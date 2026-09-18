"""US towns from GeoNames cities1000 (CC BY 4.0), looked up locally to spare the geocoding quota."""

import math
import re
from dataclasses import dataclass
from functools import cache
from itertools import islice
from pathlib import Path

from trips.geo import LatLng, haversine_miles
from trips.ors import Place

DATA_FILE = Path(__file__).with_name("us_towns.tsv")
SUGGESTION_COUNT = 6
MAX_SEARCH_RING = 6
CITY_SUFFIX = " city"
COUNTRY_SUFFIX = re.compile(r",?\s*(usa|us|united states)\s*$", re.IGNORECASE)


@dataclass(frozen=True)
class Town:
    name: str
    state: str
    lat: float
    lng: float

    @property
    def place(self) -> Place:
        return Place(f"{self.name}, {self.state}", self.lat, self.lng)


@cache
def _towns() -> list[Town]:
    """Rows are sorted by population, largest first."""
    rows = (line.split("\t") for line in DATA_FILE.read_text(encoding="utf-8").splitlines())
    return [Town(name, state, float(lat), float(lng)) for name, state, lat, lng, _ in rows]


@cache
def _by_name() -> dict[tuple[str, str], Town]:
    index: dict[tuple[str, str], Town] = {}
    for town in _towns():
        name = town.name.lower()
        index.setdefault((name, town.state), town)
        index.setdefault((name.removesuffix(CITY_SUFFIX), town.state), town)
    return index


@cache
def _grid() -> dict[tuple[int, int], list[Town]]:
    grid: dict[tuple[int, int], list[Town]] = {}
    for town in _towns():
        grid.setdefault((math.floor(town.lat), math.floor(town.lng)), []).append(town)
    return grid


def _split(text: str) -> tuple[str, str]:
    name, _, state = COUNTRY_SUFFIX.sub("", text.strip()).rpartition(",")
    if not name:
        return state.strip().lower(), ""
    return name.strip().lower(), state.strip().upper()


def find(text: str) -> Place | None:
    name, state = _split(text)
    town = _by_name().get((name, state))
    return town.place if town else None


def suggest(query: str) -> list[Place]:
    name, state = _split(query)
    matches = (t for t in _towns() if t.name.lower().startswith(name) and t.state.startswith(state))
    return [town.place for town in islice(matches, SUGGESTION_COUNT)]


def nearest(point: LatLng) -> str:
    lat, lng = math.floor(point[0]), math.floor(point[1])
    for ring in range(1, MAX_SEARCH_RING + 1):
        nearby = [
            town
            for d_lat in range(-ring, ring + 1)
            for d_lng in range(-ring, ring + 1)
            for town in _grid().get((lat + d_lat, lng + d_lng), [])
        ]
        if nearby:
            town = min(nearby, key=lambda t: haversine_miles(point, (t.lat, t.lng)))
            return town.place.label
    return f"{point[0]:.3f}, {point[1]:.3f}"
