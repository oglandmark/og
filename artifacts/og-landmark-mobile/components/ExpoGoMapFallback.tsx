import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { MapViewModeControl, type MapViewMode } from '@/components/MapViewModeControl';
import { MAP_VIEW_MODE_SWITCH_SCRIPT } from '@/components/MapViewModes';
import { useColors } from '@/hooks/useColors';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';

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
  satellite?: boolean;
  modeControlTop?: number;
  modeControlLeft?: number;
  modeControlRight?: number;
  modeControlHorizontal?: boolean;
  modeControlButtonHeight?: number;
  zoomControlsBottomRight?: boolean;
  onSelect?: (id: string | number) => void;
  onPress?: (latitude: number, longitude: number) => void;
  onDragEnd?: (latitude: number, longitude: number) => void;
  onRegionChange?: (region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
    zoom?: number;
    userGesture?: boolean;
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
  satellite,
}: Required<Pick<Props, 'latitude' | 'longitude'>> & Omit<Props, 'latitude' | 'longitude'>) {
  const pointsJson = toSafeJson(points ?? []);
  const radius = Math.min(10, Math.max(0.4, Math.round(Number(radiusKm ?? 0) * 10) / 10));
  const mapboxToken = toSafeJson(MAPBOX_ACCESS_TOKEN);
  const mapboxStyle = satellite ? 'satellite-streets-v12' : 'streets-v12';

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
      position: relative;
      width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
      background: #183B60; border: 3px solid #ffffff;
      box-shadow: 0 2px 7px rgba(16,42,67,.45);
      transform: rotate(-45deg);
    }
    .pin::after { content: ''; position: absolute; width: 8px; height: 8px; left: 7px; top: 7px; border-radius: 50%; background: #ffffff; }
    .user-pin { width: 18px; height: 18px; background: #4285f4; border-color: #fff; }
    .price-pill {
      position: absolute; left: 50%; bottom: 7px; transform: translateX(-50%);
      display: inline-block; padding: 5px 8px; border-radius: 9px;
      color: #0B1F3A; background: #fff; border: 1.5px solid #c8a45a;
      box-shadow: 0 2px 7px rgba(16,42,67,.28); font: 700 11px Arial, sans-serif;
      white-space: nowrap;
    }
    .price-pill-tip {
      position: absolute; top: calc(100% - 1px); left: 50%; transform: translateX(-50%);
      width: 0; height: 0; border-left: 7px solid transparent;
      border-right: 7px solid transparent; border-top: 8px solid #c8a45a;
    }
    .price-pill-tip::after {
      content: ''; position: absolute; left: -5.5px; top: -8px; width: 0; height: 0;
      border-left: 5.5px solid transparent; border-right: 5.5px solid transparent;
      border-top: 6px solid #fff;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
       var points = ${pointsJson};
       var mapboxToken = ${mapboxToken};
        var currentMapMode = '${satellite ? 'satellite' : 'map'}';
        var mapboxStyle = '${mapboxStyle}';
      var interactive = ${Boolean(interactive)};
      var map = L.map('map', {
        zoomControl: false,
        attributionControl: true,
        dragging: interactive,
        // Expo Go's Android WebView can swallow Leaflet's built-in pinch
        // handler. A capture-phase touch bridge below handles two-finger zoom.
        touchZoom: false,
         zoomSnap: 0.25,
         zoomDelta: 0.5,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
      }).setView([${latitude}, ${longitude}], ${zoom ?? 13});
       var mapboxTiles = L.tileLayer(
         'https://api.mapbox.com/styles/v1/mapbox/' + mapboxStyle + '/tiles/256/{z}/{x}/{y}@2x?access_token=' + encodeURIComponent(mapboxToken),
         { maxZoom: 22, maxNativeZoom: 22, crossOrigin: true, attribution: '&copy; Mapbox &copy; OpenStreetMap' }
       );
       mapboxTiles.addTo(map);
        ${MAP_VIEW_MODE_SWITCH_SCRIPT}

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
        var priceWidth = point.label
          ? Math.max(70, Math.min(190, String(point.label).length * 7 + 20))
          : 28;
        var html = point.label
          ? '<div class="price-pill">' + escapeHtml(point.label) + '<span class="price-pill-tip"></span></div>'
          : '<div class="pin"></div>';
        return L.divIcon({
           html: html, className: '',
           iconSize: point.label ? [priceWidth, 32] : [28, 28],
           iconAnchor: point.label ? [priceWidth / 2, 32] : [14, 28]
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
            radius: nextRadius, color: '#2f6f9f', weight: 2, opacity: .82,
            dashArray: '6 8', fillColor: '#2f6f9f', fillOpacity: .10,
            interactive: false
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
       var pinchAnchor = null;
       var pinchActive = false;
       var userGestureActive = false;
       var userGestureResetTimer = null;
       var regionReportTimer = null;
       function markUserGesture() {
         userGestureActive = true;
         if (userGestureResetTimer) clearTimeout(userGestureResetTimer);
       }
       function finishUserGesture(delay) {
         if (userGestureResetTimer) clearTimeout(userGestureResetTimer);
         userGestureResetTimer = setTimeout(function () {
           userGestureActive = false;
         }, delay);
       }
      function touchDistance(touches) {
        var dx = touches[0].clientX - touches[1].clientX;
        var dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
      }
      var mapElement = map.getContainer();
       function startPinch(event) {
         if (!interactive) return;
         markUserGesture();
         if (event.touches.length !== 2) return;
         event.stopPropagation();
        pinchStartDistance = touchDistance(event.touches);
        pinchStartZoom = map.getZoom();
         var rect = mapElement.getBoundingClientRect();
         pinchAnchor = L.point(
           (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left,
           (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top
         );
         pinchActive = pinchStartDistance > 0;
         if (pinchActive && map.dragging.enabled()) map.dragging.disable();
        event.preventDefault();
         event.stopPropagation();
       }
       function movePinch(event) {
         if (!interactive) return;
         if (event.touches.length !== 2 || !pinchActive) return;
         event.stopPropagation();
        var scale = touchDistance(event.touches) / pinchStartDistance;
        var nextZoom = Math.max(3, Math.min(19, pinchStartZoom + Math.log(scale) / Math.LN2));
         map.setZoomAround(pinchAnchor, nextZoom, { animate: false });
        event.preventDefault();
         event.stopPropagation();
       }
       function resetPinch() {
         if (!pinchActive) return;
         pinchStartDistance = 0;
         pinchAnchor = null;
         pinchActive = false;
         if (interactive) map.dragging.enable();
       }
       function endPinch(event) {
         if (pinchActive) event.stopPropagation();
         if (event.touches.length < 2) resetPinch();
         if (event.touches.length === 0) finishUserGesture(250);
       }
       function cancelPinch(event) {
         var wasPinching = pinchActive;
         resetPinch();
         if (wasPinching) event.stopPropagation();
         finishUserGesture(0);
       }
       mapElement.addEventListener('touchstart', startPinch, { passive: false, capture: true });
       mapElement.addEventListener('touchmove', movePinch, { passive: false, capture: true });
       mapElement.addEventListener('touchend', endPinch, { passive: false, capture: true });
       mapElement.addEventListener('touchcancel', cancelPinch, { passive: false, capture: true });
      window.__zoomMap = function (delta) {
        var nextZoom = Math.max(3, Math.min(19, map.getZoom() + Number(delta || 0)));
        map.setZoom(nextZoom, { animate: true });
      };
      window.__updateMapState = function (next) {
        if (!next) return;
        var current = map.getCenter();
         var centerChanged = next.latitude != null && next.longitude != null &&
           (Math.abs(current.lat - next.latitude) > 0.000001 ||
            Math.abs(current.lng - next.longitude) > 0.000001);
         var zoomChanged = next.zoom != null && Math.abs(map.getZoom() - Number(next.zoom)) > 0.01;
         if (centerChanged || zoomChanged) {
           map.setView(
             centerChanged ? [next.latitude, next.longitude] : [current.lat, current.lng],
             next.zoom != null ? Number(next.zoom) : map.getZoom(),
             { animate: true },
           );
        }
        if (next.points) renderPoints(next.points);
        if (next.radiusKm != null) updateArea(next.latitude, next.longitude, next.radiusKm);
      };
      map.on('click', function (event) {
        if (interactive) send('press', { latitude: event.latlng.lat, longitude: event.latlng.lng });
      });
       function sendRegion() {
        var c = map.getCenter(), b = map.getBounds();
        send('region', {
          latitude: c.lat, longitude: c.lng,
          latitudeDelta: Math.abs(b.getNorth() - b.getSouth()),
          longitudeDelta: Math.abs(b.getEast() - b.getWest()),
           zoom: map.getZoom(),
           userGesture: userGestureActive
        });
       }
       map.on('moveend', function () {
         if (regionReportTimer) clearTimeout(regionReportTimer);
         if (!userGestureActive) {
           sendRegion();
           return;
         }
         regionReportTimer = setTimeout(sendRegion, 100);
      });
      send('ready');
    })();
  </script>
</body>
</html>`;
}

export function ExpoGoMapFallback(props: Props) {
  const colors = useColors();
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapMode, setMapMode] = useState<MapViewMode>(props.satellite ? 'satellite' : 'map');
  const initialHtmlRef = useRef<string | null>(null);
  if (!initialHtmlRef.current) {
    initialHtmlRef.current = buildMapHtml({
      latitude: props.latitude,
      longitude: props.longitude,
      zoom: props.zoom,
      points: props.points,
      radiusKm: props.radiusKm,
      interactive: props.interactive,
       satellite: props.satellite,
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

  useEffect(() => {
    setMapMode(props.satellite ? 'satellite' : 'map');
  }, [props.satellite]);

  useEffect(() => {
    if (!mapReady) return;
    webViewRef.current?.injectJavaScript(
      `window.__setMapViewMode && window.__setMapViewMode(${JSON.stringify(mapMode)}); true;`,
    );
  }, [mapMode, mapReady]);

  const changeMapMode = useCallback((mode: MapViewMode) => {
    setMapMode(mode);
    webViewRef.current?.injectJavaScript(
      `window.__setMapViewMode && window.__setMapViewMode(${JSON.stringify(mode)}); true;`,
    );
  }, []);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        mode?: string;
        id?: string | number;
        latitude?: number;
        longitude?: number;
        latitudeDelta?: number;
        longitudeDelta?: number;
        zoom?: number;
         userGesture?: boolean;
      };
       if (message.type === 'ready') {
         readyRef.current = true;
         setMapReady(true);
         syncMapState();
         return;
       }
        if (message.type === 'mode') {
           if (message.mode === 'map' || message.mode === 'satellite') {
            setMapMode(message.mode);
          }
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
            zoom: message.zoom ?? props.zoom ?? 14,
             userGesture: message.userGesture === true,
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
         // Leaflet owns all pan and pinch gestures. Prevent the native
         // WebView scroll container from competing with the map or bubbling
         // a vertical drag to an outer screen.
         scrollEnabled={false}
         nestedScrollEnabled={false}
         bounces={false}
         overScrollMode="never"
         cacheEnabled
        onMessage={onMessage}
        startInLoadingState
        renderLoading={() => <View style={styles.loading} />}
      />
      <MapViewModeControl
        mode={mapMode}
        onChange={changeMapMode}
        top={props.modeControlTop}
        left={props.modeControlLeft}
        right={props.modeControlRight}
        horizontal={props.modeControlHorizontal}
        buttonHeight={props.modeControlButtonHeight}
      />
         <View
           pointerEvents="box-none"
           style={[
             styles.zoomControls,
             props.zoomControlsBottomRight && {
               top: undefined,
               left: undefined,
               right: 12,
               bottom: 76,
             },
           ]}
         >
         <Pressable
           accessibilityRole="button"
           accessibilityLabel="Zoom in map"
            style={[styles.zoomButton, { backgroundColor: colors.mapGlass, borderColor: colors.mapGlassBorder }]}
           onPress={() => zoomBy(1)}
         >
            <Feather name="plus" size={20} color={colors.foreground} />
         </Pressable>
         <Pressable
           accessibilityRole="button"
           accessibilityLabel="Zoom out map"
            style={[styles.zoomButton, { backgroundColor: colors.mapGlass, borderColor: colors.mapGlassBorder }]}
           onPress={() => zoomBy(-1)}
         >
            <Feather name="minus" size={20} color={colors.foreground} />
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
    borderWidth: 1,
    shadowColor: '#0B1F3A',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
