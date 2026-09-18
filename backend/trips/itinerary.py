"""Turns scheduled duty events into the trip response: stops, timeline and daily log sheets."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from trips.geo import LatLng, Polyline, downsample
from trips.hos import CYCLE, Clocks, Event, Status, StopType, leg_minutes
from trips.ors import Step

DAY = 24 * 60
MINUTES_PER_HOUR = 60
ISO_MINUTE = "%Y-%m-%dT%H:%M"
OFF_DUTY_NOTE = "Off duty"
ON_DUTY_STATUSES = (Status.DRIVING, Status.ON_DUTY)


def mile_key(mile: float) -> float:
    return round(mile, 3)


def hours(minutes: float) -> float:
    return round(minutes / MINUTES_PER_HOUR, 2)


def waypoints(events: list[Event], polyline: Polyline) -> dict[float, LatLng]:
    miles = [event.mile_start for event in events] + [events[-1].mile_end]
    return {mile_key(mile): polyline.point_at(mile) for mile in miles}


def cycle_used_at(events: list[Event], initial: int, minute: int) -> int:
    used = initial
    for event in events:
        if event.start >= minute:
            break
        if event.stop == StopType.RESTART:
            used = 0 if event.end <= minute else used
        elif event.status in ON_DUTY_STATUSES:
            used += min(event.end, minute) - event.start
    return used


def overlap(start: int, end: int, lo: int, hi: int) -> int:
    return max(0, min(end, hi) - max(start, lo))


def clocks_in_hours(clocks: Clocks) -> dict:
    return {
        "drive_left": hours(clocks.drive_left),
        "window_left": hours(clocks.window_left),
        "break_due_in": hours(clocks.break_due_in),
        "cycle_left": hours(clocks.cycle_left),
    }


@dataclass(frozen=True)
class Leg:
    origin: str
    destination: str
    miles: float
    steps: list[Step]


class Itinerary:
    def __init__(
        self,
        events: list[Event],
        polyline: Polyline,
        names: dict[float, str],
        cycle_used_minutes: int,
        day_one: date,
    ):
        self.events = events
        self.polyline = polyline
        self.points = waypoints(events, polyline)
        self.names = names
        self.cycle_used_minutes = cycle_used_minutes
        self.midnight = datetime.combine(day_one, time())

    def iso(self, minute: int) -> str:
        return (self.midnight + timedelta(minutes=minute)).strftime(ISO_MINUTE)

    def name_at(self, mile: float) -> str:
        return self.names[mile_key(mile)]

    def build(self, legs: list[Leg]) -> dict:
        logs = self.logs()
        return {
            "summary": self.summary(legs, len(logs)),
            "route": {
                "coordinates": [list(point) for point in downsample(self.polyline.points)],
                "legs": [
                    {
                        "from": leg.origin,
                        "to": leg.destination,
                        "miles": round(leg.miles, 1),
                        "driving_hours": hours(leg_minutes(leg.miles)),
                        "steps": [
                            {
                                "instruction": step.instruction,
                                "miles": round(step.miles, 1),
                                **(
                                    {"lat": round(step.lat, 6), "lng": round(step.lng, 6)}
                                    if step.lat is not None and step.lng is not None
                                    else {}
                                ),
                            }
                            for step in leg.steps
                        ],
                    }
                    for leg in legs
                ],
            },
            "stops": self.stops(),
            "timeline": [self.timeline_entry(event) for event in self.events],
            "logs": logs,
        }

    def summary(self, legs: list[Leg], days: int) -> dict:
        first, last = self.events[0], self.events[-1]
        driving = sum(e.end - e.start for e in self.events if e.status == Status.DRIVING)
        on_duty = sum(e.end - e.start for e in self.events if e.status in ON_DUTY_STATUSES)
        cycle_end = cycle_used_at(self.events, self.cycle_used_minutes, last.end)
        return {
            "total_miles": round(sum(leg.miles for leg in legs), 1),
            "driving_hours": hours(driving),
            "on_duty_hours": hours(on_duty),
            "trip_start": self.iso(first.start),
            "trip_end": self.iso(last.end),
            "days": days,
            "cycle_used_start": hours(self.cycle_used_minutes),
            "cycle_used_end": hours(cycle_end),
        }

    def stops(self) -> list[dict]:
        stops = []
        for index, event in enumerate(self.events):
            if event.stop is None:
                continue
            departure = event.end
            for follower in self.events[index + 1 :]:
                if follower.stop is not None or follower.status == Status.DRIVING:
                    break
                departure = follower.end
            lat, lng = self.points[mile_key(event.mile_start)]
            stops.append(
                {
                    "type": event.stop.value,
                    "name": self.name_at(event.mile_start),
                    "lat": lat,
                    "lng": lng,
                    "arrival": self.iso(event.start),
                    "departure": self.iso(departure),
                    "duration_hours": hours(departure - event.start),
                    "mile_marker": round(event.mile_start),
                    "reason": event.reason,
                    "clocks": clocks_in_hours(event.clocks),
                }
            )
        return stops

    def timeline_entry(self, event: Event) -> dict:
        lat, lng = self.points[mile_key(event.mile_start)]
        return {
            "status": event.status.value,
            "start": self.iso(event.start),
            "end": self.iso(event.end),
            "lat": lat,
            "lng": lng,
            "note": event.note,
            "clocks": clocks_in_hours(event.clocks),
        }

    def logs(self) -> list[dict]:
        last_day = (self.events[-1].end - 1) // DAY
        return [DailyLog(self, day * DAY).as_dict() for day in range(last_day + 1)]


class DailyLog:
    def __init__(self, itinerary: Itinerary, lo: int):
        self.itinerary = itinerary
        self.events = itinerary.events
        self.lo = lo
        self.hi = lo + DAY

    def spans(self) -> list[tuple[Status, int, int]]:
        first, last = self.events[0], self.events[-1]
        return [
            (Status.OFF_DUTY, 0, first.start),
            *((event.status, event.start, event.end) for event in self.events),
            (Status.OFF_DUTY, last.end, max(last.end, self.hi)),
        ]

    def segments(self) -> list[dict]:
        segments: list[dict] = []
        for status, start, end in self.spans():
            if overlap(start, end, self.lo, self.hi) == 0:
                continue
            start_minute, end_minute = max(start, self.lo) - self.lo, min(end, self.hi) - self.lo
            if segments and segments[-1]["status"] == status.value:
                segments[-1]["end_minute"] = end_minute
            else:
                segments.append(
                    {"status": status.value, "start_minute": start_minute, "end_minute": end_minute}
                )
        return segments

    def remarks(self) -> list[dict]:
        remarks = []
        previous_status = None
        for event in self.events:
            changed = event.status != previous_status or event.stop is not None
            previous_status = event.status
            if changed and self.lo <= event.start < self.hi:
                remarks.append(self.remark(event.start, event.mile_start, event.note))
        last = self.events[-1]
        if self.lo <= last.end < self.hi:
            remarks.append(self.remark(last.end, last.mile_end, OFF_DUTY_NOTE))
        return remarks

    def remark(self, minute: int, mile: float, note: str) -> dict:
        return {"minute": minute - self.lo, "location": self.itinerary.name_at(mile), "note": note}

    def place_at(self, minute: int) -> str:
        for event in self.events:
            if event.start <= minute < event.end:
                mile = event.mile_end if event.status == Status.DRIVING else event.mile_start
                return self.itinerary.name_at(mile)
        mile = 0.0 if minute < self.events[0].start else self.events[-1].mile_end
        return self.itinerary.name_at(mile)

    def minutes_by_status(self, segments: list[dict]) -> dict[str, int]:
        totals = {status.value: 0 for status in Status}
        for segment in segments:
            totals[segment["status"]] += segment["end_minute"] - segment["start_minute"]
        return totals

    def miles_driving(self) -> float:
        miles = 0.0
        for event in self.events:
            if event.status == Status.DRIVING:
                share = overlap(event.start, event.end, self.lo, self.hi) / (
                    event.end - event.start
                )
                miles += share * (event.mile_end - event.mile_start)
        return round(miles, 1)

    def as_dict(self) -> dict:
        segments = self.segments()
        totals = self.minutes_by_status(segments)
        on_duty_today = totals[Status.DRIVING] + totals[Status.ON_DUTY]
        cycle = cycle_used_at(self.events, self.itinerary.cycle_used_minutes, self.hi)
        return {
            "date": (self.itinerary.midnight + timedelta(minutes=self.lo)).date().isoformat(),
            "from": self.place_at(self.lo),
            "to": self.place_at(self.hi - 1),
            "miles_driving": self.miles_driving(),
            "segments": segments,
            "remarks": self.remarks(),
            "totals": {status: hours(minutes) for status, minutes in totals.items()},
            "recap": {
                "on_duty_today": hours(on_duty_today),
                "total_last_8_days": hours(cycle),
                "available_tomorrow": hours(max(0, CYCLE - cycle)),
            },
        }
