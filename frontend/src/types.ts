export type StopType = 'start' | 'pickup' | 'dropoff' | 'fuel' | 'break' | 'rest' | 'restart';

export type DutyStatus = 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty';

export type TripField = 'current_location' | 'pickup_location' | 'dropoff_location' | 'cycle_used_hours';

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

export interface TripRequest {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  cycle_used_hours: number;
}

export interface Clocks {
  drive_left: number;
  window_left: number;
  break_due_in: number;
  cycle_left: number;
}

export interface Stop {
  type: StopType;
  name: string;
  lat: number;
  lng: number;
  arrival: string;
  departure: string;
  duration_hours: number;
  mile_marker: number;
  reason: string;
  clocks: Clocks;
}

export interface RouteStep {
  instruction: string;
  miles: number;
  lat?: number;
  lng?: number;
}

export interface RouteLeg {
  from: string;
  to: string;
  miles: number;
  driving_hours: number;
  steps: RouteStep[];
}

export interface TimelineEntry {
  status: DutyStatus;
  start: string;
  end: string;
  lat: number;
  lng: number;
  note: string;
  clocks: Clocks;
}

export interface LogSegment {
  status: DutyStatus;
  start_minute: number;
  end_minute: number;
}

export interface LogRemark {
  minute: number;
  location: string;
  note: string;
}

export interface DailyLog {
  date: string;
  from: string;
  to: string;
  miles_driving: number;
  shipping_doc_number?: string;
  segments: LogSegment[];
  remarks: LogRemark[];
  totals: Record<DutyStatus, number>;
  recap: {
    on_duty_today: number;
    total_last_7_days?: number;
    total_last_8_days: number;
    available_tomorrow: number;
  };
}

export interface TripSummary {
  total_miles: number;
  driving_hours: number;
  on_duty_hours: number;
  trip_start: string;
  trip_end: string;
  days: number;
  cycle_used_start: number;
  cycle_used_end: number;
  planning_speed_mph?: number;
}

export interface TripResponse {
  summary: TripSummary;
  route: { coordinates: [number, number][]; legs: RouteLeg[] };
  stops: Stop[];
  timeline: TimelineEntry[];
  logs: DailyLog[];
}
