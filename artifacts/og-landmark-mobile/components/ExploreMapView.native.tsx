/**
 * ExploreMapView — Native: react-native-maps with zoom-aware OG markers
 *
 * Features:
 *  • OG gold price-pill markers per property
 *  • Numbered clusters at overview zoom, price pills when zoomed in
 *  • Area circle follows the current map center while the user pans
 *  • User location dot
 *  • Google Maps provider on both iOS and Android
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { LocalizedText as Text } from '@/components/LocalizedText';
import MapView, {
  Circle,
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import Supercluster from 'supercluster';
import { Feather } from '@expo/vector-icons';
import { MapAreaRange, MAP_AREA_BLUE, MAP_AREA_BLUE_FILL } from '@/components/MapAreaRange';
import { countPointsWithinRadius } from '@/components/mapRadius';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface MapBounds {
  north: number; south: number; east: number; west: number;
  centerLat: number; centerLng: number;
}

interface MapProperty {
  id: string | number;
  latitude?: number; longitude?: number;
  lat?: number; lng?: number;
  price?: string | number;
  title?: string;
  type?: string;
  address?: string;
  city?: string;
  image?: string;
}

interface Props {
  properties?: MapProperty[];
  onSelect: (id: string | number) => void;
  onSearchArea?: (bounds: MapBounds) => void;
  selectedId?: string | number;
  userLat?: number;
  userLng?: number;
  centerLat?: number;
  centerLng?: number;
  count?: number;
  colors?: any;
}

const OKARA_DISTRICT_CENTER = { latitude: 30.8105, longitude: 73.4597 };

// ─── OG Landmark dark-gold Google Maps style ──────────────────────────────────
const OG_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0e1e33' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0e1e33' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#c8a45a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a3358' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d4a75e' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d4a75e' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0a2010' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#18304f' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0b1a2d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a94a3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#c8a45a' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f0d090' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e2e44' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#061422' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d4a5c' }] },
];

const PROVIDER = PROVIDER_GOOGLE;
// Do not mount the native Google provider in a build made without its SDK key.
// It can crash during MapView initialization instead of showing an error.
const GOOGLE_MAPS_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey?.trim() ||
  Constants.expoConfig?.ios?.config?.googleMapsApiKey?.trim() ||
  '';
const HAS_GOOGLE_MAPS_KEY = Boolean(GOOGLE_MAPS_KEY);

function GoogleMapsUnavailable() {
  return (
    <View style={styles.mapsUnavailable}>
      <Feather name="map" size={28} color="#c8a45a" />
      <Text style={styles.mapsUnavailableTitle}>Google Maps unavailable</Text>
      <Text style={styles.mapsUnavailableText}>
        This build needs its Google Maps API key.
      </Text>
    </View>
  );
}

// ─── Price formatter ───────────────────────────────────────────────────────────
function fmt(price?: string | number): string {
  const n = typeof price === 'string'
    ? parseFloat(price.replace(/[^0-9.]/g, ''))
    : Number(price ?? 0);
  if (!n || !isFinite(n)) return '';
  if (n >= 10_000_000) return (n / 10_000_000).toFixed(n % 10_000_000 === 0 ? 0 : 1) + ' Cr';
  if (n >= 100_000)    return (n / 100_000).toFixed(n % 100_000 === 0 ? 0 : 1) + ' L';
  return n.toLocaleString();
}

// ─── Price pill marker ─────────────────────────────────────────────────────────
function PricePill({ price, selected }: { price?: string | number; selected: boolean }) {
  const label = fmt(price);
  return (
    <View style={[pill.wrap, selected && pill.wrapSel]}>
      <Text style={[pill.text, selected && pill.textSel]} numberOfLines={1}>
        {label || '—'}
      </Text>
    </View>
  );
}
const pill = StyleSheet.create({
  wrap: {
    backgroundColor: '#ffffff', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#c8a45a',
    paddingHorizontal: 8, paddingVertical: 4,
    shadowColor: '#000', shadowOpacity: 0.4,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  wrapSel: { backgroundColor: '#c8a45a', borderColor: '#e8c870' },
  text: { fontSize: 11, fontWeight: '700', color: '#102a43' },
  textSel: { color: '#102a43' },
});

// ─── Cluster bubble ────────────────────────────────────────────────────────────
function ClusterBubble({ count }: { count: number }) {
  const size = count < 5 ? 38 : count < 15 ? 48 : 58;
  return (
    <View style={[clust.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={clust.text}>{count}</Text>
    </View>
  );
}
const clust = StyleSheet.create({
  wrap: {
    backgroundColor: '#c8a45a', borderWidth: 3, borderColor: '#e8c870',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4,
    shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  text: { color: '#102a43', fontWeight: '800', fontSize: 13 },
});

// ─── User location dot ─────────────────────────────────────────────────────────
function UserDot() {
  return (
    <View style={udot.outer}><View style={udot.inner} /></View>
  );
}
const udot = StyleSheet.create({
  outer: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(66,133,244,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  inner: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#4285F4', borderWidth: 2, borderColor: '#fff',
  },
});

// ─── Region → bbox helper ──────────────────────────────────────────────────────
// ─── Main component ────────────────────────────────────────────────────────────
export function ExploreMapView(props: Props) {
  if (!HAS_GOOGLE_MAPS_KEY) return <GoogleMapsUnavailable />;
  return <ExploreMapViewWithGoogleMaps {...props} />;
}

function ExploreMapViewWithGoogleMaps({
  properties = [],
  onSelect,
  selectedId,
  userLat,
  userLng,
  centerLat,
  centerLng,
  onSearchArea,
}: Props) {
  const [areaRadiusKm, setAreaRadiusKm] = useState(4);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<MapProperty | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const mapInitialized = useRef(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (mapReady) return;
    const timeout = setTimeout(() => setMapError(true), 15000);
    return () => clearTimeout(timeout);
  }, [mapReady, mapAttempt]);

  // Valid properties only
  const validProps = useMemo(() =>
    properties.filter((p) => {
      const la = p.latitude ?? p.lat;
      const lo = p.longitude ?? p.lng;
      return la && lo && isFinite(Number(la)) && isFinite(Number(lo));
    }),
    [properties],
  );

  // Initial region
  const cLat = centerLat ?? userLat ?? OKARA_DISTRICT_CENTER.latitude;
  const cLng = centerLng ?? userLng ?? OKARA_DISTRICT_CENTER.longitude;
  const [areaCenter, setAreaCenter] = useState({ latitude: cLat, longitude: cLng });
  const areaPropertyCount = useMemo(
    () => countPointsWithinRadius(validProps, areaCenter, areaRadiusKm),
    [validProps, areaCenter, areaRadiusKm],
  );

  const initialRegion: Region = {
    latitude: cLat, longitude: cLng,
    latitudeDelta: userLat != null && userLng != null ? 0.1 : 0.22,
    longitudeDelta: userLat != null && userLng != null ? 0.1 : 0.22,
  };

  // initialRegion is only read on the first native render. Recenter explicitly
  // whenever Near Me obtains a fresh GPS coordinate while the map is already open.
  useEffect(() => {
    const nextLat = centerLat ?? userLat;
    const nextLng = centerLng ?? userLng;
    if (nextLat == null || nextLng == null || !isFinite(nextLat) || !isFinite(nextLng)) return;
    const coordinate = { latitude: nextLat, longitude: nextLng };
    setAreaCenter(coordinate);
    mapRef.current?.animateToRegion(
      { ...coordinate, latitudeDelta: 0.1, longitudeDelta: 0.1 },
      550,
    );
  }, [centerLat, centerLng, userLat, userLng]);

  const handleAreaRadiusChange = useCallback((nextRadiusKm: number) => {
    setAreaRadiusKm(nextRadiusKm);
    const latitudeDelta = Math.max(0.025, (nextRadiusKm * 2.8) / 111);
    const longitudeDelta = Math.max(
      0.025,
      latitudeDelta / Math.max(0.35, Math.cos((cLat * Math.PI) / 180)),
    );
    mapRef.current?.animateToRegion({
      latitude: areaCenter.latitude,
      longitude: areaCenter.longitude,
      latitudeDelta,
      longitudeDelta,
    }, 420);
  }, [areaCenter, cLat]);

  const cluster = useMemo(() => {
    const sc = new Supercluster({ radius: 50, maxZoom: 16 });
    sc.load(validProps.map((p) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(p.longitude ?? p.lng), Number(p.latitude ?? p.lat)],
      },
      properties: { id: p.id, price: p.price },
    })));
    return sc;
  }, [validProps]);

  const markers = useMemo(() => {
    if (!currentRegion) return [];
    const bbox: [number, number, number, number] = [
      currentRegion.longitude - currentRegion.longitudeDelta / 2,
      currentRegion.latitude - currentRegion.latitudeDelta / 2,
      currentRegion.longitude + currentRegion.longitudeDelta / 2,
      currentRegion.latitude + currentRegion.latitudeDelta / 2,
    ];
    const zoom = Math.round(Math.log(360 / currentRegion.longitudeDelta) / Math.LN2);
    return cluster.getClusters(bbox, zoom);
  }, [cluster, currentRegion]);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    setCurrentRegion(region);
    setAreaCenter({ latitude: region.latitude, longitude: region.longitude });
    if (mapInitialized.current) setShowSearchArea(true);
    else mapInitialized.current = true;
  }, []);

  const handleSearchArea = useCallback(() => {
    if (!currentRegion || !onSearchArea) return;
    onSearchArea({
      north: currentRegion.latitude + currentRegion.latitudeDelta / 2,
      south: currentRegion.latitude - currentRegion.latitudeDelta / 2,
      east: currentRegion.longitude + currentRegion.longitudeDelta / 2,
      west: currentRegion.longitude - currentRegion.longitudeDelta / 2,
      centerLat: currentRegion.latitude,
      centerLng: currentRegion.longitude,
    });
    setShowSearchArea(false);
  }, [currentRegion, onSearchArea]);

  // Render individual property price markers.
  const renderedMarkers = useMemo(() =>
    markers.map((feature, i) => {
      const [lng, lat] = feature.geometry.coordinates;
      if (feature.properties.cluster) {
        return (
          <Marker
            key={`cluster-${feature.id ?? i}`}
            coordinate={{ latitude: lat, longitude: lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={() => mapRef.current?.animateCamera(
              { center: { latitude: lat, longitude: lng }, zoom: Math.min(20, (currentRegion ? Math.round(Math.log(360 / currentRegion.longitudeDelta) / Math.LN2) : 8) + 3) },
              { duration: 450 },
            )}
          >
            <ClusterBubble count={feature.properties.point_count} />
          </Marker>
        );
      }

      const id = feature.properties.id;
      const selected = String(id) === String(selectedId)
        || String(id) === String(selectedProperty?.id);
      return (
        <Marker
          key={`prop-${id}`}
          coordinate={{ latitude: lat, longitude: lng }}
          onPress={() => {
            const property = validProps.find((item) => String(item.id) === String(id));
            setSelectedProperty(property ?? null);
          }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          zIndex={selected ? 10 : 1}
        >
          <PricePill price={feature.properties.price} selected={selected} />
        </Marker>
      );
    }),
    [markers, selectedId, selectedProperty?.id, validProps],
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        key={`google-map-${mapAttempt}`}
        style={styles.map}
        provider={PROVIDER}
        initialRegion={initialRegion}
        customMapStyle={OG_MAP_STYLE}
        onRegionChange={(region) => setAreaCenter({
          latitude: region.latitude,
          longitude: region.longitude,
        })}
        onRegionChangeComplete={handleRegionChangeComplete}
        userInterfaceStyle="light"
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        onMapReady={() => {
          setMapReady(true);
          setMapError(false);
        }}
      >
        <Circle
          center={areaCenter}
          radius={areaRadiusKm * 1000}
          strokeColor={MAP_AREA_BLUE}
          strokeWidth={1.5}
          fillColor={MAP_AREA_BLUE_FILL}
        />
        {renderedMarkers}

        {userLat != null && userLng != null && (
          <Marker
            coordinate={{ latitude: userLat, longitude: userLng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={20}
          >
            <UserDot />
          </Marker>
        )}
      </MapView>

      {mapError ? (
        <View style={styles.mapError}>
          <Feather name="wifi-off" size={22} color="#c8a45a" />
          <Text style={styles.mapErrorTitle}>Google Maps could not load</Text>
          <Text style={styles.mapErrorText}>Check your connection and try again.</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setMapError(false);
              setMapReady(false);
              setMapAttempt((attempt) => attempt + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry Google Maps"
          >
            <Text style={styles.retryButtonText}>Retry map</Text>
          </Pressable>
        </View>
      ) : !mapReady && (
        <View style={styles.mapLoading}>
          <Text style={styles.mapLoadingText}>Loading Google Maps…</Text>
        </View>
      )}
      {showSearchArea && onSearchArea && (
        <Pressable
          style={styles.searchAreaButton}
          onPress={handleSearchArea}
          accessibilityRole="button"
          accessibilityLabel="Search properties in this map area"
        >
          <Feather name="search" size={14} color="#102a43" />
          <Text style={styles.searchAreaText}>Search this area</Text>
        </Pressable>
      )}
      <View style={styles.rangeOverlay}>
        <MapAreaRange
          value={areaRadiusKm}
          onChange={handleAreaRadiusChange}
          colors={{
            card: '#ffffff',
            border: '#d6e0e8',
            foreground: '#102a43',
            mutedForeground: '#587089',
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={[styles.countBadge, { backgroundColor: '#ffffff', borderColor: '#d6e0e8' }]}
      >
        <View style={styles.countDot} />
        <Text style={styles.countText}>{areaPropertyCount} on map</Text>
      </View>

      {selectedProperty && (
        <View style={styles.previewCard}>
          {selectedProperty.image ? (
            <Image source={{ uri: selectedProperty.image }} style={styles.previewImage} />
          ) : (
            <View style={styles.previewImagePlaceholder}>
              <Feather name="home" size={22} color="#c8a45a" />
            </View>
          )}
          <View style={styles.previewBody}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {selectedProperty.title || selectedProperty.type || 'Property'}
            </Text>
            <Text style={styles.previewAddress} numberOfLines={1}>
              {selectedProperty.address || selectedProperty.city || 'Exact location available'}
            </Text>
            <Text style={styles.previewPrice} numberOfLines={1}>
              {fmt(selectedProperty.price) || 'Price on request'}
            </Text>
          </View>
          <Pressable
            style={styles.previewButton}
            onPress={() => {
              onSelect(selectedProperty.id);
              setSelectedProperty(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="View selected property"
          >
            <Text style={styles.previewButtonText}>View</Text>
          </Pressable>
          <Pressable
            style={styles.previewClose}
            onPress={() => setSelectedProperty(null)}
            accessibilityRole="button"
            accessibilityLabel="Close property preview"
          >
            <Feather name="x" size={15} color="#587089" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 420,
    overflow: 'hidden',
    borderRadius: 18,
    marginBottom: 20,
  },
  map:       { flex: 1 },
  mapLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,240,247,0.78)',
  },
  mapLoadingText: { color: '#587089', fontSize: 13, fontWeight: '700' },
  mapError: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#e8f0f7',
    gap: 7,
  },
  mapErrorTitle: { color: '#102a43', fontSize: 15, fontWeight: '800' },
  mapErrorText: { color: '#587089', fontSize: 12, textAlign: 'center' },
  retryButton: {
    marginTop: 5,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#c8a45a',
  },
  retryButtonText: { color: '#102a43', fontSize: 11, fontWeight: '800' },
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
  mapsUnavailable: {
    flex: 1, backgroundColor: '#e8f0f7', alignItems: 'center',
    justifyContent: 'center', padding: 24, gap: 7,
  },
  mapsUnavailableTitle: { color: '#102a43', fontSize: 15, fontWeight: '700' },
  mapsUnavailableText: {
    color: '#587089', fontSize: 12, textAlign: 'center', lineHeight: 18,
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
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  countDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: MAP_AREA_BLUE },
  countText: { color: '#102a43', fontWeight: '700', fontSize: 11 },
  rangeOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  previewCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 72,
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    shadowColor: '#102a43',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  previewImage: { width: 58, height: 58, borderRadius: 10, backgroundColor: '#e8f0f7' },
  previewImagePlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#102a43',
  },
  previewBody: { flex: 1, minWidth: 0 },
  previewTitle: { color: '#102a43', fontSize: 13, fontWeight: '800' },
  previewAddress: { color: '#587089', fontSize: 11, marginTop: 3 },
  previewPrice: { color: '#b58c34', fontSize: 12, fontWeight: '800', marginTop: 4 },
  previewButton: {
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#c8a45a',
  },
  previewButtonText: { color: '#102a43', fontSize: 11, fontWeight: '800' },
  previewClose: { position: 'absolute', top: 6, right: 6, padding: 2 },
});
