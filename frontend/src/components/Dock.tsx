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
  const stats = [
    `${miles(summary.total_miles)} mi`,
    `${hours(summary.driving_hours)} hrs driving`,
    duration(minutesBetween(summary.trip_start, summary.trip_end)),
    `${summary.days} daily ${summary.days === 1 ? 'log' : 'logs'}`,
  ];

  return (
    <section className="glass pointer-events-auto rounded-[22px] p-2.5 sm:p-3" aria-label="Trip details">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
        <span className="flex items-center gap-1.5 rounded-full bg-brand-100 px-2 py-0.5 text-[11.5px] font-semibold text-brand-700">
          <ShieldCheck className="size-3.5" aria-hidden /> HOS compliant
        </span>
        <p className="font-mono text-[12.5px] text-ink">
          {stats.map((stat, i) => (
            <span key={stat}>
              {i > 0 && <span className="mx-2 text-faint">·</span>}
              {stat}
            </span>
          ))}
        </p>
        <p className="hidden text-[12.5px] text-muted lg:block">
          Arrives {dayLabel(summary.trip_end)}, {clock(summary.trip_end)} · cycle ends at {hours(summary.cycle_used_end)} / 70
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Collapse stops' : 'Expand stops'}
          className="ml-auto grid size-8 place-items-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
        >
          <ChevronDown className={`size-4 transition-transform ${open ? '' : 'rotate-180'}`} />
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
