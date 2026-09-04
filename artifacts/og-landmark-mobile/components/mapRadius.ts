export const MAP_AREA_RANGE_STEPS = [0.4, 0.9, 4, 10] as const;
export const MAP_AREA_BLUE = '#102A43';
export const MAP_AREA_BLUE_FILL = 'rgba(16,42,67,0.16)';
export const MAP_AREA_MIN_KM = MAP_AREA_RANGE_STEPS[0];
export const MAP_AREA_MAX_KM = MAP_AREA_RANGE_STEPS[MAP_AREA_RANGE_STEPS.length - 1];

export interface MapCoordinate {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
}

export type MapAreaRadiusMessage = {
  type: 'mapAreaRadius';
  radiusKm: number;
  fit?: boolean;
};

export function normalizeMapAreaRange(km: number): number {
  return Number.isFinite(km) && km > 0 ? km : MAP_AREA_RANGE_STEPS[0];
}

export function formatMapAreaRange(km: number): string {
  const safeKm = normalizeMapAreaRange(km);
  return safeKm < 1
    ? `${Math.round(safeKm * 1000)} Meters`
    : `${safeKm} Kilometers`;
}

function coordinateValue(point: MapCoordinate) {
  const latitude = Number(point.latitude ?? point.lat);
  const longitude = Number(point.longitude ?? point.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

export function countPointsWithinRadius(
  points: MapCoordinate[],
  center: { latitude: number; longitude: number },
  radiusKm: number,
): number {
  const earthRadiusKm = 6371;
  const centerLat = (center.latitude * Math.PI) / 180;
  const centerLng = (center.longitude * Math.PI) / 180;
  const safeRadius = Math.max(0, Number(radiusKm) || 0);

  return points.reduce((count, point) => {
    const coordinate = coordinateValue(point);
    if (!coordinate) return count;
    const latitude = (coordinate.latitude * Math.PI) / 180;
    const longitude = (coordinate.longitude * Math.PI) / 180;
    const deltaLat = latitude - centerLat;
    const deltaLng = longitude - centerLng;
    const haversine =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(centerLat) * Math.cos(latitude) * Math.sin(deltaLng / 2) ** 2;
    const distanceKm = 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
    return distanceKm <= safeRadius ? count + 1 : count;
  }, 0);
}

export function createMapAreaRadiusMessage(km: number, fit = false): MapAreaRadiusMessage | null {
  if (!Number.isFinite(km) || km <= 0) return null;
  return { type: 'mapAreaRadius', radiusKm: km, fit };
}

export function createMapAreaRadiusInjection(km: number, fit = false): string | null {
  const message = createMapAreaRadiusMessage(km, fit);
  if (!message) return null;
  return `if (window.__setAreaRadius) window.__setAreaRadius(${message.radiusKm}, ${Boolean(message.fit)}); true;`;
}