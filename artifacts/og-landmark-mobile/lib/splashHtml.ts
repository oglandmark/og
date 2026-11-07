export const STARTUP_SPLASH_ANIMATION_DURATION_MS = 7_000;
export const STARTUP_SPLASH_LOAD_TIMEOUT_MS = 3_500;

const controlPanelMarkup = /<div id="ui">[\s\S]*?<\/div>/;
const controlHandlers = /\$\('sd'\)\.onclick=[\s\S]*?\$\('rp'\)\.onclick=[\s\S]*?playAu\(\)\};/;
const audioElementMarkup = /<audio id="au"[^>]*><\/audio>/;

export function resolveSplashAssetUri(uri: string, origin: string): string {
  const asset = new URL(uri, origin);
  const appOrigin = new URL(origin);
  if (asset.pathname.startsWith('/assets/')) {
    const metroAsset = new URL('/assets/', appOrigin);
    metroAsset.searchParams.set('unstable_path', `.${asset.pathname}`);
    asset.searchParams.forEach((value, key) => metroAsset.searchParams.set(key, value));
    return metroAsset.href;
  }
  return new URL(`${asset.pathname}${asset.search}${asset.hash}`, appOrigin).href;
}

export function prepareSplashHtml(source: string): string {
  if (!controlPanelMarkup.test(source)) {
    throw new Error('Splash reference is missing its expected control panel.');
  }
  if (
    !source.includes('let snd=false;') ||
    !controlHandlers.test(source) ||
    !audioElementMarkup.test(source)
  ) {
    throw new Error('Splash reference audio markup changed; update the silent-splash adapter.');
  }

  return source
    .replace(controlPanelMarkup, '')
    .replace(audioElementMarkup, '')
    .replace(controlHandlers, '');
}
