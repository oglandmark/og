/**
 * ExploreMapView — Web: iframe with Leaflet showing all property pins.
 *
 * Web parity with native:
 *  • OG gold price-pill markers per property (with selected styling)
 *  • Light English-label street tiles with OG gold price markers
 *  • User location dot (userLat / userLng)
 *  • Area circle follows the current map center while the user pans
 *  • Compact popup preview: title / type / area / location + select action
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import type { ImageSourcePropType } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MapAreaRange } from '@/components/MapAreaRange';
import {
  createMapAreaRadiusMessage,
  MAP_AREA_BLUE,
} from '@/components/mapRadius';

export interface PropertyLike {
  id: number;
  city: string;
  price: number;
  type: string;
  status?: string;
  title?: string;
  area: number;
  areaUnit?: string;
  lat?: number;
  lng?: number;
  address?: string;
  bedrooms?: number;
  bathrooms?: number;
  image?: ImageSourcePropType;
}

export interface MapBounds {
  north: number; south: number; east: number; west: number;
  centerLat: number; centerLng: number;
}

interface Props {
  properties?: PropertyLike[];
  count?: number;
  colors: any;
  onSelect: (id: number) => void;
  onSearchArea?: (bounds: MapBounds) => void;
  selectedId?: string | number;
  userLat?: number;
  userLng?: number;
  centerLat?: number;
  centerLng?: number;
}

const OKARA_DISTRICT_CENTER = { latitude: 30.8105, longitude: 73.4597 };

// ─── Price formatter (mirrors native) ────────────────────────────────────────
function fmtPrice(price?: number): string {
  const n = Number(price ?? 0);
  if (!n || !isFinite(n)) return '';
  if (n >= 10_000_000) return (n / 10_000_000).toFixed(n % 10_000_000 === 0 ? 0 : 1) + ' Cr';
  if (n >= 100_000) return (n / 100_000).toFixed(n % 100_000 === 0 ? 0 : 1) + ' L';
  return n.toLocaleString();
}

// Escape a value for safe embedding inside single-quoted JS strings / HTML.
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\r?\n/g, ' ');
}

function buildExploreHtml(
  properties: PropertyLike[],
  selectedId?: string | number,
  userLat?: number,
  userLng?: number,
  centerLat?: number,
  centerLng?: number,
) {
  const validProps = properties.filter(
    (p) => p.lat && p.lng && isFinite(p.lat!) && isFinite(p.lng!)
  );

  const hasUser = userLat != null && userLng != null && isFinite(Number(userLat)) && isFinite(Number(userLng));

  const mapCenterLat = centerLat != null
    ? Number(centerLat)
    : hasUser ? Number(userLat) : OKARA_DISTRICT_CENTER.latitude;
  const mapCenterLng = centerLng != null
    ? Number(centerLng)
    : hasUser ? Number(userLng) : OKARA_DISTRICT_CENTER.longitude;
  const zoom = hasUser ? 13 : 10;
  const areaPoints = JSON.stringify(validProps.map((property) => ({
    latitude: property.lat,
    longitude: property.lng,
  })));

  const selectedKey = selectedId != null ? String(selectedId) : '';

  const markersJs = validProps
    .map((p) => {
      const label = fmtPrice(p.price);
      const selected = String(p.id) === selectedKey;
      const areaText = `${p.area ?? ''}${p.areaUnit ? ' ' + p.areaUnit : ''}`.trim();
      const location = p.address || p.city || '';
      const title = p.title || p.type || 'Property';

      const popupHtml =
        `<div class="og-pop">` +
          `<div class="og-pop-title">${esc(title)}</div>` +
          `<div class="og-pop-meta">` +
            (p.type ? `<span class="og-pop-tag">${esc(p.type)}</span>` : '') +
            (areaText ? `<span class="og-pop-tag">${esc(areaText)}</span>` : '') +
          `</div>` +
          (location ? `<div class="og-pop-loc">${esc(location)}</div>` : '') +
          `<div class="og-pop-price">PKR ${esc(label || '—')}</div>` +
          `<button class="og-pop-btn" onclick="window.parent.postMessage({type:'mapSelect',id:${JSON.stringify(p.id)}},'*')">View property</button>` +
        `</div>`;

      return `
  (function() {
    var icon = L.divIcon({
      html: '<div class="og-pin${selected ? ' og-pin-sel' : ''}">PKR ${esc(label)}</div>',
      iconSize: [null, null], iconAnchor: [0,0], className: ''
    });
    var m = L.marker([${p.lat}, ${p.lng}], {icon: icon, zIndexOffset: ${selected ? 1000 : 0}});
     if (clusterGroup && !${selected}) clusterGroup.addLayer(m); else m.addTo(map);
    m.bindPopup('${esc(popupHtml)}', {closeButton:true, className:'og-popup', maxWidth:240});
     m.on('click', function() {
       map.setView([${p.lat}, ${p.lng}], Math.max(map.getZoom(), 17), { animate: true });
       window.parent.postMessage({type:'mapSelect',id:${JSON.stringify(p.id)}},'*');
     });
    ${selected ? 'm.openPopup();' : ''}
  })();`;
    })
    .join('\n');

  const userJs = hasUser
    ? `
  (function() {
    var uicon = L.divIcon({
      html: '<div class="og-user"><div class="og-user-dot"></div></div>',
      iconSize: [18,18], iconAnchor: [9,9], className: ''
    });
    L.marker([${Number(userLat)}, ${Number(userLng)}], {icon: uicon, zIndexOffset: 2000}).addTo(map);
  })();`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:100%;height:100%;background:#e8f0f7;}
    #map{width:100%;height:100%;position:absolute;top:0;left:0;background:#e8f0f7;}
    .leaflet-container{background:#e8f0f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
    .og-pin{
      background:#ffffff;color:#102a43;font-size:11px;font-weight:700;
      padding:4px 8px;border-radius:10px;white-space:nowrap;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);border:1.5px solid #c8a45a;cursor:pointer;
    }
    .og-pin-sel{
      background:#c8a45a;color:#102a43;border-color:#e8c870;
      box-shadow:0 3px 10px rgba(200,164,90,0.5);
    }
    .og-user{
      width:18px;height:18px;border-radius:9px;background:rgba(66,133,244,0.3);
      display:flex;align-items:center;justify-content:center;
    }
    .og-user-dot{
      width:10px;height:10px;border-radius:5px;background:#4285F4;border:2px solid #fff;
    }
    .og-cluster{
      width:42px;height:42px;border-radius:21px;display:flex;align-items:center;justify-content:center;
      background:#c8a45a;color:#102a43;border:3px solid #f2d996;
      font-size:12px;font-weight:900;box-shadow:0 7px 18px rgba(0,0,0,.45);
    }
    .og-popup .leaflet-popup-content-wrapper{
       background:#ffffff;color:#102a43;border-radius:14px;border:1px solid #d6e0e8;
      box-shadow:0 8px 24px rgba(0,0,0,0.5);
    }
     .og-popup .leaflet-popup-tip{background:#ffffff;}
    .og-popup .leaflet-popup-content{margin:12px 14px;line-height:1.35;}
    .og-popup a.leaflet-popup-close-button{color:#8a94a3;}
     .og-pop-title{font-size:14px;font-weight:800;color:#102a43;margin-bottom:6px;}
    .og-pop-meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;}
    .og-pop-tag{
      font-size:10px;font-weight:700;color:#c8a45a;background:rgba(200,164,90,0.12);
      border:1px solid rgba(200,164,90,0.4);border-radius:8px;padding:2px 7px;
    }
     .og-pop-loc{font-size:11px;color:#587089;margin-bottom:8px;}
    .og-pop-price{font-size:13px;font-weight:800;color:#c8a45a;margin-bottom:10px;}
    .og-pop-btn{
      width:100%;background:#c8a45a;color:#102a43;border:none;border-radius:10px;
      padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer;
    }
    .og-pop-btn:hover{background:#e8c870;}
     .leaflet-control-attribution{display:none;}
      .leaflet-bar{border:1px solid rgba(214,224,232,.95)!important;border-radius:12px!important;overflow:hidden;box-shadow:0 6px 18px rgba(16,42,67,.18)!important;}
      .leaflet-bar a{width:30px;height:30px;line-height:30px;background:#ffffff;color:#102a43;border-bottom-color:#d6e0e8;}
      .leaflet-bar a:hover{background:#edf3f7;}
  </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>if (!window.L) document.write('<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"><\/script>');</script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<script>if (!L.MarkerClusterGroup) document.write('<script src="https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"><\/script>');</script>
<script>
  var map = L.map('map',{zoomControl:true,attributionControl:false}).setView([${mapCenterLat},${mapCenterLng}],${zoom});
    var primaryTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
     maxZoom: 19, maxNativeZoom: 19, keepBuffer: 3,
     updateWhenIdle: false, updateWhenZooming: true
  });
   var detailTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, maxNativeZoom: 19, keepBuffer: 3, opacity: 0.98
  });
  var fallbackEnabled = false;
  primaryTiles.on('tileerror', function() {
    if (!fallbackEnabled) {
       fallbackEnabled = true;
       map.removeLayer(primaryTiles);
      detailTiles.addTo(map);
    }
  });
  primaryTiles.addTo(map);

  var clusterGroup = L.markerClusterGroup && ${validProps.length} > 1
    ? L.markerClusterGroup({
        showCoverageOnHover:false,
        spiderfyOnMaxZoom:true,
        maxClusterRadius:54,
        disableClusteringAtZoom:12,
        iconCreateFunction:function(cluster){
          return L.divIcon({
            html:'<div class="og-cluster">'+cluster.getChildCount()+'</div>',
            className:'',iconSize:[42,42],iconAnchor:[21,21]
          });
        }
      })
    : null;

  ${markersJs}
  if (clusterGroup && clusterGroup.getLayers().length) clusterGroup.addTo(map);
  ${userJs}
  var areaCircle = L.circle([${centerLat},${centerLng}], {
    radius: 4000,
    color: '${MAP_AREA_BLUE}',
    weight: 1.5,
    fillColor: '${MAP_AREA_BLUE}',
    fillOpacity: 0.18
  }).addTo(map);

  map.on('move', function() {
    areaCircle.setLatLng(map.getCenter());
  });

  var areaPoints = ${areaPoints};
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
  function postAreaCount() {
    var center = map.getCenter();
    var radiusKm = areaCircle.getRadius() / 1000;
    var count = areaPoints.filter(function(point) {
      return distanceKm(
        { latitude: center.lat, longitude: center.lng },
        point
      ) <= radiusKm;
    }).length;
    window.parent.postMessage({ type: 'mapAreaCount', count: count }, '*');
  }

  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || data.type !== 'mapAreaRadius') return;
    var radiusKm = Number(data.radiusKm);
    if (!isFinite(radiusKm) || radiusKm <= 0) return;
    areaCircle.setRadius(radiusKm * 1000);
    postAreaCount();
    if (data.fit) {
      map.fitBounds(areaCircle.getBounds(), { padding: [34, 34], maxZoom: 15, animate: true });
    }
  });

  function currentBounds() {
    var b = map.getBounds();
    var c = map.getCenter();
    return {
      north: b.getNorth(), south: b.getSouth(),
      east: b.getEast(), west: b.getWest(),
      centerLat: c.lat, centerLng: c.lng
    };
  }

  function postBounds() {
    window.parent.postMessage({ type: 'mapBounds', bounds: currentBounds() }, '*');
  }

  map.on('moveend zoomend', function() {
    postBounds();
    postAreaCount();
  });

  // Emit the initial bounds once the map has settled.
  map.whenReady(function() {
    setTimeout(function() {
      postBounds();
      postAreaCount();
    }, 0);
  });
</script>
</body></html>`;
}

export function ExploreMapView({
  properties = [],
  colors,
  onSelect,
  selectedId,
  userLat,
  userLng,
  centerLat,
  centerLng,
  onSearchArea,
}: Props) {
  const [areaRadiusKm, setAreaRadiusKm] = useState(4);
  const [areaPropertyCount, setAreaPropertyCount] = useState(0);
  const iframeRef = React.useRef<any>(null);
  const boundsInitialized = React.useRef(false);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const html = useMemo(
    () => buildExploreHtml(properties, selectedId, userLat, userLng, centerLat, centerLng),
    [properties, selectedId, userLat, userLng, centerLat, centerLng],
  );

  // Track the latest bounds reported by the iframe so the search control can act on them.
  const lastBounds = React.useRef<MapBounds | null>(null);

  // Listen for postMessage from iframe on web
  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'mapSelect') {
        onSelect(data.id);
      } else if (data.type === 'mapBounds' && data.bounds) {
        lastBounds.current = data.bounds as MapBounds;
        if (boundsInitialized.current) setShowSearchArea(true);
        else boundsInitialized.current = true;
      } else if (data.type === 'mapAreaCount' && Number.isFinite(data.count)) {
        setAreaPropertyCount(Math.max(0, Math.round(data.count)));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSelect]);

  const syncAreaRadius = React.useCallback((radiusKm: number, fit = false) => {
    const message = createMapAreaRadiusMessage(radiusKm, fit);
    if (message) iframeRef.current?.contentWindow?.postMessage(message, '*');
  }, []);

  React.useEffect(() => {
    syncAreaRadius(areaRadiusKm, true);
  }, [areaRadiusKm, syncAreaRadius]);

  const blobUrl = useMemo(() => {
    if (typeof Blob === 'undefined') return null;
    return URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  }, [html]);

  // Revoke the previous blob URL when it changes / unmounts to avoid leaks.
  React.useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  return (
    <View style={[s.container, { borderColor: colors?.border ?? '#1a3358' }]}>
      {/* @ts-ignore */}
      <iframe
        ref={iframeRef}
        src={blobUrl ?? undefined}
        srcDoc={!blobUrl ? html : undefined}
        style={{ width: '100%', height: '100%', border: 'none' } as any}
        title="Properties Map"
        sandbox="allow-scripts allow-same-origin"
        onLoad={() => syncAreaRadius(areaRadiusKm)}
      />
      <View style={s.rangeOverlay}>
        <MapAreaRange value={areaRadiusKm} onChange={setAreaRadiusKm} colors={{
          card: colors?.card ?? '#ffffff',
          border: colors?.border ?? '#d6e0e8',
          foreground: colors?.foreground ?? '#102a43',
          mutedForeground: colors?.mutedForeground ?? '#587089',
        }} />
      </View>
      <View style={[s.countBadge, {
        backgroundColor: colors?.card ?? '#ffffff',
        borderColor: colors?.border ?? '#d6e0e8',
      }]} pointerEvents="none">
        <View style={[s.countDot, { backgroundColor: MAP_AREA_BLUE }]} />
        <Text style={[s.countText, { color: colors?.foreground ?? '#102a43' }]}>
          {areaPropertyCount} on map
        </Text>
      </View>
      {showSearchArea && onSearchArea && (
        <Pressable
          style={s.searchAreaButton}
          onPress={() => {
            if (lastBounds.current) onSearchArea(lastBounds.current);
            setShowSearchArea(false);
          }}
          accessibilityRole="button"
          accessibilityLabel="Search properties in this map area"
        >
          <Feather name="search" size={14} color="#102a43" />
          <Text style={s.searchAreaText}>Search this area</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    height: 420,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
  } as any,
  rangeOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  countBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 8,
    shadowColor: '#102a43',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  countDot: { width: 7, height: 7, borderRadius: 4 },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  searchAreaButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#ffffff',
    shadowColor: '#102a43',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  searchAreaText: { color: '#102a43', fontSize: 12, fontWeight: '800' },
});
