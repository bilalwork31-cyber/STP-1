import { useEffect, useRef } from 'react';
import { STOP_COLOR, STOP_LABEL, clock, hours, miles } from '../format';
import { STOP_ICON } from './stopIcons';
import type { Stop } from '../types';

interface Props {
  stops: Stop[];
  selected: number | null;
  hovered: number | null;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
}

export function StopStrip({ stops, selected, hovered, onSelect, onHover }: Props) {
  const cards = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (selected !== null) cards.current[selected]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  return (
    <ol className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
      {stops.map((stop, i) => {
        const Icon = STOP_ICON[stop.type];
        const active = i === selected || i === hovered;
        return (
          <li key={`${stop.type}-${stop.arrival}`} className="shrink-0 snap-start">
            <button
              ref={(node) => {
                cards.current[i] = node;
              }}
              type="button"
              title={stop.reason}
              onClick={() => onSelect(i)}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              aria-current={i === selected}
              aria-label={`${STOP_LABEL[stop.type]}, ${stop.name}, ${clock(stop.arrival)}. ${stop.reason}`}
              className={`flex w-[218px] items-center gap-2.5 rounded-xl border bg-white p-2.5 text-left transition ${
                active ? 'border-brand-500 shadow-sm ring-2 ring-brand-500/25' : 'border-line hover:border-slate-300'
              }`}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full text-white shadow-xs" style={{ background: STOP_COLOR[stop.type] }}>
                <Icon className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1.5">
                  <span className="truncate text-[13px] font-semibold text-ink">{stop.name}</span>
                  <span className="shrink-0 font-mono text-[11.5px] font-medium text-ink">{clock(stop.arrival)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted">
                  <span className="font-semibold" style={{ color: STOP_COLOR[stop.type] }}>{STOP_LABEL[stop.type]}</span>
                  <span className="text-slate-300">·</span>
                  <span>mi {miles(stop.mile_marker)}</span>
                  {stop.duration_hours > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span>{hours(stop.duration_hours)}h</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
