import { useEffect, useRef } from 'react';
import { STOP_COLOR, STOP_LABEL, clock, dayLabel, hours, miles } from '../format';
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
    <ol className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
      {stops.map((stop, i) => {
        const Icon = STOP_ICON[stop.type];
        const active = i === selected || i === hovered;
        return (
          <li key={`${stop.type}-${stop.arrival}`} className="snap-start">
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
              className={`flex w-[214px] items-center gap-2.5 rounded-xl border bg-white px-2.5 py-2 text-left transition ${
                active ? 'border-brand-500 shadow-[0_6px_16px_-6px_rgb(0_128_124/0.45)]' : 'border-line hover:border-faint'
              }`}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full text-white" style={{ background: STOP_COLOR[stop.type] }}>
                <Icon className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-ink">{stop.name}</span>
                  <span className="shrink-0 font-mono text-[11.5px] text-ink">{clock(stop.arrival)}</span>
                </span>
                <span className="block truncate text-[11px] text-muted">
                  <span className="font-medium" style={{ color: STOP_COLOR[stop.type] }}>{STOP_LABEL[stop.type]}</span>
                  {' · '}
                  {dayLabel(stop.arrival)} · mi {miles(stop.mile_marker)}
                  {stop.duration_hours > 0 && ` · ${hours(stop.duration_hours)} hr`}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
