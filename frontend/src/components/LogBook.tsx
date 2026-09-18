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
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-4 px-4 pb-12 pt-[72px] sm:px-6 sm:pt-[84px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Log sheets by day">
          {logs.map((day, i) => {
            const active = i === index;
            return (
              <button
                key={day.date}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setIndex(i)}
                className={`min-w-[155px] shrink-0 rounded-2xl border p-3 text-left transition ${
                  active
                    ? 'border-brand-500 bg-white shadow-md ring-2 ring-brand-500/20'
                    : 'border-line bg-white/75 text-ink hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[13px] font-bold ${active ? 'text-brand-900' : 'text-ink'}`}>
                    Day {i + 1}
                  </span>
                  <span className="text-[11.5px] font-medium text-muted">
                    {dayLabel(day.date)}
                  </span>
                </div>
                <div className="mt-1 text-[12px] font-medium text-slate-600">
                  <span>{miles(day.miles_driving)} mi</span>
                  <span className="mx-1 text-slate-300">·</span>
                  <span>{hm(day.totals.driving)} drive</span>
                </div>
                <div className="mt-2.5">
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-black/5" aria-hidden>
                    {day.segments.map((seg) => (
                      <span
                        key={seg.start_minute}
                        style={{
                          flexGrow: seg.end_minute - seg.start_minute,
                          background: STATUS_COLOR[seg.status],
                        }}
                      />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {logs.length > 1 && (
            <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={index === 0}
                aria-label="Previous day"
                title="Previous day"
                className="grid size-8 place-items-center rounded-lg text-ink transition hover:bg-slate-100 disabled:opacity-25"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="px-1 text-[11.5px] font-semibold tabular-nums text-muted">
                {index + 1} / {logs.length}
              </span>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={index === logs.length - 1}
                aria-label="Next day"
                title="Next day"
                className="grid size-8 place-items-center rounded-lg text-ink transition hover:bg-slate-100 disabled:opacity-25"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-9 items-center gap-2 rounded-xl bg-brand-950 px-3.5 text-[13px] font-medium text-white shadow-xs transition hover:bg-brand-850 active:scale-[0.98]"
          >
            <Printer className="size-4 text-brand-300" />
            <span>{logs.length === 1 ? 'Print log sheet' : `Print all (${logs.length})`}</span>
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
