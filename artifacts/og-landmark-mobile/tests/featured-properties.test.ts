import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const home = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const explore = readFileSync(new URL('../app/(tabs)/explore.tsx', import.meta.url), 'utf8');

test('Home shows the complete Featured Properties title and fixes the known truncated label', () => {
  assert.match(home, /configuredFeaturedTitle\.toLowerCase\(\) === 'featured properti'/);
  assert.match(home, /'Featured Properties'/);
  assert.match(home, /title=\{featuredTitle\}/);
});

test('Home limits heavy horizontal cards and keeps text typing out of parent state', () => {
  assert.match(home, /featuredProps = useMemo\(\(\) => allProps\.filter\(\(p\) => p\.featured\)\.slice\(0, 8\)/);
  assert.match(home, /const queryRef = useRef\(''\)/);
  assert.match(home, /defaultValue=""/);
  assert.doesNotMatch(home, /const \[query,\s*setQuery\] = useState/);
});

test('Home agent carousel is swipe-driven instead of a 32ms JS scroll loop', () => {
  const start = home.indexOf('function AgentCarousel');
  const end = home.indexOf('function AgentCard', start);
  assert.ok(start >= 0 && end > start);
  const carousel = home.slice(start, end);
  assert.match(carousel, /visibleAgents\.map/);
  assert.doesNotMatch(carousel, /setInterval|marqueeAgents/);
});

test('Home and Explore avoid duplicate loads and short public-feed polling', () => {
  assert.match(home, /const HOME_REFRESH_INTERVAL_MS = 60_000/);
  assert.match(explore, /const LIVE_REFRESH_INTERVAL_MS = 60_000/);
  assert.match(home, /managedAgentsLoadedRef\.current = true/);
  assert.match(explore, /devProjectsLoadedRef\.current = true/);
  assert.doesNotMatch(home, /setInterval\([^;]*15_000/);
  assert.doesNotMatch(explore, /setInterval\([^;]*15_000/);
});
