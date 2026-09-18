import type { Place, TripRequest, TripResponse } from './types';

const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly field: string | null,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(path, { ...init, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  } catch (err) {
    if (signal?.aborted) throw err;
    if (timeout.aborted) throw new ApiError('Routing is taking too long. Try again.', null, true);
    throw new ApiError('Cannot reach the planner. Check your connection and try again.', null, true);
  }
  if (response.ok) return (await response.json()) as T;

  const body = (await response.json().catch(() => null)) as { error?: { field: string | null; message: string } } | null;
  const message = body?.error?.message ?? `The planner answered ${response.status}. Try again in a moment.`;
  throw new ApiError(message, body?.error?.field ?? null, response.status >= 500 || response.status === 429);
}

export function getPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  return request<Place[]>(`/api/places?q=${encodeURIComponent(query)}`, {}, signal);
}

export function planTrip(trip: TripRequest): Promise<TripResponse> {
  return request<TripResponse>('/api/trip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip),
  });
}
