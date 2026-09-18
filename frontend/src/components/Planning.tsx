import { useEffect, useState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';

const STEPS = ['Finding locations', 'Routing the truck', 'Scheduling HOS stops', 'Drawing daily logs'];
const STEP_MS = 900;

export function Planning() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[900] grid place-items-center bg-brand-950/65 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Planning your trip">
      <div className="w-full max-w-[340px] rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Planning your trip</h2>
        <ol className="mt-4 flex flex-col gap-3.5">
          {STEPS.map((label, i) => {
            const isDone = i < step;
            const isCurrent = i === step;
            return (
              <li
                key={label}
                className={`flex items-center gap-3 text-[13.5px] transition-colors ${
                  isCurrent ? 'font-medium text-ink' : isDone ? 'text-ink' : 'text-muted'
                }`}
              >
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full transition-all ${
                    isDone
                      ? 'bg-brand-500 text-white shadow-xs'
                      : isCurrent
                        ? 'border-2 border-brand-500 bg-brand-100 text-brand-700'
                        : 'border-2 border-slate-300 bg-slate-50'
                  }`}
                  aria-hidden="true"
                >
                  {isDone ? (
                    <Check className="size-3 stroke-[2.5]" />
                  ) : isCurrent ? (
                    <LoaderCircle className="size-3 animate-spin text-brand-700 stroke-[2.5]" />
                  ) : null}
                </span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
