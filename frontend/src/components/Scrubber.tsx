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
  { key: 'drive_left', label: 'Drive Left', limit: 11, tip: 'Daily driving hours remaining (11h limit)' },
  { key: 'window_left', label: 'Shift Left', limit: 14, tip: '14-hour on-duty window remaining' },
  { key: 'break_due_in', label: 'Break Due In', limit: 8, tip: 'Hours until 30-minute rest break required' },
  { key: 'cycle_left', label: 'Cycle Left', limit: 70, tip: '70-hour / 8-day cycle hours remaining' },
] as const;

function Clock({ value, limit, label, tip }: { value: number; limit: number; label: string; tip: string }) {
  const safeVal = Math.max(0, value);
  const color = value <= 0 ? 'var(--color-coral)' : value < 1 ? 'var(--color-onduty)' : 'var(--color-brand-500)';
  return (
    <div
      className="flex items-center gap-2 rounded-xl bg-white/80 p-2 shadow-2xs ring-1 ring-black/5 transition hover:bg-white sm:p-2.5"
      title={`${label}: ${hm(safeVal)} remaining of ${limit}h. ${tip}`}
    >
      <svg viewBox="0 0 20 20" className="size-6 shrink-0 -rotate-90" aria-hidden>
        <circle cx="10" cy="10" r={RING_RADIUS} fill="none" stroke="#cbd5e1" strokeWidth="2.5" />
        <circle
          cx="10"
          cy="10"
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - Math.min(1, safeVal / limit))}
        />
      </svg>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[11px] font-semibold text-slate-600">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-1 font-mono text-[12.5px] font-bold tabular-nums text-ink">
          <span>{hm(safeVal)}</span>
          <span className="font-sans text-[10px] font-medium uppercase tracking-wider text-muted">left</span>
          <span className="font-sans text-[10px] font-normal text-slate-400">/ {limit}h</span>
        </div>
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
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={() => {
            if (time >= end) onTime(start);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? 'Pause route simulation' : 'Simulate route timeline'}
          title={playing ? 'Pause route simulation' : 'Simulate route timeline'}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-brand-900 px-3 text-[12px] font-semibold text-white shadow-xs transition hover:bg-brand-700 active:scale-95"
        >
          {playing ? (
            <>
              <Pause className="size-3.5" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="size-3.5" />
              <span>Simulate</span>
            </>
          )}
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

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-slate-500">Timeline:</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <span className="size-2 rounded-full bg-[#0f766e]" /> Driving
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <span className="size-2 rounded-full bg-[#ea580c]" /> On Duty
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <span className="size-2 rounded-full bg-[#6b21a8]" /> Sleeper Berth
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <span className="size-2 rounded-full bg-[#64748b]" /> Off Duty
          </span>
        </div>
        <span className="hidden text-slate-400 sm:inline">Drag timeline bar or click Simulate to preview run</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {CLOCKS.map((c) => (
          <Clock key={c.key} value={moment.clocks[c.key]} limit={c.limit} label={c.label} tip={c.tip} />
        ))}
      </div>
    </div>
  );
}
