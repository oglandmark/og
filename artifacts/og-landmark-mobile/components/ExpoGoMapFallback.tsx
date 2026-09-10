import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

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
  const radius = Math.max(0.4, Number(radiusKm ?? 0));

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    * { box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; margin: 0; background: #e8f0f7; }
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
        zoomControl: interactive,
        attributionControl: true,
        dragging: interactive,
        touchZoom: interactive,
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
      points.forEach(function (point) {
        if (point.latitude == null || point.longitude == null) return;
        var marker = L.marker([point.latitude, point.longitude], {
          icon: pointIcon(point), draggable: interactive && !point.label
        }).addTo(map);
        if (point.id != null) marker.on('click', function () { send('select', { id: point.id }); });
        if (interactive) marker.on('dragend', function (event) {
          var p = event.target.getLatLng();
          send('drag', { latitude: p.lat, longitude: p.lng });
        });
      });
      if (${radiusKm != null}) {
        L.circle([${latitude}, ${longitude}], {
          radius: ${radius * 1000}, color: '#1f6f8b', weight: 1.5,
          fillColor: '#7fc8d6', fillOpacity: .16
        }).addTo(map);
      }
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
  const html = useMemo(
    () => buildMapHtml({
      latitude: props.latitude,
      longitude: props.longitude,
      zoom: props.zoom,
      points: props.points,
      radiusKm: props.radiusKm,
      interactive: props.interactive,
    }),
    [props.latitude, props.longitude, props.zoom, props.points, props.radiusKm, props.interactive],
  );

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
      if (message.type === 'ready') return;
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
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        startInLoadingState
        renderLoading={() => <View style={styles.loading} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: '#e8f0f7' },
  loading: { ...StyleSheet.absoluteFill, backgroundColor: '#e8f0f7' },
});