import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { LogSheet } from './LogSheet';
import { STATUS_COLOR, dayLabel, hm, miles } from '../format';
import type { DailyLog } from '../types';

export function LogBook({ logs }: { logs: DailyLog[] }) {
  const [index, setIndex] = useState(0);
  const log = logs[Math.min(index, logs.length - 1)];
  const go = (step: number) => setIndex((i) => Math.min(logs.length - 1, Math.max(0, i + step)));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-4 px-4 pb-10 pt-[76px] sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Log sheets by day">
          {logs.map((day, i) => (
            <button
              key={day.date}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={`min-w-[132px] shrink-0 rounded-xl border px-3 py-2 text-left transition ${
                i === index ? 'border-brand-900 bg-brand-900 text-white shadow-float' : 'border-line bg-white text-ink hover:border-brand-500'
              }`}
            >
              <span className="block text-[12px] font-semibold">Day {i + 1} · {dayLabel(day.date)}</span>
              <span className={`mt-0.5 block font-mono text-[11px] ${i === index ? 'text-white/60' : 'text-muted'}`}>
                {miles(day.miles_driving)} mi · {hm(day.totals.driving)} drive
              </span>
              <span className="mt-1.5 flex h-1 overflow-hidden rounded-full" aria-hidden>
                {day.segments.map((seg) => (
                  <span key={seg.start_minute} style={{ flexGrow: seg.end_minute - seg.start_minute, background: STATUS_COLOR[seg.status] }} />
                ))}
              </span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous day" className="grid size-9 place-items-center rounded-lg border border-line bg-white text-ink transition hover:border-brand-500 disabled:opacity-40">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => go(1)} disabled={index === logs.length - 1} aria-label="Next day" className="grid size-9 place-items-center rounded-lg border border-line bg-white text-ink transition hover:border-brand-500 disabled:opacity-40">
            <ChevronRight className="size-4" />
          </button>
          <button type="button" onClick={() => window.print()} className="flex h-9 items-center gap-2 rounded-lg bg-brand-900 px-3.5 text-[13px] font-medium text-white transition hover:bg-brand-700">
            <Printer className="size-4" /> Print all {logs.length}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[4px] shadow-paper">
        <div className="min-w-[760px]">
          <LogSheet key={log.date} log={log} animate />
        </div>
      </div>
      <p className="text-center text-[12px] text-muted">
        Times use the home terminal clock. Hover the grid for exact spans. Use the arrow keys to flip days.
      </p>
    </div>
  );
}
