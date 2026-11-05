import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

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

test('startup keeps the 7-second animated splash and removes the static native logo', () => {
  assert.ok(splashPlugin);
  assert.equal(splashPlugin[1].image, undefined);
  assert.equal(splashPlugin[1].dark?.image, undefined);
  assert.equal(splashPlugin[1].android?.drawable?.icon, './plugins/splash-transparent.xml');
  assert.equal(splashPlugin[1].android?.drawable?.darkIcon, './plugins/splash-transparent.xml');
  assert.match(layout, /STARTUP_SPLASH_MIN_DURATION_MS = 7000/);
  assert.match(layout, /splashDurationElapsed/);
  assert.match(layout, /<StartupSplash colors=\{colors\} overlay fontsReady=\{fontsReady\} \/>/);
  assert.match(colorTokens, /background: '#FFFFFF'/);
  assert.match(colorTokens, /teal: '#19C3B1'/);
  assert.match(colorTokens, /gold: '#F2B84B'/);
  assert.match(colorTokens, /splashBackground: '#0B1F3A'/);
});

test('startup splash uses the new animated roof mark and replaces only its old logo', () => {
  assert.doesNotMatch(layout, /OGLandmarkLogo/);
  assert.match(startupSplash, /accessibilityLabel="OG Landmark roof logo"/);
  assert.match(startupSplash, /REAL ESTATE · HOMES · PROPERTIES/);
  assert.match(startupSplash, /Find your next landmark/);
  assert.match(startupSplash, /useReducedMotion/);
  assert.match(colorTokens, /splashTeal: '#19C3B1'/);
  assert.match(colorTokens, /splashGold: '#F2B84B'/);
});

test('startup splash plays intro sound natively and offers web gesture playback', () => {
  assert.ok(existsSync(new URL('../assets/audio/splash-brand-intro.mp3', import.meta.url)));
  assert.ok(appConfig.expo.assetBundlePatterns?.includes('assets/audio/*'));
  assert.match(startupSplash, /useAudioPlayer/);
  assert.match(startupSplash, /splashAudioPlayer\.volume = 0\.7/);
  assert.match(startupSplash, /splashAudioPlayer\.play\(\)/);
  assert.match(startupSplash, /splashAudioPlayer\.pause\(\)/);
  assert.match(startupSplash, /if \(Platform\.OS === 'web'\) return undefined/);
  assert.match(startupSplash, /Platform\.OS === 'web' && !webAudioEnabled/);
  assert.match(startupSplash, /onPress=\{enableSplashAudio\}/);
});

test('splash keeps rotating rings composited and avoids frame-by-frame SVG path drawing', () => {
  assert.match(startupSplash, /renderToHardwareTextureAndroid/);
  assert.match(startupSplash, /shouldRasterizeIOS/);
  assert.match(startupSplash, /const logoRevealStyle = useAnimatedStyle/);
  assert.doesNotMatch(startupSplash, /useAnimatedProps|strokeDashoffset/);
});

