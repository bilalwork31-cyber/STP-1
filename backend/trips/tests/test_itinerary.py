from datetime import date

from django.test import SimpleTestCase

from trips.geo import Polyline
from trips.hos import plan
from trips.itinerary import DAY, Itinerary, Leg, mile_key, waypoints

DAY_ONE = date(2026, 9, 18)


def build(legs=(200.0, 1400.0), cycle_minutes=750):
    events = plan(legs, cycle_minutes)
    polyline = Polyline([(44.5, -88.0), (41.9, -87.6), (32.8, -96.8)], sum(legs))
    names = {mile: f"Town {mile}" for mile in waypoints(events, polyline)}
    trip_legs = [Leg("Origin", "Shipper", legs[0], []), Leg("Shipper", "Receiver", legs[1], [])]
    return events, Itinerary(events, polyline, names, cycle_minutes, DAY_ONE).build(trip_legs)


def minutes(stamp: str) -> int:
    day, clock = stamp.split("T")
    hours, mins = map(int, clock.split(":"))
    return (int(day[-2:]) - DAY_ONE.day) * DAY + hours * 60 + mins


class DailyLogTests(SimpleTestCase):
    def test_each_log_covers_24_hours_without_gaps(self):
        _, trip = build()
        self.assertGreater(len(trip["logs"]), 1)
        for log in trip["logs"]:
            segments = log["segments"]
            self.assertEqual(segments[0]["start_minute"], 0)
            self.assertEqual(segments[-1]["end_minute"], DAY)
            for before, after in zip(segments, segments[1:], strict=False):
                self.assertEqual(before["end_minute"], after["start_minute"])
                self.assertNotEqual(before["status"], after["status"])
            self.assertEqual(sum(log["totals"].values()), 24)

    def test_day_one_is_off_duty_until_the_06_00_start(self):
        _, trip = build()
        first = trip["logs"][0]
        self.assertEqual(first["date"], "2026-09-18")
        self.assertEqual(
            first["segments"][0], {"status": "off_duty", "start_minute": 0, "end_minute": 360}
        )
        self.assertEqual(
            first["remarks"][0],
            {"minute": 360, "location": "Town 0.0", "note": "Pretrip inspection"},
        )

    def test_a_remark_marks_every_change_of_duty_status(self):
        _, trip = build()
        for log in trip["logs"]:
            changes = {segment["start_minute"] for segment in log["segments"][1:]}
            self.assertLessEqual(changes, {remark["minute"] for remark in log["remarks"]})

    def test_daily_miles_add_up_to_the_trip(self):
        _, trip = build()
        self.assertAlmostEqual(sum(log["miles_driving"] for log in trip["logs"]), 1600, delta=0.2)

    def test_recap_tracks_the_70_hour_cycle(self):
        _, trip = build(cycle_minutes=750)
        cycle = 12.5
        for log in trip["logs"]:
            cycle += log["recap"]["on_duty_today"]
            self.assertAlmostEqual(log["recap"]["total_last_8_days"], cycle)
            self.assertAlmostEqual(log["recap"]["available_tomorrow"], 70 - cycle)
        self.assertAlmostEqual(trip["summary"]["cycle_used_end"], cycle)

    def test_restart_resets_the_recap_cycle(self):
        _, trip = build(legs=(100.0, 600.0), cycle_minutes=4000)
        self.assertLess(trip["summary"]["cycle_used_end"], 20)
        self.assertIn("restart", [stop["type"] for stop in trip["stops"]])


class StopTests(SimpleTestCase):
    def test_rest_stop_departs_after_the_next_pretrip(self):
        _, trip = build()
        rest = next(stop for stop in trip["stops"] if stop["type"] == "rest")
        self.assertEqual(rest["duration_hours"], 10.5)
        self.assertEqual(minutes(rest["departure"]) - minutes(rest["arrival"]), 630)

    def test_stops_follow_the_trip_order_with_live_clocks(self):
        events, trip = build()
        types = [stop["type"] for stop in trip["stops"]]
        self.assertEqual((types[0], types[-1]), ("start", "dropoff"))
        self.assertEqual(
            trip["stops"][0]["clocks"],
            {"drive_left": 11, "window_left": 14, "break_due_in": 8, "cycle_left": 57.5},
        )
        pickup = next(stop for stop in trip["stops"] if stop["type"] == "pickup")
        self.assertEqual(pickup["name"], f"Town {mile_key(200.0)}")
        self.assertEqual(len(trip["timeline"]), len(events))
        self.assertEqual(trip["summary"]["trip_end"], trip["timeline"][-1]["end"])
