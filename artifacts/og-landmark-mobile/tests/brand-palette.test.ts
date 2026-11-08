import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

test('mobile primary actions use official gold with navy foreground', () => {
  assert.equal(colors.light.primaryAction, '#C9A248');
  assert.equal(colors.light.primaryActionForeground, '#0B1F3A');
  assert.match(polishedUiSource, /backgroundColor:\s*colors\.primaryAction/);
  assert.match(polishedUiSource, /color:\s*colors\.primaryActionForeground/);
});

test('navy, teal selection, and red destructive roles stay distinct', () => {
  assert.equal(colors.light.action, '#0B1F3A');
  assert.equal(colors.light.teal, '#19C3B1');
  assert.equal(colors.light.selectionBorder, '#19C3B1');
  assert.equal(colors.light.destructive, '#b94b42');
  assert.match(tabLayoutSource, /tabBarActiveTintColor:\s*colors\.teal/);
});

test('gold accents use the brand-guide value', () => {
  assert.equal(colors.light.gold, '#C9A248');
  assert.equal(colors.light.goldForeground, '#0B1F3A');
  assert.equal(colors.light.splashGold, '#C9A55C');
});
