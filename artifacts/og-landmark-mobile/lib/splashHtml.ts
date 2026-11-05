const controlPanelMarkup = /<div id="ui">[\s\S]*?<\/div>/;
const controlHandlers = /\$\('sd'\)\.onclick=[\s\S]*?\$\('rp'\)\.onclick=[\s\S]*?playAu\(\)\};/;

export function prepareSplashHtml(source: string): string {
  if (!controlPanelMarkup.test(source)) {
    throw new Error('Splash reference is missing its expected control panel.');
  }
  if (!source.includes('let snd=false,prev=0;') || !controlHandlers.test(source)) {
    throw new Error('Splash reference audio controls changed; update the autoplay adapter.');
  }

  return source
    .replace(controlPanelMarkup, '')
    .replace('let snd=false,prev=0;', 'let snd=true,prev=0;')
    .replace(controlHandlers, '');
}
