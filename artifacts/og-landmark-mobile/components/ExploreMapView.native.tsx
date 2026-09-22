/**
 * ExploreMapView — native Mapbox tile map rendered through the shared WebView.
 *
 * Keeping the native and Expo Go paths on the same Mapbox-backed renderer
 * avoids provider differences between preview and production builds while
 * preserving pan, pinch zoom, property pins, area search, and radius controls.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { MapAreaRange, MAP_AREA_BLUE } from '@/components/MapAreaRange';
import {
  countPointsWithinRadius,
  MAP_AREA_DEFAULT_KM,
  mapAreaZoomForRadius,
} from '@/components/mapRadius';
import { ExpoGoMapFallback, type ExpoGoMapPoint } from '@/components/ExpoGoMapFallback';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  centerLat: number;
  centerLng: number;
}

interface MapProperty {
  id: string | number;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  price?: string | number;
  title?: string;
  type?: string;
  address?: string;
  city?: string;
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
  fullScreen?: boolean;
}

const OKARA_DISTRICT_CENTER = { latitude: 30.8105, longitude: 73.4597 };

function formatPrice(price?: string | number): string {
  const n = typeof price === 'string'
    ? Number(price.replace(/[^0-9.]/g, ''))
    : Number(price ?? 0);
  if (!n || !Number.isFinite(n)) return '';
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(n % 10_000_000 === 0 ? 0 : 1)} Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(n % 100_000 === 0 ? 0 : 1)} L`;
  return n.toLocaleString();
}

export function ExploreMapView({
  properties = [],
  onSelect,
  onSearchArea,
  userLat,
  userLng,
  centerLat,
  centerLng,
  colors,
  fullScreen,
}: Props) {
  const initialLat = centerLat ?? userLat ?? OKARA_DISTRICT_CENTER.latitude;
  const initialLng = centerLng ?? userLng ?? OKARA_DISTRICT_CENTER.longitude;
  const [areaRadiusKm, setAreaRadiusKm] = useState(MAP_AREA_DEFAULT_KM);
  const [areaCenter, setAreaCenter] = useState({ latitude: initialLat, longitude: initialLng });
  const [currentRegion, setCurrentRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);

  useEffect(() => {
    setAreaCenter({ latitude: initialLat, longitude: initialLng });
  }, [initialLat, initialLng]);

  const validProperties = useMemo(
    () => properties.filter((property) => {
      const latitude = property.latitude ?? property.lat;
      const longitude = property.longitude ?? property.lng;
      return latitude != null && longitude != null
        && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
    }),
    [properties],
  );

  const points = useMemo<ExpoGoMapPoint[]>(() => {
    const listingPoints = validProperties.map((property) => ({
      id: property.id,
      latitude: Number(property.latitude ?? property.lat),
      longitude: Number(property.longitude ?? property.lng),
      label: formatPrice(property.price),
    }));
    if (userLat != null && userLng != null) {
      listingPoints.push({ id: '__user__', latitude: userLat, longitude: userLng, label: '' });
    }
    return listingPoints;
  }, [validProperties, userLat, userLng]);

  const areaPropertyCount = useMemo(
    () => countPointsWithinRadius(validProperties, areaCenter, areaRadiusKm),
    [validProperties, areaCenter, areaRadiusKm],
  );

  const handleRegionChange = (region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => {
    setAreaCenter({ latitude: region.latitude, longitude: region.longitude });
    setCurrentRegion(region);
    setShowSearchArea(true);
  };

  const searchCurrentArea = () => {
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
  };

  return (
    <View style={[styles.container, fullScreen && styles.fullScreenContainer]}>
      <ExpoGoMapFallback
        latitude={areaCenter.latitude}
        longitude={areaCenter.longitude}
        zoom={mapAreaZoomForRadius(areaRadiusKm)}
        points={points}
        radiusKm={areaRadiusKm}
        interactive
        onRegionChange={handleRegionChange}
        onSelect={(id) => {
          if (id !== '__user__') onSelect(id);
        }}
      />

      {showSearchArea && onSearchArea && (
        <Pressable
          style={[styles.searchAreaButton, {
            backgroundColor: colors?.card ?? '#ffffff',
            borderColor: colors?.border ?? '#d6e0e8',
          }]}
          onPress={searchCurrentArea}
          accessibilityRole="button"
          accessibilityLabel="Search properties in this map area"
        >
          <Feather name="search" size={14} color={colors?.action ?? '#102a43'} />
          <Text style={[styles.searchAreaText, { color: colors?.action ?? '#102a43' }]}>
            Search this area
          </Text>
        </Pressable>
      )}

      {!showSearchArea && (
        <View
          pointerEvents="none"
          style={[styles.mapContextBadge, {
            backgroundColor: colors?.actionGlass ?? '#173d5ed9',
            borderColor: colors?.actionGlassBorder ?? '#ffffff55',
          }]}
        >
          <Feather name="map" size={14} color={colors?.actionForeground ?? '#ffffff'} />
          <View>
            <Text style={[styles.mapContextKicker, { color: colors?.gold ?? '#d9b96d' }]}>LIVE LISTINGS</Text>
            <Text style={[styles.mapContextTitle, { color: colors?.actionForeground ?? '#ffffff' }]}>Explore the area</Text>
          </View>
        </View>
      )}

      <View
        pointerEvents="none"
        style={[styles.countBadge, {
          backgroundColor: colors?.card ?? '#ffffff',
          borderColor: colors?.border ?? '#d6e0e8',
        }]}
      >
        <View style={[styles.countDot, { backgroundColor: MAP_AREA_BLUE }]} />
        <Text style={[styles.countText, { color: colors?.foreground ?? '#102a43' }]}>
          {areaPropertyCount} on map
        </Text>
      </View>

      {validProperties.length === 0 && (
        <View pointerEvents="none" style={styles.mapEmpty}>
          <View style={[styles.mapEmptyCard, {
            backgroundColor: colors?.card ?? '#ffffff',
            borderColor: colors?.border ?? '#d6e0e8',
          }]}>
            <Feather name="map-pin" size={18} color={colors?.primary ?? '#c8a45a'} />
            <Text style={[styles.mapEmptyTitle, { color: colors?.foreground ?? '#102a43' }]}>
              No listings in this area
            </Text>
            <Text style={[styles.mapEmptyText, { color: colors?.mutedForeground ?? '#587089' }]}>
              Move the map or expand the range to explore more.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.rangeOverlay}>
        <MapAreaRange
          value={areaRadiusKm}
          onChange={setAreaRadiusKm}
          colors={{
            card: colors?.card ?? '#ffffff',
            border: colors?.border ?? '#d6e0e8',
            foreground: colors?.foreground ?? '#102a43',
            mutedForeground: colors?.mutedForeground ?? '#587089',
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 420, overflow: 'hidden', borderRadius: 18, marginBottom: 20 },
  fullScreenContainer: { flex: 1, height: undefined, marginBottom: 0, borderRadius: 0 },
  searchAreaButton: {
    position: 'absolute', top: 12, left: 12, flexDirection: 'row',
    alignItems: 'center', gap: 7, borderRadius: 17, paddingHorizontal: 12,
    paddingVertical: 9, borderWidth: 1, shadowColor: '#102a43',
    shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  searchAreaText: { fontSize: 12, fontWeight: '800' },
  mapContextBadge: {
    position: 'absolute', top: 12, left: 12, flexDirection: 'row',
    alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 15,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  mapContextKicker: { fontSize: 8, fontWeight: '800', letterSpacing: 1.1, marginBottom: 2 },
  mapContextTitle: { fontSize: 11, fontWeight: '700' },
  countBadge: {
    position: 'absolute', top: 12, right: 12, flexDirection: 'row',
    alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 11, paddingVertical: 8, shadowColor: '#102a43',
    shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  countDot: { width: 7, height: 7, borderRadius: 4 },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  rangeOverlay: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  mapEmpty: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  mapEmptyCard: {
    alignItems: 'center', borderWidth: 1, borderRadius: 15, paddingHorizontal: 18,
    paddingVertical: 14, shadowColor: '#102a43', shadowOpacity: 0.14,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  mapEmptyTitle: { fontSize: 13, fontWeight: '800', marginTop: 7 },
  mapEmptyText: { fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 4 },
});