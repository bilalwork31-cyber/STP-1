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

function nearestIndex(route: [number, number][], lat: number, lng: number): number {
  let best = 0;
  let bestDistance = Infinity;
  route.forEach(([rLat, rLng], i) => {
    const distance = (rLat - lat) ** 2 + (rLng - lng) ** 2;
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

export function routeAnchors(route: [number, number][], timeline: TimelineEntry[]): number[] {
  const anchors = timeline.map((entry) => nearestIndex(route, entry.lat, entry.lng));
  return [...anchors, route.length - 1];
}

export function truckAt(route: [number, number][], timeline: TimelineEntry[], anchors: number[], ms: number): [number, number] {
  const index = entryAt(timeline, ms);
  const entry = timeline[index];
  if (entry.status !== 'driving') return [entry.lat, entry.lng];
  const progress = Math.min(1, (ms - toMs(entry.start)) / (toMs(entry.end) - toMs(entry.start)));
  const from = anchors[index];
  const to = Math.max(from, anchors[index + 1]);
  return route[Math.round(from + (to - from) * progress)];
}
