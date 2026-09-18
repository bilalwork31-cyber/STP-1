from django.test import SimpleTestCase

from trips.hos import (
    AVG_SPEED_MPH,
    DAY_START,
    FUEL_INTERVAL_MILES,
    SLOT,
    Status,
    StopType,
    plan,
)

RESTING = (Status.OFF_DUTY, Status.SLEEPER)


def violations(events, cycle_used):
    """Replays events against the FMCSA limits independently of the scheduler."""
    found = []
    drive = since_break = 0
    window_start = None
    rest_run = idle_run = 0
    cycle = cycle_used
    for event in events:
        length = event.end - event.start
        if event.status in RESTING:
            rest_run += length
            idle_run += length
            if rest_run >= 600:
                drive, window_start = 0, None
            if rest_run >= 2040:
                cycle = 0
            if idle_run >= 30:
                since_break = 0
            continue
        rest_run = 0
        if window_start is None:
            window_start = event.start
        cycle += length
        if event.status == Status.ON_DUTY:
            idle_run += length
            since_break = 0 if idle_run >= 30 else since_break
            continue
        idle_run = 0
        drive += length
        since_break += length
        checks = {
            "11 hr driving": drive > 660,
            "14 hr window": event.end - window_start > 840,
            "8 hr break": since_break > 480,
            "70 hr cycle": cycle > 4200,
        }
        found += [f"{rule} at minute {event.start}" for rule, broken in checks.items() if broken]
    return found


def stops(events, stop_type):
    return [event for event in events if event.stop == stop_type]


class HoursOfServiceTests(SimpleTestCase):
    def test_short_trip_needs_no_rest_or_break(self):
        events = plan((100, 150), 0)
        self.assertEqual(stops(events, StopType.REST), [])
        self.assertEqual(stops(events, StopType.BREAK), [])
        self.assertEqual(events[0].start, DAY_START)

    def test_long_trips_never_break_a_limit(self):
        for legs, cycle in [((200, 968), 750), ((180, 3100), 3720), ((0, 2500), 0)]:
            with self.subTest(legs=legs, cycle=cycle):
                self.assertEqual(violations(plan(legs, cycle), cycle), [])

    def test_driving_stops_at_11_hours_with_a_10_hour_sleeper_reset(self):
        events = plan((0, 900), 0)
        rest = stops(events, StopType.REST)[0]
        driven = sum(e.end - e.start for e in events[: events.index(rest)] if e.status == "driving")
        self.assertEqual(driven, 660)
        self.assertEqual((rest.status, rest.end - rest.start), (Status.SLEEPER, 600))
        self.assertIn("11 hr driving limit", rest.reason)

    def test_no_driving_after_the_14th_hour_across_a_sweep_of_trips(self):
        for pickup_miles in range(0, 1200, 97):
            for cycle in (0, 1800, 3900):
                events = plan((pickup_miles, 3000 - pickup_miles), cycle)
                broken = [v for v in violations(events, cycle) if v.startswith("14 hr")]
                self.assertEqual(broken, [], f"pickup at {pickup_miles} mi, cycle {cycle} min")

    def test_30_minute_break_after_8_hours_of_driving(self):
        events = plan((0, 500), 0)
        pause = stops(events, StopType.BREAK)[0]
        driven = sum(
            e.end - e.start for e in events if e.status == "driving" and e.end <= pause.start
        )
        self.assertEqual(driven, 480)
        self.assertEqual((pause.status, pause.end - pause.start), (Status.OFF_DUTY, 30))

    def test_pickup_counts_as_the_30_minute_break(self):
        events = plan((330, 200), 0)
        self.assertEqual(stops(events, StopType.BREAK), [])

    def test_exhausted_cycle_triggers_34_hour_restart(self):
        events = plan((100, 600), 4000)
        restart = stops(events, StopType.RESTART)[0]
        self.assertEqual((restart.status, restart.end - restart.start), (Status.OFF_DUTY, 2040))
        self.assertEqual(violations(events, 4000), [])

    def test_full_cycle_at_start_restarts_before_any_work(self):
        events = plan((100, 100), 4200)
        self.assertEqual(events[0].stop, StopType.RESTART)
        self.assertEqual(events[1].stop, StopType.START)
        self.assertEqual(events[1].start, DAY_START + 2040)

    def test_fuel_stop_before_every_1000_miles(self):
        events = plan((50, 2600), 0)
        fuel_miles = [event.mile_start for event in stops(events, StopType.FUEL)]
        self.assertEqual(len(fuel_miles), 2)
        previous = 0.0
        for mile in [*fuel_miles, events[-1].mile_end]:
            self.assertLessEqual(mile - previous, FUEL_INTERVAL_MILES)
            previous = mile

    def test_pickup_and_dropoff_take_one_hour_on_duty(self):
        events = plan((200, 300), 0)
        for stop_type in (StopType.PICKUP, StopType.DROPOFF):
            (event,) = stops(events, stop_type)
            self.assertEqual((event.status, event.end - event.start), (Status.ON_DUTY, 60))
        self.assertEqual(events[-1].stop, StopType.DROPOFF)

    def test_every_event_sits_on_the_15_minute_grid(self):
        for event in plan((123.4, 2345.6), 1234 // SLOT * SLOT):
            self.assertEqual(event.start % SLOT, 0)
            self.assertEqual(event.end % SLOT, 0)
            self.assertGreater(event.end, event.start)

    def test_driving_time_matches_average_speed(self):
        events = plan((110, 0), 0)
        driving = [event for event in events if event.status == Status.DRIVING]
        self.assertEqual(sum(e.end - e.start for e in driving), 110 / AVG_SPEED_MPH * 60)
        self.assertAlmostEqual(driving[-1].mile_end, 110)

    def test_cross_country_trip_with_full_cycle_terminates(self):
        events = plan((0, 3000), 4200)
        self.assertEqual(events[-1].stop, StopType.DROPOFF)
        self.assertAlmostEqual(events[-1].mile_start, 3000)
        self.assertEqual(violations(events, 4200), [])
