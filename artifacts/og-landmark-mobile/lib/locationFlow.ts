/**
 * Device-location decision flow.
 *
 * This module intentionally has no React Native or Expo imports. The app passes
 * the real Expo Location provider at runtime, while tests can pass a
 * deterministic provider without requiring a simulator or physical device.
 */

export type AccuracyLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface GPSResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  accuracyLevel: AccuracyLevel;
}

export interface LocationPermission {
  granted: boolean;
  status: string;
  canAskAgain: boolean;
}

export interface LocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  };
}

export interface LocationProvider {
  Accuracy: {
    High: unknown;
    Balanced: unknown;
  };
  getForegroundPermissionsAsync(): Promise<LocationPermission>;
  requestForegroundPermissionsAsync(): Promise<LocationPermission>;
  hasServicesEnabledAsync(): Promise<boolean>;
  getCurrentPositionAsync(options: { accuracy?: any }): Promise<LocationPosition>;
  getLastKnownPositionAsync(): Promise<LocationPosition | null>;
}

export type LocationFlowFailure =
  | 'permission-denied'
  | 'services-disabled'
  | 'timeout'
  | 'unavailable'
  | 'provider-error';

export interface LocationFlowOptions {
  highAccuracyTimeoutMs?: number;
  balancedAccuracyTimeoutMs?: number;
  onPermissionDenied?: (permission: LocationPermission) => void;
  onServicesDisabled?: () => void;
  onUnavailable?: (reason: LocationFlowFailure) => void;
}

export function classifyAccuracy(accuracyMetres: number): AccuracyLevel {
  if (accuracyMetres <= 20) return 'high';
  if (accuracyMetres <= 100) return 'medium';
  if (accuracyMetres <= 500) return 'low';
  return 'unknown';
}

export function accuracyLabel(level: AccuracyLevel): string {
  switch (level) {
    case 'high':
      return 'High accuracy (GPS)';
    case 'medium':
      return 'Medium accuracy';
    case 'low':
      return 'Low accuracy — move outdoors or adjust pin manually';
    default:
      return 'Accuracy unknown';
  }
}

export function accuracyColor(level: AccuracyLevel): string {
  switch (level) {
    case 'high':
      return '#16a34a';
    case 'medium':
      return '#d97706';
    case 'low':
      return '#dc2626';
    default:
      return '#64748b';
  }
}

export function lowAccuracyMessage(accuracyMetres: number): string {
  return `Location accuracy is ${Math.round(accuracyMetres)} metres. You can continue, or move outdoors for better accuracy and adjust the pin manually.`;
}

function normalizePosition(position: LocationPosition): GPSResult {
  const accuracy = position.coords.accuracy ?? 999;
  return {
    latitude: parseFloat(position.coords.latitude.toFixed(7)),
    longitude: parseFloat(position.coords.longitude.toFixed(7)),
    accuracy,
    accuracyLevel: classifyAccuracy(accuracy),
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getPositionAttempt(
  provider: LocationProvider,
  accuracy: unknown,
  timeoutMs: number,
): Promise<LocationPosition | null> {
  try {
    return await withTimeout(provider.getCurrentPositionAsync({ accuracy }), timeoutMs);
  } catch {
    // A native provider can reject when GPS is warming up. Treat that like a
    // timed-out attempt so balanced accuracy and last-known fallback still run.
    return null;
  }
}

/**
 * Resolve a current position with permission, service, timeout, and fallback
 * handling. The callbacks let the UI provide platform-specific recovery copy.
 */
export async function getCurrentPositionFromProvider(
  provider: LocationProvider,
  options: LocationFlowOptions = {},
): Promise<GPSResult | null> {
  const {
    highAccuracyTimeoutMs = 12_000,
    balancedAccuracyTimeoutMs = 10_000,
    onPermissionDenied,
    onServicesDisabled,
    onUnavailable,
  } = options;

  try {
    const existing = await provider.getForegroundPermissionsAsync();
    const permission =
      existing.granted ||
      (existing.status !== 'undetermined' && !existing.canAskAgain)
        ? existing
        : await provider.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      onPermissionDenied?.(permission);
      onUnavailable?.('permission-denied');
      return null;
    }

    if (!(await provider.hasServicesEnabledAsync())) {
      onServicesDisabled?.();
      onUnavailable?.('services-disabled');
      return null;
    }

    const position =
      (await getPositionAttempt(provider, provider.Accuracy.High, highAccuracyTimeoutMs)) ??
      (await getPositionAttempt(provider, provider.Accuracy.Balanced, balancedAccuracyTimeoutMs)) ??
      (await provider.getLastKnownPositionAsync().catch(() => null));

    if (!position) {
      onUnavailable?.('timeout');
      return null;
    }

    return normalizePosition(position);
  } catch {
    onUnavailable?.('provider-error');
    return null;
  }
}

export interface ReverseGeocodeResult {
  fullAddress?: string;
  city?: string;
  locality?: string;
  district?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  placeId?: string;
}

export interface GPSLocationData extends ReverseGeocodeResult {
  latitude: number;
  longitude: number;
  fullAddress: string;
  accuracy: number;
  locationSource: 'gps';
}

export function createGpsLocationData(
  position: GPSResult,
  reverseGeocoded: ReverseGeocodeResult | null,
): GPSLocationData {
  return {
    latitude: position.latitude,
    longitude: position.longitude,
    fullAddress: reverseGeocoded?.fullAddress ?? '',
    city: reverseGeocoded?.city,
    locality: reverseGeocoded?.locality,
    district: reverseGeocoded?.district,
    province: reverseGeocoded?.province,
    country: reverseGeocoded?.country,
    postalCode: reverseGeocoded?.postalCode,
    placeId: reverseGeocoded?.placeId,
    accuracy: position.accuracy,
    locationSource: 'gps',
  };
}