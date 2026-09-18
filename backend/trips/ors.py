"""OpenRouteService client: geocoding and truck routing."""

import json
import threading
from dataclasses import dataclass
from http.client import HTTPException, HTTPSConnection
from urllib.parse import urlencode

from django.conf import settings

from trips.geo import LatLng

HOST = "api.openrouteservice.org"
TIMEOUT_SECONDS = 25
COUNTRY = "US"
COUNTRY_SUFFIX = ", USA"
SUGGESTION_COUNT = 6
SUGGESTION_LAYERS = "locality,county,region,address,venue"
TRUCK_PROFILE = "driving-hgv"
ACCEPT = "application/json, application/geo+json"
NOT_FOUND = 404
DISTANCE_LIMIT_CODE = 2004
ERROR_STATUS = 400


class UpstreamError(Exception):
    def __init__(self, status: int | None, code: int | None, detail: str):
        super().__init__(detail)
        self.status = status
        self.code = code


class NoRouteError(Exception):
    pass


@dataclass(frozen=True)
class Place:
    label: str
    lat: float
    lng: float


@dataclass(frozen=True)
class Step:
    instruction: str
    miles: float


@dataclass(frozen=True)
class Route:
    points: list[LatLng]
    leg_miles: tuple[float, float]
    leg_steps: tuple[list[Step], list[Step]]


_local = threading.local()


def _connection() -> HTTPSConnection:
    """One keep alive connection per thread, so each request skips the TLS handshake."""
    if getattr(_local, "connection", None) is None:
        _local.connection = HTTPSConnection(HOST, timeout=TIMEOUT_SECONDS)
    return _local.connection


def _drop_connection():
    _local.connection.close()
    _local.connection = None


def _request(method: str, target: str, data: bytes | None, headers: dict) -> tuple[int, bytes]:
    connection = _connection()
    try:
        connection.request(method, target, body=data, headers=headers)
        response = connection.getresponse()
        return response.status, response.read()
    except (OSError, HTTPException):
        _drop_connection()
        raise


def _exchange(method: str, target: str, data: bytes | None, headers: dict) -> tuple[int, bytes]:
    try:
        try:
            return _request(method, target, data, headers)
        except (ConnectionResetError, BrokenPipeError):
            # The server closed an idle keep alive socket; reconnect once.
            return _request(method, target, data, headers)
    except (OSError, HTTPException) as error:
        raise UpstreamError(None, None, str(error) or type(error).__name__) from error


def _error_detail(status: int, payload: bytes) -> UpstreamError:
    try:
        detail = json.loads(payload).get("error", {})
    except (ValueError, AttributeError):
        return UpstreamError(status, None, payload[:200].decode(errors="replace"))
    if isinstance(detail, dict):
        return UpstreamError(status, detail.get("code"), detail.get("message", str(detail)))
    return UpstreamError(status, None, str(detail))


def _call(path: str, params: dict | None = None, body: dict | None = None) -> dict:
    target = path + (f"?{urlencode(params)}" if params else "")
    headers = {"Authorization": settings.ORS_API_KEY, "Accept": ACCEPT}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    status, payload = _exchange("POST" if data else "GET", target, data, headers)
    if status >= ERROR_STATUS:
        raise _error_detail(status, payload)
    return json.loads(payload)


def _place(feature: dict) -> Place:
    lng, lat = feature["geometry"]["coordinates"]
    return Place(feature["properties"]["label"].removesuffix(COUNTRY_SUFFIX), lat, lng)


def suggest(text: str) -> list[Place]:
    params = {
        "text": text,
        "boundary.country": COUNTRY,
        "layers": SUGGESTION_LAYERS,
        "size": SUGGESTION_COUNT,
    }
    return [_place(feature) for feature in _call("/geocode/autocomplete", params)["features"]]


def geocode(text: str) -> Place | None:
    params = {"text": text, "boundary.country": COUNTRY, "size": 1}
    features = _call("/geocode/search", params)["features"]
    return _place(features[0]) if features else None


def route(stops: list[Place]) -> Route:
    body = {"coordinates": [[place.lng, place.lat] for place in stops], "units": "mi"}
    try:
        payload = _call(f"/v2/directions/{TRUCK_PROFILE}/geojson", body=body)
    except UpstreamError as error:
        if error.status == NOT_FOUND:
            raise NoRouteError("No truck route connects these locations.") from error
        if error.code == DISTANCE_LIMIT_CODE:
            raise NoRouteError("This trip is longer than the routing service allows.") from error
        raise
    feature = payload["features"][0]
    to_pickup, to_dropoff = feature["properties"]["segments"]
    return Route(
        points=[(lat, lng) for lng, lat in feature["geometry"]["coordinates"]],
        leg_miles=(to_pickup["distance"], to_dropoff["distance"]),
        leg_steps=(_steps(to_pickup), _steps(to_dropoff)),
    )


def _steps(segment: dict) -> list[Step]:
    return [Step(step["instruction"], step["distance"]) for step in segment["steps"]]
