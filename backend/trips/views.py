import json
import logging
import math
from dataclasses import asdict
from datetime import date

from django.core.cache import cache
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from trips import hos, ors
from trips.geo import Polyline
from trips.itinerary import Itinerary, Leg, mile_key, waypoints

LOCATION_FIELDS = ("current_location", "pickup_location", "dropoff_location")
CYCLE_FIELD = "cycle_used_hours"
MAX_LOCATION_LENGTH = 200
MIN_QUERY_LENGTH = 3
MAX_CYCLE_HOURS = 70
CYCLE_STEP_HOURS = 0.25
RATE_WINDOW_SECONDS = 60
TRIP_RATE_LIMIT = 20
PLACES_RATE_LIMIT = 120
UPSTREAM_MESSAGE = "The routing service did not respond. Try again in a moment."

logger = logging.getLogger(__name__)


class RequestError(Exception):
    def __init__(self, status: int, message: str, field: str | None = None):
        super().__init__(message)
        self.status = status
        self.field = field


def error_response(status: int, message: str, field: str | None = None) -> JsonResponse:
    return JsonResponse({"error": {"field": field, "message": message}}, status=status)


def method_not_allowed(allowed: str) -> JsonResponse:
    response = error_response(405, f"This endpoint only accepts {allowed} requests.")
    response["Allow"] = allowed
    return response


def rate_limited(request: HttpRequest, scope: str, limit: int) -> bool:
    client = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", ""))
    key = f"rate:{scope}:{client.split(',')[0].strip()}"
    cache.add(key, 0, RATE_WINDOW_SECONDS)
    return cache.incr(key) > limit


def parse_trip(body: bytes) -> tuple[list[str], float]:
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeDecodeError) as error:
        raise RequestError(400, "Request body must be valid JSON.") from error
    if not isinstance(payload, dict):
        raise RequestError(400, "Request body must be a JSON object.")
    locations = [parse_location(payload, field) for field in LOCATION_FIELDS]
    return locations, parse_cycle(payload.get(CYCLE_FIELD))


def parse_location(payload: dict, field: str) -> str:
    value = payload.get(field)
    label = field.replace("_", " ").capitalize()
    if not isinstance(value, str) or not value.strip():
        raise RequestError(422, f"{label} is required.", field)
    if len(value.strip()) > MAX_LOCATION_LENGTH:
        raise RequestError(
            422, f"{label} must be {MAX_LOCATION_LENGTH} characters or fewer.", field
        )
    return value.strip()


def parse_cycle(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        raise RequestError(422, "Cycle used must be a number of hours.", CYCLE_FIELD)
    if not 0 <= value <= MAX_CYCLE_HOURS:
        raise RequestError(
            422, f"Cycle used must be between 0 and {MAX_CYCLE_HOURS} hours.", CYCLE_FIELD
        )
    if (value / CYCLE_STEP_HOURS) % 1:
        raise RequestError(422, "Cycle used must be in 15 minute steps, like 12.25.", CYCLE_FIELD)
    return float(value)


def geocode_all(texts: list[str]) -> list[ors.Place]:
    places = []
    for field, text in zip(LOCATION_FIELDS, texts, strict=True):
        place = ors.geocode(text)
        if place is None:
            message = f"Could not find '{text}' in the US. Check the spelling or pick a suggestion."
            raise RequestError(422, message, field)
        places.append(place)
    return places


def plan_trip(texts: list[str], cycle_hours: float) -> dict:
    current, pickup, dropoff = geocode_all(texts)
    try:
        route = ors.route([current, pickup, dropoff])
    except ors.NoRouteError as error:
        raise RequestError(422, str(error)) from error
    cycle_minutes = round(cycle_hours * 60)
    events = hos.plan(route.leg_miles, cycle_minutes)
    polyline = Polyline(route.points, sum(route.leg_miles))
    anchors = {
        mile_key(0): current.label,
        mile_key(route.leg_miles[0]): pickup.label,
        mile_key(sum(route.leg_miles)): dropoff.label,
    }
    unnamed = {
        mile: point for mile, point in waypoints(events, polyline).items() if mile not in anchors
    }
    towns = ors.town_names(list(unnamed.values()))
    names = anchors | {mile: towns[point] for mile, point in unnamed.items()}
    legs = [
        Leg(current.label, pickup.label, route.leg_miles[0], route.leg_steps[0]),
        Leg(pickup.label, dropoff.label, route.leg_miles[1], route.leg_steps[1]),
    ]
    return Itinerary(events, polyline, names, cycle_minutes, date.today()).build(legs)


@csrf_exempt
def trip(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return method_not_allowed("POST")
    if rate_limited(request, "trip", TRIP_RATE_LIMIT):
        return error_response(429, "Too many trip requests. Wait a minute and try again.")
    try:
        texts, cycle_hours = parse_trip(request.body)
        return JsonResponse(plan_trip(texts, cycle_hours))
    except RequestError as error:
        return error_response(error.status, str(error), error.field)
    except ors.UpstreamError as error:
        logger.warning("Trip planning failed upstream: %s %s %s", error.status, error.code, error)
        return error_response(502, UPSTREAM_MESSAGE)


def places(request: HttpRequest) -> JsonResponse:
    if request.method != "GET":
        return method_not_allowed("GET")
    if rate_limited(request, "places", PLACES_RATE_LIMIT):
        return error_response(429, "Too many searches. Wait a minute and try again.")
    query = request.GET.get("q", "").strip()
    if len(query) < MIN_QUERY_LENGTH:
        return error_response(400, f"Type at least {MIN_QUERY_LENGTH} characters to search.", "q")
    if len(query) > MAX_LOCATION_LENGTH:
        return error_response(
            400, f"Search must be {MAX_LOCATION_LENGTH} characters or fewer.", "q"
        )
    try:
        suggestions = ors.suggest(query)
    except ors.UpstreamError as error:
        logger.warning("Place search failed upstream: %s %s %s", error.status, error.code, error)
        return error_response(502, UPSTREAM_MESSAGE)
    return JsonResponse([asdict(place) for place in suggestions], safe=False)
