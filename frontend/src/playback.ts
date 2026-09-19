import { toMs } from './format';
import type { Clocks, TimelineEntry } from './types';

const MINUTE_MS = 60_000;
const RESET_MINUTES = 600;

export interface Moment {
  entry: TimelineEntry;
  clocks: Clocks;
}

export function entryAt(timeline: TimelineEntry[], ms: number): number {
  const index = timeline.findIndex((entry) => ms < toMs(entry.end));
  return index === -1 ? timeline.length - 1 : index;
}

export function momentAt(timeline: TimelineEntry[], ms: number): Moment {
  const entry = timeline[entryAt(timeline, ms)];
  const elapsed = Math.max(0, (ms - toMs(entry.start)) / MINUTE_MS) / 60;
  const length = (toMs(entry.end) - toMs(entry.start)) / MINUTE_MS;
  const driving = entry.status === 'driving';
  const working = driving || entry.status === 'on_duty';
  const isReset = length >= RESET_MINUTES;
  const drain = (value: number, applies: boolean) => Math.max(0, applies ? value - elapsed : value);
  return {
    entry,
    clocks: {
      drive_left: drain(entry.clocks.drive_left, driving),
      break_due_in: drain(entry.clocks.break_due_in, driving),
      window_left: drain(entry.clocks.window_left, !isReset),
      cycle_left: drain(entry.clocks.cycle_left, working),
    },
  };
}

function nearestIndex(route: [number, number][], lat: number, lng: number, startIndex = 0): number {
  let best = startIndex;
  let bestDistance = Infinity;
  for (let i = startIndex; i < route.length; i++) {
    const [rLat, rLng] = route[i];
    const distance = (rLat - lat) ** 2 + (rLng - lng) ** 2;
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  }
  return best;
}

export function routeAnchors(route: [number, number][], timeline: TimelineEntry[]): number[] {
  let lastIdx = 0;
  const anchors = timeline.map((entry) => {
    lastIdx = nearestIndex(route, entry.lat, entry.lng, lastIdx);
    return lastIdx;
  });
  return [...anchors, Math.max(lastIdx, route.length - 1)];
}

export function truckAt(route: [number, number][], timeline: TimelineEntry[], anchors: number[], ms: number): [number, number] {
  if (!route || route.length === 0) return [0, 0];
  const index = entryAt(timeline, ms);
  const entry = timeline[index];
  if (!entry) return route[0];
  if (entry.status !== 'driving') return [entry.lat, entry.lng];

  const startMs = toMs(entry.start);
  const endMs = toMs(entry.end);
  const duration = endMs - startMs;
  const progress = duration > 0 ? Math.min(1, Math.max(0, (ms - startMs) / duration)) : 0;

  const from = Math.min(route.length - 1, Math.max(0, anchors[index] ?? 0));
  const to = Math.min(route.length - 1, Math.max(from, anchors[index + 1] ?? from));

  if (from === to) return route[from];

  const floatIdx = from + (to - from) * progress;
  const floorIdx = Math.floor(floatIdx);
  const ceilIdx = Math.min(route.length - 1, Math.ceil(floatIdx));
  const frac = floatIdx - floorIdx;

  if (floorIdx === ceilIdx || frac <= 0) {
    return route[floorIdx];
  }

  const p1 = route[floorIdx];
  const p2 = route[ceilIdx];
  return [
    p1[0] + (p2[0] - p1[0]) * frac,
    p1[1] + (p2[1] - p1[1]) * frac,
  ];
}
