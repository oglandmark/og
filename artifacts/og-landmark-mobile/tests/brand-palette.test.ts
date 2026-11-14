import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import colors from '../constants/colors';

const polishedUiSource = readFileSync(
  resolve(fileURLToPath(new URL('../components/PolishedUI.tsx', import.meta.url))),
  'utf8',
);
const tabLayoutSource = readFileSync(
  resolve(fileURLToPath(new URL('../app/(tabs)/_layout.tsx', import.meta.url))),
  'utf8',
);
const homeBannerSource = readFileSync(
  resolve(fileURLToPath(new URL('../components/HomeCategoryBannerCarousel.tsx', import.meta.url))),
  'utf8',
);
const glassCoverageSources = [
  '../app/admin/banners.tsx',
  '../app/admin/index.tsx',
  '../app/admin/properties.tsx',
  '../app/admin/reports.tsx',
  '../app/admin/users.tsx',
  '../app/post/listing.tsx',
  '../app/property/[id].tsx',
  '../app/(tabs)/messages.tsx',
  '../app/(tabs)/post-ad.tsx',
  '../app/(tabs)/profile.tsx',
  '../components/AgentAdminInbox.tsx',
  '../components/AgentProgressPanel.tsx',
  '../components/ErrorFallback.tsx',
  '../components/ExpoGoMapFallback.tsx',
  '../components/GoogleMapCanvas.tsx',
  '../components/MapAreaRange.tsx',
  '../components/MapViewComponent.native.tsx',
  '../components/PromiseSection.tsx',
  '../components/PropertyMediaStrip.tsx',
].map((path) => readFileSync(resolve(fileURLToPath(new URL(path, import.meta.url))), 'utf8'));

function collectTsxSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectTsxSources(path) : entry.name.endsWith('.tsx') ? [path] : [];
  });
}

test('mobile primary actions use official gold with navy foreground', () => {
  assert.equal(colors.light.primaryAction, '#C9A248');
  assert.equal(colors.light.primaryActionForeground, '#0B1F3A');
  assert.match(polishedUiSource, /glassControlStyle\(colors,\s*'gold'\)/);
  assert.match(polishedUiSource, /color:\s*colors\.primaryActionForeground/);
});

test('shared button controls use semantic glass tokens without changing brand action roles', () => {
  const glassSource = readFileSync(
    resolve(fileURLToPath(new URL('../components/glassControls.ts', import.meta.url))),
    'utf8',
  );
  const authSource = readFileSync(
    resolve(fileURLToPath(new URL('../components/AuthScreenUI.tsx', import.meta.url))),
    'utf8',
  );
  assert.match(glassSource, /colors\.goldGlass/);
  assert.match(glassSource, /colors\.glassOverlay/);
  assert.match(glassSource, /colors\.actionGlassBorder/);
  assert.match(glassSource, /colors\.selectionBackground/);
  assert.match(polishedUiSource, /glassHighlightStyle\(colors\)/);
  assert.match(authSource, /colors\.action,\s*colors\.actionPressed,\s*colors\.actionDeep/);
  assert.match(authSource, /colors\.primaryAction/);
  assert.match(homeBannerSource, /glassControlStyle\(colors,\s*'gold'\)/);
  assert.match(homeBannerSource, /colors\.primaryActionForeground/);
  for (const source of glassCoverageSources) {
    assert.match(source, /glassControlStyle/);
  }
});

test('all mobile UI files with Pressable actions use the shared glass helper', () => {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url));
  const sourceFiles = [
    ...collectTsxSources(join(projectRoot, 'app')),
    ...collectTsxSources(join(projectRoot, 'components')),
  ];
  const primitivePath = join(projectRoot, 'components', 'AnimatedPressable.tsx');
  const interactiveSources = sourceFiles
    .filter((path) => path !== primitivePath)
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
    .filter(({ source }) => /<(?:Pressable|TouchableOpacity)\b/.test(source));
  assert.ok(interactiveSources.length > 0, 'expected to find mobile Pressable controls');
  for (const { path, source } of interactiveSources) {
    assert.match(source, /glassControlStyle/, `${path} should use the shared control treatment`);
  }
});

test('navy, teal selection, and red destructive roles stay distinct', () => {
  assert.equal(colors.light.action, '#0B1F3A');
  assert.equal(colors.light.teal, '#19C3B1');
  assert.equal(colors.light.selectionBorder, '#19C3B1');
  assert.equal(colors.light.destructive, '#b94b42');
  assert.equal(colors.light.success, '#0F766E');
  assert.equal(colors.light.warning, '#b9822b');
  assert.equal(colors.light.primaryAction, '#C9A248');
  assert.equal(colors.light.primaryActionForeground, '#0B1F3A');
  assert.match(tabLayoutSource, /tabBarActiveTintColor:\s*colors\.teal/);
});

test('gold accents use the brand-guide value', () => {
  assert.equal(colors.light.gold, '#C9A248');
  assert.equal(colors.light.goldForeground, '#0B1F3A');
  assert.equal(colors.light.splashGold, '#C9A55C');
});
