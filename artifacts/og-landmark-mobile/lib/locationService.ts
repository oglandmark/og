/**
 * OG Landmark — Location Service
 * GPS permissions, current position, accuracy classification,
 * haversine distance, "Near Me" support.
 */
import * as ExpoLocation from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import {
  accuracyColor,
  accuracyLabel,
  classifyAccuracy,
  getCurrentPositionFromProvider,
} from './locationFlow';
import type { GPSResult } from './locationFlow';
export {
  accuracyColor,
  accuracyLabel,
  classifyAccuracy,
  type AccuracyLevel,
  type GPSResult,
} from './locationFlow';
export type { LocationProvider } from './locationFlow';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LocationData {
  latitude: number;
  longitude: number;
  fullAddress: string;
  streetAddress?: string;
  locality?: string;         // area / neighbourhood
  city?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  placeId?: string;
  accuracy?: number;
  locationSource: 'gps' | 'search' | 'map_tap' | 'manual';
}

// ─── Accuracy helpers ──────────────────────────────────────────────────────────

// ─── Permissions ───────────────────────────────────────────────────────────────

/**
 * Request foreground location permission.
 * Returns true if granted; shows user-friendly alert and returns false otherwise.
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    // Check the existing permission first. Calling requestForegroundPermissionsAsync
    // on every tap can make Android repeat its permission flow even after access
    // has already been granted.
    const existing = await ExpoLocation.getForegroundPermissionsAsync();
    if (existing.granted) return true;

    const permission = existing.status === 'undetermined' || existing.canAskAgain
      ? await ExpoLocation.requestForegroundPermissionsAsync()
      : existing;
    const { status, canAskAgain } = permission;
    if (status === 'granted') return true;

    if (!canAskAgain) {
      Alert.alert(
        'Location Permission Required',
        'Location access is permanently denied. Please enable it in Settings to use GPS features.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    } else {
      Alert.alert(
        'Location Permission',
        'Allow location access to use GPS features like "Use My Location" and "Near Me".',
      );
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Get current GPS position ──────────────────────────────────────────────────

/**
 * Get current device GPS position.
 * Tries high accuracy first; falls back to balanced if it times out.
 */
export async function getCurrentPosition(): Promise<GPSResult | null> {
  try {
    if (Platform.OS === 'web') {
      if (!navigator.geolocation) {
        Alert.alert('Location Unavailable', 'This browser does not provide location services.');
        return null;
      }

      const position = await new Promise<GeolocationPosition | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          () => resolve(null),
          { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
        );
      });
      if (!position) {
        Alert.alert('Location Unavailable', 'Could not get your current location. Check browser location access and try again.');
        return null;
      }

      const accuracy = position.coords.accuracy ?? 999;
      return {
        latitude: parseFloat(position.coords.latitude.toFixed(7)),
        longitude: parseFloat(position.coords.longitude.toFixed(7)),
        accuracy,
        accuracyLevel: classifyAccuracy(accuracy),
      };
    }

    return getCurrentPositionFromProvider(ExpoLocation, {
      onPermissionDenied: ({ canAskAgain }) => {
        if (!canAskAgain) {
          Alert.alert(
            'Location Permission Required',
            'Location access is permanently denied. Please enable it in Settings to use GPS features.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
        } else {
          Alert.alert(
            'Location Permission',
            'Allow location access to use GPS features like "Use My Location" and "Near Me".',
          );
        }
      },
      onServicesDisabled: () => {
        Alert.alert(
          'Turn On Location Services',
          'GPS is currently disabled. Turn on Location Services, then try again. You can also search an address or enter coordinates manually.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      },
      onUnavailable: (reason) => {
        if (reason === 'permission-denied' || reason === 'services-disabled') return;
        Alert.alert(
          'Location Unavailable',
          reason === 'timeout'
            ? 'GPS could not return a position yet. Keep Location Services on and try Use My Location again.'
            : 'Could not get your current location. Make sure GPS is enabled and try again.',
        );
      },
    });
  } catch (err) {
    Alert.alert(
      'Location Unavailable',
      'Could not get your current location. Make sure GPS is enabled and try again.',
    );
    return null;
  }
}

// ─── Distance calculation ──────────────────────────────────────────────────────

const R = 6371; // Earth radius in km

/**
 * Haversine distance between two lat/lng points in kilometres.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Format distance for display on property cards.
 * e.g. "350 m away" or "2.4 km away"
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

// ─── Open in maps ──────────────────────────────────────────────────────────────

export function openGoogleMaps(lat: number, lng: number, label?: string) {
  const encoded = encodeURIComponent(label ?? `${lat},${lng}`);
  const url = Platform.select({
    ios:     `maps://0,0?q=${encoded}@${lat},${lng}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${encoded})`,
    default: `https://www.google.com/maps?q=${lat},${lng}`,
  });
  Linking.openURL(url ?? `https://www.google.com/maps?q=${lat},${lng}`)
    .catch(() => Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`));
}

export function getDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export function openDirections(lat: number, lng: number) {
  Linking.openURL(getDirectionsUrl(lat, lng)).catch(() => undefined);
}
