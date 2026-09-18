import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { STATUS_COLOR, STATUS_LABEL, clock, dayLabel, fromMs, hm, toMs } from '../format';
import type { Moment } from '../playback';
import type { TimelineEntry } from '../types';

const BASE_MINUTES_PER_SECOND = 20;
const SPEEDS = [1, 4, 16];
const MINUTE_MS = 60_000;
const RING_RADIUS = 8;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const CLOCKS = [
  { key: 'drive_left', label: 'Drive', limit: 11 },
  { key: 'window_left', label: 'Window', limit: 14 },
  { key: 'break_due_in', label: 'Break in', limit: 8 },
  { key: 'cycle_left', label: 'Cycle', limit: 70 },
] as const;

function Clock({ value, limit, label }: { value: number; limit: number; label: string }) {
  const color = value <= 0 ? 'var(--color-coral)' : value < 1 ? 'var(--color-onduty)' : 'var(--color-brand-500)';
  return (
    <div className="flex items-center gap-2" title={`${label}: ${hm(value)} of ${limit} hrs left`}>
      <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden>
        <circle cx="10" cy="10" r={RING_RADIUS} fill="none" stroke="var(--color-line)" strokeWidth="2.5" />
        <circle
          cx="10"
          cy="10"
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - Math.min(1, value / limit))}
        />
      </svg>
      <span className="text-[12px] text-muted">{label}</span>
      <span className="font-mono text-[12.5px] font-medium text-ink">
        {hm(value)}
        <span className="text-faint">/{limit}h</span>
      </span>
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
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={() => {
            if (time >= end) onTime(start);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? 'Pause trip playback' : 'Play trip playback'}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-900 text-white transition hover:bg-brand-700"
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 translate-x-px" />}
        </button>
        <div className="flex shrink-0 rounded-lg bg-canvas p-0.5" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              onClick={() => setSpeed(s)}
              className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] transition ${speed === s ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              {s}x
            </button>
          ))}
        </div>
        <p className="shrink-0 whitespace-nowrap font-mono text-[12.5px] text-ink">
          <span className="text-muted">{dayLabel(iso)}</span> {clock(iso)}
        </p>

        <div className="relative order-last h-5 min-w-full flex-1 sm:order-none sm:min-w-[240px]">
          <div className="absolute inset-x-0 top-1.5 flex h-2 overflow-hidden rounded-full" aria-hidden>
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

        <span
          className="ml-auto inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium text-white sm:ml-0"
          style={{ background: STATUS_COLOR[moment.entry.status] }}
          aria-live="polite"
          title={moment.entry.note}
        >
          {STATUS_LABEL[moment.entry.status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1.5">
        {CLOCKS.map((c) => (
          <Clock key={c.key} value={moment.clocks[c.key]} limit={c.limit} label={c.label} />
        ))}
        <span className="ml-auto hidden truncate text-[12px] text-muted md:block">{moment.entry.note}</span>
      </div>
    </div>
  );
}
