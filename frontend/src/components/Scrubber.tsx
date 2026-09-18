import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { STATUS_COLOR, STATUS_LABEL, clock, dayLabel, fromMs, hm, toMs } from '../format';
import type { Moment } from '../playback';
import type { TimelineEntry } from '../types';

const BASE_MINUTES_PER_SECOND = 20;
const SPEEDS = [1, 4, 16];
const MINUTE_MS = 60_000;

const CLOCKS = [
  { key: 'drive_left', label: 'Drive', limit: 11 },
  { key: 'window_left', label: 'Window', limit: 14 },
  { key: 'break_due_in', label: 'Break in', limit: 8 },
  { key: 'cycle_left', label: 'Cycle', limit: 70 },
] as const;

function Ring({ value, limit, label }: { value: number; limit: number; label: string }) {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const color = value <= 0 ? 'var(--color-coral)' : value < 1 ? 'var(--color-onduty)' : 'var(--color-brand-700)';
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 40 40" className="size-10 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="3.5" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(1, value / limit))}
          className="transition-[stroke-dashoffset] duration-200"
        />
      </svg>
      <div className="leading-tight">
        <p className="text-[11px] text-muted">{label}</p>
        <p className="font-mono text-[14px] font-medium text-ink">
          {hm(value)}
          <span className="ml-1 text-[11px] text-faint">/ {limit}h</span>
        </p>
      </div>
    </div>
  );
}

interface Props {
  timeline: TimelineEntry[];
  time: number;
  moment: Moment;
  onTime: (ms: number) => void;
}

export function Scrubber({ timeline, time, moment, onTime }: Props) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(SPEEDS[1]);
  const start = toMs(timeline[0].start);
  const end = toMs(timeline[timeline.length - 1].end);
  const timeRef = useRef(time);
  timeRef.current = time;

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = timeRef.current + ((now - last) / 1000) * BASE_MINUTES_PER_SECOND * speed * MINUTE_MS;
      last = now;
      if (next >= end) {
        onTime(end);
        setPlaying(false);
        return;
      }
      onTime(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, end, onTime]);

  const iso = fromMs(time);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (time >= end) onTime(start);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? 'Pause trip playback' : 'Play trip playback'}
          className="grid size-9 place-items-center rounded-full bg-brand-900 text-white transition hover:bg-brand-700"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
        </button>
        <div className="flex rounded-lg bg-canvas p-0.5" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              onClick={() => setSpeed(s)}
              className={`rounded-md px-2 py-1 font-mono text-[11px] transition ${speed === s ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              {s}x
            </button>
          ))}
        </div>
        <p className="font-mono text-[13px] text-ink">
          <span className="text-muted">{dayLabel(iso)}</span> {clock(iso)}
        </p>
        <span
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-white"
          style={{ background: STATUS_COLOR[moment.entry.status] }}
          aria-live="polite"
        >
          {STATUS_LABEL[moment.entry.status]}
          {moment.entry.note && moment.entry.note !== STATUS_LABEL[moment.entry.status] && (
            <span className="font-normal opacity-85">· {moment.entry.note}</span>
          )}
        </span>
      </div>

      <div className="relative mt-3.5 h-6">
        <div className="absolute inset-x-0 top-2 flex h-2 overflow-hidden rounded-full" aria-hidden>
          {timeline.map((entry) => (
            <span
              key={entry.start}
              style={{ flexGrow: toMs(entry.end) - toMs(entry.start), background: STATUS_COLOR[entry.status] }}
              className="border-r border-white/60 last:border-0"
            />
          ))}
        </div>
        <input
          type="range"
          min={start}
          max={end}
          step={MINUTE_MS * 15}
          value={time}
          onChange={(event) => {
            setPlaying(false);
            onTime(event.target.valueAsNumber);
          }}
          aria-label="Trip time"
          aria-valuetext={`${dayLabel(iso)} ${clock(iso)}, ${STATUS_LABEL[moment.entry.status]}`}
          className="scrub absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CLOCKS.map((c) => (
          <Ring key={c.key} value={moment.clocks[c.key]} limit={c.limit} label={c.label} />
        ))}
      </div>
    </div>
  );
}
