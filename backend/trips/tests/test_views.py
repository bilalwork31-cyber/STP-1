import json
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase

from trips import ors

PLACES = {
    "Green Bay, WI": ors.Place("Green Bay, WI", 44.51, -88.01),
    "Chicago, IL": ors.Place("Chicago, IL", 41.88, -87.63),
    "Dallas, TX": ors.Place("Dallas, TX", 32.78, -96.80),
}
ROUTE = ors.Route(
    points=[(44.51, -88.01), (41.88, -87.63), (32.78, -96.80)],
    leg_miles=(204.9, 968.1),
    leg_steps=(
        [ors.Step("Keep left onto I 94", 34.07), ors.Step("Arrive at Chicago", 0.0)],
        [ors.Step("Keep right onto I 57", 200.81)],
    ),
)
VALID = {
    "current_location": "Green Bay, WI",
    "pickup_location": "Chicago, IL",
    "dropoff_location": "Dallas, TX",
    "cycle_used_hours": 12.5,
}


def fake_town_names(points):
    return {point: f"Town at {point[0]:.2f}" for point in points}


class TripEndpointTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def post(self, body):
        payload = body if isinstance(body, str) else json.dumps(body)
        return self.client.post("/api/trip", payload, content_type="application/json")

    def assert_error(self, response, status, field):
        self.assertEqual(response.status_code, status)
        self.assertEqual(response.json()["error"]["field"], field)
        self.assertTrue(response.json()["error"]["message"])

    @patch("trips.ors.town_names", side_effect=fake_town_names)
    @patch("trips.ors.route", return_value=ROUTE)
    @patch("trips.ors.geocode", side_effect=PLACES.get)
    def test_plans_a_compliant_trip(self, *_):
        response = self.post(VALID)
        self.assertEqual(response.status_code, 200)
        trip = response.json()
        self.assertEqual(set(trip), {"summary", "route", "stops", "timeline", "logs"})
        self.assertEqual(trip["summary"]["total_miles"], 1173.0)
        self.assertEqual(trip["route"]["legs"][0]["from"], "Green Bay, WI")
        self.assertEqual(trip["stops"][-1]["name"], "Dallas, TX")
        self.assertEqual({"note", "clocks"} - set(trip["timeline"][0]), set())
        for log in trip["logs"]:
            self.assertEqual(sum(log["totals"].values()), 24)

    @patch("trips.ors.town_names", side_effect=fake_town_names)
    @patch("trips.ors.route", return_value=ROUTE)
    @patch("trips.ors.geocode", side_effect=PLACES.get)
    def test_returns_turn_by_turn_directions_per_leg(self, *_):
        legs = self.post(VALID).json()["route"]["legs"]
        self.assertEqual(
            legs[0]["steps"],
            [
                {"instruction": "Keep left onto I 94", "miles": 34.1},
                {"instruction": "Arrive at Chicago", "miles": 0.0},
            ],
        )
        self.assertEqual(
            legs[1]["steps"], [{"instruction": "Keep right onto I 57", "miles": 200.8}]
        )

    def test_rejects_malformed_json(self):
        self.assert_error(self.post("{not json"), 400, None)

    def test_rejects_missing_and_blank_locations(self):
        self.assert_error(self.post({**VALID, "pickup_location": "  "}), 422, "pickup_location")
        body = {key: value for key, value in VALID.items() if key != "dropoff_location"}
        self.assert_error(self.post(body), 422, "dropoff_location")

    def test_rejects_invalid_cycle_hours(self):
        for value in (-1, 70.5, True, "12", 12.3, None):
            with self.subTest(value=value):
                self.assert_error(
                    self.post({**VALID, "cycle_used_hours": value}), 422, "cycle_used_hours"
                )

    @patch("trips.ors.geocode", side_effect=lambda text: PLACES.get(text))
    def test_unknown_location_names_the_field(self, _):
        response = self.post({**VALID, "pickup_location": "Chicagoo"})
        self.assert_error(response, 422, "pickup_location")
        self.assertIn("Chicagoo", response.json()["error"]["message"])

    @patch(
        "trips.ors.route", side_effect=ors.NoRouteError("No truck route connects these locations.")
    )
    @patch("trips.ors.geocode", side_effect=PLACES.get)
    def test_unroutable_trip_is_422(self, *_):
        self.assert_error(self.post(VALID), 422, None)

    @patch("trips.ors.geocode", side_effect=ors.UpstreamError(None, None, "timed out"))
    def test_routing_outage_is_502(self, _):
        self.assert_error(self.post(VALID), 502, None)

    @patch("trips.ors.geocode", side_effect=ors.UpstreamError(403, None, "Quota exceeded"))
    def test_routing_quota_is_503_with_its_own_message(self, _):
        response = self.post(VALID)
        self.assert_error(response, 503, None)
        self.assertIn("quota", response.json()["error"]["message"])

    def test_wrong_method_is_405(self):
        response = self.client.get("/api/trip")
        self.assert_error(response, 405, None)
        self.assertEqual(response["Allow"], "POST")


class PlacesEndpointTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_short_query_is_400(self):
        response = self.client.get("/api/places", {"q": "ch"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["field"], "q")

    @patch("trips.ors.suggest", return_value=[PLACES["Chicago, IL"]])
    def test_returns_suggestions(self, _):
        response = self.client.get("/api/places", {"q": "Chicag"})
        self.assertEqual(response.json(), [{"label": "Chicago, IL", "lat": 41.88, "lng": -87.63}])

    def test_rate_limit_is_429(self):
        statuses = [self.client.get("/api/places", {"q": "x"}).status_code for _ in range(121)]
        self.assertEqual(statuses[-1], 429)
        self.assertEqual(set(statuses[:-1]), {400})
