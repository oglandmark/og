/**
 * Admin — Property Management
 * Approve / Reject / Feature / Delete listings
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { LocationPicker } from '@/components/LocationPicker';
import { openGoogleMaps, type LocationData } from '@/lib/locationService';
import {
  getAdminProperties, ApiProperty,
  approveProperty, rejectProperty,
  toggleFeatureProperty, deleteAdminProperty, updateProperty, sendBroadcastPush,
} from '@/lib/api';

const NAVY = '#102a43';
const GOLD = '#C8A45A';

const STATUS_TABS = ['Pending', 'Active', 'Rejected', 'All'] as const;
type StatusTab = typeof STATUS_TABS[number];

function statusColor(s: string) {
  if (s === 'Active')   return '#15803d';
  if (s === 'Pending')  return '#b45309';
  if (s === 'Rejected') return '#dc2626';
  return '#6b7280';
}

// Valid, non-null-island coordinates
function hasValidCoords(lat?: number, lng?: number): lat is number {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    isFinite(lat) && isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}

// Open in the device maps app. Prefer coordinates; fall back to an address search.
function openInMaps(prop: ApiProperty) {
  const label = prop.title || prop.address || undefined;
  if (hasValidCoords(prop.lat, prop.lng)) {
    openGoogleMaps(prop.lat as number, prop.lng as number, label);
    return;
  }
  const query = [prop.address, prop.city].filter(Boolean).join(', ').trim();
  if (query) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open Maps.'));
    return;
  }
  Alert.alert('No location', 'This property has no coordinates or address.');
}

export default function AdminProperties() {
  const colors = useColors();
  const { top } = useSafeAreaInsets();
  const [tab,        setTab]        = useState<StatusTab>('Pending');
  const [properties, setProperties] = useState<ApiProperty[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingProperty, setEditingProperty] = useState<ApiProperty | null>(null);
  const [editLatitude, setEditLatitude] = useState<number | null>(null);
  const [editLongitude, setEditLongitude] = useState<number | null>(null);
  const [editLocation, setEditLocation] = useState<LocationData | null>(null);
  const [editConfirmed, setEditConfirmed] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  const load = useCallback(async () => {
    try {
      const status = tab === 'All' ? undefined : tab;
      const data = await getAdminProperties({ status, limit: 50 });
      setProperties(data);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  async function doApprove(prop: ApiProperty) {
    try {
      await approveProperty(prop.id);
      try {
        await sendBroadcastPush(
          'New Property Listed',
          `${prop.title} is now available in ${prop.city}.`,
          { type: 'property', propertyId: prop.id },
        );
      } catch (error: unknown) {
        console.warn('[push] Property approval broadcast failed.', error);
        Alert.alert(
          'Approved, but notification failed',
          'The property was approved, but its notification could not be sent. You can retry from Broadcast Notification.',
        );
      }
      setProperties(p => p.filter(x => x.id !== prop.id));
    } catch { Alert.alert('Error', 'Could not approve.'); }
  }

  async function doReject(id: number) {
    Alert.alert('Reject Property', 'Reject this listing?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
          try { await rejectProperty(id); setProperties(p => p.filter(x => x.id !== id)); }
          catch { Alert.alert('Error', 'Could not reject.'); }
        }},
    ]);
  }

  async function doFeature(prop: ApiProperty) {
    const newFeatured = !prop.featured;
    try {
      await toggleFeatureProperty(prop.id, newFeatured);
      setProperties(prev => prev.map(p => p.id === prop.id ? { ...p, featured: newFeatured } : p));
    } catch { Alert.alert('Error', 'Could not update featured status.'); }
  }

  async function doDelete(id: number) {
    Alert.alert('Delete Property', 'Permanently delete this listing?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteAdminProperty(id); setProperties(p => p.filter(x => x.id !== id)); }
          catch { Alert.alert('Error', 'Could not delete.'); }
        }},
    ]);
  }

  function beginLocationEdit(prop: ApiProperty) {
    const hasCoords = hasValidCoords(prop.lat, prop.lng);
    setEditingProperty(prop);
    setEditLatitude(hasCoords ? prop.lat! : null);
    setEditLongitude(hasCoords ? prop.lng! : null);
    setEditLocation(hasCoords ? {
      latitude: prop.lat!,
      longitude: prop.lng!,
      fullAddress: prop.address || '',
      city: prop.city || undefined,
      locationSource: 'manual',
    } : null);
    setEditConfirmed(false);
  }

  function closeLocationEdit(force = false) {
    if (savingLocation && !force) return;
    setEditingProperty(null);
    setEditLatitude(null);
    setEditLongitude(null);
    setEditLocation(null);
    setEditConfirmed(false);
  }

  async function saveLocationEdit() {
    if (!editingProperty || editLatitude == null || editLongitude == null || !editConfirmed) {
      Alert.alert('Confirm Location', 'Set and confirm the exact property pin before saving.');
      return;
    }

    setSavingLocation(true);
    try {
      const payload = {
        lat: editLatitude,
        lng: editLongitude,
        address: editLocation?.fullAddress || editingProperty.address,
        city: editLocation?.city || editingProperty.city,
      };
      await updateProperty(editingProperty.id, payload);
      setProperties((prev) => prev.map((prop) =>
        prop.id === editingProperty.id ? { ...prop, ...payload } : prop
      ));
      closeLocationEdit(true);
    } catch {
      Alert.alert('Could Not Save', 'The property location could not be updated. Check your connection and try again.');
    } finally {
      setSavingLocation(false);
    }
  }

  const renderItem = ({ item }: { item: ApiProperty }) => {
    const thumb = Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : null;
    const coords = hasValidCoords(item.lat, item.lng);
    const locationText = [item.address, item.city].filter(Boolean).join(', ').trim();
    const hasLocation = coords || !!locationText;
    return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardTop}>
        {/* Thumbnail */}
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={s.thumb}
            resizeMode="cover"
          />
        ) : (
          <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.secondary }]}>
            <Feather name="image" size={22} color={colors.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
          <Text style={[s.meta, { color: colors.mutedForeground }]}>
            {item.type} · {item.city} · PKR {(item.price / 1_000_000).toFixed(1)}M
          </Text>
          <View style={s.badgeRow}>
            <View style={[s.badge, { backgroundColor: statusColor(item.approvalStatus ?? 'Pending') + '20' }]}>
              <Text style={[s.badgeText, { color: statusColor(item.approvalStatus ?? 'Pending') }]}>
                {item.approvalStatus ?? 'Pending'}
              </Text>
            </View>
            {item.featured && (
              <View style={[s.badge, { backgroundColor: GOLD + '20' }]}>
                <Text style={[s.badgeText, { color: GOLD }]}>Featured</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Location summary */}
      <View style={[s.locBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={s.locHeaderRow}>
            <Feather name="map-pin" size={13} color={GOLD} />
            <Text style={[s.locLabel, { color: colors.foreground }]}>Location</Text>
          </View>
          {locationText ? (
            <Text style={[s.locText, { color: colors.mutedForeground }]} numberOfLines={2}>
              {locationText}
            </Text>
          ) : (
            <Text style={[s.locText, { color: '#dc2626' }]}>Location not set</Text>
          )}
          <Text style={[s.locCoords, { color: colors.mutedForeground }]}>
            {coords
              ? `${(item.lat as number).toFixed(5)}, ${(item.lng as number).toFixed(5)}`
              : 'No GPS coordinates — using address'}
          </Text>
          <View style={s.locActions}>
            <Pressable style={[s.locBtn, { borderColor: GOLD }]} onPress={() => openInMaps(item)}>
              <Feather name="map" size={13} color={GOLD} />
              <Text style={[s.locBtnText, { color: GOLD }]}>Open in Maps</Text>
            </Pressable>
            <Pressable
              style={[s.locBtn, { borderColor: colors.border }]}
              onPress={() => beginLocationEdit(item)}
            >
              <Feather name="edit-2" size={13} color={colors.foreground} />
              <Text style={[s.locBtnText, { color: colors.foreground }]}>Edit Location</Text>
            </Pressable>
          </View>
      </View>

      {/* Action buttons */}
      <View style={s.actions}>
        {(item.approvalStatus === 'Pending' || !item.approvalStatus) && (
          <>
            <Pressable style={[s.actBtn, { backgroundColor: '#15803d' }]} onPress={() => doApprove(item)}>
              <Feather name="check" size={13} color="#fff" />
              <Text style={s.actText}>Approve</Text>
            </Pressable>
            <Pressable style={[s.actBtn, { backgroundColor: '#dc2626' }]} onPress={() => doReject(item.id)}>
              <Feather name="x" size={13} color="#fff" />
              <Text style={s.actText}>Reject</Text>
            </Pressable>
          </>
        )}
        <Pressable style={[s.actBtn, { backgroundColor: item.featured ? GOLD : colors.secondary, borderWidth: 1, borderColor: GOLD }]} onPress={() => doFeature(item)}>
          <Feather name="star" size={13} color={item.featured ? '#fff' : GOLD} />
          <Text style={[s.actText, { color: item.featured ? '#fff' : GOLD }]}>
            {item.featured ? 'Unfeature' : 'Feature'}
          </Text>
        </Pressable>
        <Pressable style={[s.actBtn, { backgroundColor: '#dc262615' }]} onPress={() => doDelete(item.id)}>
          <Feather name="trash-2" size={13} color="#dc2626" />
          <Text style={[s.actText, { color: '#dc2626' }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );};  

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: NAVY, paddingTop: top + 14 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color="#8a9ab5" />
        </Pressable>
        <Text style={s.headerTitle}>Properties</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Status tabs */}
      <View style={[s.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {STATUS_TABS.map(t => (
          <Pressable
            key={t}
            style={[s.tabItem, tab === t && { borderBottomColor: GOLD, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, { color: tab === t ? GOLD : colors.mutedForeground }]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={properties}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GOLD} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="check-circle" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No {tab} properties</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!editingProperty} transparent animationType="slide" onRequestClose={() => closeLocationEdit()}>
        <View style={s.modalBackdrop}>
          <View style={[s.modalSheet, { backgroundColor: colors.background, paddingBottom: Platform.OS === 'ios' ? 28 : 18 }]}>
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalTitle, { color: colors.foreground }]}>Edit Property Location</Text>
                <Text style={[s.modalSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {editingProperty?.title}
                </Text>
              </View>
              <Pressable onPress={() => closeLocationEdit()} hitSlop={10}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={s.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <LocationPicker
                latitude={editLatitude}
                longitude={editLongitude}
                address={editLocation?.fullAddress || editingProperty?.address}
                onChange={(lat, lng) => {
                  setEditLatitude(lat);
                  setEditLongitude(lng);
                }}
                onLocationChange={setEditLocation}
                onClear={() => {
                  setEditLatitude(null);
                  setEditLongitude(null);
                  setEditLocation(null);
                  setEditConfirmed(false);
                }}
                colors={colors}
                accentColor={GOLD}
                requireConfirm
                onConfirmationChange={setEditConfirmed}
                errorMessage={editLatitude == null || editLongitude == null ? 'Set an exact property pin' : undefined}
              />
            </ScrollView>
            <View style={[s.modalFooter, { borderTopColor: colors.border }]}>
              <Pressable onPress={() => closeLocationEdit()} style={[s.modalCancel, { borderColor: colors.border }]}>
                <Text style={[s.modalCancelText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveLocationEdit}
                disabled={savingLocation || !editConfirmed}
                style={[s.modalSave, { backgroundColor: GOLD, opacity: savingLocation || !editConfirmed ? 0.55 : 1 }]}
              >
                {savingLocation ? <ActivityIndicator size="small" color="#102a43" /> : <Feather name="check" size={15} color="#102a43" />}
                <Text style={s.modalSaveText}>{savingLocation ? 'Saving…' : 'Save Location'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#ffffff' },
  tabs:        { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem:     { flex: 1, alignItems: 'center', paddingVertical: 13 },
  tabText:     { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  card:        { borderRadius: 14, borderWidth: 1, padding: 14 },
  cardTop:     { flexDirection: 'row', gap: 10, marginBottom: 12 },
  thumb:       { width: 72, height: 72, borderRadius: 10 },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  title:       { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 4 },
  meta:        { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 6 },
  badgeRow:    { flexDirection: 'row', gap: 6 },
  badge:       { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontFamily: 'Inter_700Bold', fontSize: 10 },
  locBox:      { borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 12, gap: 4 },
  locHeaderRow:{ flexDirection: 'row', alignItems: 'center', gap: 5 },
  locLabel:    { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  locText:     { fontFamily: 'Inter_400Regular', fontSize: 12 },
  locCoords:   { fontFamily: 'Inter_400Regular', fontSize: 11 },
  locActions:  { flexDirection: 'row', gap: 8, marginTop: 6 },
  locBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  locBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  actions:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  actText:     { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#fff' },
  empty:       { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText:   { fontFamily: 'Inter_400Regular', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5,14,24,0.72)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '92%', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  modalSub: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  modalBody: { padding: 18, paddingBottom: 30 },
  modalFooter: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1 },
  modalCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, paddingVertical: 12 },
  modalCancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  modalSave: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, paddingVertical: 12 },
  modalSaveText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#102a43' },
});
