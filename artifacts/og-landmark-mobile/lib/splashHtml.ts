export const STARTUP_SPLASH_ANIMATION_DURATION_MS = 7_000;
export const STARTUP_SPLASH_LOAD_TIMEOUT_MS = 3_500;

const controlPanelMarkup = /<div id="ui">[\s\S]*?<\/div>/;
const controlHandlers = /\$\('sd'\)\.onclick=[\s\S]*?\$\('rp'\)\.onclick=[\s\S]*?playAu\(\)\};/;
const audioElementMarkup = /<audio id="au"[^>]*><\/audio>/;
const insetSplashFit =
  "function fit(){const {W,H}=C,uh=RENDER?0:56,k=Math.min(innerWidth/W,(innerHeight-uh)/H);$('wrap').style.transform=`translate(-50%,-50%) translateY(${-uh/2}px) scale(${k})`}";
const fullScreenSplashFit =
  "function fit(){const {W,H}=C,k=Math.min(innerWidth/W,innerHeight/H);$('wrap').style.transform=`translate(-50%,-50%) scale(${k})`}";
const autoStartAnimation =
  "else{setF(P.get('f')||'app');(function loop(now){cur=Math.min(D,(now-t0)/1000);render(cur);if(cur<D)requestAnimationFrame(loop)})(performance.now())}";
const readyGatedAnimation =
  "else{setF(P.get('f')||'app');window.startSplashAnimation=()=>{t0=performance.now();cur=0;render(0);(function loop(now){cur=Math.min(D,(now-t0)/1000);render(cur);if(cur<D)requestAnimationFrame(loop)})(performance.now())}}";

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
    !audioElementMarkup.test(source) ||
    !source.includes(insetSplashFit) ||
    !source.includes(autoStartAnimation)
  ) {
    throw new Error('Splash reference changed; update the splash adapter.');
  }

  return source
    .replace(controlPanelMarkup, '')
    .replace(audioElementMarkup, '')
    .replace(controlHandlers, '')
    .replace(insetSplashFit, fullScreenSplashFit)
    .replace(autoStartAnimation, readyGatedAnimation);
}
