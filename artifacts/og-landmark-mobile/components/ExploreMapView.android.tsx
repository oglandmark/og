import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import {
  AndroidLeafletMap,
  type AndroidLeafletMarker,
} from '@/components/AndroidLeafletMap';
import { MapAreaRange, MAP_AREA_BLUE } from '@/components/MapAreaRange';
import { useColors } from '@/hooks/useColors';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  centerLat: number;
  centerLng: number;
}

// OG Landmark's primary service area. Keep the first map view local to
// District Okara instead of opening on a Pakistan-wide viewport.
const OKARA_DISTRICT_CENTER = { latitude: 30.8105, longitude: 73.4597 };

interface MapProperty {
  id: string | number;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  price?: string | number;
  title?: string;
  type?: string;
}

interface Props {
  properties?: MapProperty[];
  onSelect: (id: string | number) => void;
  onSearchArea?: (bounds: MapBounds) => void;
  selectedId?: string | number;
  userLat?: number;
  userLng?: number;
  count?: number;
  colors?: ReturnType<typeof useColors>;
}

function formatPrice(price?: string | number) {
  const amount = typeof price === 'string'
    ? Number(price.replace(/[^0-9.]/g, ''))
    : Number(price ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'View';
  if (amount >= 10_000_000) return `PKR ${(amount / 10_000_000).toFixed(amount % 10_000_000 === 0 ? 0 : 1)} Cr`;
  if (amount >= 100_000) return `PKR ${(amount / 100_000).toFixed(amount % 100_000 === 0 ? 0 : 1)} L`;
  return `PKR ${amount.toLocaleString()}`;
}

export function ExploreMapView({
  properties = [],
  onSelect,
  selectedId,
  userLat,
  userLng,
  colors: suppliedColors,
}: Props) {
  const themeColors = useColors();
  const colors = suppliedColors ?? themeColors;
  const [areaRadiusKm, setAreaRadiusKm] = useState(4);
  const [areaPropertyCount, setAreaPropertyCount] = useState(0);

  const validProperties = useMemo(() => properties.flatMap((property) => {
    const latitude = Number(property.latitude ?? property.lat);
    const longitude = Number(property.longitude ?? property.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
    return [{ property, latitude, longitude }];
  }), [properties]);

  const center = {
    latitude: userLat ?? OKARA_DISTRICT_CENTER.latitude,
    longitude: userLng ?? OKARA_DISTRICT_CENTER.longitude,
  };

  const markers = useMemo<AndroidLeafletMarker[]>(() => {
    const propertyMarkers: AndroidLeafletMarker[] = validProperties.map(({ property, latitude, longitude }) => ({
      id: property.id,
      latitude,
      longitude,
      label: formatPrice(property.price),
      selected: String(property.id) === String(selectedId),
    }));
    if (userLat != null && userLng != null) {
      propertyMarkers.push({
        id: '__user__',
        latitude: userLat,
        longitude: userLng,
        label: '',
        selected: false,
        userLocation: true,
      });
    }
    return propertyMarkers;
  }, [selectedId, userLat, userLng, validProperties]);

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <AndroidLeafletMap
        markers={markers}
        center={center}
        zoom={userLat != null && userLng != null ? 13 : 10}
        interactive
        areaRadiusKm={areaRadiusKm}
        areaColor={MAP_AREA_BLUE}
        colors={colors}
        onMarkerPress={(id) => {
          if (id !== '__user__') onSelect(id);
        }}
        onAreaCountChange={setAreaPropertyCount}
      />
      <View style={styles.rangeOverlay}>
        <MapAreaRange value={areaRadiusKm} onChange={setAreaRadiusKm} colors={colors} />
      </View>
      <View pointerEvents="none" style={[styles.countBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.countDot} />
        <Text style={[styles.countText, { color: colors.foreground }]}>
          {areaPropertyCount} on map
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 420,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  countBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
    opacity: 0.95,
  },
  countDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: MAP_AREA_BLUE },
  countText: { fontSize: 11, fontWeight: '700' },
  rangeOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
});