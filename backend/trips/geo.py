import bisect
import math

EARTH_RADIUS_MILES = 3958.8
MAX_ROUTE_POINTS = 1500

LatLng = tuple[float, float]


def haversine_miles(a: LatLng, b: LatLng) -> float:
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(h))


class Polyline:
    """Maps route mileage to coordinates, scaled so the last point sits at the routed distance."""

    def __init__(self, points: list[LatLng], total_miles: float):
        self.points = points
        cumulative = [0.0]
        for a, b in zip(points, points[1:], strict=False):
            cumulative.append(cumulative[-1] + haversine_miles(a, b))
        scale = total_miles / cumulative[-1] if cumulative[-1] else 0.0
        self.miles = [distance * scale for distance in cumulative]

    def point_at(self, mile: float) -> LatLng:
        index = bisect.bisect_left(self.miles, mile)
        if index == 0:
            return self.points[0]
        if index >= len(self.points):
            return self.points[-1]
        before, after = self.miles[index - 1], self.miles[index]
        t = (mile - before) / (after - before) if after > before else 0.0
        (lat1, lng1), (lat2, lng2) = self.points[index - 1], self.points[index]
        return (lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t)


def downsample(points: list[LatLng], limit: int = MAX_ROUTE_POINTS) -> list[LatLng]:
    if len(points) <= limit:
        return points
    step = math.ceil(len(points) / (limit - 1))
    sampled = points[::step]
    return sampled if sampled[-1] == points[-1] else [*sampled, points[-1]]
