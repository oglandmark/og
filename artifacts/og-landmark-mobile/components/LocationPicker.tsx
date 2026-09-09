/**
 * LocationPicker  — Professional property location picker
 *   • Google Places Autocomplete (Pakistan-scoped)
 *   • GPS with accuracy display + low-accuracy warning
 *   • Tap / drag on Google Maps to pin
 *   • Manual coordinate entry
 *   • "Confirm Location" step before finalising
 *
 * PinnedMapCard — read-only detail display (property detail page)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import type { useColors } from '@/hooks/useColors';
import { InteractiveMap, StaticMap } from '@/components/MapViewComponent';
import {
  fetchAutocompleteSuggestions,
  fetchPlaceDetails,
  geocodeLocality,
  reverseGeocode,
  type AutocompleteSuggestion,
} from '@/lib/geocodingService';
import {
  getCurrentPosition,
  classifyAccuracy,
  accuracyLabel,
  accuracyColor,
  openGoogleMaps,
  type LocationData,
  type AccuracyLevel,
} from '@/lib/locationService';
import { createGpsLocationData, lowAccuracyMessage } from '@/lib/locationFlow';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useColors>;

const OKARA_REGION = {
  latitude: 30.8077, longitude: 73.4561,
  latitudeDelta: 0.08, longitudeDelta: 0.08,
};

// City centers are used only as a starting viewport. The user can still
// search, use GPS, tap the map, or drag the pin to the exact property.
const CITY_REGIONS: Record<string, typeof OKARA_REGION> = {
  Okara: { latitude: 30.8077, longitude: 73.4561, latitudeDelta: 0.08, longitudeDelta: 0.08 },
  Depalpur: { latitude: 30.6698, longitude: 73.6554, latitudeDelta: 0.08, longitudeDelta: 0.08 },
  'Renala Khurd': { latitude: 30.8895, longitude: 73.5986, latitudeDelta: 0.08, longitudeDelta: 0.08 },
  'Hujra Shah Muqeem': { latitude: 30.7417, longitude: 73.8238, latitudeDelta: 0.08, longitudeDelta: 0.08 },
  Basirpur: { latitude: 30.6688, longitude: 73.8386, latitudeDelta: 0.08, longitudeDelta: 0.08 },
  'Haveli Lakha': { latitude: 30.7208, longitude: 73.7537, latitudeDelta: 0.08, longitudeDelta: 0.08 },
};

function getCityRegion(city?: string) {
  return CITY_REGIONS[city ?? ''] ?? OKARA_REGION;
}

function fmtCoord(n: number, isLat: boolean) {
  const dir = isLat ? (n >= 0 ? 'N' : 'S') : (n >= 0 ? 'E' : 'W');
  return `${Math.abs(n).toFixed(5)}° ${dir}`;
}

// ─── PinnedMapCard (property detail — read only) ───────────────────────────────

export function PinnedMapCard({
  latitude, longitude, address, city, locality, district, colors,
  showDirections = false,
}: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  city?: string;
  locality?: string;
  district?: string;
  colors: Colors;
  showDirections?: boolean;
}) {
  const hasPin       = typeof latitude === 'number' && typeof longitude === 'number'
                    && isFinite(latitude) && isFinite(longitude)
                    && !(latitude === 0 && longitude === 0);
  const [resolvedAddr, setResolvedAddr] = useState(address ?? '');

  useEffect(() => {
    if (hasPin && !address) {
      reverseGeocode(latitude!, longitude!).then((r) => {
        if (r?.fullAddress) setResolvedAddr(r.fullAddress);
      });
    }
  }, [hasPin, latitude, longitude, address]);

  const handleOpen = () => {
    if (hasPin) openGoogleMaps(latitude!, longitude!, address || resolvedAddr || 'Property');
    else if (resolvedAddr)
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedAddr)}`);
  };

  const handleDirections = () => {
    if (!hasPin) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`);
  };

  return (
    <View style={[pmc.card, { backgroundColor: colors.glassCard ?? colors.card, borderColor: colors.glassBorder ?? colors.border }]}>
      <View style={pmc.mapWrap}>
        {hasPin ? (
          <StaticMap latitude={latitude!} longitude={longitude!} />
        ) : (
          <View style={[pmc.noPin, { backgroundColor: colors.secondary }]}>
            <Feather name="map" size={28} color={colors.mutedForeground} />
            <Text style={[pmc.noPinText, { color: colors.mutedForeground }]}>
              {resolvedAddr || 'Location not available'}
            </Text>
          </View>
        )}
      </View>

      {/* Location details below map */}
      {hasPin && (
        <View style={[pmc.infoBody, { borderTopColor: colors.border }]}>
          <Feather name="map-pin" size={13} color={(colors as any).action ?? colors.primary} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            {(locality || city) && (
              <Text style={[pmc.infoArea, { color: colors.foreground }]}>
                {[locality, city, district].filter(Boolean).join(' · ')}
              </Text>
            )}
            {resolvedAddr ? (
              <Text style={[pmc.infoAddr, { color: colors.mutedForeground }]} numberOfLines={2}>
                {resolvedAddr}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Action buttons */}
      {hasPin && (
        <View style={[pmc.actionRow, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={handleOpen}
            style={({ pressed }) => [pmc.actionBtn, { backgroundColor: (colors as any).action + '15', opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="map-pin" size={13} color={(colors as any).action ?? colors.primary} />
            <Text style={[pmc.actionBtnText, { color: (colors as any).action ?? colors.primary }]}>Open in Maps</Text>
          </Pressable>
          {showDirections && (
            <Pressable
              onPress={handleDirections}
              style={({ pressed }) => [pmc.actionBtn, { backgroundColor: '#1a6b3a15', opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="navigation" size={13} color="#1a6b3a" />
              <Text style={[pmc.actionBtnText, { color: '#1a6b3a' }]}>Get Directions</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const pmc = StyleSheet.create({
  card:       { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  mapWrap:    { height: 200, backgroundColor: '#e8f0f7' },
  noPin:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  noPinText:  { fontFamily: 'Inter_400Regular', fontSize: 12 },
  infoBody:   { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 8, borderTopWidth: 1 },
  infoArea:   { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  infoAddr:   { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2, lineHeight: 14 },
  actionRow:  { flexDirection: 'row', borderTopWidth: 1, padding: 10, gap: 8 },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, flex: 1, justifyContent: 'center' },
  actionBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});

// ─── LocationPicker (Add / Edit Property forms) ────────────────────────────────

interface LocationPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  city?: string;
  locality?: string;
  onChange: (lat: number, lng: number, address?: string) => void;
  onLocationChange?: (location: LocationData) => void;
  onClear: () => void;
  colors: Colors;
  accentColor?: string;
  requireConfirm?: boolean;
  onConfirmationChange?: (confirmed: boolean) => void;
  errorMessage?: string;
}

export function LocationPicker({
  latitude, longitude, address, city, locality,
  onChange, onLocationChange, onClear,
  colors, accentColor, requireConfirm = false,
  onConfirmationChange, errorMessage,
}: LocationPickerProps) {
  const accent  = accentColor ?? (colors as any).action ?? colors.primary;
  const hasPin  = typeof latitude === 'number' && typeof longitude === 'number'
               && isFinite(latitude) && isFinite(longitude);

  const [query,           setQuery]           = useState(address ?? '');
  const [suggestions,     setSuggestions]     = useState<AutocompleteSuggestion[]>([]);
  const [acLoading,       setAcLoading]       = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef  = useRef<string>(`s${Date.now()}`);

  const [gpsLoading,     setGpsLoading]     = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [accuracyLevel,  setAccuracyLevel]  = useState<AccuracyLevel>('unknown');
  const [accuracyMetres, setAccuracyMetres] = useState<number | null>(null);
  const [localityLoading, setLocalityLoading] = useState(false);
  const localityRequestRef = useRef(0);

  const [showManual, setShowManual] = useState(false);
  const [latInput,   setLatInput]   = useState(latitude  != null ? String(latitude)  : '');
  const [lngInput,   setLngInput]   = useState(longitude != null ? String(longitude) : '');
  const [manualErr,  setManualErr]  = useState('');

  const [pinnedAddr,    setPinnedAddr]    = useState(address ?? '');
  const [locationData,  setLocationData]  = useState<Partial<LocationData>>({});
  const [confirmed,     setConfirmed]     = useState(!requireConfirm);

  useEffect(() => {
    onConfirmationChange?.(confirmed);
  }, [confirmed, onConfirmationChange]);

  const [region, setRegion] = useState(
    hasPin
      ? { latitude: latitude!, longitude: longitude!, latitudeDelta: 0.02, longitudeDelta: 0.02 }
      : getCityRegion(city),
  );

  useEffect(() => {
    if (hasPin) {
      setRegion({ latitude: latitude!, longitude: longitude!, latitudeDelta: 0.02, longitudeDelta: 0.02 });
    }
  }, [hasPin, latitude, longitude]);

  // When the listing city or area changes before an exact pin is selected,
  // move the map to the selected place instead of leaving the old city center.
  // The locality lookup uses the same Places service as address search, so a
  // selected area gets a real map position rather than a visual-only chip.
  useEffect(() => {
    if (hasPin) return;

    const requestId = ++localityRequestRef.current;
    let cancelled = false;
    setRegion(getCityRegion(city));
    setLocalityLoading(Boolean(locality?.trim()));

    if (!locality?.trim() || !city?.trim()) {
      setLocalityLoading(false);
      return () => { cancelled = true; };
    }

    (async () => {
      const details = await geocodeLocality(locality, city);
      if (cancelled || localityRequestRef.current !== requestId || hasPin) return;

      if (details) {
        setRegion({
          latitude: details.latitude,
          longitude: details.longitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        });
      }
      setLocalityLoading(false);
    })().catch(() => {
      if (!cancelled && localityRequestRef.current === requestId) setLocalityLoading(false);
    });

    return () => { cancelled = true; };
  }, [city, locality, hasPin]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const applyLocation = useCallback((loc: LocationData) => {
    const lat = loc.latitude;
    const lng = loc.longitude;
    onChange(lat, lng, loc.fullAddress);
    if (onLocationChange) onLocationChange(loc);
    setPinnedAddr(loc.fullAddress);
    setLocationData(loc);
    setLatInput(String(lat));
    setLngInput(String(lng));
    if (requireConfirm) setConfirmed(false);
    setShowManual(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setLocationError('');
    if (loc.fullAddress) setQuery(loc.fullAddress);
    setRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 });
  }, [onChange, onLocationChange, requireConfirm]);

  // ── Autocomplete ──────────────────────────────────────────────────────────

  const onQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setSuggestions([]); setShowSuggestions(false); return; }

    debounceRef.current = setTimeout(async () => {
      setAcLoading(true);
      const results = await fetchAutocompleteSuggestions(text, sessionRef.current);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setAcLoading(false);
    }, 400);
  }, []);

  const onSelectSuggestion = useCallback(async (s: AutocompleteSuggestion) => {
    Keyboard.dismiss();
    setQuery(s.description);
    setSuggestions([]);
    setShowSuggestions(false);
    setAcLoading(true);

    try {
      const details = await fetchPlaceDetails(s.placeId, sessionRef.current);
      // Reset session token after use
      sessionRef.current = `s${Date.now()}`;
      if (!details) {
        setLocationError('We could not resolve that place. Try another result or drop the pin on the map.');
        return;
      }
      applyLocation({ ...details, locationSource: 'search' });
    } catch {
      setLocationError('Location search is unavailable right now. You can still place the pin manually.');
    } finally {
      setAcLoading(false);
    }
  }, [applyLocation]);

  // ── GPS ───────────────────────────────────────────────────────────────────

  const getGPS = async () => {
    setGpsLoading(true);
    setAccuracyLevel('unknown');
    setAccuracyMetres(null);
    try {
      const pos = await getCurrentPosition();
      if (!pos) { setGpsLoading(false); return; }

      setAccuracyLevel(pos.accuracyLevel);
      setAccuracyMetres(pos.accuracy);

      if (pos.accuracyLevel === 'low') {
        Alert.alert(
          'Low GPS Accuracy',
          lowAccuracyMessage(pos.accuracy),
          [
            { text: 'Adjust Pin Manually', style: 'cancel' },
            {
              text: 'Use Anyway', onPress: async () => {
                const rev = await reverseGeocode(pos.latitude, pos.longitude);
                applyLocation(createGpsLocationData(pos, rev));
              },
            },
          ],
        );
        setGpsLoading(false);
        return;
      }

      const rev = await reverseGeocode(pos.latitude, pos.longitude);
      applyLocation(createGpsLocationData(pos, rev));
    } catch {
      Alert.alert('Error', 'Could not get your location. Please try again or enter address manually.');
    } finally {
      setGpsLoading(false);
    }
  };

  // ── Map tap / drag ────────────────────────────────────────────────────────

  const handleMapPress = useCallback(
    async (e: { nativeEvent?: { coordinate?: { latitude: number; longitude: number } } }) => {
      const coord = e?.nativeEvent?.coordinate;
      if (!coord) return;
      const lat = parseFloat(coord.latitude.toFixed(7));
      const lng = parseFloat(coord.longitude.toFixed(7));
      setAddressLoading(true);
      try {
        const rev = await reverseGeocode(lat, lng);
        applyLocation({
          latitude: lat, longitude: lng,
          fullAddress: rev?.fullAddress ?? `Pinned location · ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          city: rev?.city, locality: rev?.locality, district: rev?.district,
          province: rev?.province, country: rev?.country, postalCode: rev?.postalCode,
          placeId: rev?.placeId, locationSource: 'map_tap',
        });
      } catch {
        setLocationError('We could not find the address for this pin. Check the pin and try again.');
      } finally {
        setAddressLoading(false);
      }
    },
    [applyLocation],
  );

  const handleDragEnd = useCallback(
    async (lat: number, lng: number) => {
      setAddressLoading(true);
      try {
        const rev = await reverseGeocode(lat, lng);
        applyLocation({
          latitude: lat, longitude: lng,
          fullAddress: rev?.fullAddress ?? `Pinned location · ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          city: rev?.city, locality: rev?.locality, district: rev?.district,
          province: rev?.province, country: rev?.country, postalCode: rev?.postalCode,
          placeId: rev?.placeId, locationSource: 'map_tap',
        });
      } catch {
        setLocationError('We could not update this address. Please try moving the pin again.');
      } finally {
        setAddressLoading(false);
      }
    },
    [applyLocation],
  );

  // ── Manual entry ──────────────────────────────────────────────────────────

  const confirmManual = async () => {
    setManualErr('');
    const lat = parseFloat(latInput.trim());
    const lng = parseFloat(lngInput.trim());
    if (isNaN(lat) || lat < -90  || lat > 90)  { setManualErr('Latitude must be between -90 and 90');    return; }
    if (isNaN(lng) || lng < -180 || lng > 180) { setManualErr('Longitude must be between -180 and 180'); return; }
    setAddressLoading(true);
    try {
      const rev = await reverseGeocode(lat, lng);
      applyLocation({
        latitude: lat, longitude: lng,
        fullAddress: rev?.fullAddress ?? '',
        city: rev?.city, locality: rev?.locality, district: rev?.district,
        locationSource: 'manual',
      });
      setShowManual(false);
    } catch {
      setLocationError('Coordinates were accepted, but the address could not be resolved. Please review the pin.');
    } finally {
      setAddressLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={lp.root}>

      {/* Header */}
      <View style={lp.header}>
        <View style={[lp.iconWrap, { backgroundColor: accent + '18' }]}>
          <Feather name="map-pin" size={14} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[lp.title, { color: colors.foreground }]}>Property Location</Text>
          <Text style={[lp.sub, { color: colors.mutedForeground }]}>
            Search address, use GPS, or tap the map
          </Text>
        </View>
        {hasPin && (
          <Pressable
            onPress={() => {
              onClear();
              setLatInput(''); setLngInput('');
              setQuery(''); setPinnedAddr('');
              setSuggestions([]);
              setShowManual(false);
              setConfirmed(!requireConfirm);
              setAccuracyLevel('unknown');
              setAccuracyMetres(null);
            }}
            hitSlop={10}
            style={[lp.clearBtn, { backgroundColor: '#dc262618' }]}
          >
            <Feather name="x" size={13} color="#dc2626" />
          </Pressable>
        )}
      </View>

      {/* Places Autocomplete Search Bar */}
      <View style={[lp.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={15} color={colors.mutedForeground} style={{ marginLeft: 12 }} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search property address or area…"
          placeholderTextColor={colors.mutedForeground + '88'}
          style={[lp.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          onSubmitEditing={() => { if (suggestions.length > 0) onSelectSuggestion(suggestions[0]); }}
        />
        {acLoading && <ActivityIndicator size="small" color={accent} style={{ marginRight: 12 }} />}
        {!acLoading && query.length > 0 && (
          <Pressable
            onPress={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false); }}
            hitSlop={8} style={{ marginRight: 12 }}
          >
            <Feather name="x-circle" size={15} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={[lp.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="always"
            scrollEnabled={suggestions.length > 4}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => onSelectSuggestion(item)}
                style={({ pressed }) => [
                  lp.suggItem,
                  index < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  pressed && { backgroundColor: accent + '15' },
                ]}
              >
                <View style={[lp.suggIcon, { backgroundColor: accent + '18' }]}>
                  <Feather name="map-pin" size={11} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[lp.suggMain, { color: colors.foreground }]} numberOfLines={1}>
                    {item.mainText}
                  </Text>
                  {item.secondaryText ? (
                    <Text style={[lp.suggSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {item.secondaryText}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        </View>
      )}

      {/* GPS accuracy indicator */}
      {hasPin && accuracyMetres !== null && (
        <View style={[lp.accuracyBadge, { backgroundColor: accuracyColor(accuracyLevel) + '18', borderColor: accuracyColor(accuracyLevel) + '44' }]}>
          <View style={[lp.accuracyDot, { backgroundColor: accuracyColor(accuracyLevel) }]} />
          <Text style={[lp.accuracyText, { color: accuracyColor(accuracyLevel) }]}>
            {accuracyLabel(accuracyLevel)} ({Math.round(accuracyMetres)} m)
          </Text>
        </View>
      )}

      {/* Map surface */}
      <View style={lp.mapWrap}>
        <InteractiveMap
          // Keep the camera controlled by the resolved city/locality region
          // until the user selects an exact pin.
          key={`${city ?? 'default'}-${hasPin ? `${latitude}-${longitude}` : 'location'}`}
          region={region}
          onRegionChange={setRegion}
          onPress={handleMapPress}
          pinLat={hasPin ? latitude! : undefined}
          pinLng={hasPin ? longitude! : undefined}
          onDragEnd={handleDragEnd}
          showMyLocation={false}
        />
        {localityLoading && !hasPin && (
          <View pointerEvents="none" style={lp.localityLoading}>
            <ActivityIndicator size="small" color={accent} />
            <Text style={[lp.localityLoadingText, { color: colors.foreground }]}>
              Locating {locality}…
            </Text>
          </View>
        )}
        {Platform.OS !== 'web' && !hasPin && (
          <View pointerEvents="none" style={lp.tapHint}>
            <View style={lp.tapHintPill}>
              <Feather name="map-pin" size={12} color="#ffffff" />
              <Text style={lp.tapHintText}>Tap map to drop a pin</Text>
            </View>
          </View>
        )}
      </View>
      {requireConfirm && (
        <Text style={[lp.confirmHint, { color: colors.mutedForeground }]}>
          Place the exact pin, review the address, then confirm the location before submitting.
        </Text>
      )}

      {/* Coordinate + address badge */}
      {hasPin && (
        <View style={[lp.badge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {addressLoading ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Feather name={confirmed ? 'check-circle' : 'map-pin'} size={13} color={confirmed ? '#16a34a' : accent} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[lp.badgeCoord, { color: colors.foreground }]}>
              {fmtCoord(latitude!, true)}  ·  {fmtCoord(longitude!, false)}
            </Text>
            {addressLoading ? (
              <Text style={[lp.badgeAddr, { color: accent }]}>Finding address…</Text>
            ) : pinnedAddr ? (
              <Text style={[lp.badgeAddr, { color: colors.mutedForeground }]} numberOfLines={2}>
                {pinnedAddr}
              </Text>
            ) : null}
            {(locationData as LocationData)?.city && (
              <Text style={[lp.badgeArea, { color: colors.mutedForeground }]}>
                {[(locationData as LocationData).locality, (locationData as LocationData).city, (locationData as LocationData).district].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>
          <Pressable onPress={() => openGoogleMaps(latitude!, longitude!)} hitSlop={8}>
            <Feather name="external-link" size={12} color={colors.mutedForeground} />
          </Pressable>
        </View>
      )}

      {/* Action buttons row */}
      <View style={lp.btnRow}>
        <Pressable
          onPress={getGPS}
          disabled={gpsLoading}
          style={({ pressed }) => [
            lp.btn,
            { backgroundColor: accent, opacity: gpsLoading || pressed ? 0.75 : 1, flex: 1 },
          ]}
        >
          {gpsLoading
            ? <ActivityIndicator size="small" color="#ffffff" />
            : <Feather name="crosshair" size={14} color="#ffffff" />}
          <Text style={lp.btnText}>{gpsLoading ? 'Locating…' : 'Use My Location'}</Text>
        </Pressable>

        <Pressable
          onPress={() => setShowManual(!showManual)}
          style={({ pressed }) => [
            lp.btn, lp.btnOutline,
            { borderColor: accent + '55', backgroundColor: accent + '12', opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Feather name="edit-3" size={14} color={accent} />
          <Text style={[lp.btnText, { color: accent }]}>Coordinates</Text>
        </Pressable>
      </View>

      {/* Confirm Location button (for Add Property flow) */}
      {requireConfirm && hasPin && !confirmed && (
        <Pressable
          onPress={() => setConfirmed(true)}
          style={({ pressed }) => [lp.confirmLocationBtn, { backgroundColor: '#16a34a', opacity: pressed ? 0.82 : 1 }]}
        >
          <Feather name="check-circle" size={15} color="#ffffff" />
          <Text style={lp.confirmLocationText}>Confirm Location</Text>
        </Pressable>
      )}
      {requireConfirm && hasPin && confirmed && (
        <View style={[lp.confirmedBadge, { backgroundColor: '#16a34a18', borderColor: '#16a34a33' }]}>
          <Feather name="check-circle" size={13} color="#16a34a" />
          <Text style={[lp.confirmedText, { color: '#16a34a' }]}>Location Confirmed</Text>
        </View>
      )}
      {errorMessage ? <Text style={lp.validationError}>{errorMessage}</Text> : null}
      {locationError ? (
        <View style={[lp.locationError, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '30' }]}>
          <Feather name="alert-circle" size={14} color={colors.destructive} />
          <Text style={[lp.locationErrorText, { color: colors.destructive }]}>{locationError}</Text>
        </View>
      ) : null}

      {/* Manual coordinate entry */}
      {showManual && (
        <View style={[lp.manualBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[lp.manualLabel, { color: colors.mutedForeground }]}>
            Enter coordinates manually — open Google Maps, long-press any location to copy them.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[lp.fieldLabel, { color: colors.mutedForeground }]}>Latitude</Text>
              <TextInput
                value={latInput} onChangeText={setLatInput}
                placeholder="e.g. 30.6892" keyboardType="numbers-and-punctuation"
                placeholderTextColor={colors.mutedForeground + '66'}
                style={[lp.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[lp.fieldLabel, { color: colors.mutedForeground }]}>Longitude</Text>
              <TextInput
                value={lngInput} onChangeText={setLngInput}
                placeholder="e.g. 73.9254" keyboardType="numbers-and-punctuation"
                placeholderTextColor={colors.mutedForeground + '66'}
                style={[lp.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              />
            </View>
          </View>
          {manualErr ? <Text style={lp.manualErr}>{manualErr}</Text> : null}
          <Pressable onPress={confirmManual} style={[lp.confirmBtn, { backgroundColor: accent }]}>
            <Feather name="check" size={14} color="#ffffff" />
            <Text style={lp.btnText}>Set Location</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const lp = StyleSheet.create({
  root:     { gap: 10 },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title:    { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  sub:      { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 1 },
  clearBtn: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 13, height: 46, gap: 8 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, height: '100%', paddingHorizontal: 8 },

  dropdown:  { borderWidth: 1, borderRadius: 13, overflow: 'hidden', maxHeight: 240 },
  suggItem:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  suggIcon:  { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  suggMain:  { fontFamily: 'Inter_500Medium', fontSize: 13 },
  suggSub:   { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 1 },

  accuracyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  accuracyDot:   { width: 7, height: 7, borderRadius: 4 },
  accuracyText:  { fontFamily: 'Inter_500Medium', fontSize: 10, flex: 1 },

  mapWrap:     { height: 230, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  tapHint:     { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12 },
  tapHintPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  tapHintText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#ffffff' },
  localityLoading: {
    position: 'absolute', top: 10, left: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  localityLoadingText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },

  badge:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  badgeCoord: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  badgeAddr:  { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2, lineHeight: 14 },
  badgeArea:  { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 1, color: '#8a9fb8' },

  btnRow:    { flexDirection: 'row', gap: 10 },
  btn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14 },
  btnOutline:{ borderWidth: 1 },
  btnText:   { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ffffff' },

  confirmLocationBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, paddingVertical: 13 },
  confirmLocationText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#ffffff' },
  confirmedBadge:      { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9 },
  confirmedText:       { fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  manualBox:   { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  manualLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  fieldLabel:  { fontFamily: 'Inter_500Medium', fontSize: 10, marginBottom: 5 },
  input:       { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 13 },
  manualErr:   { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#dc2626' },
  validationError: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#dc2626' },
  confirmBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, paddingVertical: 11 },
  confirmHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 12 },
  locationError: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderWidth: 1, borderRadius: 11, padding: 10, marginTop: 9 },
  locationErrorText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
});
