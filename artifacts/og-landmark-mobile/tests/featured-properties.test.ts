import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const home = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');

test('Home shows the complete Featured Properties title and fixes the known truncated label', () => {
  assert.match(home, /configuredFeaturedTitle\.toLowerCase\(\) === 'featured properti'/);
  assert.match(home, /'Featured Properties'/);
  assert.match(home, /title=\{featuredTitle\}/);
});
