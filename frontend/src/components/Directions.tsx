import { ArrowUp, CornerUpLeft, CornerUpRight, Flag, MoveUpLeft, MoveUpRight, Navigation, RotateCw, type LucideIcon } from 'lucide-react';
import { hours, miles } from '../format';
import type { RouteLeg, RouteStep } from '../types';

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

const stepDistance = (value: number, isArrival: boolean) => {
  if (isArrival) return 'Arrive';
  if (value <= 0.01) return '< 100 ft';
  if (value < 0.1) {
    const feet = Math.max(50, Math.round((value * 5280) / 50) * 50);
    return `${feet} ft`;
  }
  if (value < 10) return `${value.toFixed(1)} mi`;
  return `${miles(value)} mi`;
};

interface Props {
  legs: RouteLeg[];
  activeStep?: { legIndex: number; stepIndex: number } | null;
  onSelectStep?: (legIndex: number, stepIndex: number, step: RouteStep) => void;
}

export function Directions({ legs, activeStep, onSelectStep }: Props) {
  return (
    <aside
      className="scrollbar-thin absolute bottom-2 left-2 right-2 top-[66px] z-[600] overflow-y-auto rounded-[24px] bg-white shadow-2xl ring-1 ring-black/10 sm:bottom-4 sm:left-auto sm:right-4 sm:top-[74px] sm:w-[420px]"
      aria-label="Turn by turn directions"
    >
      {legs.map((leg, legIndex) => {
        const isLastLeg = legIndex === legs.length - 1;
        return (
          <section key={leg.from + leg.to}>
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-5 py-3.5 shadow-xs">
              <div className="flex items-center gap-2 text-[14.5px] font-semibold text-ink">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-500 text-[11px] font-bold text-white shadow-2xs">
                  {legIndex + 1}
                </span>
                <span className="truncate">{leg.from}</span>
                <span className="text-slate-300" aria-hidden>→</span>
                <span className="truncate">{leg.to}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] font-medium text-muted">
                <span>{legIndex === 0 ? 'To pickup' : 'To dropoff'}</span>
                <span className="text-slate-300" aria-hidden>·</span>
                <span>{miles(leg.miles)} mi</span>
                <span className="text-slate-300" aria-hidden>·</span>
                <span>{hours(leg.driving_hours)}h driving</span>
                <span className="text-slate-300" aria-hidden>·</span>
                <span>{leg.steps.length} steps</span>
              </div>
            </header>

            <ol className={`px-2 py-2 ${isLastLeg ? 'pb-8' : 'pb-4'}`}>
              {leg.steps.map((step, i) => {
                const isArrival = /^arrive/i.test(step.instruction);
                const Icon = maneuverIcon(step.instruction);
                const isDropoff = isArrival && isLastLeg;
                const isPickup = isArrival && !isLastLeg;
                const isActive = activeStep?.legIndex === legIndex && activeStep?.stepIndex === i;

                if (isArrival) {
                  return (
                    <li
                      key={i}
                      onClick={() => onSelectStep?.(legIndex, i, step)}
                      className={`my-1.5 flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                        isActive
                          ? 'border-brand-500 bg-brand-50 shadow-sm ring-2 ring-brand-500/25'
                          : isDropoff
                          ? 'border-coral-200 bg-coral-50/50 hover:border-coral-400 hover:bg-coral-50'
                          : 'border-brand-200 bg-brand-50/50 hover:border-brand-400 hover:bg-brand-50'
                      }`}
                    >
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-lg text-white shadow-2xs ${
                          isDropoff ? 'bg-coral' : 'bg-brand-500'
                        }`}
                      >
                        <Flag className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-ink">
                          {isDropoff ? 'Final Dropoff Destination' : 'Pickup Location Arrival'}
                        </div>
                        <div className="text-[12px] text-muted">{step.instruction}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isActive && (
                          <span className="rounded-full bg-brand-200 px-2 py-0.5 text-[10.5px] font-bold text-brand-900">
                            On map
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isDropoff ? 'bg-coral-100 text-coral-700' : 'bg-brand-100 text-brand-700'
                          }`}
                        >
                          {isDropoff ? 'Dropoff' : 'Pickup'}
                        </span>
                      </div>
                    </li>
                  );
                }

                return (
                  <li
                    key={i}
                    onClick={() => onSelectStep?.(legIndex, i, step)}
                    className={`group flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition ${
                      isActive
                        ? 'border border-brand-500 bg-brand-50/90 shadow-xs ring-2 ring-brand-500/25'
                        : 'border border-transparent hover:border-slate-200 hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg transition ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-700'
                      }`}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span
                      className={`min-w-0 flex-1 text-[13.5px] leading-snug transition ${
                        isActive ? 'font-semibold text-brand-950' : 'text-ink'
                      }`}
                    >
                      {step.instruction}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                      {isActive && (
                        <span className="rounded-full bg-brand-200/90 px-2 py-0.5 text-[10.5px] font-bold text-brand-900">
                          On map
                        </span>
                      )}
                      <span className="font-mono text-[11.5px] font-medium text-slate-500">
                        {stepDistance(step.miles, false)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </aside>
  );
}
