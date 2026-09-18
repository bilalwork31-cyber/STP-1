import { Composer } from './Composer';
import type { TripRequest } from '../types';

const SAMPLES: { name: string; trip: TripRequest }[] = [
  { name: 'Milwaukee to Indianapolis', trip: { current_location: 'Milwaukee, WI', pickup_location: 'Chicago, IL', dropoff_location: 'Indianapolis, IN', cycle_used_hours: 8 } },
  { name: 'Green Bay to Dallas', trip: { current_location: 'Green Bay, WI', pickup_location: 'Chicago, IL', dropoff_location: 'Dallas, TX', cycle_used_hours: 12.5 } },
  { name: 'Seattle to Miami, 62 hrs used', trip: { current_location: 'Seattle, WA', pickup_location: 'Portland, OR', dropoff_location: 'Miami, FL', cycle_used_hours: 62 } },
];

const RULES = ['11 hr driving', '14 hr window', '30 min break', '70 hr / 8 day', 'Fuel every 1,000 mi', '1 hr pickup and dropoff'];

interface Props {
  trip: TripRequest;
  loading: boolean;
  serverError: { field: string | null; message: string } | null;
  onChange: (trip: TripRequest) => void;
  onSubmit: (trip: TripRequest) => void;
}

export function Landing({ trip, loading, serverError, onChange, onSubmit }: Props) {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-brand-950 text-white">
      <img src="/hero.jpg" alt="" className="hero-drift absolute inset-0 size-full object-cover object-[50%_65%]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_30%,rgb(3_35_43/0.35),rgb(3_35_43/0.92))]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <img src="/logo.png" alt="spotter.ai" width={118} height={29} className="h-[29px] w-auto" />
        <span className="hidden rounded-full border border-white/15 px-3 py-1 text-[12px] text-white/70 sm:block">HOS Trip Planner</span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1080px] flex-1 flex-col justify-center px-4 pb-10 sm:px-8">
        <div className="mb-9 text-center">
          <p className="text-[13px] font-medium tracking-[0.02em] text-brand-300">For property carrying drivers on the 70 hr / 8 day cycle</p>
          <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[64px]">
            Plan the run. <span className="text-white/55">Log the day.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-relaxed text-white/70 sm:text-[17px]">
            Enter four details. Get the truck route, every legally required stop, and filled daily log sheets.
          </p>
        </div>

        <Composer trip={trip} loading={loading} serverError={serverError} onChange={onChange} onSubmit={onSubmit} />

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-[13px] text-white/50">Try</span>
          {SAMPLES.map((sample) => (
            <button
              key={sample.name}
              type="button"
              disabled={loading}
              onClick={() => {
                onChange(sample.trip);
                onSubmit(sample.trip);
              }}
              className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[13px] text-white/85 backdrop-blur transition hover:border-white/40 hover:bg-white/[0.12]"
            >
              {sample.name}
            </button>
          ))}
        </div>
      </main>

      <footer className="relative z-10 flex flex-wrap justify-center gap-x-5 gap-y-1 px-6 pb-6 text-[12px] text-white/45">
        {RULES.map((rule) => (
          <span key={rule}>{rule}</span>
        ))}
      </footer>
    </div>
  );
}
