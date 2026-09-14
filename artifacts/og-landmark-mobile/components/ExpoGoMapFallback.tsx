import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';

export type ExpoGoMapPoint = {
  id?: string | number;
  latitude: number;
  longitude: number;
  label?: string;
};

type Props = {
  latitude: number;
  longitude: number;
  zoom?: number;
  points?: ExpoGoMapPoint[];
  radiusKm?: number;
  interactive?: boolean;
  onSelect?: (id: string | number) => void;
  onPress?: (latitude: number, longitude: number) => void;
  onDragEnd?: (latitude: number, longitude: number) => void;
  onRegionChange?: (region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => void;
};

function toSafeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function buildMapHtml({
  latitude,
  longitude,
  zoom,
  points,
  radiusKm,
  interactive,
}: Required<Pick<Props, 'latitude' | 'longitude'>> & Omit<Props, 'latitude' | 'longitude'>) {
  const pointsJson = toSafeJson(points ?? []);
  const radius = Math.min(10, Math.max(0.4, Math.round(Number(radiusKm ?? 0) * 10) / 10));

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    * { box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; margin: 0; background: #e8f0f7; overflow: hidden; }
    .leaflet-container { touch-action: none; }
    .leaflet-control-attribution { font-size: 8px; opacity: .72; }
    .pin, .user-pin {
      width: 22px; height: 22px; border-radius: 50%;
      background: #c8a45a; border: 3px solid #f3d37c;
      box-shadow: 0 2px 7px rgba(16,42,67,.45);
    }
    .user-pin { width: 18px; height: 18px; background: #4285f4; border-color: #fff; }
    .price-pill {
      display: inline-block; padding: 5px 8px; border-radius: 9px;
      color: #102a43; background: #fff; border: 1.5px solid #c8a45a;
      box-shadow: 0 2px 7px rgba(16,42,67,.28); font: 700 11px Arial, sans-serif;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var points = ${pointsJson};
      var interactive = ${Boolean(interactive)};
      var map = L.map('map', {
        zoomControl: false,
        attributionControl: true,
        dragging: interactive,
        // Expo Go's Android WebView can swallow Leaflet's built-in pinch
        // handler. A small native touch bridge below handles two-finger zoom.
        touchZoom: false,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
      }).setView([${latitude}, ${longitude}], ${zoom ?? 13});
      var primary = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, crossOrigin: true, attribution: '&copy; OpenStreetMap contributors'
      });
      var fallback = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: 'Tiles &copy; Esri'
      });
      var fallbackUsed = false;
      primary.on('tileerror', function () {
        if (!fallbackUsed) { fallbackUsed = true; fallback.addTo(map); }
      });
      primary.addTo(map);

      function send(type, payload) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify(Object.assign({ type: type }, payload || {}))
        );
      }
      function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (c) {
          return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c];
        });
      }
      function pointIcon(point) {
        var html = point.label
          ? '<div class="price-pill">' + escapeHtml(point.label) + '</div>'
          : '<div class="pin"></div>';
        return L.divIcon({
          html: html, className: '', iconSize: point.label ? [70, 30] : [22, 22],
          iconAnchor: point.label ? [35, 15] : [11, 11]
        });
      }
      var markerLayer = L.layerGroup().addTo(map);
      var areaCircle = null;
      function renderPoints(nextPoints) {
        markerLayer.clearLayers();
        (nextPoints || []).forEach(function (point) {
          if (point.latitude == null || point.longitude == null) return;
          var marker = L.marker([point.latitude, point.longitude], {
            icon: pointIcon(point), draggable: interactive && !point.label
          }).addTo(markerLayer);
          if (point.id != null) marker.on('click', function () { send('select', { id: point.id }); });
          if (interactive) marker.on('dragend', function (event) {
            var p = event.target.getLatLng();
            send('drag', { latitude: p.lat, longitude: p.lng });
          });
        });
      }
      function updateArea(nextLatitude, nextLongitude, nextRadiusKm) {
        if (nextLatitude == null || nextLongitude == null || nextRadiusKm == null) return;
        var nextRadiusKmSafe = Math.min(10, Math.max(0.4, Math.round(Number(nextRadiusKm) * 10) / 10));
        var nextRadius = nextRadiusKmSafe * 1000;
        if (!areaCircle) {
          areaCircle = L.circle([nextLatitude, nextLongitude], {
            radius: nextRadius, color: '#1f6f8b', weight: 1.5,
            fillColor: '#7fc8d6', fillOpacity: .16
          }).addTo(map);
        } else {
          areaCircle.setLatLng([nextLatitude, nextLongitude]);
          areaCircle.setRadius(nextRadius);
        }
      }
      renderPoints(points);
      if (${radiusKm != null}) updateArea(${latitude}, ${longitude}, ${radius});
      map.on('move', function () {
        if (areaCircle) areaCircle.setLatLng(map.getCenter());
      });
      var pinchStartDistance = 0;
      var pinchStartZoom = 0;
      function touchDistance(touches) {
        var dx = touches[0].clientX - touches[1].clientX;
        var dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
      }
      var mapElement = map.getContainer();
      mapElement.addEventListener('touchstart', function (event) {
        if (!interactive || event.touches.length !== 2) return;
        pinchStartDistance = touchDistance(event.touches);
        pinchStartZoom = map.getZoom();
        event.preventDefault();
      }, { passive: false });
      mapElement.addEventListener('touchmove', function (event) {
        if (!interactive || event.touches.length !== 2 || !pinchStartDistance) return;
        var scale = touchDistance(event.touches) / pinchStartDistance;
        var nextZoom = Math.max(3, Math.min(19, pinchStartZoom + Math.log(scale) / Math.LN2));
        map.setZoom(nextZoom, { animate: false });
        event.preventDefault();
      }, { passive: false });
      mapElement.addEventListener('touchend', function (event) {
        if (event.touches.length < 2) pinchStartDistance = 0;
      }, { passive: false });
      window.__zoomMap = function (delta) {
        var nextZoom = Math.max(3, Math.min(19, map.getZoom() + Number(delta || 0)));
        map.setZoom(nextZoom, { animate: true });
      };
      window.__updateMapState = function (next) {
        if (!next) return;
        var current = map.getCenter();
        if (next.latitude != null && next.longitude != null &&
            (Math.abs(current.lat - next.latitude) > 0.000001 ||
             Math.abs(current.lng - next.longitude) > 0.000001)) {
          map.setView([next.latitude, next.longitude], next.zoom || map.getZoom(), { animate: false });
        }
        if (next.points) renderPoints(next.points);
        if (next.radiusKm != null) updateArea(next.latitude, next.longitude, next.radiusKm);
      };
      map.on('click', function (event) {
        if (interactive) send('press', { latitude: event.latlng.lat, longitude: event.latlng.lng });
      });
      map.on('moveend', function () {
        var c = map.getCenter(), b = map.getBounds();
        send('region', {
          latitude: c.lat, longitude: c.lng,
          latitudeDelta: Math.abs(b.getNorth() - b.getSouth()),
          longitudeDelta: Math.abs(b.getEast() - b.getWest())
        });
      });
      send('ready');
    })();
  </script>
</body>
</html>`;
}

export function ExpoGoMapFallback(props: Props) {
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const initialHtmlRef = useRef<string | null>(null);
  if (!initialHtmlRef.current) {
    initialHtmlRef.current = buildMapHtml({
      latitude: props.latitude,
      longitude: props.longitude,
      zoom: props.zoom,
      points: props.points,
      radiusKm: props.radiusKm,
      interactive: props.interactive,
    });
  }

  const syncMapState = useCallback(() => {
    if (!readyRef.current) return;
    const payload = toSafeJson({
      latitude: props.latitude,
      longitude: props.longitude,
      zoom: props.zoom,
      points: props.points ?? [],
      radiusKm: props.radiusKm,
    });
    webViewRef.current?.injectJavaScript(
      `window.__updateMapState && window.__updateMapState(${payload}); true;`,
    );
  }, [props.latitude, props.longitude, props.zoom, props.points, props.radiusKm]);

  const zoomBy = useCallback((delta: number) => {
    webViewRef.current?.injectJavaScript(
      `window.__zoomMap && window.__zoomMap(${delta}); true;`,
    );
  }, []);

  useEffect(() => {
    syncMapState();
  }, [syncMapState, mapReady]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        id?: string | number;
        latitude?: number;
        longitude?: number;
        latitudeDelta?: number;
        longitudeDelta?: number;
      };
       if (message.type === 'ready') {
         readyRef.current = true;
         setMapReady(true);
         syncMapState();
         return;
       }
      if (message.type === 'select' && message.id != null) props.onSelect?.(message.id);
      if (message.type === 'press' && message.latitude != null && message.longitude != null) {
        props.onPress?.(message.latitude, message.longitude);
      }
      if (message.type === 'drag' && message.latitude != null && message.longitude != null) {
        props.onDragEnd?.(message.latitude, message.longitude);
      }
      if (
        message.type === 'region' &&
        message.latitude != null &&
        message.longitude != null &&
        message.latitudeDelta != null &&
        message.longitudeDelta != null
      ) {
        props.onRegionChange?.({
          latitude: message.latitude,
          longitude: message.longitude,
          latitudeDelta: message.latitudeDelta,
          longitudeDelta: message.longitudeDelta,
        });
      }
    } catch {
      // Ignore malformed messages from the remote map document.
    }
  };

  return (
    <View style={styles.container}>
       <WebView
         ref={webViewRef}
        originWhitelist={['*']}
         source={{ html: initialHtmlRef.current }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
         // Keep the native touch stream enabled. The HTML document itself is
         // overflow-locked, so this allows Leaflet pan/pinch without making
         // the surrounding Explore list scroll inside the map.
         scrollEnabled={true}
         nestedScrollEnabled={true}
         cacheEnabled
        onMessage={onMessage}
        startInLoadingState
        renderLoading={() => <View style={styles.loading} />}
      />
       <View pointerEvents="box-none" style={styles.zoomControls}>
         <Pressable
           accessibilityRole="button"
           accessibilityLabel="Zoom in map"
           style={styles.zoomButton}
           onPress={() => zoomBy(1)}
         >
           <Feather name="plus" size={20} color="#102a43" />
         </Pressable>
         <Pressable
           accessibilityRole="button"
           accessibilityLabel="Zoom out map"
           style={styles.zoomButton}
           onPress={() => zoomBy(-1)}
         >
           <Feather name="minus" size={20} color="#102a43" />
         </Pressable>
       </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: '#e8f0f7' },
  loading: { ...StyleSheet.absoluteFill, backgroundColor: '#e8f0f7' },
  zoomControls: {
    position: 'absolute',
    top: 12,
    left: 12,
    gap: 6,
  },
  zoomButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d6e0e8',
    shadowColor: '#102a43',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});