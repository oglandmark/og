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

test('Home and Explore do not expose demo properties when no approved live property is available', () => {
  const hiddenIds = [101];

  // Home never uses the bundled catalogue as a public-property fallback.
  for (const apiProperties of [[], undefined]) {
    const homeSource = selectHomePropertySource(apiProperties ?? []);
    assert.deepEqual(
      filterVisibleDemoProperties(homeSource, hiddenIds).map(({ id }) => id),
      [],
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

test('Home does not show bundled examples while loading, offline, or after an empty API response', () => {
  assert.deepEqual(selectHomePropertySource([]), []);
});

test('successful public feeds show live listings only, without adding bundled demos', () => {
  const live = [{ id: 1, isDemo: false, title: 'Live listing' }];
  const catalog = [
    { id: 1, isDemo: true, title: 'Demo one' },
    { id: 2, isDemo: true, title: 'Demo two' },
  ];
  const merged = selectHomePropertySource(live);

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

test('public mobile property lists require Admin-approved and active listings', () => {
  const records = [
    { id: 10, approvalStatus: 'Pending', listingStatus: 'Active' },
    { id: 11, approvalStatus: 'Approved', listingStatus: 'Active' },
    { id: 12, approvalStatus: 'Approved', listingStatus: 'Pending' },
    { id: 13, isDemo: true, approvalStatus: 'Approved', listingStatus: 'Active' },
  ];
  assert.deepEqual(
    filterVisibleDemoProperties(records, []).map(({ id }) => id),
    [11],
  );
});

test('restoring a demo does not make it public again', () => {
  const restoredHiddenIds: number[] = [];
  assert.deepEqual(
    filterVisibleDemoProperties(demos, restoredHiddenIds).map(({ id }) => id),
    [103],
  );
  assert.equal(isDemoPropertyHidden(demos[0]!, restoredHiddenIds), false);
});

test('all demo listings are blocked from public detail routes', () => {
  assert.equal(isDemoPropertyHidden(demos[0]!, [101]), true);
  assert.equal(filterVisibleDemoProperties(demos, []).some((property) => property.isDemo), false);
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

test('Home and Explore use live approved data only and retain cache only for filtered requests', () => {
  const home = readScreen('app', '(tabs)', 'index.tsx');
  const explore = readScreen('app', '(tabs)', 'explore.tsx');
  const detail = readScreen('app', 'property', '[id].tsx');

  assert.match(home, /selectHomePropertySource\(apiProps\)/);
  assert.match(home, /selectLatestProperties\(allProps\)/);
  assert.match(home, /selectRecommendedProperties\(allProps,\s*transaction\)/);
  assert.match(explore, /useState<Property\[\]>\(\[\]\)/);
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
