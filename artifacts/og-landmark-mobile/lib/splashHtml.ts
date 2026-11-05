const controlPanelMarkup = /<div id="ui">[\s\S]*?<\/div>/;
const controlHandlers = /\$\('sd'\)\.onclick=[\s\S]*?\$\('rp'\)\.onclick=[\s\S]*?playAu\(\)\};/;
const audioElementMarkup = /<audio id="au"[^>]*><\/audio>/;

export function prepareSplashHtml(source: string): string {
  if (!controlPanelMarkup.test(source)) {
    throw new Error('Splash reference is missing its expected control panel.');
  }
  if (
    !source.includes('let snd=false,prev=0;') ||
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
