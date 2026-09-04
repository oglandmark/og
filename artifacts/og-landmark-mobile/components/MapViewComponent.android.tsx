import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  AndroidLeafletMap,
  type AndroidMapBounds,
} from '@/components/AndroidLeafletMap';
import { useColors } from '@/hooks/useColors';

interface StaticMapProps {
  latitude?: number;
  longitude?: number;
  satellite?: boolean;
  interactive?: boolean;
}

interface InteractiveMapProps {
  region?: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  onRegionChange?: (region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => void;
  onPress?: (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => void;
  pinLat?: number;
  pinLng?: number;
  onDragEnd?: (latitude: number, longitude: number) => void;
  showMyLocation?: boolean;
}

function hasValidCoordinates(latitude?: number, longitude?: number) {
  return latitude != null
    && longitude != null
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

export function StaticMap({ latitude, longitude, satellite = false, interactive = true }: StaticMapProps) {
  const colors = useColors();
  if (!hasValidCoordinates(latitude, longitude)) {
    return <View style={[styles.placeholder, { backgroundColor: colors.background }]} />;
  }

  return (
    <AndroidLeafletMap
      markers={[{ latitude: latitude!, longitude: longitude! }]}
      center={{ latitude: latitude!, longitude: longitude! }}
      zoom={15}
      interactive={interactive}
      satellite={satellite}
      colors={colors}
    />
  );
}

export function InteractiveMap({
  region,
  pinLat,
  pinLng,
  onPress,
  onDragEnd,
  onRegionChange,
  showMyLocation = true,
}: InteractiveMapProps) {
  const colors = useColors();
  const initialCoordinate = {
    latitude: pinLat ?? region?.latitude ?? 30.8141,
    longitude: pinLng ?? region?.longitude ?? 73.4502,
  };
  const [pinCoordinate, setPinCoordinate] = useState(initialCoordinate);
  const [userCoordinate, setUserCoordinate] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const ignoreMapPressUntil = useRef(0);

  useEffect(() => {
    if (hasValidCoordinates(pinLat, pinLng)) {
      setPinCoordinate({ latitude: pinLat!, longitude: pinLng! });
    }
  }, [pinLat, pinLng]);

  const handleMapPress = useCallback((latitude: number, longitude: number) => {
    if (Date.now() < ignoreMapPressUntil.current) return;
    const coordinate = { latitude, longitude };
    setPinCoordinate(coordinate);
    onPress?.({ nativeEvent: { coordinate } });
  }, [onPress]);

  const handleMarkerDragEnd = useCallback((
    id: string | number,
    latitude: number,
    longitude: number,
  ) => {
    if (id !== 'pin') return;
    setPinCoordinate({ latitude, longitude });
    onDragEnd?.(latitude, longitude);
  }, [onDragEnd]);

  const handleBoundsChange = useCallback((bounds: AndroidMapBounds) => {
    onRegionChange?.({
      latitude: bounds.centerLat,
      longitude: bounds.centerLng,
      latitudeDelta: Math.abs(bounds.north - bounds.south),
      longitudeDelta: Math.abs(bounds.east - bounds.west),
    });
  }, [onRegionChange]);

  const goToMyLocation = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coordinate = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };
      ignoreMapPressUntil.current = Date.now() + 700;
      setUserCoordinate(coordinate);
      setPinCoordinate(coordinate);
      onPress?.({ nativeEvent: { coordinate } });
    } finally {
      setLocating(false);
    }
  }, [locating, onPress]);

  const markers = useMemo(() => [
    { id: 'pin', ...pinCoordinate, draggable: Boolean(onDragEnd) },
    ...(userCoordinate ? [{ id: '__user__', ...userCoordinate, userLocation: true }] : []),
  ], [onDragEnd, pinCoordinate, userCoordinate]);

  return (
    <View style={styles.container}>
      <AndroidLeafletMap
        markers={markers}
        center={userCoordinate ?? pinCoordinate}
        zoom={14}
        interactive
        colors={colors}
        onMapPress={handleMapPress}
        onMarkerDragEnd={handleMarkerDragEnd}
        onBoundsChange={handleBoundsChange}
      />
      {showMyLocation && (
        <Pressable
          style={[
            styles.locationButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.primary,
              opacity: locating ? 0.62 : 1,
            },
          ]}
          onPress={goToMyLocation}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
        >
          <Feather name="crosshair" size={18} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  placeholder: { flex: 1 },
  locationButton: {
    position: 'absolute',
    right: 12,
    bottom: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});