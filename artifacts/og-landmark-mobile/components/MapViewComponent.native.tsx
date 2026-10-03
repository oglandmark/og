/**
 * MapViewComponent — Android uses Google Maps; iOS uses the shared Mapbox WebView.
 *
 * Android's EAS preview builds receive the restricted Maps SDK key at build
 * time, while the iOS and Expo Go paths keep the shared WebView renderer.
 */
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ExpoGoMapFallback } from '@/components/ExpoGoMapFallback';
import { GoogleMapCanvas } from '@/components/GoogleMapCanvas';
import { getCurrentPosition } from '@/lib/locationService';

interface StaticMapProps {
  latitude?: number;
  longitude?: number;
  satellite?: boolean;
  interactive?: boolean;
}

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

export function StaticMap({
  latitude,
  longitude,
  satellite = true,
  interactive = true,
}: StaticMapProps) {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return <View style={styles.placeholder} />;
  }

  if (Platform.OS === 'android') {
    return (
      <GoogleMapCanvas
        center={{ latitude, longitude }}
        zoom={15}
        interactive={interactive}
        satellite={satellite}
        points={[{ id: 'property', latitude, longitude }]}
      />
    );
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
  centerPin = false,
  zoomControlsBottomRight = false,
  satellite = false,
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
    const next = {
      latitude: pinLat ?? region?.latitude ?? 30.8141,
      longitude: pinLng ?? region?.longitude ?? 73.4502,
    };
    setCenter(next);
    setPin(next);
  }, [pinLat, pinLng, region?.latitude, region?.longitude]);

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
      {Platform.OS === 'android' ? (
        <GoogleMapCanvas
          center={center}
          zoom={region?.zoom ?? 14}
          interactive
          satellite={satellite}
          zoomControlsBottomRight={zoomControlsBottomRight}
          pin={centerPin ? null : pin}
          pinDraggable={!centerPin}
          centerPin={centerPin}
          showMyLocation={showMyLocation}
          onPinChange={(latitude, longitude) => {
            setPin({ latitude, longitude });
          }}
          onPress={handlePress}
          onDragEnd={handleDragEnd}
          onRegionChange={(nextRegion) => {
            setCenter({ latitude: nextRegion.latitude, longitude: nextRegion.longitude });
            onRegionChange?.(nextRegion);
          }}
        />
      ) : (
        <ExpoGoMapFallback
          latitude={center.latitude}
          longitude={center.longitude}
          zoom={region?.zoom ?? 14}
          interactive
          satellite={satellite}
          zoomControlsBottomRight={zoomControlsBottomRight}
          points={centerPin ? [] : [{ latitude: pin.latitude, longitude: pin.longitude }]}
          onPress={handlePress}
          onDragEnd={handleDragEnd}
          onRegionChange={(nextRegion) => {
            setCenter({ latitude: nextRegion.latitude, longitude: nextRegion.longitude });
            onRegionChange?.(nextRegion);
          }}
        />
      )}
      {showMyLocation && Platform.OS !== 'android' && (
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