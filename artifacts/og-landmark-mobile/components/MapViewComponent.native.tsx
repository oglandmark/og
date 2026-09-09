/**
 * MapViewComponent — Native: react-native-maps
 *
 * iOS + Android → PROVIDER_GOOGLE with gold markers
 *
 * Exports:
 *   StaticMap      — non-interactive property pin (detail page)
 *   InteractiveMap — draggable pin + tap-to-set + My Location (LocationPicker)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { LocalizedText as Text } from '@/components/LocalizedText';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
  type Region,
} from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { getCurrentPosition } from '@/lib/locationService';

// ─── OG Landmark dark-gold map style (Google Maps) ────────────────────────────
const OG_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0e1e33' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0e1e33' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#c8a45a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a3358' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#c8a45a' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d4a75e' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d4a75e' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0a2010' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#507460' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#18304f' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0b1a2d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a94a3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#c8a45a' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a2535' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f0d090' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e2e44' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#c8a45a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#061422' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d4a5c' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#0e1a2d' }] },
];

const PROVIDER = PROVIDER_GOOGLE;
// A Google provider without a native SDK key can terminate the app while the
// MapView is being created. Keep the rest of the app usable in unconfigured
// preview builds instead of mounting a provider that cannot initialize.
const GOOGLE_MAPS_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey?.trim() ||
  Constants.expoConfig?.ios?.config?.googleMapsApiKey?.trim() ||
  '';
const HAS_GOOGLE_MAPS_KEY = Boolean(GOOGLE_MAPS_KEY);

function GoogleMapsUnavailable() {
  return (
    <View style={styles.mapsUnavailable}>
      <Feather name="map" size={24} color="#c8a45a" />
      <Text style={styles.mapsUnavailableTitle}>Google Maps unavailable</Text>
      <Text style={styles.mapsUnavailableText}>
        This build needs its Google Maps API key.
      </Text>
    </View>
  );
}

// ─── Gold property pin ─────────────────────────────────────────────────────────
function GoldPin() {
  return (
    <View style={pin.container}>
      <View style={pin.head}>
        <View style={pin.inner} />
      </View>
      <View style={pin.tail} />
    </View>
  );
}
const pin = StyleSheet.create({
  container: { alignItems: 'center' },
  head: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#c8a45a',
    borderWidth: 3, borderColor: '#e8c870',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.45,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  inner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#102a43' },
  tail: {
    width: 3, height: 10, backgroundColor: '#c8a45a',
    marginTop: -1, borderRadius: 2,
  },
});

// ─── Blue user location dot ────────────────────────────────────────────────────
function UserDot() {
  return (
    <View style={dot.outer}>
      <View style={dot.inner} />
    </View>
  );
}
const dot = StyleSheet.create({
  outer: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(66,133,244,0.3)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(66,133,244,0.5)',
  },
  inner: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#4285F4',
    borderWidth: 2, borderColor: '#fff',
  },
});

// ─── Types ─────────────────────────────────────────────────────────────────────
interface StaticMapProps {
  latitude?: number;
  longitude?: number;
  satellite?: boolean;
  interactive?: boolean;
}

interface InteractiveMapProps {
  region?: { latitude: number; longitude: number; latitudeDelta?: number; longitudeDelta?: number };
  onRegionChange?: (r: Region) => void;
  onPress?: (e: any) => void;
  pinLat?: number;
  pinLng?: number;
  onDragEnd?: (lat: number, lng: number) => void;
  showMyLocation?: boolean;
}

// ─── StaticMap ─────────────────────────────────────────────────────────────────
export function StaticMap({ latitude, longitude, satellite = false, interactive = true }: StaticMapProps) {
  const mapRef = useRef<MapView>(null);
  if (!latitude || !longitude || !isFinite(latitude) || !isFinite(longitude)) {
    return <View style={styles.placeholder} />;
  }
  if (!HAS_GOOGLE_MAPS_KEY) return <GoogleMapsUnavailable />;

  const region: Region = {
    latitude, longitude,
    latitudeDelta: 0.01, longitudeDelta: 0.01,
  };

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={PROVIDER}
      initialRegion={region}
       mapType={satellite ? 'satellite' : 'standard'}
       customMapStyle={OG_MAP_STYLE}
      showsPointsOfInterests
      showsBuildings
      showsIndoors
      showsCompass
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={interactive}
      pitchEnabled={interactive}
      toolbarEnabled={false}
         userInterfaceStyle="light"
    >
      <Marker
        coordinate={{ latitude, longitude }}
        tracksViewChanges={false}
        onPress={() => mapRef.current?.animateToRegion(
          { latitude, longitude, latitudeDelta: 0.003, longitudeDelta: 0.003 },
          450,
        )}
      >
        <GoldPin />
      </Marker>
    </MapView>
  );
}

// ─── InteractiveMap ────────────────────────────────────────────────────────────
export function InteractiveMap(props: InteractiveMapProps) {
  if (!HAS_GOOGLE_MAPS_KEY) return <GoogleMapsUnavailable />;
  return <InteractiveMapWithGoogleMaps {...props} />;
}

function InteractiveMapWithGoogleMaps({
  region,
  pinLat,
  pinLng,
  onPress,
  onDragEnd,
  showMyLocation = true,
}: InteractiveMapProps) {
  const lat = pinLat ?? region?.latitude ?? 30.8141;
  const lng = pinLng ?? region?.longitude ?? 73.4502;

  const [pinCoord, setPinCoord] = useState({ latitude: lat, longitude: lng });
  const [userCoord, setUserCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<MapView>(null);
  const ignoreMapPressUntil = useRef(0);

  const initialRegion: Region = {
    latitude: lat, longitude: lng,
    latitudeDelta: 0.02, longitudeDelta: 0.02,
  };

  const handleMapPress = useCallback(
    (e: MapPressEvent) => {
      if (Date.now() < ignoreMapPressUntil.current) return;
      const coord = e.nativeEvent.coordinate;
      setPinCoord(coord);
      if (onPress) onPress({ nativeEvent: { coordinate: { latitude: coord.latitude, longitude: coord.longitude } } });
    },
    [onPress],
  );

  const handleDragEnd = useCallback(
    (e: MarkerDragStartEndEvent) => {
      const coord = e.nativeEvent.coordinate;
      ignoreMapPressUntil.current = Date.now() + 500;
      setPinCoord(coord);
      if (onDragEnd) onDragEnd(coord.latitude, coord.longitude);
    },
    [onDragEnd],
  );

  useEffect(() => {
    if (pinLat == null || pinLng == null || !isFinite(pinLat) || !isFinite(pinLng)) return;
    const coord = { latitude: pinLat, longitude: pinLng };
    setPinCoord(coord);
    mapRef.current?.animateToRegion(
      { ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      450,
    );
  }, [pinLat, pinLng]);

  // Recenter the native map when the form changes city/locality before an
  // exact pin exists. Without this, react-native-maps keeps its initial camera
  // at the old city even though the parent has resolved a new region.
  useEffect(() => {
    if (pinLat != null || pinLng != null || !region) return;
    const nextRegion: Region = {
      latitude: region.latitude,
      longitude: region.longitude,
      latitudeDelta: region.latitudeDelta ?? 0.025,
      longitudeDelta: region.longitudeDelta ?? 0.025,
    };
    setPinCoord({ latitude: nextRegion.latitude, longitude: nextRegion.longitude });
    mapRef.current?.animateToRegion(nextRegion, 450);
  }, [region?.latitude, region?.longitude, region?.latitudeDelta, region?.longitudeDelta, pinLat, pinLng]);

  const goToMyLocation = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      if (!pos) return;
      const coord = { latitude: pos.latitude, longitude: pos.longitude };
      setUserCoord(coord);
      mapRef.current?.animateToRegion(
        { ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500,
      );
    } finally {
      setLocating(false);
    }
  }, [locating]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER}
        initialRegion={initialRegion}
        customMapStyle={OG_MAP_STYLE}
        onPress={handleMapPress}
        userInterfaceStyle="light"
        showsUserLocation={false}
        toolbarEnabled={false}
      >
        <Marker
          coordinate={pinCoord}
          draggable={!!onDragEnd}
          onDragEnd={handleDragEnd}
          tracksViewChanges={false}
        >
          <GoldPin />
        </Marker>

        {userCoord && (
          <Marker coordinate={userCoord} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <UserDot />
          </Marker>
        )}
      </MapView>

      {showMyLocation && (
        <Pressable
          style={[styles.myLocBtn, locating && { opacity: 0.6 }]}
          onPress={goToMyLocation}
          disabled={locating}
        >
          <Feather name="crosshair" size={18} color="#c8a45a" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  map:         { flex: 1 },
  placeholder: { flex: 1, backgroundColor: '#e8f0f7' },
  mapsUnavailable: {
    flex: 1, backgroundColor: '#e8f0f7', alignItems: 'center',
    justifyContent: 'center', padding: 24, gap: 7,
  },
  mapsUnavailableTitle: { color: '#102a43', fontSize: 14, fontWeight: '700' },
  mapsUnavailableText: {
    color: '#587089', fontSize: 12, textAlign: 'center', lineHeight: 18,
  },
  myLocBtn: {
    position: 'absolute', bottom: 16, right: 12,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#ffffff',
    borderWidth: 1.5, borderColor: '#c8a45a',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
});
