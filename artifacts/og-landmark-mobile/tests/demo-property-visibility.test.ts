import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  filterVisibleDemoProperties,
  isDemoPropertyHidden,
  keepCachedPropertiesWhenRemoteIsEmpty,
  selectHomePropertySource,
} from '../lib/demoPropertyVisibility';

const mobileRoot = resolve(import.meta.dirname, '..');

function readScreen(...segments: string[]): string {
  return readFileSync(resolve(mobileRoot, ...segments), 'utf8');
}

const demos = [
  { id: 101, isDemo: true, title: 'Hidden demo' },
  { id: 102, isDemo: true, title: 'Visible demo' },
  { id: 103, isDemo: false, title: 'Live listing' },
];

test('hidden demos stay out of demo-backed views when the property API is empty or unavailable', () => {
  const hiddenIds = [101];
  const expected = [102, 103];

  // Home chooses the bundled catalog for either an empty response or a failed request.
  for (const apiProperties of [[], undefined]) {
    const homeSource = selectHomePropertySource(apiProperties ?? [], demos);
    assert.deepEqual(
      filterVisibleDemoProperties(homeSource, hiddenIds).map(({ id }) => id),
      expected,
    );
  }

  // Explore starts from its local cache and keeps it when the API is empty or fails.
  const cachedProperties = [...demos];
  for (const remoteProperties of [[], undefined]) {
    const preserved = keepCachedPropertiesWhenRemoteIsEmpty(
      cachedProperties,
      remoteProperties ?? [],
    );
    assert.deepEqual(
      filterVisibleDemoProperties(preserved, hiddenIds).map(({ id }) => id),
      expected,
    );
  }
});

test('restoring a demo makes it visible again in list views and property detail', () => {
  const restoredHiddenIds: number[] = [];

  assert.deepEqual(
    filterVisibleDemoProperties(demos, restoredHiddenIds).map(({ id }) => id),
    [101, 102, 103],
  );
  assert.equal(isDemoPropertyHidden(demos[0]!, restoredHiddenIds), false);
});

test('only the hidden demo is blocked from a direct property-detail route', () => {
  assert.equal(isDemoPropertyHidden(demos[0]!, [101]), true);
  assert.equal(isDemoPropertyHidden(demos[2]!, [103]), false);
});

test('Home, Explore, saved, detail, and Agent views use the shared visibility rules', () => {
  const screens = [
    {
      name: 'Home',
      source: readScreen('app', '(tabs)', 'index.tsx'),
      expected: /filterVisibleDemoProperties\(propertySource,\s*hiddenDemoPropertyIds\)/,
    },
    {
      name: 'Explore',
      source: readScreen('app', '(tabs)', 'explore.tsx'),
      expected: /filterVisibleDemoProperties\(allProperties,\s*hiddenDemoPropertyIds\)/,
    },
    {
      name: 'saved properties',
      source: readScreen('app', '(tabs)', 'saved.tsx'),
      expected: /filterVisibleDemoProperties\(\s*properties\.filter\(\(property\) => savedIds\.includes\(property\.id\)\),\s*hiddenDemoPropertyIds/,
    },
    {
      name: 'property detail',
      source: readScreen('app', 'property', '[id].tsx'),
      expected: /isDemoPropertyHidden\(property,\s*hiddenDemoPropertyIds\)/,
    },
    {
      name: 'Agent listings',
      source: readScreen('app', 'agent', '[id].tsx'),
      expected: /filterVisibleDemoProperties\(\s*properties\.filter\(\(p\) => p\.agent === agent\.displayName \|\| p\.agent === agent\.agency\),\s*hiddenDemoPropertyIds/,
    },
  ];

  for (const screen of screens) {
    assert.match(screen.source, screen.expected, `${screen.name} must filter hidden demos`);
  }
});

test('Home retains its bundled offline fallback and Explore keeps cached listings on empty or failed requests', () => {
  const home = readScreen('app', '(tabs)', 'index.tsx');
  const explore = readScreen('app', '(tabs)', 'explore.tsx');
  const detail = readScreen('app', 'property', '[id].tsx');

  assert.match(home, /selectHomePropertySource\(apiProps,\s*properties\)/);
  assert.match(explore, /useState\(\(\) => uniqueProperties\(properties\)\)/);
  assert.equal(
    (explore.match(/keepCachedPropertiesWhenRemoteIsEmpty\(/g) ?? []).length,
    2,
    'both Explore catalogue request paths must retain cached listings on empty results',
  );
  assert.match(explore, /\.catch\(\(\) => \{\s*if \(!cancelled\) \{\s*setGeoError\(''\);/);
  assert.match(detail, /catch\(\(\) => undefined\); \/\/ keep mock on failure/);
});
