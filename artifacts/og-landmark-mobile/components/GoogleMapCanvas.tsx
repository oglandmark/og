import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import MapView, { Circle, Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { MapViewModeControl, type MapViewMode } from '@/components/MapViewModeControl';
import { getCurrentPosition } from '@/lib/locationService';

export interface GoogleMapPoint {
  id?: string | number;
  latitude: number;
  longitude: number;
  label?: string;
}

interface MapRegionChange extends Region {
  zoom?: number;
  userGesture?: boolean;
}

interface Props {
  center: { latitude: number; longitude: number };
  zoom?: number;
  points?: GoogleMapPoint[];
  radiusKm?: number;
  satellite?: boolean;
  interactive?: boolean;
  pin?: { latitude: number; longitude: number } | null;
  pinDraggable?: boolean;
  centerPin?: boolean;
  onPress?: (latitude: number, longitude: number) => void;
  onDragEnd?: (latitude: number, longitude: number) => void;
  onPinChange?: (latitude: number, longitude: number) => void;
  onRegionChange?: (region: MapRegionChange) => void;
  onSelect?: (id: string | number) => void;
  showMyLocation?: boolean;
  zoomControlsBottomRight?: boolean;
  modeControlTop?: number;
  modeControlLeft?: number;
  modeControlRight?: number;
  modeControlHorizontal?: boolean;
  modeControlButtonHeight?: number;
}

const MIN_DELTA = 0.001;
const MAX_DELTA = 100;

function deltaForZoom(zoom: number): number {
  return Math.max(MIN_DELTA, Math.min(MAX_DELTA, 360 / 2 ** zoom));
}

function zoomForDelta(latitudeDelta: number): number {
  return Math.log2(360 / Math.max(MIN_DELTA, latitudeDelta));
}

function clampDelta(delta: number): number {
  return Math.max(MIN_DELTA, Math.min(MAX_DELTA, delta));
}

function isValidPoint(point: GoogleMapPoint): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}

export function GoogleMapCanvas({
  center,
  zoom = 14,
  points = [],
  radiusKm,
  satellite = false,
  interactive = true,
  pin,
  pinDraggable = false,
  centerPin = false,
  onPress,
  onDragEnd,
  onPinChange,
  onRegionChange,
  onSelect,
  showMyLocation = false,
  zoomControlsBottomRight = false,
  modeControlTop = 100,
  modeControlLeft = 12,
  modeControlRight,
  modeControlHorizontal = false,
  modeControlButtonHeight = 38,
}: Props) {
  const initialRegion = useMemo<Region>(() => {
    const delta = deltaForZoom(zoom);
    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }, [center.latitude, center.longitude, zoom]);

  const mapRef = useRef<MapView | null>(null);
  const regionRef = useRef<Region>(initialRegion);
  const [mapMode, setMapMode] = useState<MapViewMode>(satellite ? 'satellite' : 'map');
  const [pinPosition, setPinPosition] = useState(pin ?? center);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setMapMode(satellite ? 'satellite' : 'map');
  }, [satellite]);

  useEffect(() => {
    const target: Region = {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: deltaForZoom(zoom),
      longitudeDelta: deltaForZoom(zoom),
    };
    const current = regionRef.current;
    const changed = Math.abs(target.latitude - current.latitude) > 0.000001
      || Math.abs(target.longitude - current.longitude) > 0.000001
      || Math.abs(target.latitudeDelta - current.latitudeDelta) > 0.000001;
    if (!changed) return;
    regionRef.current = target;
    mapRef.current?.animateToRegion(target, 220);
  }, [center.latitude, center.longitude, zoom]);

  useEffect(() => {
    const nextPin = pin ?? center;
    setPinPosition(nextPin);
  }, [pin?.latitude, pin?.longitude, center.latitude, center.longitude]);

  const reportRegion = (region: Region, userGesture = true) => {
    regionRef.current = region;
    onRegionChange?.({
      ...region,
      zoom: zoomForDelta(region.latitudeDelta),
      userGesture,
    });
  };

  const moveToRegion = (region: Region) => {
    regionRef.current = region;
    mapRef.current?.animateToRegion(region, 220);
  };

  const handleMapPress = (event: any) => {
    const coordinate = event?.nativeEvent?.coordinate;
    if (coordinate && Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude)) {
      setPinPosition({ latitude: coordinate.latitude, longitude: coordinate.longitude });
      onPress?.(coordinate.latitude, coordinate.longitude);
    }
  };

  const handlePinDragEnd = (event: any) => {
    const coordinate = event?.nativeEvent?.coordinate;
    if (!coordinate) return;
    setPinPosition({ latitude: coordinate.latitude, longitude: coordinate.longitude });
    onDragEnd?.(coordinate.latitude, coordinate.longitude);
  };

  const zoomBy = (factor: number) => {
    const current = regionRef.current;
    const region = {
      ...current,
      latitudeDelta: clampDelta(current.latitudeDelta * factor),
      longitudeDelta: clampDelta(current.longitudeDelta * factor),
    };
    moveToRegion(region);
  };

  const goToMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const position = await getCurrentPosition();
      if (!position) return;
      const region: Region = {
        latitude: position.latitude,
        longitude: position.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setPinPosition({ latitude: position.latitude, longitude: position.longitude });
      onPinChange?.(position.latitude, position.longitude);
      moveToRegion(region);
      reportRegion(region, false);
    } finally {
      setLocating(false);
    }
  };

  if (
    !Number.isFinite(center.latitude)
    || !Number.isFinite(center.longitude)
    || center.latitude < -90
    || center.latitude > 90
    || center.longitude < -180
    || center.longitude > 180
  ) {
    return <View style={styles.placeholder} />;
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        mapType={mapMode === 'satellite' ? 'satellite' : 'standard'}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        pitchEnabled={interactive}
        rotateEnabled={interactive}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        loadingEnabled
        onPress={interactive ? handleMapPress : undefined}
        onRegionChangeComplete={(region, details) => {
          reportRegion(region, details?.isGesture ?? true);
        }}
      >
        {radiusKm != null && radiusKm > 0 && (
          <Circle
            center={center}
            radius={radiusKm * 1000}
            strokeColor="#4285F4"
            strokeWidth={2}
            fillColor="rgba(66,133,244,0.14)"
          />
        )}

        {points.filter(isValidPoint).map((point, index) => {
          const isUser = point.id === '__user__';
          return (
            <Marker
              key={`${String(point.id ?? 'point')}-${index}`}
              coordinate={{ latitude: point.latitude, longitude: point.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => {
                if (point.id != null && !isUser) onSelect?.(point.id);
              }}
            >
              {isUser ? (
                <View style={styles.userMarker} />
              ) : point.label ? (
                <View style={styles.priceMarker}>
                  <View style={styles.pricePill}>
                    <Text style={styles.priceText}>{point.label}</Text>
                  </View>
                  <View style={styles.priceTip} />
                </View>
              ) : (
                <View style={styles.listingMarker}>
                  <Feather name="map-pin" size={22} color="#0B1F3A" />
                </View>
              )}
            </Marker>
          );
        })}

        {pin && !centerPin && (
          <Marker
            coordinate={pinPosition}
            draggable={interactive && pinDraggable}
            anchor={{ x: 0.5, y: 1 }}
            onDragEnd={handlePinDragEnd}
          >
            <View style={styles.listingMarker}>
              <Feather name="map-pin" size={25} color="#0B1F3A" />
            </View>
          </Marker>
        )}
      </MapView>

      <MapViewModeControl
        mode={mapMode}
        onChange={setMapMode}
        top={modeControlTop}
        left={modeControlLeft}
        right={modeControlRight}
        horizontal={modeControlHorizontal}
        buttonHeight={modeControlButtonHeight}
      />

      {interactive && (
        <View
          style={[
            styles.zoomControls,
            zoomControlsBottomRight ? styles.zoomControlsBottomRight : styles.zoomControlsTopLeft,
          ]}
        >
          <Pressable
            style={styles.zoomButton}
            onPress={() => zoomBy(0.55)}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
          >
            <Feather name="plus" size={19} color="#0B1F3A" />
          </Pressable>
          <Pressable
            style={[styles.zoomButton, styles.zoomButtonDivider]}
            onPress={() => zoomBy(1.8)}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
          >
            <Feather name="minus" size={19} color="#0B1F3A" />
          </Pressable>
        </View>
      )}

      {centerPin && (
        <View pointerEvents="none" style={styles.centerPin}>
          <Feather name="map-pin" size={31} color="#0B1F3A" />
          <View style={styles.centerPinDot} />
        </View>
      )}

      {showMyLocation && (
        <Pressable
          style={[
            styles.myLocationButton,
            zoomControlsBottomRight && styles.myLocationButtonRaised,
            locating && styles.disabledButton,
          ]}
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
  container: { flex: 1, overflow: 'hidden' },
  placeholder: { flex: 1, backgroundColor: '#e8f0f7' },
  zoomControls: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d6e0e8',
    shadowColor: '#0B1F3A',
    shadowOpacity: 0.2,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  zoomControlsTopLeft: { top: 14, left: 12 },
  zoomControlsBottomRight: { bottom: 14, right: 12 },
  zoomButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  zoomButtonDivider: { borderTopWidth: 1, borderTopColor: '#d6e0e8' },
  myLocationButton: {
    position: 'absolute',
    bottom: 16,
    right: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#c8a45a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  myLocationButtonRaised: { bottom: 106 },
  disabledButton: { opacity: 0.6 },
  centerPin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -16,
    marginTop: -31,
    alignItems: 'center',
  },
  centerPinDot: {
    width: 8,
    height: 8,
    marginTop: -8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  listingMarker: {
    width: 32,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#4285f4',
    shadowColor: '#0B1F3A',
    shadowOpacity: 0.32,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  priceMarker: { alignItems: 'center' },
  pricePill: {
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#c8a45a',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1F3A',
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  priceText: { color: '#0B1F3A', fontSize: 11, fontWeight: '700' },
  priceTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#c8a45a',
    marginTop: -1,
  },
});