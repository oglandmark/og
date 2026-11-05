import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { prepareSplashHtml } from '../lib/splashHtml';

const appConfig = JSON.parse(
  readFileSync(new URL('../app.json', import.meta.url), 'utf8'),
) as {
  expo: {
    plugins: unknown[];
    assetBundlePatterns?: string[];
  };
};
const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
const startupSplash = readFileSync(
  new URL('../components/StartupSplash.tsx', import.meta.url),
  'utf8',
);
const sharedLogo = readFileSync(
  new URL('../components/OGLandmarkLogo.tsx', import.meta.url),
  'utf8',
);
const splashReference = readFileSync(
  new URL('../assets/splash/og-landmark-intro.html', import.meta.url),
  'utf8',
);
const colorTokens = readFileSync(new URL('../constants/colors.ts', import.meta.url), 'utf8');
const splashPlugin = appConfig.expo.plugins.find(
  (plugin): plugin is [
    string,
    {
      image?: string;
      dark?: { image?: string };
      android?: { drawable?: { icon?: string; darkIcon?: string } };
    },
  ] =>
    Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
);

test('startup keeps the 8-second animated splash and removes the static native logo', () => {
  assert.ok(splashPlugin);
  assert.equal(splashPlugin[1].image, undefined);
  assert.equal(splashPlugin[1].dark?.image, undefined);
  assert.equal(splashPlugin[1].android?.drawable?.icon, './plugins/splash-transparent.xml');
  assert.equal(splashPlugin[1].android?.drawable?.darkIcon, './plugins/splash-transparent.xml');
  assert.match(layout, /STARTUP_SPLASH_MIN_DURATION_MS = 8000/);
  assert.match(layout, /splashDurationElapsed/);
  assert.match(layout, /<StartupSplash colors=\{colors\} overlay fontsReady=\{fontsReady\} \/>/);
  assert.ok(appConfig.expo.assetBundlePatterns?.includes('assets/splash/*'));
  assert.match(colorTokens, /background: '#FFFFFF'/);
  assert.match(colorTokens, /teal: '#19C3B1'/);
  assert.match(colorTokens, /gold: '#F2B84B'/);
  assert.match(colorTokens, /splashBackground: '#040C1A'/);
});

test('startup splash uses the supplied HTML scene and its complete animation timeline', () => {
  assert.doesNotMatch(layout, /OGLandmarkLogo/);
  assert.ok(existsSync(new URL('../assets/splash/og-landmark-intro.html', import.meta.url)));
  assert.match(splashReference, /const D=8/);
  assert.match(splashReference, /function render\(t\)/);
  assert.match(splashReference, /PT\.forEach/);
  assert.match(splashReference, /requestAnimationFrame\(loop\)/);
  assert.match(startupSplash, /og-landmark-intro\.html/);
  assert.match(startupSplash, /mediaPlaybackRequiresUserAction=\{false\}/);
  assert.match(startupSplash, /srcDoc: html/);
  assert.match(colorTokens, /splashTeal: '#19C3B1'/);
  assert.match(colorTokens, /splashGold: '#C9A55C'/);
});

test('autoplay adapter removes the controls and starts the embedded sound automatically', () => {
  const preparedHtml = prepareSplashHtml(splashReference);
  assert.match(preparedHtml, /let snd=true,prev=0/);
  assert.doesNotMatch(preparedHtml, /<div id="ui">/);
  assert.doesNotMatch(preparedHtml, /\$\('sd'\)\.onclick/);
  assert.doesNotMatch(preparedHtml, /\$\('rp'\)\.onclick/);
  assert.match(startupSplash, /allowsInlineMediaPlayback/);
  assert.doesNotMatch(startupSplash, /Tap for sound/);
});

test('shared OG and roof mark loops after ten focused seconds on each mobile page', () => {
  assert.match(sharedLogo, /useFocusEffect/);
  assert.match(sharedLogo, /withDelay\(\s*10_000/);
  assert.match(sharedLogo, /withRepeat/);
  assert.match(sharedLogo, /cancelAnimation\(markPulse\)/);
  assert.match(sharedLogo, /useReducedMotion/);
  assert.match(sharedLogo, /Platform\.OS === 'web'/);
  assert.match(sharedLogo, /OG Landmark logo/);
});

