import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Navigation, RotateCw, X } from 'lucide-react';
import { ApiError, planTrip } from './api';
import { toMs } from './format';
import { momentAt, routeAnchors, truckAt } from './playback';
import { warmContiguousUs } from './tiles';
import { Composer } from './components/Composer';
import { Directions } from './components/Directions';
import { Dock } from './components/Dock';
import { Landing } from './components/Landing';
import { LogSheet } from './components/LogSheet';
import { Planning } from './components/Planning';
import { TripBar, type View } from './components/TripBar';
import type { TripRequest, TripResponse } from './types';

const loadRouteMap = () => import('./components/RouteMap');
const RouteMap = lazy(() => loadRouteMap().then((module) => ({ default: module.RouteMap })));
const LogBook = lazy(() => import('./components/LogBook').then((module) => ({ default: module.LogBook })));

const STORAGE_KEY = 'spotter.trip';
const EMPTY: TripRequest = { current_location: '', pickup_location: '', dropoff_location: '', cycle_used_hours: 0 };

function loadDraft(): TripRequest {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...EMPTY, ...JSON.parse(saved) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function saveDraft(trip: TripRequest) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
  } catch {
    return;
  }
}

const VIEWS: View[] = ['route', 'directions', 'logs'];
const viewFromHash = (): View => VIEWS.find((view) => window.location.hash === `#${view}`) ?? 'route';

export default function App() {
  const [draft, setDraft] = useState<TripRequest>(loadDraft);
  const [request, setRequest] = useState<TripRequest | null>(null);
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState<View>(viewFromHash);
  const [time, setTime] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focusedStep, setFocusedStep] = useState<{
    lat: number;
    lng: number;
    instruction: string;
    miles: number;
    stepNumber: number;
    legIndex: number;
    stepIndex: number;
  } | null>(null);

  useEffect(() => {
    warmContiguousUs();
    loadRouteMap();
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const submit = useCallback(async (next: TripRequest) => {
    setLoading(true);
    setError(null);
    saveDraft(next);
    try {
      const planned = await planTrip(next);
      setRequest(next);
      setTrip(planned);
      setTime(toMs(planned.summary.trip_start));
      setSelected(null);
      setFocusedStep(null);
      setEditing(false);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const anchors = useMemo(() => (trip ? routeAnchors(trip.route.coordinates, trip.timeline) : []), [trip]);
  const selectStop = useCallback(
    (index: number) => {
      setSelected(index);
      if (trip) setTime(toMs(trip.stops[index].arrival));
    },
    [trip],
  );

  const goHome = useCallback(() => {
    setTrip(null);
    setRequest(null);
    setFocusedStep(null);
    window.location.hash = '';
  }, []);

  const banner = error && !error.field && (
    <div role="alert" className="absolute left-1/2 top-4 z-[900] flex w-[min(92%,520px)] -translate-x-1/2 items-start gap-3 rounded-2xl bg-white p-3.5 shadow-float">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-coral" />
      <p className="flex-1 text-[13px] text-ink">{error.message}</p>
      {error.retryable && (
        <button type="button" onClick={() => submit(draft)} className="flex items-center gap-1.5 rounded-full bg-brand-900 px-3 py-1 text-[12px] font-medium text-white">
          <RotateCw className="size-3" /> Retry
        </button>
      )}
      <button type="button" aria-label="Dismiss" onClick={() => setError(null)} className="text-faint hover:text-ink">
        <X className="size-4" />
      </button>
    </div>
  );

  if (!trip || !request) {
    return (
      <div className="app-shell relative h-full overflow-y-auto">
        <Landing trip={draft} loading={loading} serverError={error} onChange={setDraft} onSubmit={submit} />
        {loading && <Planning />}
        {banner}
      </div>
    );
  }

  const moment = momentAt(trip.timeline, time);
  const truck = time > toMs(trip.summary.trip_start) ? truckAt(trip.route.coordinates, trip.timeline, anchors, time) : null;

  return (
    <>
      <div className="app-shell relative h-full overflow-hidden bg-canvas">
        <Suspense fallback={null}>
          <RouteMap
            route={trip.route.coordinates}
            stops={trip.stops}
            truck={truck}
            selected={selected}
            hovered={hovered}
            focusedStep={focusedStep}
            onSelect={selectStop}
            onHover={setHovered}
          />
        </Suspense>
        <TripBar request={request} view={view} logCount={trip.logs.length} onEdit={() => setEditing(true)} onHome={goHome} />
        {view === 'directions' ? (
          <Directions
            legs={trip.route.legs}
            activeStep={focusedStep ? { legIndex: focusedStep.legIndex, stepIndex: focusedStep.stepIndex } : null}
            onSelectStep={(legIndex, stepIndex, step) => {
              let lat = step.lat;
              let lng = step.lng;
              if (lat === undefined || lng === undefined) {
                const coords = trip.route.coordinates;
                const ratio = Math.min(1, Math.max(0, stepIndex / Math.max(1, trip.route.legs[legIndex].steps.length)));
                const idx = Math.floor(ratio * (coords.length - 1));
                [lat, lng] = coords[idx];
              }
              setFocusedStep({
                lat,
                lng,
                instruction: step.instruction,
                miles: step.miles,
                stepNumber: stepIndex + 1,
                legIndex,
                stepIndex,
              });
              if (window.innerWidth < 640) {
                window.location.hash = '#route';
              }
            }}
          />
        ) : (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[600] mx-auto max-w-[1120px] sm:inset-x-4 sm:bottom-4">
            {focusedStep && view === 'route' ? (
              <div className="glass pointer-events-auto mb-2 flex items-center justify-between gap-3 rounded-2xl border border-brand-500/30 p-2.5 shadow-float sm:p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-xs">
                    <Navigation className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-700">
                      Step {focusedStep.stepNumber} · {focusedStep.miles > 0 ? `${focusedStep.miles} mi` : 'Arrival'}
                    </p>
                    <p className="truncate text-[13px] font-semibold text-ink">{focusedStep.instruction}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href="#directions"
                    className="flex items-center gap-1 rounded-full bg-brand-900 px-3 py-1.5 text-[12px] font-semibold text-white shadow-xs transition hover:bg-brand-700"
                  >
                    All steps
                  </a>
                  <button
                    type="button"
                    onClick={() => setFocusedStep(null)}
                    aria-label="Close step focus"
                    title="Close step focus"
                    className="grid size-7 place-items-center rounded-full text-muted hover:bg-black/5 hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            ) : null}
            <Dock trip={trip} time={time} moment={moment} selected={selected} hovered={hovered} onTime={setTime} onSelect={selectStop} onHover={setHovered} />
          </div>
        )}

        {view === 'logs' && (
          <div className="absolute inset-0 z-[650] overflow-y-auto bg-desk">
            <Suspense fallback={null}>
              <LogBook logs={trip.logs} />
            </Suspense>
          </div>
        )}

        {editing && (
          <div className="absolute inset-0 z-[800] flex items-start justify-center bg-brand-950/70 px-4 pt-24 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setEditing(false)}>
            <div className="w-full max-w-[1080px]">
              <Composer trip={draft} loading={loading} serverError={error} onChange={setDraft} onSubmit={submit} />
            </div>
          </div>
        )}
        {loading && <Planning />}
        {banner}
      </div>

      <div className="print-sheets hidden">
        {trip.logs.map((log) => (
          <LogSheet key={log.date} log={log} />
        ))}
      </div>
    </>
  );
}
