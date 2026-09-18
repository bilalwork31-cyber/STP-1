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
    <ol className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
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
              onClick={() => onSelect(i)}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              aria-current={i === selected}
              className={`flex h-full w-[232px] flex-col rounded-2xl border bg-white p-3 text-left transition ${
                active ? 'border-brand-500 shadow-[0_0_0_3px_rgb(0_128_124/0.15)]' : 'border-line hover:border-faint'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full text-white" style={{ background: STOP_COLOR[stop.type] }}>
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="text-[12px] font-semibold" style={{ color: STOP_COLOR[stop.type] }}>
                  {STOP_LABEL[stop.type]}
                </span>
                <span className="ml-auto font-mono text-[12px] text-ink">{clock(stop.arrival)}</span>
              </span>
              <span className="mt-2 truncate text-[14px] font-medium text-ink">{stop.name}</span>
              <span className="mt-0.5 font-mono text-[11px] text-faint">
                {dayLabel(stop.arrival)} · mi {miles(stop.mile_marker)}
                {stop.duration_hours > 0 && ` · ${hours(stop.duration_hours)} hr`}
              </span>
              <span className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-muted">{stop.reason}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
