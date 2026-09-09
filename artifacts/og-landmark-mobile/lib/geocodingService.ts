/**
 * OG Landmark — Geocoding Service
 * Wraps Google Maps Platform APIs:
 *   • Places Autocomplete (Pakistan-scoped)
 *   • Place Details (structured address + lat/lng)
 *   • Geocoding / reverse geocoding with structured address parsing
 *
 * All calls are client-side (React Native → Google APIs directly),
 * using the EXPO_PUBLIC_GOOGLE_MAPS_API_KEY Metro inlines at build time.
 */
import { Platform } from 'react-native';
import type { LocationData } from './locationService';

const API_KEY       = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const PLACES_BASE   = 'https://maps.googleapis.com/maps/api/place';
const GEOCODE_BASE  = 'https://maps.googleapis.com/maps/api/geocode';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AutocompleteSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText?: string;
}

export interface PlaceResult extends LocationData {
  name: string;
  placeId: string;
}

// ─── Address component parsing ─────────────────────────────────────────────────

interface RawComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

function pick(components: RawComponent[], ...types: string[]): string {
  for (const type of types) {
    const c = components.find((x) => x.types.includes(type));
    if (c) return c.long_name;
  }
  return '';
}

function parseComponents(components: RawComponent[]): Partial<LocationData> {
  return {
    streetAddress: [
      pick(components, 'street_number'),
      pick(components, 'route'),
    ].filter(Boolean).join(' ') || undefined,
    locality:    pick(components, 'sublocality_level_1', 'sublocality', 'neighborhood', 'locality') || undefined,
    city:        pick(components, 'locality', 'postal_town', 'administrative_area_level_2') || undefined,
    district:    pick(components, 'administrative_area_level_2', 'administrative_area_level_3') || undefined,
    province:    pick(components, 'administrative_area_level_1') || undefined,
    postalCode:  pick(components, 'postal_code') || undefined,
    country:     pick(components, 'country') || undefined,
  };
}

// ─── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string): Promise<T | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── Places Autocomplete ───────────────────────────────────────────────────────

/**
 * Get address suggestions for the given input string.
 * Scoped to Pakistan, English results.
 */
export async function fetchAutocompleteSuggestions(
  input: string,
  sessionToken?: string,
): Promise<AutocompleteSuggestion[]> {
  if (!input.trim()) return [];

  let url =
    `${PLACES_BASE}/autocomplete/json` +
    `?input=${encodeURIComponent(input)}` +
    `&key=${API_KEY}` +
    `&components=country:pk` +
    `&language=en` +
    `&types=geocode|establishment`;

  if (sessionToken) url += `&sessiontoken=${encodeURIComponent(sessionToken)}`;

  const data = await apiFetch<{ predictions: any[]; status: string }>(url);
  if (!data?.predictions) return [];

  return data.predictions.map((p: any) => ({
    placeId:       p.place_id,
    description:   p.description,
    mainText:      p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text,
  }));
}

// ─── Place Details ─────────────────────────────────────────────────────────────

/**
 * Fetch full details for a Place ID.
 * Returns a structured LocationData object.
 */
export async function fetchPlaceDetails(
  placeId: string,
  sessionToken?: string,
): Promise<PlaceResult | null> {
  let url =
    `${PLACES_BASE}/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=name,geometry,formatted_address,address_components` +
    `&key=${API_KEY}` +
    `&language=en`;

  if (sessionToken) url += `&sessiontoken=${encodeURIComponent(sessionToken)}`;

  const data = await apiFetch<{ result: any; status: string }>(url);
  if (!data?.result?.geometry?.location) return null;

  const r    = data.result;
  const loc  = r.geometry.location;
  const comp = parseComponents(r.address_components ?? []);

  return {
    latitude:     parseFloat(Number(loc.lat).toFixed(7)),
    longitude:    parseFloat(Number(loc.lng).toFixed(7)),
    fullAddress:  r.formatted_address ?? '',
    name:         r.name ?? '',
    placeId,
    locationSource: 'search',
    ...comp,
  };
}

/**
 * Resolve a selected city/locality to a map center before the user drops an
 * exact property pin. Google Places is preferred when configured; Nominatim is
 * a public fallback for builds that use the Leaflet map without a Google key.
 */
export async function geocodeLocality(
  locality: string,
  city: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const query = `${locality}, ${city}, Pakistan`;

  if (API_KEY) {
    const suggestions = await fetchAutocompleteSuggestions(query);
    const first = suggestions[0];
    if (first) {
      const details = await fetchPlaceDetails(first.placeId);
      if (details) return { latitude: details.latitude, longitude: details.longitude };
    }
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=pk&accept-language=en&q=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'OG-Landmark-Mobile/1.0',
        },
      },
    );
    if (!response.ok) return null;
    const results = await response.json() as Array<{ lat?: string; lon?: string }>;
    const result = results[0];
    const latitude = Number(result?.lat);
    const longitude = Number(result?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

// ─── Reverse Geocoding ─────────────────────────────────────────────────────────

/**
 * Reverse-geocode a lat/lng to a full structured address.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<PlaceResult | null> {
  // The native Google endpoint is not used in the browser because the
  // browser build does not always receive the native public key. Nominatim
  // gives the web picker a real address instead of silently returning blank.
  if (Platform.OS === 'web') {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1&accept-language=en`,
        { headers: { Accept: 'application/json' } },
      );
      if (response.ok) {
        const result = await response.json() as {
          display_name?: string;
          place_id?: number;
          address?: Record<string, string>;
        };
        const a = result.address ?? {};
        return {
          latitude: parseFloat(lat.toFixed(7)),
          longitude: parseFloat(lng.toFixed(7)),
          fullAddress: result.display_name ?? '',
          streetAddress: [a.house_number, a.road].filter(Boolean).join(' ') || undefined,
          locality: a.neighbourhood ?? a.suburb ?? a.village ?? a.town ?? undefined,
          city: a.city ?? a.town ?? a.village ?? undefined,
          district: a.county ?? a.state_district ?? undefined,
          province: a.state ?? undefined,
          postalCode: a.postcode ?? undefined,
          country: a.country ?? undefined,
          placeId: result.place_id ? String(result.place_id) : '',
          name: '',
          locationSource: 'map_tap',
        };
      }
    } catch {
      // Fall through to the coordinate result below so the pin is never lost.
    }
    return {
      latitude: parseFloat(lat.toFixed(7)),
      longitude: parseFloat(lng.toFixed(7)),
      fullAddress: `Pinned location · ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      name: '',
      placeId: '',
      locationSource: 'map_tap',
    };
  }

  const url =
    `${GEOCODE_BASE}/json` +
    `?latlng=${lat},${lng}` +
    `&key=${API_KEY}` +
    `&language=en`;

  const data = await apiFetch<{ results: any[]; status: string }>(url);
  if (!data?.results?.length) return null;

  const r    = data.results[0];
  const comp = parseComponents(r.address_components ?? []);

  return {
    latitude:       parseFloat(lat.toFixed(7)),
    longitude:      parseFloat(lng.toFixed(7)),
    fullAddress:    r.formatted_address ?? '',
    name:           '',
    placeId:        r.place_id ?? '',
    locationSource: 'map_tap',
    ...comp,
  };
}

/**
 * Convenience: reverse-geocode and return just the formatted address string.
 */
export async function reverseGeocodeAddress(lat: number, lng: number): Promise<string> {
  const result = await reverseGeocode(lat, lng);
  return result?.fullAddress ?? '';
}
