import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  filterDeletedDemoProjects,
  filterVisibleDemoProperties,
  isDemoPropertyHidden,
  keepCachedPropertiesWhenRemoteIsEmpty,
  replacePropertiesFromSuccessfulPublicFeed,
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

test('deleted bundled projects are removed from Explore and direct project details', () => {
  const projects = [
    { id: 'okara-model-town', name: 'Sample project' },
    { id: 'developer-live', name: 'Developer project' },
  ];
  assert.deepEqual(filterDeletedDemoProjects(projects, ['okara-model-town']), [projects[1]]);
  assert.match(readScreen('app', '(tabs)', 'explore.tsx'), /filterDeletedDemoProjects\(staticProjects, deletedDemoProjectIds\)/);
  assert.match(readScreen('app', 'project', '[id].tsx'), /staticProjectDeleted/);
});

test('deleted bundled projects disappear from the app project list', () => {
  const projects = [
    { id: 'okara-model-town', name: 'Sample project' },
    { id: 'developer-live', name: 'Developer project' },
  ];
  assert.deepEqual(
    filterDeletedDemoProjects(projects, ['okara-model-town']),
    [projects[1]],
  );
});

test('mobile refreshes Admin-managed demo visibility while open and after app resume', () => {
  const provider = readScreen('context', 'DemoPropertyVisibilityContext.tsx');
  assert.match(provider, /setInterval\(refresh,\s*15_000\)/);
  assert.match(provider, /AppState\.addEventListener\('change'/);
});

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

  // Explore may keep cached live listings for a filtered/nearby fallback, but not bundled examples.
  const cachedProperties = [...demos];
  for (const remoteProperties of [[], undefined]) {
    const preserved = keepCachedPropertiesWhenRemoteIsEmpty(
      cachedProperties,
      remoteProperties ?? [],
    );
    assert.deepEqual(
      filterVisibleDemoProperties(preserved, hiddenIds).map(({ id }) => id),
      [103],
    );
  }
});

test('a successful empty public feed clears cached and bundled properties', () => {
  const cached = [
    { id: 8, isDemo: false, title: 'Deleted Admin listing' },
    { id: -101, demoId: 101, isDemo: true, title: 'Bundled example' },
  ];
  assert.deepEqual(
    replacePropertiesFromSuccessfulPublicFeed(cached, []),
    [],
  );
});

test('Home uses bundled properties while loading or offline, but not after a successful empty response', () => {
  assert.deepEqual(selectHomePropertySource([], demos, true), demos);
  assert.deepEqual(selectHomePropertySource([], demos, false), []);
});

test('successful public feeds show live listings only, without adding bundled demos', () => {
  const live = [{ id: 1, isDemo: false, title: 'Live listing' }];
  const catalog = [
    { id: 1, isDemo: true, title: 'Demo one' },
    { id: 2, isDemo: true, title: 'Demo two' },
  ];
  const merged = selectHomePropertySource(live, catalog);

  assert.deepEqual(merged.map(({ id }) => id), [1]);
  assert.deepEqual(
    filterVisibleDemoProperties(merged, [1]).map(({ title }) => title),
    ['Live listing'],
  );
  assert.deepEqual(
    keepCachedPropertiesWhenRemoteIsEmpty(catalog, live).map(({ id }) => id),
    [1],
  );
  assert.deepEqual(
    replacePropertiesFromSuccessfulPublicFeed(catalog, live).map(({ id }) => id),
    [1],
  );
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
      expected: /filterVisibleDemoProperties\(\s*propertyChoices\.filter\(\(property\) => savedIds\.includes\(property\.id\)\),\s*hiddenDemoPropertyIds/,
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

test('Home retains fallback only while loading/offline and Explore preserves cache only for filtered requests', () => {
  const home = readScreen('app', '(tabs)', 'index.tsx');
  const explore = readScreen('app', '(tabs)', 'explore.tsx');
  const detail = readScreen('app', 'property', '[id].tsx');

  assert.match(home, /selectHomePropertySource\(\s*apiProps,\s*properties,\s*apiLoading \|\| Boolean\(propertyError\)/);
  assert.match(home, /const allowCuratedFallback = apiProps\.length === 0 && \(apiLoading \|\| Boolean\(propertyError\)\)/);
  assert.match(home, /selectLatestProperties\(allProps,\s*allowCuratedFallback\)/);
  assert.match(home, /selectRecommendedProperties\(allProps,\s*transaction,\s*allowCuratedFallback\)/);
  assert.match(explore, /useState\(\(\) => uniqueProperties\(properties\)\)/);
  assert.match(explore, /replacePropertiesFromSuccessfulPublicFeed\(/);
  assert.equal(
    (explore.match(/keepCachedPropertiesWhenRemoteIsEmpty\(/g) ?? []).length,
    1,
    'only the filtered map request should retain cached listings on empty results',
  );
  assert.match(explore, /authoritative for the public feed/);
  assert.match(explore, /setInterval\(\(\) => \{\s*if \(AppState\.currentState === 'active'\) void refreshProperties\(\);/);
  assert.match(home, /setInterval\(\(\) => \{\s*if \(AppState\.currentState === 'active'\) void refreshProperties\(\);/);
  assert.match(detail, /catch\(\(\) => undefined\); \/\/ keep mock on failure/);
});

test('Explore removes Near Me and clears temporary filters after leaving the page', () => {
  const explore = readScreen('app', '(tabs)', 'explore.tsx');

  assert.doesNotMatch(explore, /Near Me|nearMe/);
  assert.match(explore, /router\.setParams\(\{[\s\S]*?verifiedOnly: undefined,/);
  assert.match(explore, /resetExploreStateOnBlur[\s\S]*?setFilters\(\{ \.\.\.emptyFilters \}\)[\s\S]*?setIsProjectsMode\(false\)/);
  assert.match(explore, /useFocusEffect\(useCallback\(\(\) => \{[\s\S]*?return \(\) => \{[\s\S]*?resetExploreStateOnBlur\(\)/);
});
