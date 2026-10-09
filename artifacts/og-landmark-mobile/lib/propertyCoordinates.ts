export type PropertyCoordinateSource = {
  lat?: number | null;
  lng?: number | null;
  location?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};

export type PropertyCoordinates = {
  latitude: number;
  longitude: number;
};

function hasValidCoords(latitude?: number | null, longitude?: number | null): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function getPropertyCoordinates(property: PropertyCoordinateSource): PropertyCoordinates | null {
  if (hasValidCoords(property.lat, property.lng)) {
    return { latitude: property.lat!, longitude: property.lng! };
  }

  const latitude = property.location?.latitude;
  const longitude = property.location?.longitude;
  return hasValidCoords(latitude, longitude) ? { latitude: latitude!, longitude: longitude! } : null;
}

export function formatPropertyCoordinates(coordinates: PropertyCoordinates): string {
  return `${coordinates.latitude.toFixed(7)}, ${coordinates.longitude.toFixed(7)}`;
}
