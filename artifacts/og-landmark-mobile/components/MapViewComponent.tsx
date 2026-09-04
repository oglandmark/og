/**
 * MapViewComponent — Web implementation using iframe + label-rich street tiles.
 */
import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

interface InteractiveMapProps {
  region?: { latitude: number; longitude: number; latitudeDelta?: number; longitudeDelta?: number };
  onRegionChange?: (r: any) => void;
  onPress?: (e: any) => void;
  pinLat?: number;
  pinLng?: number;
  onDragEnd?: (lat: number, lng: number) => void;
  showMyLocation?: boolean;
}

interface StaticMapProps {
  latitude?: number;
  longitude?: number;
  satellite?: boolean;
  interactive?: boolean;
}

function buildLeafletHtml(lat: number, lng: number, zoom: number, interactive = false, channel = 'og-map') {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    * { margin:0; padding:0; }
    body { background:#e8f0f7; }
    #map { width:100%; height:100%; position:absolute;top:0;left:0;right:0;bottom:0; }
    .custom-pin { width:20px;height:20px;background:#C8A45A;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4); }
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
   // OSM includes street names, neighbourhoods, landmarks and POI labels.
   // Esri World Street remains a readable fallback if OSM is unavailable.
   var primaryTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
     maxZoom:19, maxNativeZoom:19, keepBuffer:3,
     updateWhenIdle:false, updateWhenZooming:true,
     attribution:'© OpenStreetMap contributors'
   });
   var detailTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
     maxZoom:19, maxNativeZoom:19, keepBuffer:3,
     attribution:'Tiles © Esri'
   });
   var fallbackEnabled = false;
   primaryTiles.on('tileerror', function() {
     if (!fallbackEnabled) { fallbackEnabled = true; detailTiles.addTo(map); }
   });
   primaryTiles.addTo(map);
   var icon = L.divIcon({html:'<div class="custom-pin"></div>',iconSize:[20,20],iconAnchor:[10,10],className:''});
    var marker = L.marker([${lat},${lng}],{icon:icon, draggable:${interactive}}).addTo(map);
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
      map.on('moveend', function() {
        var c = map.getCenter(), b = map.getBounds();
        send('og-map-region', {
          latitude:c.lat, longitude:c.lng,
          latitudeDelta:Math.abs(b.getNorth() - b.getSouth()),
          longitudeDelta:Math.abs(b.getEast() - b.getWest())
        });
      });
    }
   marker.on('click', function () {
     map.setView([${lat},${lng}], Math.max(map.getZoom(), 17), { animate: true });
   });
</script>
</body></html>`;
}

export function StaticMap({ latitude, longitude, interactive = true }: StaticMapProps) {
  if (!latitude || !longitude || !isFinite(latitude) || !isFinite(longitude)) {
    return <View style={s.placeholder} />;
  }
  const html = buildLeafletHtml(latitude, longitude, 15, interactive);
  const blob = typeof Blob !== 'undefined' ? URL.createObjectURL(new Blob([html], { type: 'text/html' })) : null;
  return (
    <View style={s.container}>
      {/* @ts-ignore — iframe is valid on web */}
      <iframe
         src={blob ?? 'about:blank'}
         srcDoc={!blob ? html : undefined}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 } as any}
        title="Property Location"
      />
    </View>
  );
}

export function InteractiveMap({ region, pinLat, pinLng, onPress, onDragEnd, onRegionChange }: InteractiveMapProps) {
  const lat = pinLat ?? region?.latitude ?? 30.3753;
  const lng = pinLng ?? region?.longitude ?? 69.3451;
  const channel = useMemo(() => `og-map-${Math.random().toString(36).slice(2)}`, []);
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
        });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [channel, onDragEnd, onPress, onRegionChange]);
  const html = buildLeafletHtml(lat, lng, 14, true, channel);
  const blob = typeof Blob !== 'undefined' ? URL.createObjectURL(new Blob([html], { type: 'text/html' })) : null;
  return (
    <View style={s.container}>
      {/* @ts-ignore */}
      <iframe
        src={blob ?? `about:blank`}
        srcDoc={!blob ? html : undefined}
        style={{ width: '100%', height: '100%', border: 'none' } as any}
        title="Map"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' } as any,
  placeholder: { flex: 1, backgroundColor: '#e8f0f7' },
});
