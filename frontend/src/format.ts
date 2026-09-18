import type { DutyStatus, StopType } from './types';

const MINUTE_MS = 60_000;

export const STATUS_LABEL: Record<DutyStatus, string> = {
  off_duty: 'Off duty',
  sleeper_berth: 'Sleeper berth',
  driving: 'Driving',
  on_duty: 'On duty',
};

export const STATUS_COLOR: Record<DutyStatus, string> = {
  off_duty: 'var(--color-off)',
  sleeper_berth: 'var(--color-sleeper)',
  driving: 'var(--color-drive)',
  on_duty: 'var(--color-onduty)',
};

export const STOP_LABEL: Record<StopType, string> = {
  start: 'Start',
  pickup: 'Pickup',
  dropoff: 'Dropoff',
  fuel: 'Fuel',
  break: '30 min break',
  rest: '10 hr rest',
  restart: '34 hr restart',
};

export const STOP_COLOR: Record<StopType, string> = {
  start: '#06343F',
  pickup: '#00807C',
  dropoff: '#FA4A63',
  fuel: '#E0892B',
  break: '#64748B',
  rest: '#7B6CF6',
  restart: '#4C3FD1',
};

export function toMs(iso: string): number {
  const [date, time = '00:00'] = iso.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, min);
}

export function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16);
}

export function minutesBetween(startIso: string, endIso: string): number {
  return (toMs(endIso) - toMs(startIso)) / MINUTE_MS;
}

export function clock(iso: string): string {
  return iso.slice(11, 16);
}

export function dayLabel(iso: string): string {
  return new Date(toMs(iso)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function miles(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function hours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function hm(decimalHours: number): string {
  const total = Math.round(decimalHours * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function duration(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = Math.round(minutes % 60);
  if (days) return `${days}d ${h}h`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function minuteOfDay(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
