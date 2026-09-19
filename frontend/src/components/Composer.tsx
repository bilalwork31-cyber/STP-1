import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpDown, LoaderCircle } from 'lucide-react';
import { PlaceInput } from './PlaceInput';
import type { TripField, TripRequest } from '../types';

const CYCLE_LIMIT = 70;
const CYCLE_WARNING = 60;
const CYCLE_STEP = 0.25;

function validate(trip: TripRequest): Partial<Record<TripField, string>> {
  const errors: Partial<Record<TripField, string>> = {};
  if (!trip.current_location.trim()) errors.current_location = 'Enter where the truck is now.';
  if (!trip.pickup_location.trim()) errors.pickup_location = 'Enter the pickup city.';
  if (!trip.dropoff_location.trim()) errors.dropoff_location = 'Enter the dropoff city.';
  if (trip.pickup_location.trim() && trip.pickup_location.trim().toLowerCase() === trip.dropoff_location.trim().toLowerCase()) {
    errors.dropoff_location = 'Dropoff must differ from pickup.';
  }
  const cycle = trip.cycle_used_hours;
  if (Number.isNaN(cycle) || cycle < 0 || cycle > CYCLE_LIMIT) {
    errors.cycle_used_hours = `Cycle used must be between 0 and ${CYCLE_LIMIT} hrs.`;
  }
  return errors;
}

interface Props {
  trip: TripRequest;
  loading: boolean;
  serverError: { field: string | null; message: string } | null;
  onChange: (trip: TripRequest) => void;
  onSubmit: (trip: TripRequest) => void;
}

export function Composer({ trip, loading, serverError, onChange, onSubmit }: Props) {
  const [touched, setTouched] = useState(false);
  const errors = touched ? validate(trip) : {};
  const messages = [...new Set([...Object.values(errors), serverError?.field ? serverError.message : null].filter(Boolean))];
  const invalid = (field: TripField) => Boolean(errors[field]) || serverError?.field === field;
  const left = Math.max(0, CYCLE_LIMIT - (trip.cycle_used_hours || 0));
  const set = (field: keyof TripRequest) => (value: string | number) => onChange({ ...trip, [field]: value });

  const submit = () => {
    setTouched(true);
    const roundedCycle = Math.round(Math.max(0, Math.min(CYCLE_LIMIT, trip.cycle_used_hours || 0)) / CYCLE_STEP) * CYCLE_STEP;
    const normalized = { ...trip, cycle_used_hours: Number(roundedCycle.toFixed(2)) };
    if (!Object.keys(validate(normalized)).length) onSubmit(normalized);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="w-full"
    >
      <fieldset
        disabled={loading}
        className="flex flex-col rounded-[28px] bg-white/95 p-2 shadow-[0_24px_60px_-20px_rgb(3_35_43/0.55)] ring-1 ring-black/5 backdrop-blur-xl md:flex-row md:items-center"
      >
        <legend className="sr-only">Trip details</legend>
        <PlaceInput label="From" placeholder="Truck location" dotClass="bg-ink" value={trip.current_location} invalid={invalid('current_location')} onChange={set('current_location')} />
        <span className="segment-divider" aria-hidden />
        <PlaceInput label="Pickup" placeholder="Shipper city" dotClass="bg-brand-500" value={trip.pickup_location} invalid={invalid('pickup_location')} onChange={set('pickup_location')} />
        <button
          type="button"
          aria-label="Swap pickup and dropoff"
          onClick={() => onChange({ ...trip, pickup_location: trip.dropoff_location, dropoff_location: trip.pickup_location })}
          className="z-10 -my-3 mr-4 grid size-7 shrink-0 place-items-center self-end rounded-full bg-white text-muted shadow-xs ring-1 ring-line transition hover:scale-105 hover:text-ink md:-mx-3.5 md:my-0 md:mr-0 md:self-auto md:rotate-90"
        >
          <ArrowUpDown className="size-3.5" />
        </button>
        <PlaceInput label="Dropoff" placeholder="Receiver city" dotClass="bg-coral" value={trip.dropoff_location} invalid={invalid('dropoff_location')} onChange={set('dropoff_location')} />
        <span className="segment-divider" aria-hidden />

        <div className="segment group relative md:w-[168px] md:flex-none">
          <label htmlFor="cycle-used" className={`text-[11.5px] font-semibold ${invalid('cycle_used_hours') ? 'text-coral' : 'text-ink'}`}>
            Cycle used
          </label>
          <div className="mt-0.5 flex items-baseline gap-1 text-[15px]">
            <input
              id="cycle-used"
              type="number"
              inputMode="decimal"
              min={0}
              max={CYCLE_LIMIT}
              step={CYCLE_STEP}
              value={Number.isNaN(trip.cycle_used_hours) ? '' : trip.cycle_used_hours}
              onChange={(event) => set('cycle_used_hours')(event.target.valueAsNumber)}
              className="w-10 bg-transparent p-0 font-medium tabular-nums text-ink focus:outline-none"
              aria-describedby="cycle-hint"
            />
            <span className="text-muted">of 70 hrs</span>
          </div>
          <div className="absolute right-0 top-full z-30 mt-3 hidden w-[280px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-4 shadow-float ring-1 ring-black/5 group-focus-within:block">
            <input
              type="range"
              min={0}
              max={CYCLE_LIMIT}
              step={0.5}
              value={trip.cycle_used_hours || 0}
              onChange={(event) => set('cycle_used_hours')(event.target.valueAsNumber)}
              aria-label="Cycle hours used"
              className="w-full accent-brand-500"
            />
            <p id="cycle-hint" className={`mt-2 text-[12.5px] ${trip.cycle_used_hours >= CYCLE_WARNING ? 'text-[#b86e00]' : 'text-muted'}`}>
              {trip.cycle_used_hours >= CYCLE_WARNING
                ? `${left} hrs left. Expect a 34 hr restart on longer runs.`
                : `${left} hrs left in the 70 hr / 8 day cycle.`}
            </p>
          </div>
        </div>

        <button
          type="submit"
          className="mt-2 flex h-14 shrink-0 items-center justify-center gap-2 rounded-[22px] bg-coral px-6 text-[15px] font-semibold text-white transition hover:bg-coral-600 disabled:cursor-wait md:ml-1 md:mt-0"
        >
          {loading ? <LoaderCircle className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
          <span>{loading ? 'Planning' : 'Plan trip'}</span>
        </button>
      </fieldset>
      <p role="alert" className="mt-3 min-h-5 px-4 text-[13px] font-medium text-[#ffb4bf]">
        {messages.join(' ')}
      </p>
    </form>
  );
}
