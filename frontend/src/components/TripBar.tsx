import { FileText, Map as MapIcon, Navigation, PencilLine } from 'lucide-react';
import type { TripRequest } from '../types';

export type View = 'route' | 'directions' | 'logs';

interface Props {
  request: TripRequest;
  view: View;
  logCount: number;
  onEdit: () => void;
}

export function TripBar({ request, view, logCount, onEdit }: Props) {
  const tabs = [
    { id: 'route', label: 'Route', icon: MapIcon },
    { id: 'directions', label: 'Directions', icon: Navigation },
    { id: 'logs', label: `Logs · ${logCount}`, icon: FileText },
  ] as const;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[700] flex flex-wrap items-center gap-2 p-3 sm:gap-3 sm:p-4">
      <div className="pointer-events-auto flex h-11 items-center rounded-full bg-brand-950/90 px-4 shadow-float backdrop-blur-xl">
        <img src="/logo.png" alt="spotter.ai" width={98} height={24} className="h-6 w-auto" />
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="glass pointer-events-auto order-3 flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full px-4 text-left text-[13.5px] transition hover:bg-white sm:order-none sm:max-w-[620px] sm:flex-none"
      >
        <span className="size-2 shrink-0 rounded-full bg-ink" />
        <span className="truncate text-ink">{request.current_location}</span>
        <span className="shrink-0 text-faint">→</span>
        <span className="size-2 shrink-0 rounded-full bg-brand-500" />
        <span className="truncate text-ink">{request.pickup_location}</span>
        <span className="shrink-0 text-faint">→</span>
        <span className="size-2 shrink-0 rounded-full bg-coral" />
        <span className="truncate text-ink">{request.dropoff_location}</span>
        <span className="hidden shrink-0 text-muted md:inline">· {request.cycle_used_hours} hrs used</span>
        <PencilLine className="ml-auto size-4 shrink-0 text-muted" aria-label="Edit trip" />
      </button>

      <nav className="glass pointer-events-auto ml-auto flex h-11 items-center rounded-full p-1" aria-label="Result views" role="tablist">
        {tabs.map((tab) => (
          <a
            key={tab.id}
            href={`#${tab.id}`}
            role="tab"
            aria-selected={view === tab.id}
            aria-label={tab.label}
            className={`flex h-full items-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition ${view === tab.id ? 'bg-brand-900 text-white' : 'text-muted hover:text-ink'}`}
          >
            <tab.icon className="size-4" aria-hidden />
            <span className={tab.id === view ? '' : 'hidden sm:inline'}>{tab.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
