import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPropertyCoordinates, getPropertyCoordinates } from '../lib/propertyCoordinates';

test('top-level coordinates are preferred and retain seven decimal places', () => {
  const coordinates = getPropertyCoordinates({
    lat: 30.8077123,
    lng: 73.4561988,
    location: { latitude: 30.8, longitude: 73.4 },
  });

  assert.deepEqual(coordinates, { latitude: 30.8077123, longitude: 73.4561988 });
  assert.equal(formatPropertyCoordinates(coordinates!), '30.8077123, 73.4561988');
});

test('nested location coordinates are used when top-level values are missing', () => {
  assert.deepEqual(
    getPropertyCoordinates({ location: { latitude: 30.8077123, longitude: 73.4561988 } }),
    { latitude: 30.8077123, longitude: 73.4561988 },
  );
});

test('invalid and null-island coordinate pairs are not treated as a pin', () => {
  assert.equal(getPropertyCoordinates({ lat: 0, lng: 0 }), null);
  assert.equal(getPropertyCoordinates({ lat: 91, lng: 73 }), null);
  assert.equal(getPropertyCoordinates({ lat: 30, lng: null }), null);
});
