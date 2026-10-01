/**
 * MapViewComponent — Web implementation using iframe + Mapbox street tiles.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MapViewModeControl, type MapViewMode } from '@/components/MapViewModeControl';
import {
  MAP_VIEW_MODE_SWITCH_SCRIPT,
  setMapViewModeForFrame,
} from '@/components/MapViewModes';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';

interface InteractiveMapProps {
  region?: { latitude: number; longitude: number; latitudeDelta?: number; longitudeDelta?: number; zoom?: number };
  satellite?: boolean;
  onRegionChange?: (r: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
    zoom?: number;
    userGesture?: boolean;
  }) => void;
  onPress?: (e: any) => void;
  pinLat?: number;
  pinLng?: number;
  onDragEnd?: (lat: number, lng: number) => void;
  showMyLocation?: boolean;
  centerPin?: boolean;
  zoomControlsBottomRight?: boolean;
}

interface StaticMapProps {
  latitude?: number;
  longitude?: number;
  satellite?: boolean;
  interactive?: boolean;
}

function buildLeafletHtml(
  lat: number,
  lng: number,
  zoom: number,
  interactive = false,
  channel = 'og-map',
  satellite = false,
  centerPin = false,
  zoomControlsBottomRight = false,
) {
  const mapboxStyle = satellite ? 'satellite-streets-v12' : 'streets-v12';
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    * { margin:0; padding:0; }
    body { background:#e8f0f7; }
    #map { width:100%; height:100%; position:absolute;top:0;left:0;right:0;bottom:0; }
     .leaflet-container { touch-action:none; }
     .custom-pin { position:relative;width:28px;height:28px;background:#183B60;border-radius:50% 50% 50% 0;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);transform:rotate(-45deg); }
     .custom-pin::after { content:'';position:absolute;width:8px;height:8px;left:7px;top:7px;background:#fff;border-radius:50%; }
  </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>if (!window.L) document.write('<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"><\/script>');</script>
<script>
  var map = L.map('map', {
    zoomControl:${interactive}, attributionControl:false,
    scrollWheelZoom:${interactive}, dragging:${interactive},
    touchZoom:${interactive}, doubleClickZoom:${interactive}
  }).setView([${lat},${lng}],${zoom});
    ${interactive && zoomControlsBottomRight ? "map.zoomControl.setPosition('bottomright');" : ""}
    var mapboxToken = ${JSON.stringify(MAPBOX_ACCESS_TOKEN)};
    var currentMapMode = '${satellite ? 'satellite' : 'map'}';
    var mapboxTiles = L.tileLayer(
      'https://api.mapbox.com/styles/v1/mapbox/${mapboxStyle}/tiles/256/{z}/{x}/{y}@2x?access_token=' + encodeURIComponent(mapboxToken),
      {
        maxZoom:22, maxNativeZoom:22, keepBuffer:3,
        updateWhenIdle:false, updateWhenZooming:true,
        attribution:'© Mapbox © OpenStreetMap'
      }
    );
    mapboxTiles.addTo(map);
    ${MAP_VIEW_MODE_SWITCH_SCRIPT}
   var icon = L.divIcon({html:'<div class="custom-pin"></div>',iconSize:[28,28],iconAnchor:[14,28],className:''});
    var marker = L.marker([${lat},${lng}],{
      icon:icon,
      draggable:${interactive && !centerPin},
      opacity:${centerPin ? 0 : 1},
      interactive:${!centerPin}
    }).addTo(map);
    function send(type, payload) {
      window.parent.postMessage(Object.assign({ type:type, channel:'${channel}' }, payload), '*');
    }
    if (${interactive}) {
      map.on('click', function(e) {
        send('og-map-press', { latitude:e.latlng.lat, longitude:e.latlng.lng });
      });
      marker.on('dragend', function(e) {
        var p = e.target.getLatLng();
        send('og-map-drag', { latitude:p.lat, longitude:p.lng });
      });
       var userGestureActive = false;
       var userGestureResetTimer = null;
       var regionReportTimer = null;
       var mapElement = map.getContainer();
       function markUserGesture() {
         userGestureActive = true;
         if (userGestureResetTimer) clearTimeout(userGestureResetTimer);
       }
       function finishUserGesture(delay) {
         if (userGestureResetTimer) clearTimeout(userGestureResetTimer);
         userGestureResetTimer = setTimeout(function() {
           userGestureActive = false;
         }, delay);
       }
       mapElement.addEventListener('touchstart', function(event) {
         if (!${interactive}) return;
         markUserGesture();
       }, { passive:true, capture:true });
       mapElement.addEventListener('touchmove', function(event) {
         if (${interactive}) markUserGesture();
       }, { passive:true, capture:true });
       mapElement.addEventListener('touchend', function(event) {
         if (!${interactive}) return;
         if (event.touches.length === 0) finishUserGesture(250);
       }, { passive:true, capture:true });
       mapElement.addEventListener('touchcancel', function(event) {
         if (!${interactive}) return;
         finishUserGesture(0);
       }, { passive:true, capture:true });
       mapElement.addEventListener('pointerdown', function(event) {
         if (!${interactive}) return;
         markUserGesture();
       }, { passive:true, capture:true });
       mapElement.addEventListener('pointerup', function(event) {
         if (!${interactive}) return;
         finishUserGesture(250);
       }, { passive:true, capture:true });
       mapElement.addEventListener('wheel', function(event) {
         if (!${interactive}) return;
         markUserGesture();
         finishUserGesture(250);
       }, { passive:true, capture:true });
       mapElement.addEventListener('dblclick', function(event) {
         if (!${interactive}) return;
         markUserGesture();
         finishUserGesture(250);
       }, { passive:true, capture:true });
       map.on('moveend', function() {
         function sendRegion() {
        var c = map.getCenter(), b = map.getBounds();
        send('og-map-region', {
          latitude:c.lat, longitude:c.lng,
          latitudeDelta:Math.abs(b.getNorth() - b.getSouth()),
          longitudeDelta:Math.abs(b.getEast() - b.getWest()),
           zoom:map.getZoom(),
           userGesture:userGestureActive
        });
         }
         if (regionReportTimer) clearTimeout(regionReportTimer);
         if (!userGestureActive) {
           sendRegion();
           return;
         }
         regionReportTimer = setTimeout(sendRegion, 100);
      });
    }
   marker.on('click', function () {
     map.setView([${lat},${lng}], Math.max(map.getZoom(), 17), { animate: true });
   });
   window.addEventListener('message', function(event) {
     var data = event.data;
      if (!data || data.channel !== '${channel}') return;
      if (data.type === 'og-map-view-mode') {
        window.__setMapViewMode && window.__setMapViewMode(data.mode);
        return;
      }
      if (data.type !== 'og-map-update') return;
     if (data.latitude == null || data.longitude == null) return;
     marker.setLatLng([data.latitude, data.longitude]);
     map.setView([data.latitude, data.longitude], data.zoom || map.getZoom(), { animate: false });
   });
</script>
</body></html>`;
}

export function StaticMap({ latitude, longitude, satellite = true, interactive = true }: StaticMapProps) {
  const validCoordinates = latitude != null && longitude != null
    && Number.isFinite(latitude) && Number.isFinite(longitude);
  const safeLatitude = validCoordinates ? latitude : 0;
  const safeLongitude = validCoordinates ? longitude : 0;
  const channel = useMemo(() => `og-map-static-${Math.random().toString(36).slice(2)}`, []);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [mapMode, setMapMode] = useState<MapViewMode>(satellite ? 'satellite' : 'map');
  const sendMapMode = useCallback((mode: MapViewMode) => {
    setMapViewModeForFrame(iframeRef.current?.contentWindow, channel, mode);
  }, [channel]);
  const html = useMemo(
    () => buildLeafletHtml(safeLatitude, safeLongitude, 15, interactive, channel, satellite),
    [safeLatitude, safeLongitude, interactive, channel, satellite],
  );
  const blob = useMemo(
    () => typeof Blob !== 'undefined' ? URL.createObjectURL(new Blob([html], { type: 'text/html' })) : null,
    [html],
  );
  useEffect(() => () => { if (blob) URL.revokeObjectURL(blob); }, [blob]);
  useEffect(() => {
    setMapMode(satellite ? 'satellite' : 'map');
  }, [satellite]);
  if (!validCoordinates) return <View style={s.placeholder} />;
  return (
    <View style={s.container}>
      {/* @ts-ignore — iframe is valid on web */}
      <iframe
        ref={iframeRef}
        src={blob ?? 'about:blank'}
        srcDoc={!blob ? html : undefined}
        onLoad={() => sendMapMode(mapMode)}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 } as any}
        title="Property Location"
      />
      <MapViewModeControl
        mode={mapMode}
        top={78}
        onChange={(mode) => {
          setMapMode(mode);
          sendMapMode(mode);
        }}
      />
    </View>
  );
}

export function InteractiveMap({
  region,
  pinLat,
  pinLng,
  onPress,
  onDragEnd,
  onRegionChange,
  centerPin = false,
  zoomControlsBottomRight = false,
  satellite = false,
}: InteractiveMapProps) {
  const lat = pinLat ?? region?.latitude ?? 30.3753;
  const lng = pinLng ?? region?.longitude ?? 69.3451;
  const channel = useMemo(() => `og-map-${Math.random().toString(36).slice(2)}`, []);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [mapMode, setMapMode] = useState<MapViewMode>(satellite ? 'satellite' : 'map');
  const sendMapMode = useCallback((mode: MapViewMode) => {
    setMapViewModeForFrame(iframeRef.current?.contentWindow, channel, mode);
  }, [channel]);
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.channel !== channel) return;
      if (data.type === 'og-map-press') {
        onPress?.({ nativeEvent: { coordinate: { latitude: data.latitude, longitude: data.longitude } } });
      } else if (data.type === 'og-map-drag') {
        onDragEnd?.(data.latitude, data.longitude);
      } else if (data.type === 'og-map-region') {
        onRegionChange?.({
          latitude: data.latitude, longitude: data.longitude,
            latitudeDelta: data.latitudeDelta, longitudeDelta: data.longitudeDelta,
            zoom: data.zoom, userGesture: data.userGesture === true,
        });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [channel, onDragEnd, onPress, onRegionChange]);
  useEffect(() => {
    setMapMode(satellite ? 'satellite' : 'map');
  }, [satellite]);
  const syncMap = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({
      channel, type: 'og-map-update', latitude: lat, longitude: lng, zoom: region?.zoom ?? 14,
    }, '*');
  }, [channel, lat, lng, region?.zoom]);
  useEffect(() => {
    syncMap();
  }, [syncMap]);
  const html = useMemo(
    () => buildLeafletHtml(lat, lng, 14, true, channel, satellite, centerPin, zoomControlsBottomRight),
    [channel, satellite, centerPin, zoomControlsBottomRight],
  );
  const blob = useMemo(
    () => typeof Blob !== 'undefined' ? URL.createObjectURL(new Blob([html], { type: 'text/html' })) : null,
    [html],
  );
  useEffect(() => () => { if (blob) URL.revokeObjectURL(blob); }, [blob]);
  return (
    <View style={s.container}>
      {/* @ts-ignore */}
      <iframe
        ref={iframeRef}
        src={blob ?? `about:blank`}
        srcDoc={!blob ? html : undefined}
        onLoad={() => {
          syncMap();
          sendMapMode(mapMode);
        }}
        style={{ width: '100%', height: '100%', border: 'none' } as any}
        title="Map"
      />
      <MapViewModeControl
        mode={mapMode}
        top={78}
        onChange={(mode) => {
          setMapMode(mode);
          sendMapMode(mode);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' } as any,
  placeholder: { flex: 1, backgroundColor: '#e8f0f7' },
});
