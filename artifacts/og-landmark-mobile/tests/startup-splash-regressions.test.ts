import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  prepareSplashHtml,
  resolveSplashAssetUri,
  STARTUP_SPLASH_ANIMATION_DURATION_MS,
  STARTUP_SPLASH_LOAD_TIMEOUT_MS,
} from '../lib/splashHtml';

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
const brandMark = readFileSync(
  new URL('../components/BrandMark.tsx', import.meta.url),
  'utf8',
);
const homeScreen = readFileSync(
  new URL('../app/(tabs)/index.tsx', import.meta.url),
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

test('startup keeps the complete 7-second animated splash and removes the static native logo', () => {
  assert.equal(STARTUP_SPLASH_ANIMATION_DURATION_MS, 7000);
  assert.equal(STARTUP_SPLASH_LOAD_TIMEOUT_MS, 3500);
  assert.ok(splashPlugin);
  assert.equal(splashPlugin[1].image, undefined);
  assert.equal(splashPlugin[1].dark?.image, undefined);
  assert.equal(splashPlugin[1].android?.drawable?.icon, './plugins/splash-transparent.xml');
  assert.equal(splashPlugin[1].android?.drawable?.darkIcon, './plugins/splash-transparent.xml');
  assert.match(layout, /splashDurationElapsed/);
  assert.match(layout, /onAnimationReady=\{handleSplashReady\}/);
  assert.doesNotMatch(layout, /SplashScreen\.hideAsync/);
  assert.match(startupSplash, /onLoadEnd=\{\(\) => reportAnimationReady\(true\)\}/);
  assert.match(startupSplash, /SplashScreen\.hideAsync/);
  assert.match(startupSplash, /const splashHtmlPromise =/);
  assert.doesNotMatch(startupSplash, /ActivityIndicator/);
  assert.doesNotMatch(startupSplash, /fallbackName/);
  assert.match(startupSplash, /readyState && readyState !== 'loading'/);
  assert.ok(appConfig.expo.assetBundlePatterns?.includes('assets/splash/*'));
  assert.match(colorTokens, /background: '#FFFFFF'/);
  assert.match(colorTokens, /teal: '#19C3B1'/);
  assert.match(colorTokens, /gold: '#F2B84B'/);
  assert.match(colorTokens, /splashBackground: '#040C1A'/);
});

test('startup splash uses the full viewport and hides Android system bars temporarily', () => {
  const preparedHtml = prepareSplashHtml(splashReference);
  assert.ok(preparedHtml.includes('const {W,H}=C,k=Math.min(innerWidth/W,innerHeight/H);'));
  assert.doesNotMatch(preparedHtml, /uh=RENDER\?0:56/);
  assert.match(preparedHtml, /window\.startSplashAnimation=\(\)=>/);
  assert.match(preparedHtml, /const E=new Map\(\),\$=id=>/);
  assert.match(preparedHtml, /function build\(f\)\{E\.clear\(\);/);
  assert.match(preparedHtml, /r="\$\{PT\[i\]\.r\}"/);
  assert.doesNotMatch(preparedHtml, /e\.setAttribute\('r',p\.r\);/);
  assert.doesNotMatch(startupSplash, /import \{ NavigationBar \} from 'expo-navigation-bar'/);
  assert.match(startupSplash, /import\('expo-navigation-bar'\)/);
  assert.match(startupSplash, /setVisibilityAsync\('hidden'\)/);
  assert.match(startupSplash, /setVisibilityAsync\('visible'\)/);
  assert.match(startupSplash, /\.catch\(\(\) => undefined\)/);
  assert.match(startupSplash, /hidden=\{Platform\.OS !== 'web'\}/);
});

test('an unavailable Android navigation-bar module cannot block splash startup', () => {
  assert.match(startupSplash, /void import\('expo-navigation-bar'\)[\s\S]*\.catch\(\(\) => undefined\)/);
  assert.match(startupSplash, /Unsupported device\/navigation mode must not prevent app startup/);
});

test('startup animation starts only after the native splash is hidden', () => {
  assert.match(startupSplash, /injectJavaScript\('window\.startSplashAnimation\?\.\(\); true;'\)/);
  assert.match(startupSplash, /SplashScreen\.hideAsync\(\)[\s\S]*startSplashAnimation\(\)/);
});

test('web splash assets use the active preview origin instead of localhost', () => {
  assert.equal(
    resolveSplashAssetUri(
      'http://localhost:18115/assets/splash/og-landmark-intro.html?platform=web&hash=abc123',
      'https://preview.example',
    ),
    'https://preview.example/assets/?unstable_path=.%2Fassets%2Fsplash%2Fog-landmark-intro.html&platform=web&hash=abc123',
  );
});

test('startup splash uses the supplied HTML scene and its complete animation timeline', () => {
  assert.doesNotMatch(layout, /OGLandmarkLogo/);
  assert.ok(existsSync(new URL('../assets/splash/og-landmark-intro.html', import.meta.url)));
  assert.match(splashReference, /const D=7/);
  assert.match(splashReference, /function render\(t\)/);
  assert.match(splashReference, /PT\.forEach/);
  assert.match(splashReference, /requestAnimationFrame\(loop\)/);
  assert.match(startupSplash, /og-landmark-intro\.html/);
  assert.match(startupSplash, /mediaPlaybackRequiresUserAction/);
  assert.match(startupSplash, /srcDoc: html/);
  assert.match(colorTokens, /splashTeal: '#19C3B1'/);
  assert.match(colorTokens, /splashGold: '#C9A55C'/);
});

test('startup splash plays once and holds its final frame instead of restarting', () => {
  assert.match(splashReference, /cur=Math\.min\(D,\(now-t0\)\/1000\)/);
  assert.match(splashReference, /if\(cur<D\)requestAnimationFrame\(loop\)/);
  assert.doesNotMatch(splashReference, /\)%D/);
});

test('startup splash removes embedded audio and stays silent', () => {
  const preparedHtml = prepareSplashHtml(splashReference);
  assert.match(preparedHtml, /let snd=false/);
  assert.doesNotMatch(preparedHtml, /<audio id="au"/);
  assert.doesNotMatch(preparedHtml, /data:audio\/mpeg;base64/);
  assert.doesNotMatch(preparedHtml, /<div id="ui">/);
  assert.doesNotMatch(preparedHtml, /\$\('sd'\)\.onclick/);
  assert.doesNotMatch(preparedHtml, /\$\('rp'\)\.onclick/);
  assert.match(startupSplash, /mediaPlaybackRequiresUserAction/);
  assert.doesNotMatch(startupSplash, /allow: 'autoplay; fullscreen'/);
});

test('shared OG and roof mark loops after ten focused seconds on each mobile page', () => {
  assert.match(sharedLogo, /useFocusEffect/);
  assert.match(sharedLogo, /withDelay\(\s*10_000/);
  assert.match(sharedLogo, /withRepeat/);
  assert.match(sharedLogo, /cancelAnimation\(timeline\)/);
  assert.match(sharedLogo, /useReducedMotion/);
  assert.match(sharedLogo, /Platform\.OS === 'web'/);
  assert.match(sharedLogo, /OG Landmark roof and OG logo/);
  assert.match(sharedLogo, /M110 100 A40 40 0 0 0 30 100/);
  assert.match(sharedLogo, /M182\.8 77\.1 A40 40 0 1 0 190 100/);
  assert.match(sharedLogo, /M60 38 L110 5 L160 38/);
  assert.match(sharedLogo, /easedProgress\(timeline\.value, 0\.5, 1\.75\)/);
  assert.match(sharedLogo, /easedProgress\(timeline\.value, 1\.25, 2\.55\)/);
  assert.match(sharedLogo, /easedProgress\(timeline\.value, 2\.45, 3\.1, true\)/);
  assert.match(sharedLogo, /withTiming\(8, \{ duration: 8000/);
  assert.match(sharedLogo, /strokeDashoffset/);
  assert.doesNotMatch(sharedLogo, /markPulse|scale: 1 \+ markPulse/);
});

test('Home brand mark shows the full OG Landmark wordmark', () => {
  assert.match(homeScreen, /<BrandMark showName compact \/>/);
  assert.match(brandMark, /accessibilityLabel="OG Landmark"/);
  assert.match(brandMark, /OG Landmark\s*<\/NativeText>/);
  assert.doesNotMatch(brandMark, /numberOfLines=\{1\}/);
  assert.match(brandMark, /flexShrink: 0/);
});

