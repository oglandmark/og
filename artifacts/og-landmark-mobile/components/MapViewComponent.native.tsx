/**
 * MapViewComponent — native Mapbox tile maps rendered through WebView.
 *
 * This keeps property detail and location-picking maps on the same provider
 * as Explore, including Expo Go preview and EAS native builds.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ExpoGoMapFallback } from '@/components/ExpoGoMapFallback';
import { getCurrentPosition } from '@/lib/locationService';

interface StaticMapProps {
  latitude?: number;
  longitude?: number;
  satellite?: boolean;
  interactive?: boolean;
}

interface InteractiveMapProps {
  region?: { latitude: number; longitude: number; latitudeDelta?: number; longitudeDelta?: number };
  onRegionChange?: (r: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => void;
  onPress?: (e: any) => void;
  pinLat?: number;
  pinLng?: number;
  onDragEnd?: (lat: number, lng: number) => void;
  showMyLocation?: boolean;
}

export function StaticMap({
  latitude,
  longitude,
  satellite = false,
  interactive = true,
}: StaticMapProps) {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return <View style={styles.placeholder} />;
  }

  return (
    <ExpoGoMapFallback
      latitude={latitude}
      longitude={longitude}
      zoom={15}
      interactive={interactive}
      satellite={satellite}
      points={[{ latitude, longitude }]}
    />
  );
}

export function InteractiveMap({
  region,
  pinLat,
  pinLng,
  onRegionChange,
  onPress,
  onDragEnd,
  showMyLocation = true,
}: InteractiveMapProps) {
  const initialLatitude = pinLat ?? region?.latitude ?? 30.8141;
  const initialLongitude = pinLng ?? region?.longitude ?? 73.4502;
  const [center, setCenter] = useState({
    latitude: initialLatitude,
    longitude: initialLongitude,
  });
  const [pin, setPin] = useState({
    latitude: initialLatitude,
    longitude: initialLongitude,
  });
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (pinLat == null || pinLng == null) return;
    const next = { latitude: pinLat, longitude: pinLng };
    setCenter(next);
    setPin(next);
  }, [pinLat, pinLng]);

  const handlePress = (latitude: number, longitude: number) => {
    const next = { latitude, longitude };
    setPin(next);
    onPress?.({ nativeEvent: { coordinate: next } });
  };

  const handleDragEnd = (latitude: number, longitude: number) => {
    const next = { latitude, longitude };
    setPin(next);
    onDragEnd?.(latitude, longitude);
  };

  const goToMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const position = await getCurrentPosition();
      if (!position) return;
      const next = { latitude: position.latitude, longitude: position.longitude };
      setCenter(next);
      setPin(next);
      onRegionChange?.({ ...next, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.container}>
      <ExpoGoMapFallback
        latitude={center.latitude}
        longitude={center.longitude}
        zoom={14}
        interactive
        points={[{ latitude: pin.latitude, longitude: pin.longitude }]}
        onPress={handlePress}
        onDragEnd={handleDragEnd}
        onRegionChange={(nextRegion) => {
          setCenter({ latitude: nextRegion.latitude, longitude: nextRegion.longitude });
          onRegionChange?.(nextRegion);
        }}
      />
      {showMyLocation && (
        <Pressable
          style={[styles.myLocBtn, locating && styles.myLocBtnDisabled]}
          onPress={goToMyLocation}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel="Center map on my location"
        >
          <Feather name="crosshair" size={18} color="#c8a45a" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  placeholder: { flex: 1, backgroundColor: '#e8f0f7' },
  myLocBtn: {
    position: 'absolute', bottom: 16, right: 12, width: 42, height: 42,
    borderRadius: 21, backgroundColor: '#ffffff', borderWidth: 1.5,
    borderColor: '#c8a45a', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  myLocBtnDisabled: { opacity: 0.6 },
});