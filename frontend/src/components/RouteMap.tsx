import { useEffect, useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import { Navigation, Truck } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { STOP_COLOR, STOP_LABEL, clock, dayLabel, hours } from '../format';
import { STOP_ICON } from './stopIcons';
import { TILE_ATTRIBUTION, TILE_LAYERS, warmTiles } from '../tiles';
import type { Stop } from '../types';

const US_CENTER: L.LatLngTuple = [39.5, -96.5];
const FIT_TOP_LEFT: L.PointExpression = [48, 96];
const FIT_BOTTOM_RIGHT: L.PointExpression = [48, 260];
const TILE_SIZE = 256;

function stopIcon(stop: Stop, active: boolean) {
  const Icon = STOP_ICON[stop.type];
  return L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div class="stop-pin" data-active="${active}" style="background:${STOP_COLOR[stop.type]}">${renderToStaticMarkup(<Icon size={14} strokeWidth={2.4} />)}</div>`,
  });
}

const TRUCK_ICON = L.divIcon({
  className: '',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  html: `<div class="truck-pin">${renderToStaticMarkup(<Truck size={17} strokeWidth={2.4} />)}</div>`,
});

const STEP_ICON = L.divIcon({
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  html: `<div class="relative flex size-10 items-center justify-center rounded-full bg-brand-900 text-white shadow-2xl ring-4 ring-brand-400/70 animate-bounce"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg></div>`,
});

function FitRoute({ route }: { route: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (route.length) map.fitBounds(L.latLngBounds(route), { paddingTopLeft: FIT_TOP_LEFT, paddingBottomRight: FIT_BOTTOM_RIGHT });
  }, [map, route]);
  return null;
}

function PrefetchNeighbours() {
  const map = useMap();
  useEffect(() => {
    const warm = () => {
      const view = map.getPixelBounds();
      const size = map.getSize();
      warmTiles({
        z: map.getZoom(),
        minX: Math.floor((view.min!.x - size.x) / TILE_SIZE),
        maxX: Math.floor((view.max!.x + size.x) / TILE_SIZE),
        minY: Math.floor((view.min!.y - size.y) / TILE_SIZE),
        maxY: Math.floor((view.max!.y + size.y) / TILE_SIZE),
      });
    };
    map.on('moveend', warm);
    return () => {
      map.off('moveend', warm);
    };
  }, [map]);
  return null;
}

export interface FocusedStep {
  lat: number;
  lng: number;
  instruction: string;
  miles: number;
  stepNumber: number;
}

function FocusStop({ stop }: { stop: Stop | null }) {
  const map = useMap();
  useEffect(() => {
    if (stop) map.flyTo([stop.lat, stop.lng], Math.max(map.getZoom(), 7), { duration: 0.6 });
  }, [map, stop]);
  return null;
}

function FocusManeuver({ step }: { step: FocusedStep | null }) {
  const map = useMap();
  useEffect(() => {
    if (step) {
      map.flyTo([step.lat, step.lng], 16, { duration: 0.8 });
    }
  }, [map, step]);
  return null;
}

interface Props {
  route: [number, number][];
  stops: Stop[];
  truck: [number, number] | null;
  selected: number | null;
  hovered: number | null;
  focusedStep?: FocusedStep | null;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
}

export function RouteMap({ route, stops, truck, selected, hovered, focusedStep, onSelect, onHover }: Props) {
  const icons = useMemo(
    () => stops.map((stop, i) => stopIcon(stop, i === selected || i === hovered)),
    [stops, selected, hovered],
  );

  return (
    <MapContainer center={US_CENTER} zoom={4} zoomControl={false} className="isolate size-full" worldCopyJump>
      {TILE_LAYERS.map((url, i) => (
        <TileLayer
          key={url}
          url={url}
          attribution={i === 0 ? TILE_ATTRIBUTION : undefined}
          maxZoom={18}
          keepBuffer={4}
        />
      ))}
      <PrefetchNeighbours />
      <ZoomControl position="topleft" />
      <FitRoute route={route} />
      <FocusStop stop={selected === null ? null : stops[selected]} />
      <FocusManeuver step={focusedStep ?? null} />
      <Polyline positions={route} pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }} />
      <Polyline positions={route} pathOptions={{ color: '#00807C', weight: 4.5 }} />
      {stops.map((stop, i) => {
        let position: [number, number] = [stop.lat, stop.lng];
        const isDuplicate = stops.findIndex((s, idx) => idx < i && Math.abs(s.lat - stop.lat) < 1e-4 && Math.abs(s.lng - stop.lng) < 1e-4) !== -1;
        if (isDuplicate) {
          position = [stop.lat + 0.0018, stop.lng + 0.0018];
        }
        return (
          <Marker
            key={`${stop.type}-${stop.arrival}-${i}`}
            position={position}
            icon={icons[i]}
            zIndexOffset={i === selected ? 1000 : isDuplicate ? 100 : 0}
            eventHandlers={{
              click: () => onSelect(i),
              mouseover: () => onHover(i),
              mouseout: () => onHover(null),
            }}
          >
          <Popup>
            <p className="font-semibold text-ink">{stop.name}</p>
            <p className="text-[12px] font-medium" style={{ color: STOP_COLOR[stop.type] }}>
              {STOP_LABEL[stop.type]}
            </p>
            <p className="mt-1 font-mono text-[12px] text-muted">
              {dayLabel(stop.arrival)} · {clock(stop.arrival)} to {clock(stop.departure)}
              {stop.duration_hours > 0 && ` · ${hours(stop.duration_hours)} hr`}
            </p>
            <p className="mt-1 text-[12px] text-muted">{stop.reason}</p>
          </Popup>
        </Marker>
        );
      })}
      {focusedStep && (
        <Marker
          position={[focusedStep.lat, focusedStep.lng]}
          icon={STEP_ICON}
          zIndexOffset={3000}
        >
          <Popup autoPan={false}>
            <div className="min-w-[180px] p-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-700">
                <Navigation className="size-3" />
                <span>Step {focusedStep.stepNumber}</span>
              </div>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-ink">
                {focusedStep.instruction}
              </p>
              <p className="mt-1 font-mono text-[11.5px] text-muted">
                {focusedStep.miles > 0 ? `${focusedStep.miles} mi` : 'Arrival'}
              </p>
            </div>
          </Popup>
        </Marker>
      )}
      {truck && <Marker position={truck} icon={TRUCK_ICON} zIndexOffset={2000} interactive={false} />}
    </MapContainer>
  );
}
