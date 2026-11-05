import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
const onboarding = readFileSync(new URL('../app/onboarding.tsx', import.meta.url), 'utf8');
const storage = readFileSync(new URL('../lib/onboarding.ts', import.meta.url), 'utf8');

test('first launch routes through three category onboarding slides after the animated splash', () => {
  assert.match(layout, /STARTUP_SPLASH_MIN_DURATION_MS = 7000/);
  assert.match(layout, /getOnboardingCompletion\(\)/);
  assert.match(layout, /router\.replace\('\/onboarding'\)/);
  assert.match(onboarding, /key: 'homes'/);
  assert.match(onboarding, /key: 'commercial'/);
  assert.match(onboarding, /key: 'agriculture'/);
});

test('onboarding uses the current navy, teal, and gold brand tokens', () => {
  assert.match(onboarding, /colors\.splashNavy/);
  assert.match(onboarding, /colors\.splashWhite/);
  assert.match(onboarding, /colors\.teal/);
  assert.match(onboarding, /colors\.gold/);
  assert.doesNotMatch(onboarding, /#132A43|rgba\(6, 19, 37/);
});

test('skip or completion persists onboarding so later launches go to Home', () => {
  assert.match(onboarding, /markOnboardingComplete\(\)/);
  assert.match(onboarding, /completeOnboarding/);
  assert.match(storage, /AsyncStorage\.setItem\(ONBOARDING_COMPLETED_KEY, 'true'\)/);
  assert.match(layout, /completed && inOnboarding/);
  assert.match(layout, /router\.replace\('\/\(tabs\)'\)/);
});
