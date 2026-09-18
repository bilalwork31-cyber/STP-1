import { ArrowLeft, FileText, Map as MapIcon, Navigation, PencilLine } from 'lucide-react';
import type { TripRequest } from '../types';

export type View = 'route' | 'directions' | 'logs';

interface Props {
  request: TripRequest;
  view: View;
  logCount: number;
  onEdit: () => void;
  onHome?: () => void;
}

export function TripBar({ request, view, logCount, onEdit, onHome }: Props) {
  const tabs = [
    { id: 'route', label: 'Route', shortLabel: 'Route', icon: MapIcon },
    { id: 'directions', label: 'Directions', shortLabel: 'Steps', icon: Navigation },
    { id: 'logs', label: `Logs · ${logCount}`, shortLabel: `Logs · ${logCount}`, icon: FileText },
  ] as const;

  const isLogs = view === 'logs';

  return (
    <div
      className={`absolute inset-x-0 top-0 z-[700] flex items-center justify-between gap-2 p-2.5 transition-colors sm:gap-3 sm:p-3.5 ${
        isLogs
          ? 'pointer-events-auto border-b border-slate-200/80 bg-white/95 shadow-xs backdrop-blur-md'
          : 'pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-1.5 sm:gap-2">
        {onHome && (
          <button
            type="button"
            onClick={onHome}
            className="glass pointer-events-auto flex h-11 shrink-0 items-center justify-center rounded-full p-2.5 text-ink transition hover:bg-white active:scale-95 sm:gap-2 sm:px-3.5"
            title="Return to Home page (Plan new trip)"
            aria-label="Return to Home page"
          >
            <ArrowLeft className="size-4 shrink-0 text-brand-700" />
            <span className="hidden items-center text-[13px] font-extrabold tracking-tight text-ink sm:flex">
              <span className="mr-1 size-2 rounded-full bg-coral inline-block" />
              <span>spotter</span>
              <span className="text-brand-600">.ai</span>
            </span>
          </button>
        )}

        <nav className="glass pointer-events-auto flex h-11 items-center rounded-full p-1" aria-label="Result views" role="tablist">
          {tabs.map((tab) => {
            const active = view === tab.id;
            return (
              <a
                key={tab.id}
                href={`#${tab.id}`}
                role="tab"
                aria-selected={active}
                aria-label={tab.label}
                className={`flex h-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium transition sm:gap-2 sm:px-3.5 sm:text-[13px] ${
                  active ? 'bg-brand-900 text-white shadow-xs' : 'text-muted hover:text-ink'
                }`}
              >
                <tab.icon className="size-3.5 shrink-0 sm:size-4" aria-hidden />
                <span className="whitespace-nowrap sm:hidden">{tab.shortLabel}</span>
                <span className="hidden whitespace-nowrap sm:inline">{tab.label}</span>
              </a>
            );
          })}
        </nav>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="glass pointer-events-auto flex h-11 items-center gap-2 rounded-full px-3.5 text-left text-[13px] transition hover:bg-white sm:px-4"
        aria-label="Edit trip route"
        title="Edit trip route"
      >
        <PencilLine className="size-4 shrink-0 text-brand-700" />
        <span className="hidden items-center gap-2 text-[13px] md:flex">
          <span className="max-w-[130px] truncate font-medium text-ink">{request.current_location}</span>
          <span className="text-faint">→</span>
          <span className="max-w-[130px] truncate font-medium text-ink">{request.pickup_location}</span>
          <span className="text-faint">→</span>
          <span className="max-w-[130px] truncate font-medium text-ink">{request.dropoff_location}</span>
          <span className="text-muted">· {request.cycle_used_hours}h</span>
        </span>
        <span className="font-medium text-ink md:hidden">Edit</span>
        <span className="hidden rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 md:inline">
          Edit
        </span>
      </button>
    </div>
  );
}
