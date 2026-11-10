import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function readAppSource(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

test('property gallery dimensions follow iPad rotation instead of a startup snapshot', () => {
  const source = readAppSource('../app/property/[id].tsx');
  assert.match(source, /useWindowDimensions/);
  assert.match(source, /width: screenWidth, height: 352/);
  assert.match(source, /i \* screenWidth/);
  assert.doesNotMatch(source, /Dimensions\.get\(['"]window['"]\)/);
});

test('project photo viewer fits both landscape and portrait screen heights', () => {
  const source = readAppSource('../app/project/[id].tsx');
  assert.match(source, /useWindowDimensions/);
  assert.match(source, /const galleryImageSize = Math\.max/);
  assert.match(source, /screenHeight - insets\.top - insets\.bottom - 100/);
  assert.match(source, /top: insets\.top \+ 12, right: insets\.right \+ 12/);
  assert.doesNotMatch(source, /Dimensions\.get\(['"]window['"]\)/);
});
