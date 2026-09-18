import { useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { Scrubber } from './Scrubber';
import { StopStrip } from './StopStrip';
import { clock, dayLabel, duration, hours, miles, minutesBetween } from '../format';
import type { Moment } from '../playback';
import type { TripResponse } from '../types';

const WIDE_SCREEN = '(min-width: 768px)';

interface Props {
  trip: TripResponse;
  time: number;
  moment: Moment;
  selected: number | null;
  hovered: number | null;
  onTime: (ms: number) => void;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
}

export function Dock({ trip, time, moment, selected, hovered, onTime, onSelect, onHover }: Props) {
  const [open, setOpen] = useState(() => window.matchMedia(WIDE_SCREEN).matches);
  const { summary } = trip;

  return (
    <section className="glass pointer-events-auto rounded-[22px] p-2.5 sm:p-3" aria-label="Trip details">
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1.5">
          <div className="flex items-center gap-2">
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-700">
              <ShieldCheck className="size-3.5" aria-hidden /> HOS compliant
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-ink">
            <span className="whitespace-nowrap rounded-md bg-white/85 px-2 py-0.5 font-semibold text-ink shadow-2xs ring-1 ring-black/5">
              {miles(summary.total_miles)} mi
            </span>
            <span className="whitespace-nowrap rounded-md bg-white/85 px-2 py-0.5 text-slate-700 shadow-2xs ring-1 ring-black/5">
              {hours(summary.driving_hours)}h drive
            </span>
            <span className="whitespace-nowrap rounded-md bg-white/85 px-2 py-0.5 text-slate-700 shadow-2xs ring-1 ring-black/5">
              {duration(minutesBetween(summary.trip_start, summary.trip_end))} total
            </span>
            <span className="whitespace-nowrap rounded-md bg-white/85 px-2 py-0.5 text-slate-700 shadow-2xs ring-1 ring-black/5">
              {summary.days} {summary.days === 1 ? 'log' : 'logs'}
            </span>
          </div>
          <p className="hidden text-[12px] text-muted lg:block">
            Arrives {dayLabel(summary.trip_end)}, {clock(summary.trip_end)} · cycle ends at {hours(summary.cycle_used_end)} / 70h
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Hide stops' : 'Show stops'}
          title={open ? 'Hide stops' : 'Show stops'}
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
        >
          <ChevronDown className={`size-4 transition-transform duration-200 ${open ? '' : 'rotate-180'}`} />
        </button>
      </div>
      {open && (
        <div className="mt-2.5">
          <StopStrip stops={trip.stops} selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover} />
        </div>
      )}
      <div className="mt-2.5 border-t border-line pt-2.5">
        <Scrubber timeline={trip.timeline} time={time} moment={moment} onTime={onTime} />
      </div>
    </section>
  );
}
