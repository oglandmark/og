import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { createMapAreaRadiusInjection } from '@/components/mapRadius';

export interface AndroidLeafletMarker {
  id?: string | number;
  latitude: number;
  longitude: number;
  label?: string;
  selected?: boolean;
  userLocation?: boolean;
  draggable?: boolean;
}

export interface AndroidMapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  centerLat: number;
  centerLng: number;
}

interface Props {
  markers: AndroidLeafletMarker[];
  center: { latitude: number; longitude: number };
  zoom?: number;
  interactive?: boolean;
  satellite?: boolean;
  areaRadiusKm?: number;
  areaColor?: string;
  colors: {
    background: string;
    card: string;
    foreground: string;
    mutedForeground: string;
    border: string;
    primary: string;
  };
  onMarkerPress?: (id: string | number) => void;
  onMarkerDragEnd?: (id: string | number, latitude: number, longitude: number) => void;
  onMapPress?: (latitude: number, longitude: number) => void;
  onBoundsChange?: (bounds: AndroidMapBounds) => void;
  onAreaCountChange?: (count: number) => void;
}

type MapMessage =
  | { type: 'ready' }
  | { type: 'marker'; id: string | number }
  | { type: 'markerDrag'; id: string | number; latitude: number; longitude: number }
  | { type: 'press'; latitude: number; longitude: number }
  | { type: 'areaCount'; count: number }
  | ({ type: 'bounds' } & AndroidMapBounds);

function buildMapHtml({
  markers,
  center,
  zoom,
  interactive,
  satellite,
  areaRadiusKm,
  areaColor,
}: Omit<Props, 'colors' | 'onMarkerPress' | 'onMarkerDragEnd' | 'onMapPress' | 'onBoundsChange' | 'onAreaCountChange'>) {
  const serializedMarkers = JSON.stringify(markers).replace(/</g, '\\u003c');
  const tileUrl = satellite
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body, #map { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #e8f0f7; }
    .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .leaflet-control-zoom {
      border: 1px solid rgba(200,164,90,.45) !important;
      border-radius: 12px !important;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0,0,0,.35) !important;
    }
    .leaflet-control-zoom a {
      color: #102a43 !important;
      background: rgba(255,255,255,.96) !important;
      border-color: rgba(16,42,67,.18) !important;
    }
    .price-marker { position: relative; transform: translate(-50%, -100%); }
    .price-pill {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 6px 10px;
      white-space: nowrap;
      border: 1.5px solid #d8b86c;
      border-radius: 10px;
      background: #ffffff;
      color: #102a43;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .15px;
      box-shadow: 0 7px 18px rgba(0,0,0,.42);
    }
    .price-marker.selected .price-pill { background: #c8a45a; color: #102a43; border-color: #9b762c; }
    .price-stem {
      width: 2px;
      height: 8px;
      margin: 0 auto;
      background: #d8b86c;
      box-shadow: 0 2px 4px rgba(0,0,0,.4);
    }
    .gold-pin {
      width: 30px; height: 30px;
      transform: rotate(45deg);
      border-radius: 50% 50% 50% 8px;
      border: 3px solid #f2d996;
      background: #c8a45a;
      box-shadow: 0 7px 18px rgba(0,0,0,.45);
    }
    .gold-pin:after {
      content: "";
      position: absolute;
      width: 8px; height: 8px;
      top: 8px; left: 8px;
      border-radius: 50%;
       background: #ffffff;
    }
    .user-dot {
      width: 18px; height: 18px;
      border-radius: 50%;
      border: 3px solid #fff;
      background: #4285f4;
      box-shadow: 0 0 0 7px rgba(66,133,244,.25), 0 4px 12px rgba(0,0,0,.35);
    }
    .og-cluster {
      width: 42px; height: 42px; border-radius: 21px;
      display: flex; align-items: center; justify-content: center;
      background: #c8a45a; color: #102a43;
      border: 3px solid #f2d996;
      font-size: 12px; font-weight: 900;
      box-shadow: 0 7px 18px rgba(0,0,0,.45);
    }
  </style>
</head>
<body>
  <div id="map"></div>
   <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
   <script>if (!window.L) document.write('<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"><\/script>');</script>
   <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
   <script>if (!L.MarkerClusterGroup) document.write('<script src="https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"><\/script>');</script>
  <script>
    (function () {
      function send(payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
      function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
          return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[char];
        });
      }
      var map = L.map('map', {
        zoomControl: ${interactive},
        attributionControl: false,
        dragging: ${interactive},
        touchZoom: ${interactive},
        doubleClickZoom: ${interactive},
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false,
        preferCanvas: true
      }).setView([${center.latitude}, ${center.longitude}], ${zoom});

       var primaryTiles = L.tileLayer('${tileUrl}', {
         maxZoom: 19,
         maxNativeZoom: 19,
         keepBuffer: 4,
         updateWhenIdle: false,
         updateWhenZooming: true,
         errorTileUrl: ''
       });
        var detailTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
         maxZoom: 19,
         maxNativeZoom: 19,
         keepBuffer: 3,
         opacity: 0.98
       });
       var fallbackEnabled = false;
       primaryTiles.on('tileerror', function () {
         if (!fallbackEnabled) {
           fallbackEnabled = true;
            map.removeLayer(primaryTiles);
           detailTiles.addTo(map);
         }
       });
       primaryTiles.addTo(map);

       var areaCircle = null;
       var markers = ${serializedMarkers};
       ${areaRadiusKm ? `
       areaCircle = L.circle([${center.latitude}, ${center.longitude}], {
         radius: ${areaRadiusKm * 1000},
         color: '${areaColor ?? '#2F80ED'}',
         weight: 1.5,
         fillColor: '${areaColor ?? '#2F80ED'}',
         fillOpacity: 0.18,
         interactive: false
       }).addTo(map);
       ` : ''}

       function distanceKm(a, b) {
         var earthRadiusKm = 6371;
         var lat1 = a.latitude * Math.PI / 180;
         var lat2 = b.latitude * Math.PI / 180;
         var deltaLat = (b.latitude - a.latitude) * Math.PI / 180;
         var deltaLng = (b.longitude - a.longitude) * Math.PI / 180;
         var haversine = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
           Math.cos(lat1) * Math.cos(lat2) *
           Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
         return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
       }

       function sendAreaCount() {
         if (!areaCircle) return;
         var centerPoint = areaCircle.getLatLng();
         var radiusKm = areaCircle.getRadius() / 1000;
         var count = markers.filter(function (item) {
           if (item.userLocation) return false;
           return distanceKm(
             { latitude: centerPoint.lat, longitude: centerPoint.lng },
             { latitude: item.latitude, longitude: item.longitude }
           ) <= radiusKm;
         }).length;
         send({ type: 'areaCount', count: count });
       }

       window.__setAreaRadius = function(radiusKm, shouldFit) {
         var nextRadius = Number(radiusKm);
         if (!areaCircle || !isFinite(nextRadius) || nextRadius <= 0) return;
         areaCircle.setRadius(nextRadius * 1000);
         sendAreaCount();
         if (shouldFit) {
           map.fitBounds(areaCircle.getBounds(), { padding: [34, 34], maxZoom: 15, animate: true });
         }
       };

       map.on('move', function () {
         if (areaCircle) {
           areaCircle.setLatLng(map.getCenter());
         }
       });

      var bounds = [];
       var clusterGroup = L.markerClusterGroup && markers.length > 1
         ? L.markerClusterGroup({
             showCoverageOnHover: false,
             spiderfyOnMaxZoom: true,
             maxClusterRadius: 54,
             disableClusteringAtZoom: 12,
             iconCreateFunction: function(cluster) {
               return L.divIcon({
                 html: '<div class="og-cluster">' + cluster.getChildCount() + '</div>',
                 className: '',
                 iconSize: [42, 42],
                 iconAnchor: [21, 21]
               });
             }
           })
         : null;
      markers.forEach(function (item) {
        var html;
        var size;
        var anchor;
        if (item.userLocation) {
          html = '<div class="user-dot"></div>';
          size = [18, 18]; anchor = [9, 9];
        } else if (item.label) {
          html = '<div class="price-marker ' + (item.selected ? 'selected' : '') + '"><div class="price-pill">' +
            escapeHtml(item.label) + '</div><div class="price-stem"></div></div>';
          size = [1, 1]; anchor = [0, 0];
        } else {
          html = '<div class="gold-pin"></div>';
          size = [30, 38]; anchor = [15, 38];
        }
        var icon = L.divIcon({ html: html, iconSize: size, iconAnchor: anchor, className: '' });
        var marker = L.marker([item.latitude, item.longitude], {
          icon: icon,
          keyboard: false,
          draggable: !!item.draggable,
          autoPan: !!item.draggable
        });
         if (clusterGroup && !item.userLocation && !item.draggable && !item.selected) {
           clusterGroup.addLayer(marker);
         } else {
           marker.addTo(map);
         }
        if (item.id !== undefined && item.id !== null) {
          marker.on('click', function (event) {
            L.DomEvent.stopPropagation(event);
            map.setView(marker.getLatLng(), Math.max(map.getZoom(), 17), { animate: true });
            send({ type: 'marker', id: item.id });
          });
          if (item.draggable) {
            marker.on('dragend', function (event) {
              var position = event.target.getLatLng();
              send({
                type: 'markerDrag',
                id: item.id,
                latitude: position.lat,
                longitude: position.lng
              });
            });
          }
        }
        if (!item.userLocation) bounds.push([item.latitude, item.longitude]);
      });
       if (clusterGroup && clusterGroup.getLayers().length) clusterGroup.addTo(map);
      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [42, 42], maxZoom: 8 });
      }

      function sendBounds() {
        var b = map.getBounds();
        var c = map.getCenter();
        send({
          type: 'bounds',
          north: b.getNorth(), south: b.getSouth(),
          east: b.getEast(), west: b.getWest(),
          centerLat: c.lat, centerLng: c.lng
        });
      }
      map.on('moveend', function () {
        sendBounds();
        sendAreaCount();
      });
      ${interactive ? `map.on('click', function (event) {
        send({ type: 'press', latitude: event.latlng.lat, longitude: event.latlng.lng });
      });` : ''}
       setTimeout(function () {
         map.invalidateSize(true);
         setTimeout(function () { map.invalidateSize(true); }, 350);
        send({ type: 'ready' });
        sendBounds();
         sendAreaCount();
      }, 80);
    })();
  </script>
</body>
</html>`;
}

export function AndroidLeafletMap(props: Props) {
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const webViewRef = useRef<WebView>(null);
  const html = useMemo(() => buildMapHtml(props), [
    props.center.latitude,
    props.center.longitude,
    props.areaColor,
    props.interactive,
    props.markers,
    props.satellite,
    props.zoom,
  ]);

  const syncAreaRadius = (fit = false) => {
    const injection = createMapAreaRadiusInjection(Number(props.areaRadiusKm), fit);
    if (injection) webViewRef.current?.injectJavaScript(injection);
  };

  useEffect(() => {
    if (readyRef.current) syncAreaRadius(true);
  }, [props.areaRadiusKm]);

  useEffect(() => {
    readyRef.current = false;
    setReady(false);
    const timeout = setTimeout(() => {
      // Keep the map surface visible if a tile/CDN is slow. A fresh app open
      // creates a fresh WebView instead of covering the map with an error card.
      if (!readyRef.current) setReady(true);
    }, 15000);
    return () => clearTimeout(timeout);
  }, [attempt, html]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as MapMessage;
      if (message.type === 'ready') {
        readyRef.current = true;
        setReady(true);
        syncAreaRadius();
      } else if (message.type === 'marker') {
        props.onMarkerPress?.(message.id);
      } else if (message.type === 'markerDrag') {
        props.onMarkerDragEnd?.(message.id, message.latitude, message.longitude);
      } else if (message.type === 'press') {
        props.onMapPress?.(message.latitude, message.longitude);
      } else if (message.type === 'bounds') {
        props.onBoundsChange?.(message);
      } else if (message.type === 'areaCount') {
        props.onAreaCountChange?.(Math.max(0, Math.round(message.count)));
      }
    } catch {
      // Ignore malformed messages from the embedded document.
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: props.colors.background }]}>
      <WebView
        ref={webViewRef}
        key={attempt}
        source={{ html, baseUrl: 'https://og-landmark.app' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        nestedScrollEnabled
        overScrollMode="never"
        bounces={false}
        scrollEnabled={false}
        onMessage={handleMessage}
         onError={() => setReady(true)}
         onHttpError={() => setReady(true)}
        style={styles.webView}
      />
      <View pointerEvents="none" style={[styles.liveBadge, { backgroundColor: props.colors.card, borderColor: props.colors.border }]}>
        <View style={[styles.liveDot, { backgroundColor: props.colors.primary }]} />
        <Text style={[styles.liveText, { color: props.colors.foreground }]}>OG LIVE MAP</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  webView: { flex: 1, backgroundColor: 'transparent' },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  loadingText: { fontSize: 12, fontWeight: '500' },
  liveBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    opacity: 0.94,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 8,
  },
  stateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  stateTitle: { fontSize: 15, fontWeight: '700' },
  stateText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginTop: 5,
  },
  retryText: { color: '#102a43', fontSize: 12, fontWeight: '800' },
});
