const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas';

export const TILE_LAYERS = [
  `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
  `${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
];

export const TILE_ATTRIBUTION = 'Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors · Towns &copy; GeoNames';

const CONTIGUOUS_US = { north: 50, south: 24, west: -125, east: -66 };
const LANDING_ZOOMS = [4, 5];
const requested = new Set<string>();

export interface TileRange {
  z: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function tileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

function tileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

export function warmTiles({ z, minX, maxX, minY, maxY }: TileRange): void {
  const last = 2 ** z - 1;
  for (let y = Math.max(0, minY); y <= Math.min(last, maxY); y++) {
    for (let x = minX; x <= maxX; x++) {
      const wrapped = ((x % (last + 1)) + last + 1) % (last + 1);
      for (const template of TILE_LAYERS) {
        const url = template.replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(wrapped));
        if (requested.has(url)) continue;
        requested.add(url);
        new Image().src = url;
      }
    }
  }
}

export function warmContiguousUs(): void {
  for (const z of LANDING_ZOOMS) {
    warmTiles({
      z,
      minX: tileX(CONTIGUOUS_US.west, z),
      maxX: tileX(CONTIGUOUS_US.east, z),
      minY: tileY(CONTIGUOUS_US.north, z),
      maxY: tileY(CONTIGUOUS_US.south, z),
    });
  }
}
