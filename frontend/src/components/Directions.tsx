import { ArrowUp, CornerUpLeft, CornerUpRight, Flag, MoveUpLeft, MoveUpRight, Navigation, RotateCw, type LucideIcon } from 'lucide-react';
import { hours, miles } from '../format';
import type { RouteLeg } from '../types';

const MANEUVERS: [RegExp, LucideIcon][] = [
  [/^arrive/i, Flag],
  [/^head/i, Navigation],
  [/roundabout/i, RotateCw],
  [/^keep left|slight left/i, MoveUpLeft],
  [/^keep right|slight right/i, MoveUpRight],
  [/left/i, CornerUpLeft],
  [/right/i, CornerUpRight],
];

const maneuverIcon = (instruction: string) => MANEUVERS.find(([pattern]) => pattern.test(instruction))?.[1] ?? ArrowUp;

const stepDistance = (value: number) => (value < 0.1 ? '' : value < 10 ? `${value.toFixed(1)} mi` : `${miles(value)} mi`);

export function Directions({ legs }: { legs: RouteLeg[] }) {
  return (
    <aside className="glass scrollbar-thin absolute bottom-2 right-2 top-[112px] z-[600] w-[min(420px,calc(100%-16px))] overflow-y-auto rounded-[26px] sm:bottom-4 sm:right-4 sm:top-[76px]" aria-label="Turn by turn directions">
      {legs.map((leg, legIndex) => (
        <section key={leg.from + leg.to}>
          <header className="sticky top-0 z-10 border-b border-line bg-white/95 px-5 py-4 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Leg {legIndex + 1} · {legIndex === 0 ? 'to pickup' : 'to dropoff'}
            </p>
            <p className="mt-1 text-[15px] font-semibold text-ink">
              {leg.from} <span className="text-faint">→</span> {leg.to}
            </p>
            <p className="mt-0.5 font-mono text-[12px] text-muted">
              {miles(leg.miles)} mi · {hours(leg.driving_hours)} hrs driving · {leg.steps.length} steps
            </p>
          </header>
          <ol className="px-2 py-2">
            {leg.steps.map((step, i) => {
              const Icon = maneuverIcon(step.instruction);
              return (
                <li key={i} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-canvas">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-500">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink">{step.instruction}</span>
                  <span className="shrink-0 pt-0.5 font-mono text-[12px] text-muted">{stepDistance(step.miles)}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </aside>
  );
}
