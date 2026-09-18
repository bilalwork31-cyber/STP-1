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
    <div className="absolute inset-0 z-[500] grid place-items-center bg-canvas/40 backdrop-blur-[2px]">
      <div className="glass w-[300px] rounded-2xl p-5" role="status" aria-live="polite">
        <p className="text-[14px] font-semibold text-ink">Planning your trip</p>
        <ol className="mt-4 flex flex-col gap-3">
          {STEPS.map((label, i) => (
            <li key={label} className={`flex items-center gap-3 text-[13px] transition-colors ${i <= step ? 'text-ink' : 'text-faint'}`}>
              <span className={`grid size-5 place-items-center rounded-full ${i < step ? 'bg-brand-700 text-white' : 'border border-line'}`}>
                {i < step ? <Check className="size-3" /> : i === step ? <LoaderCircle className="size-3.5 animate-spin text-brand-700" /> : null}
              </span>
              {label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
