export type MapViewModeValue = 'map' | 'satellite';

type MapFrameWindow = Window & {
  __setMapViewMode?: (mode: MapViewModeValue) => void;
};

export function setMapViewModeForFrame(
  frame: Window | null | undefined,
  channel: string,
  mode: MapViewModeValue,
) {
  if (!frame) return;

  const mapFrame = frame as MapFrameWindow;
  if (typeof mapFrame.__setMapViewMode === 'function') {
    mapFrame.__setMapViewMode(mode);
    return;
  }

  frame.postMessage({ channel, type: 'og-map-view-mode', mode }, '*');
}

export const MAP_VIEW_MODE_SWITCH_SCRIPT = `
  window.__setMapViewMode = function(mode) {
    if (mode !== 'map' && mode !== 'satellite') return;
    var style = mode === 'satellite' ? 'satellite-streets-v12' : 'streets-v12';
    mapboxTiles.setUrl(
      'https://api.mapbox.com/styles/v1/mapbox/' + style +
      '/tiles/256/{z}/{x}/{y}@2x?access_token=' + encodeURIComponent(mapboxToken)
    );
    window.requestAnimationFrame(function() { map.invalidateSize(); });
    currentMapMode = mode;
    if (typeof window.__syncMapViewModeButtons === 'function') {
      window.__syncMapViewModeButtons(mode);
    }
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mode', mode: mode }));
    }
  };
  if (typeof window.__syncMapViewModeButtons === 'function') {
    window.__syncMapViewModeButtons(currentMapMode);
  }
`;