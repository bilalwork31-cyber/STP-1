"""Hours of Service scheduler for a property carrying driver on the 70 hr / 8 day cycle.

All times are integer minutes on a 15 minute grid, counted from midnight of trip day 1.
"""

import math
from dataclasses import dataclass
from enum import StrEnum

SLOT = 15
AVG_SPEED_MPH = 55
DAY_START = 6 * 60
MAX_DRIVE = 11 * 60
WINDOW = 14 * 60
BREAK_AFTER = 8 * 60
BREAK = 30
RESET = 10 * 60
CYCLE = 70 * 60
RESTART = 34 * 60
FUEL_INTERVAL_MILES = 1000
# Driving minutes between fuel stops, floored so the stop lands before the 1,000 mi mark.
FUEL_INTERVAL = math.floor(FUEL_INTERVAL_MILES / AVG_SPEED_MPH * 60 / SLOT) * SLOT
FUEL_STOP = 30
PICKUP = 60
DROPOFF = 60
PRETRIP = 30


class Status(StrEnum):
    OFF_DUTY = "off_duty"
    SLEEPER = "sleeper_berth"
    DRIVING = "driving"
    ON_DUTY = "on_duty"


class StopType(StrEnum):
    START = "start"
    PICKUP = "pickup"
    DROPOFF = "dropoff"
    FUEL = "fuel"
    BREAK = "break"
    REST = "rest"
    RESTART = "restart"


class Limit(StrEnum):
    LEG_END = "leg_end"
    CYCLE = "cycle"
    DRIVE = "drive"
    WINDOW = "window"
    FUEL = "fuel"
    BREAK = "break"


REASONS = {
    StopType.START: "Pretrip inspection before departure",
    StopType.PICKUP: "1 hr on duty for loading at the shipper",
    StopType.DROPOFF: "1 hr on duty for unloading at the receiver",
    StopType.FUEL: "Fuel stop before 1,000 mi since the last fill",
    StopType.BREAK: "30 min break required after 8 hrs cumulative driving",
    StopType.RESTART: "34 hr restart: 70 hr / 8 day cycle reached",
    Limit.DRIVE: "10 hr reset: 11 hr driving limit reached",
    Limit.WINDOW: "10 hr reset: 14 hr window reached",
}

NOTES = {
    StopType.START: "Pretrip inspection",
    StopType.PICKUP: "Pickup, loading",
    StopType.DROPOFF: "Dropoff, unloading",
    StopType.FUEL: "Fuel",
    StopType.BREAK: "30 min break",
    StopType.REST: "10 hr sleeper berth",
    StopType.RESTART: "34 hr restart",
}
PRETRIP_NOTE = NOTES[StopType.START]
DRIVING_NOTE = "Driving"


@dataclass(frozen=True)
class Clocks:
    drive_left: int
    window_left: int
    break_due_in: int
    cycle_left: int


@dataclass(frozen=True)
class Event:
    status: Status
    start: int
    end: int
    mile_start: float
    mile_end: float
    note: str
    clocks: Clocks
    stop: StopType | None = None
    reason: str = ""


def ceil_to_slot(minutes: float) -> int:
    return math.ceil(round(minutes, 6) / SLOT) * SLOT


def leg_minutes(miles: float) -> int:
    return ceil_to_slot(miles / AVG_SPEED_MPH * 60)


class Driver:
    def __init__(self, cycle_used_minutes: int, start_minute: int):
        self.now = start_minute
        self.miles = 0.0
        self.drive_used = 0
        self.window_start: int | None = None
        self.since_break = 0
        self.since_fuel = 0
        self.cycle_used = cycle_used_minutes
        self.events: list[Event] = []

    def clocks(self) -> Clocks:
        window_used = 0 if self.window_start is None else self.now - self.window_start
        return Clocks(
            drive_left=max(0, MAX_DRIVE - self.drive_used),
            window_left=max(0, WINDOW - window_used),
            break_due_in=max(0, BREAK_AFTER - self.since_break),
            cycle_left=max(0, CYCLE - self.cycle_used),
        )

    def record(
        self,
        status: Status,
        minutes: int,
        note: str,
        stop: StopType | None = None,
        reason: str = "",
        miles: float = 0.0,
    ):
        self.events.append(
            Event(
                status=status,
                start=self.now,
                end=self.now + minutes,
                mile_start=self.miles,
                mile_end=self.miles + miles,
                note=note,
                clocks=self.clocks(),
                stop=stop,
                reason=reason,
            )
        )
        self._advance(status, minutes, miles)

    def _advance(self, status: Status, minutes: int, miles: float):
        if status in (Status.DRIVING, Status.ON_DUTY):
            if self.window_start is None:
                self.window_start = self.now
            self.cycle_used += minutes
        if status == Status.DRIVING:
            self.drive_used += minutes
            self.since_break += minutes
            self.since_fuel += minutes
        elif minutes >= BREAK:
            self.since_break = 0
        self.now += minutes
        self.miles += miles

    def work(self, stop: StopType | None, minutes: int, note: str, reason: str = ""):
        if CYCLE - self.cycle_used < minutes:
            self.restart()
        self.record(Status.ON_DUTY, minutes, note, stop, reason)

    def pretrip(self):
        self.work(None, PRETRIP, PRETRIP_NOTE)

    def rest(self, limit: Limit):
        self.record(Status.SLEEPER, RESET, NOTES[StopType.REST], StopType.REST, REASONS[limit])
        self.drive_used = 0
        self.window_start = None
        self.pretrip()

    def restart(self):
        self.record(
            Status.OFF_DUTY,
            RESTART,
            NOTES[StopType.RESTART],
            StopType.RESTART,
            REASONS[StopType.RESTART],
        )
        self.drive_used = 0
        self.window_start = None
        self.cycle_used = 0

    def next_limit(self, remaining: int) -> tuple[int, Limit]:
        clocks = self.clocks()
        candidates = [
            (clocks.cycle_left, Limit.CYCLE),
            (clocks.drive_left, Limit.DRIVE),
            (clocks.window_left, Limit.WINDOW),
            (FUEL_INTERVAL - self.since_fuel, Limit.FUEL),
            (clocks.break_due_in, Limit.BREAK),
            (remaining, Limit.LEG_END),
        ]
        return min(candidates, key=lambda candidate: candidate[0])

    def resolve(self, limit: Limit):
        if limit == Limit.CYCLE:
            self.restart()
            self.pretrip()
        elif limit in (Limit.DRIVE, Limit.WINDOW):
            self.rest(limit)
        elif limit == Limit.FUEL:
            self.work(StopType.FUEL, FUEL_STOP, NOTES[StopType.FUEL], REASONS[StopType.FUEL])
            self.since_fuel = 0
        else:
            self.record(
                Status.OFF_DUTY,
                BREAK,
                NOTES[StopType.BREAK],
                StopType.BREAK,
                REASONS[StopType.BREAK],
            )

    def drive(self, miles: float):
        total = leg_minutes(miles)
        remaining = total
        while remaining > 0:
            available, limit = self.next_limit(remaining)
            if available == 0:
                self.resolve(limit)
                continue
            chunk = min(available, remaining)
            self.record(Status.DRIVING, chunk, DRIVING_NOTE, miles=miles * chunk / total)
            remaining -= chunk


def plan(leg_miles: tuple[float, float], cycle_used_minutes: int) -> list[Event]:
    """Schedule pretrip, drive to pickup, load, drive to dropoff, unload."""
    to_pickup, to_dropoff = leg_miles
    driver = Driver(cycle_used_minutes, DAY_START)
    driver.work(StopType.START, PRETRIP, PRETRIP_NOTE, REASONS[StopType.START])
    driver.drive(to_pickup)
    driver.work(StopType.PICKUP, PICKUP, NOTES[StopType.PICKUP], REASONS[StopType.PICKUP])
    driver.drive(to_dropoff)
    driver.work(StopType.DROPOFF, DROPOFF, NOTES[StopType.DROPOFF], REASONS[StopType.DROPOFF])
    return driver.events
