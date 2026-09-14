import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  accuracyLabel,
  classifyAccuracy,
  createGpsLocationData,
  getCurrentPositionFromProvider,
  lowAccuracyMessage,
  type LocationPosition,
  type LocationProvider,
} from '../lib/locationFlow';
import {
  parseGoogleAddressComponents,
  parseNominatimAddress,
} from '../lib/addressParsing';
import { buildCreatePropertyPayload } from '../lib/listingPayload';

function position(
  latitude = 30.807712345,
  longitude = 73.456198765,
  accuracy = 12,
): LocationPosition {
  return { coords: { latitude, longitude, accuracy } };
}

function provider(overrides: Partial<LocationProvider> = {}): LocationProvider {
  return {
    Accuracy: { High: 'high', Balanced: 'balanced' },
    getForegroundPermissionsAsync: async () => ({
      granted: true,
      status: 'granted',
      canAskAgain: true,
    }),
    requestForegroundPermissionsAsync: async () => ({
      granted: true,
      status: 'granted',
      canAskAgain: true,
    }),
    hasServicesEnabledAsync: async () => true,
    getCurrentPositionAsync: async () => position(),
    getLastKnownPositionAsync: async () => null,
    ...overrides,
  };
}

test('classifies accuracy at every boundary and gives actionable low-accuracy guidance', () => {
  assert.equal(classifyAccuracy(20), 'high');
  assert.equal(classifyAccuracy(20.01), 'medium');
  assert.equal(classifyAccuracy(100), 'medium');
  assert.equal(classifyAccuracy(100.01), 'low');
  assert.equal(classifyAccuracy(500), 'low');
  assert.equal(classifyAccuracy(500.01), 'unknown');
  assert.match(accuracyLabel('low'), /move outdoors|adjust pin manually/i);
  assert.match(lowAccuracyMessage(347.8), /348 metres/i);
  assert.match(lowAccuracyMessage(347.8), /continue|move outdoors|adjust the pin manually/i);
});

test('keeps Google city, district, tehsil, locality, and street fields separate', () => {
  const parsed = parseGoogleAddressComponents([
    { long_name: '12', types: ['street_number'] },
    { long_name: 'Main Road', types: ['route'] },
    { long_name: 'Model Town', types: ['sublocality_level_1'] },
    { long_name: 'Depalpur', types: ['locality'] },
    { long_name: 'Depalpur Tehsil', types: ['administrative_area_level_3'] },
    { long_name: 'Okara District', types: ['administrative_area_level_2'] },
    { long_name: 'Punjab', types: ['administrative_area_level_1'] },
    { long_name: '56300', types: ['postal_code'] },
    { long_name: 'Pakistan', types: ['country'] },
  ]);

  assert.deepEqual(parsed, {
    streetAddress: '12 Main Road',
    locality: 'Model Town',
    city: 'Depalpur',
    district: 'Okara District',
    tehsil: 'Depalpur Tehsil',
    province: 'Punjab',
    postalCode: '56300',
    country: 'Pakistan',
  });
});

test('uses Nominatim fallbacks for Pakistani administrative fields', () => {
  assert.deepEqual(parseNominatimAddress({
    house_number: '12',
    road: 'Main Road',
    neighbourhood: 'Model Town',
    town: 'Depalpur',
    city_district: 'Depalpur Tehsil',
    county: 'Okara District',
    state: 'Punjab',
    postcode: '56300',
    country: 'Pakistan',
  }), {
    streetAddress: '12 Main Road',
    locality: 'Model Town',
    city: 'Depalpur',
    district: 'Okara District',
    tehsil: 'Depalpur Tehsil',
    province: 'Punjab',
    postalCode: '56300',
    country: 'Pakistan',
  });
});

test('stops after a permanently denied location permission and reports recovery state', async () => {
  let requestCalls = 0;
  const failures: string[] = [];
  let deniedCanAskAgain: boolean | undefined;
  const result = await getCurrentPositionFromProvider(provider({
    getForegroundPermissionsAsync: async () => ({
      granted: false,
      status: 'denied',
      canAskAgain: false,
    }),
    requestForegroundPermissionsAsync: async () => {
      requestCalls += 1;
      return { granted: false, status: 'denied', canAskAgain: false };
    },
  }), {
    onPermissionDenied: (permission) => { deniedCanAskAgain = permission.canAskAgain; },
    onUnavailable: (reason) => failures.push(reason),
  });

  assert.equal(result, null);
  assert.equal(requestCalls, 0);
  assert.equal(deniedCanAskAgain, false);
  assert.deepEqual(failures, ['permission-denied']);
});

test('reports disabled Location Services before attempting GPS', async () => {
  let positionCalls = 0;
  const failures: string[] = [];
  const result = await getCurrentPositionFromProvider(provider({
    hasServicesEnabledAsync: async () => false,
    getCurrentPositionAsync: async () => {
      positionCalls += 1;
      return position();
    },
  }), {
    onServicesDisabled: () => failures.push('services-disabled'),
  });

  assert.equal(result, null);
  assert.equal(positionCalls, 0);
  assert.deepEqual(failures, ['services-disabled']);
});

test('falls through high and balanced GPS timeouts without hanging the listing form', async () => {
  const requestedAccuracies: unknown[] = [];
  const failures: string[] = [];
  const result = await getCurrentPositionFromProvider(provider({
    getCurrentPositionAsync: async ({ accuracy }) => {
      requestedAccuracies.push(accuracy);
      return new Promise<LocationPosition>(() => {});
    },
  }), {
    highAccuracyTimeoutMs: 5,
    balancedAccuracyTimeoutMs: 5,
    onUnavailable: (reason) => failures.push(reason),
  });

  assert.equal(result, null);
  assert.deepEqual(requestedAccuracies, ['high', 'balanced']);
  assert.deepEqual(failures, ['timeout']);
});

test('uses the last-known position when fresh GPS attempts reject', async () => {
  const result = await getCurrentPositionFromProvider(provider({
    getCurrentPositionAsync: async () => {
      throw new Error('GPS warming up');
    },
    getLastKnownPositionAsync: async () => position(30.7, 73.4, 80),
  }), {
    highAccuracyTimeoutMs: 5,
    balancedAccuracyTimeoutMs: 5,
  });

  assert.deepEqual(result, {
    latitude: 30.7,
    longitude: 73.4,
    accuracy: 80,
    accuracyLevel: 'medium',
  });
});

test('propagates successful GPS and mocked reverse-geocoding into the listing payload', async () => {
  const gps = await getCurrentPositionFromProvider(provider({
    getCurrentPositionAsync: async () => position(30.807712345, 73.456198765, 12),
  }));
  assert.ok(gps);

  const reverseGeocode = async () => ({
    fullAddress: 'Street 4, Okara',
    streetAddress: 'Street 4',
    city: 'Okara',
    locality: 'Model Town',
    district: 'Okara',
    province: 'Punjab',
    country: 'Pakistan',
    postalCode: '56300',
    placeId: 'mock-place-id',
  });
  const location = createGpsLocationData(gps, await reverseGeocode());
  const payload = buildCreatePropertyPayload({
    title: 'GPS listing',
    type: 'House',
    status: 'For Sale',
    price: 25000000,
    area: 10,
    areaUnit: 'Marla',
    bedrooms: 3,
    bathrooms: 2,
    city: location.city ?? 'Okara',
    neighborhood: location.locality ?? '',
    fullAddress: location.fullAddress,
    description: 'A listing with a verified GPS pin.',
    latitude: location.latitude,
    longitude: location.longitude,
    district: location.district,
    locality: location.locality,
    streetAddress: location.streetAddress,
    images: [],
    locationSource: location.locationSource,
    locationAccuracy: location.accuracy,
    placeId: location.placeId,
  });

  assert.equal(location.locationSource, 'gps');
  assert.equal(location.fullAddress, 'Street 4, Okara');
  assert.equal(payload.lat, 30.8077123);
  assert.equal(payload.lng, 73.4561988);
  assert.deepEqual(payload.location, {
    latitude: 30.8077123,
    longitude: 73.4561988,
    city: 'Okara',
    district: 'Okara',
    tehsil: undefined,
    locality: 'Model Town',
    streetAddress: 'Street 4',
    address: 'Street 4, Okara',
    source: 'gps',
    accuracy: 12,
    placeId: 'mock-place-id',
  });
});

test('keeps structured address fields in the final listing location payload', () => {
  const payload = buildCreatePropertyPayload({
    title: 'Depalpur listing',
    type: 'House',
    status: 'For Sale',
    price: 18000000,
    area: 5,
    areaUnit: 'Marla',
    bedrooms: 3,
    bathrooms: 2,
    city: 'Depalpur',
    neighborhood: 'Model Town',
    fullAddress: '12 Main Road, Model Town, Depalpur',
    streetAddress: '12 Main Road',
    district: 'Okara District',
    tehsil: 'Depalpur Tehsil',
    locality: 'Model Town',
    description: 'Structured location regression fixture.',
    latitude: 30.67,
    longitude: 73.65,
    locationSource: 'search',
    placeId: 'dep-12',
  });

  assert.equal(payload.city, 'Depalpur');
  assert.equal(payload.district, 'Okara District');
  assert.equal(payload.tehsil, 'Depalpur Tehsil');
  assert.deepEqual(payload.location, {
    latitude: 30.67,
    longitude: 73.65,
    city: 'Depalpur',
    district: 'Okara District',
    tehsil: 'Depalpur Tehsil',
    locality: 'Model Town',
    streetAddress: '12 Main Road',
    address: '12 Main Road, Model Town, Depalpur',
    source: 'search',
    accuracy: undefined,
    placeId: 'dep-12',
  });
});