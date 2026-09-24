export const MAP_VIEW_MODE_CONTROL_HTML = `
  <div id="map-view-controls" class="map-view-controls" role="group" aria-label="Map view">
    <button type="button" class="map-view-button" data-map-mode="map" aria-pressed="false">Map</button>
    <button type="button" class="map-view-button" data-map-mode="satellite" aria-pressed="false">Satellite</button>
    <button type="button" class="map-view-button" data-map-mode="street" aria-pressed="false">Street View</button>
  </div>
`;

export const MAP_VIEW_MODE_CONTROL_CSS = `
  #street-view {
    position: absolute; inset: 0; z-index: 500; display: none; background: #fff;
  }
  #street-view-frame {
    width: 100%; height: 100%; border: 0; display: block;
  }
  #street-view-status {
    position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
    padding: 24px; color: #102a43; background: #f4f7fa; text-align: center;
    font: 600 14px Arial, sans-serif;
  }
  .map-view-controls {
    position: absolute; z-index: 1200; top: 6px; right: 10px;
    display: flex; align-items: center; gap: 12px; background: transparent;
    pointer-events: auto;
  }
  .map-view-button {
    appearance: none; border: 0; border-bottom: 2px solid transparent;
    min-height: 44px; padding: 0 2px; color: #fff; background: transparent;
    font: 700 12px Arial, sans-serif; white-space: nowrap; cursor: pointer;
    text-shadow: 0 1px 4px rgba(0, 0, 0, .95);
  }
  .map-view-button[aria-pressed="true"] {
    color: #f2d18a; border-bottom-color: #f2d18a;
  }
`;

export const MAP_VIEW_MODE_CONTROL_SCRIPT = `
  var mapViewControls = document.getElementById('map-view-controls');
  if (mapViewControls) {
    mapViewControls.addEventListener('click', function(event) {
      var button = event.target.closest('[data-map-mode]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof window.__setMapViewMode === 'function') {
        window.__setMapViewMode(button.getAttribute('data-map-mode'));
      }
    });
  }
  window.__syncMapViewModeButtons = function(mode) {
    document.querySelectorAll('[data-map-mode]').forEach(function(button) {
      button.setAttribute('aria-pressed', button.getAttribute('data-map-mode') === mode ? 'true' : 'false');
    });
  };
`;

export const MAP_VIEW_MODE_SWITCH_SCRIPT = `
  window.__setMapViewMode = function(mode) {
    if (mode !== 'map' && mode !== 'satellite' && mode !== 'street') return;
    var streetPanel = document.getElementById('street-view');
    var streetFrame = document.getElementById('street-view-frame');
    var streetStatus = document.getElementById('street-view-status');
    if (mode === 'street') {
      var center = typeof window.__getStreetViewCenter === 'function'
        ? window.__getStreetViewCenter()
        : map.getCenter();
      map.getContainer().style.display = 'none';
      streetPanel.style.display = 'block';
      if (!googleMapsApiKey) {
        streetFrame.style.display = 'none';
        streetStatus.textContent = 'Street View is unavailable because its Google Maps key is not configured.';
        streetStatus.style.display = 'flex';
      } else {
        streetStatus.style.display = 'none';
        streetFrame.style.display = 'block';
        streetFrame.src = 'https://www.google.com/maps/embed/v1/streetview?key=' +
          encodeURIComponent(googleMapsApiKey) +
          '&location=' + encodeURIComponent(center.lat.toFixed(6) + ',' + center.lng.toFixed(6)) +
          '&heading=0&pitch=0&fov=85';
      }
    } else {
      streetPanel.style.display = 'none';
      map.getContainer().style.display = 'block';
      streetFrame.src = 'about:blank';
      var style = mode === 'satellite' ? 'satellite-streets-v12' : 'streets-v12';
      mapboxTiles.setUrl(
        'https://api.mapbox.com/styles/v1/mapbox/' + style +
        '/tiles/256/{z}/{x}/{y}@2x?access_token=' + encodeURIComponent(mapboxToken)
      );
      window.requestAnimationFrame(function() { map.invalidateSize(); });
    }
    currentMapMode = mode;
    window.__syncMapViewModeButtons(mode);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mode', mode: mode }));
    }
  };
  window.__syncMapViewModeButtons(currentMapMode);
`;