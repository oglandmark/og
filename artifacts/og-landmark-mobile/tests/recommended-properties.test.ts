import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectRecommendedProperties } from '../lib/recommendedProperties';

const listings = [
  { id: 1, status: 'For Sale', recommended: true },
  { id: 2, status: 'For Rent', recommended: true },
  { id: 3, status: 'For Sale', recommended: false },
  { id: 4, status: 'For Sale', isDemo: true },
];

test('live Home recommendations follow the Admin selection and active transaction', () => {
  assert.deepEqual(selectRecommendedProperties(listings, 'Buy').map(({ id }) => id), [1]);
  assert.deepEqual(selectRecommendedProperties(listings, 'Rent').map(({ id }) => id), [2]);
});

test('bundled demo listings preserve the existing recommendation fallback', () => {
  assert.deepEqual(
    selectRecommendedProperties(listings, 'Buy', true).map(({ id }) => id),
    [1, 4],
  );
  assert.deepEqual(
    selectRecommendedProperties(listings.filter(({ isDemo }) => isDemo), 'Buy', true).map(({ id }) => id),
    [4],
  );
});

test('demo recommendations are excluded when live API listings are available', () => {
  assert.deepEqual(
    selectRecommendedProperties(listings.filter(({ isDemo }) => isDemo), 'Buy').map(({ id }) => id),
    [],
  );
});

test('Home shows at most eight recommended listings', () => {
  const many = Array.from({ length: 12 }, (_, index) => ({
    id: index,
    status: 'For Sale',
    recommended: true,
  }));
  assert.equal(selectRecommendedProperties(many, 'Buy').length, 8);
});
