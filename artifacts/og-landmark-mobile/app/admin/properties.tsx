/**
 * Admin — Property Management
 * Approve / Reject / Feature / Delete listings
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { LocationPicker } from '@/components/LocationPicker';
import { openGoogleMaps, type LocationData } from '@/lib/locationService';
import { formatPropertyCoordinates, getPropertyCoordinates } from '@/lib/propertyCoordinates';
import { useDemoPropertyVisibility } from '@/context/DemoPropertyVisibilityContext';
import {
  getAdminProperties, ApiProperty,
  approveProperty, rejectProperty,
  toggleFeatureProperty, deleteAdminProperty, updateProperty,
  getAdminPropertyReview, AdminPropertyReview, setAdminDemoPropertiesHidden,
} from '@/lib/api';
import { formatPrice, properties as bundledDemoProperties, Property as DemoProperty } from '@/lib/properties';

const NAVY = '#0B1F3A';
const GOLD = '#C8A45A';

const STATUS_TABS = ['Pending', 'Active', 'Rejected', 'All', 'Demos'] as const;
type StatusTab = typeof STATUS_TABS[number];

function statusColor(s: string) {
  if (s === 'Active')   return '#15803d';
  if (s === 'Pending')  return '#b45309';
  if (s === 'Rejected') return '#dc2626';
  return '#6b7280';
}

// Open in the device maps app. Prefer coordinates; fall back to an address search.
function openInMaps(prop: ApiProperty) {
  const label = prop.title || prop.address || undefined;
  const coordinates = getPropertyCoordinates(prop);
  if (coordinates) {
    openGoogleMaps(coordinates.latitude, coordinates.longitude, label);
    return;
  }
  const query = [prop.location?.address || prop.address, prop.location?.city || prop.city]
    .filter(Boolean).join(', ').trim();
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
  const { hiddenDemoPropertyIds, refreshDemoPropertyVisibility } = useDemoPropertyVisibility();
  const [tab,        setTab]        = useState<StatusTab>('Pending');
  const [properties, setProperties] = useState<ApiProperty[]>([]);
  const [demoProperties, setDemoProperties] = useState<DemoProperty[]>(bundledDemoProperties);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [demoActionBusy, setDemoActionBusy] = useState(false);
  const [editingProperty, setEditingProperty] = useState<ApiProperty | null>(null);
  const [loadError, setLoadError] = useState('');
  const [rejectingProperty, setRejectingProperty] = useState<ApiProperty | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reviewingProperty, setReviewingProperty] = useState<ApiProperty | null>(null);
  const [reviewData, setReviewData] = useState<AdminPropertyReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [editLatitude, setEditLatitude] = useState<number | null>(null);
  const [editLongitude, setEditLongitude] = useState<number | null>(null);
  const [editLocation, setEditLocation] = useState<LocationData | null>(null);
  const [editConfirmed, setEditConfirmed] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      if (tab === 'Demos') {
        await refreshDemoPropertyVisibility();
        setDemoProperties(bundledDemoProperties);
        setProperties([]);
        return;
      }
      const status = tab === 'All' ? undefined : tab;
      const data = await getAdminProperties({ status, limit: 500 });
      setProperties(data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load properties.');
    }
    finally { setLoading(false); setRefreshing(false); }
  }, [refreshDemoPropertyVisibility, tab]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  async function doApprove(prop: ApiProperty) {
    try {
      await approveProperty(prop.id);
      setProperties(p => p.filter(x => x.id !== prop.id));
    } catch { Alert.alert('Error', 'Could not approve.'); }
  }

  function beginReject(prop: ApiProperty) {
    setRejectingProperty(prop);
    setRejectReason('');
  }

  async function submitReject() {
    const property = rejectingProperty;
    const reason = rejectReason.trim();
    if (!property) return;
    if (!reason) {
      Alert.alert('Reason required', 'Please explain why this listing is being rejected.');
      return;
    }
    setRejecting(true);
    try {
      await rejectProperty(property.id, reason);
      setProperties((items) => items.filter((item) => item.id !== property.id));
      setRejectingProperty(null);
      setRejectReason('');
    } catch (error) {
      Alert.alert('Could not reject', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setRejecting(false);
    }
  }

  async function openReview(prop: ApiProperty) {
    setReviewingProperty(prop);
    setReviewData(null);
    setReviewError('');
    setReviewLoading(true);
    try {
      setReviewData(await getAdminPropertyReview(prop.id));
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Could not load the complete review.');
    } finally {
      setReviewLoading(false);
    }
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

  function toggleDemoVisibility(property: DemoProperty, hidden: boolean) {
    const title = hidden ? 'Restore demo property?' : 'Remove demo property?';
    const message = hidden
      ? 'This demo example will appear again in the app’s offline fallback.'
      : 'This only removes the bundled demo example from the mobile app. Customer listings are not affected.';
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: hidden ? 'Restore' : 'Remove',
        style: hidden ? 'default' : 'destructive',
        onPress: async () => {
          setDemoActionBusy(true);
          try {
            await setAdminDemoPropertiesHidden([property.id], !hidden);
            await refreshDemoPropertyVisibility();
          } catch (error) {
            Alert.alert('Could not update demo property', error instanceof Error ? error.message : 'Please try again.');
          } finally {
            setDemoActionBusy(false);
          }
        },
      },
    ]);
  }

  function removeAllVisibleDemos() {
    const ids = demoProperties
      .filter((property) => !hiddenDemoPropertyIds.includes(property.id))
      .map((property) => property.id);
    if (ids.length === 0) return;

    Alert.alert(
      'Remove all demo properties?',
      `This removes ${ids.length} bundled demo examples from the mobile app. Customer listings are not affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove all',
          style: 'destructive',
          onPress: async () => {
            setDemoActionBusy(true);
            try {
              await setAdminDemoPropertiesHidden(ids, true);
              await refreshDemoPropertyVisibility();
            } catch (error) {
              Alert.alert('Could not remove demo properties', error instanceof Error ? error.message : 'Please try again.');
            } finally {
              setDemoActionBusy(false);
            }
          },
        },
      ],
    );
  }

  const renderDemoItem = ({ item }: { item: DemoProperty }) => {
    const hidden = hiddenDemoPropertyIds.includes(item.id);
    return (
      <View style={[s.demoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Image source={item.image} style={s.demoThumb} />
        <View style={s.demoInfo}>
          <Text style={[s.title, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
          <Text style={[s.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.city} · {formatPrice(item.price, item.status)}
          </Text>
          <Text style={[s.demoStatus, { color: hidden ? colors.mutedForeground : colors.action }]}>
            {hidden ? 'Removed from app' : 'Offline fallback'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${hidden ? 'Restore' : 'Remove'} ${item.title}`}
          testID={`admin-demo-property-toggle-${item.id}`}
          disabled={demoActionBusy}
          onPress={() => toggleDemoVisibility(item, hidden)}
          style={[s.demoAction, { borderColor: hidden ? colors.border : '#dc262640', opacity: demoActionBusy ? 0.5 : 1 }]}
        >
          <Feather name={hidden ? 'rotate-ccw' : 'trash-2'} size={14} color={hidden ? colors.action : '#dc2626'} />
          <Text style={[s.demoActionText, { color: hidden ? colors.action : '#dc2626' }]}>
            {hidden ? 'Restore' : 'Remove'}
          </Text>
        </Pressable>
      </View>
    );
  };

  function beginLocationEdit(prop: ApiProperty) {
    const coordinates = getPropertyCoordinates(prop);
    setEditingProperty(prop);
    setEditLatitude(coordinates?.latitude ?? null);
    setEditLongitude(coordinates?.longitude ?? null);
    setEditLocation(coordinates ? {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      fullAddress: prop.location?.address || prop.address || '',
      city: prop.location?.city || prop.city || undefined,
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
      const address = editLocation?.fullAddress || editingProperty.address;
      const city = editLocation?.city || editingProperty.location?.city || editingProperty.city;
      const location = {
        ...(editingProperty.location ?? {}),
        latitude: editLatitude,
        longitude: editLongitude,
        address,
        city,
        ...(editLocation?.streetAddress ? { streetAddress: editLocation.streetAddress } : {}),
        ...(editLocation?.locationSource ? { source: editLocation.locationSource } : {}),
        ...(editLocation?.accuracy != null ? { accuracy: editLocation.accuracy } : {}),
        ...(editLocation?.placeId ? { placeId: editLocation.placeId } : {}),
      };
      const payload = {
        lat: editLatitude,
        lng: editLongitude,
        address,
        city,
        location,
      };
      await updateProperty(editingProperty.id, payload);
      setProperties((prev) => prev.map((prop) =>
        prop.id === editingProperty.id ? { ...prop, ...payload, location } : prop
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
    const coords = getPropertyCoordinates(item);
    const locationText = [
      item.location?.address || item.address,
      item.location?.city || item.city,
    ].filter(Boolean).join(', ').trim();
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
              ? formatPropertyCoordinates(coords)
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
        <Pressable style={[s.actBtn, { backgroundColor: NAVY }]} onPress={() => void openReview(item)}>
          <Feather name="eye" size={13} color="#fff" />
          <Text style={s.actText}>Review</Text>
        </Pressable>
        {(item.approvalStatus === 'Pending' || !item.approvalStatus) && (
          <>
            <Pressable style={[s.actBtn, { backgroundColor: '#15803d' }]} onPress={() => doApprove(item)}>
              <Feather name="check" size={13} color="#fff" />
              <Text style={s.actText}>Approve</Text>
            </Pressable>
            <Pressable style={[s.actBtn, { backgroundColor: '#dc2626' }]} onPress={() => beginReject(item)}>
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
      <View style={[s.header, { backgroundColor: NAVY, paddingTop: top + (Platform.OS === 'web' ? 67 : 0) + 14 }]}>
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
      ) : loadError ? (
        <View style={s.empty}>
          <Feather name="wifi-off" size={40} color="#dc2626" />
          <Text style={[s.emptyText, { color: colors.foreground }]}>{loadError}</Text>
          <Pressable style={[s.actBtn, { backgroundColor: GOLD }]} onPress={() => { setLoading(true); load(); }}>
            <Text style={[s.actText, { color: NAVY }]}>Retry</Text>
          </Pressable>
        </View>
      ) : tab === 'Demos' ? (
        <FlatList
          data={demoProperties}
          keyExtractor={item => `demo-${item.id}`}
          renderItem={renderDemoItem}
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GOLD} />}
          ListHeaderComponent={
            <View style={s.demoHeader}>
              <Text style={[s.demoDescription, { color: colors.mutedForeground }]}>
                These bundled examples appear only as an offline fallback. Remove them here to hide them across the app.
              </Text>
              {demoProperties.some(item => !hiddenDemoPropertyIds.includes(item.id)) ? (
                <Pressable
                  accessibilityRole="button"
                  testID="admin-remove-all-demo-properties"
                  disabled={demoActionBusy}
                  onPress={removeAllVisibleDemos}
                  style={[s.removeAllDemos, { opacity: demoActionBusy ? 0.5 : 1 }]}
                >
                  <Feather name="trash-2" size={14} color="#dc2626" />
                  <Text style={s.removeAllDemosText}>Remove all visible demos</Text>
                </Pressable>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="check-circle" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No demo properties</Text>
            </View>
          }
        />
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

      <Modal visible={!!editingProperty} transparent animationType="none" onRequestClose={() => closeLocationEdit()}>
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
                city={editingProperty?.city}
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
                fullScreen
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
                {savingLocation ? <ActivityIndicator size="small" color="#0B1F3A" /> : <Feather name="check" size={15} color="#0B1F3A" />}
                <Text style={s.modalSaveText}>{savingLocation ? 'Saving…' : 'Save Location'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!rejectingProperty}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!rejecting) setRejectingProperty(null); }}
      >
        <View style={s.modalBackdrop}>
          <View style={[s.rejectSheet, { backgroundColor: colors.background }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Reject Listing</Text>
            <Text style={[s.modalSub, { color: colors.mutedForeground }]}>
              {rejectingProperty?.title}
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Explain what needs to be corrected…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[s.rejectInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              editable={!rejecting}
            />
            <View style={s.modalFooter}>
              <Pressable
                onPress={() => setRejectingProperty(null)}
                disabled={rejecting}
                style={[s.modalCancel, { borderColor: colors.border, opacity: rejecting ? 0.5 : 1 }]}
              >
                <Text style={[s.modalCancelText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitReject}
                disabled={rejecting}
                style={[s.modalSave, { backgroundColor: '#dc2626', opacity: rejecting ? 0.6 : 1 }]}
              >
                {rejecting ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="x" size={15} color="#fff" />}
                <Text style={[s.modalSaveText, { color: '#fff' }]}>{rejecting ? 'Rejecting…' : 'Reject Listing'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!reviewingProperty}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewingProperty(null)}
      >
        <View style={s.modalBackdrop}>
          <View style={[s.reviewSheet, { backgroundColor: colors.background }]}>
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalTitle, { color: colors.foreground }]}>Listing Review</Text>
                <Text style={[s.modalSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {reviewingProperty?.title}
                </Text>
              </View>
              <Pressable onPress={() => setReviewingProperty(null)} hitSlop={10}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {reviewLoading ? (
              <ActivityIndicator size="large" color={GOLD} style={{ marginVertical: 60 }} />
            ) : reviewError ? (
              <View style={s.empty}>
                <Feather name="wifi-off" size={34} color="#dc2626" />
                <Text style={[s.emptyText, { color: colors.foreground }]}>{reviewError}</Text>
              </View>
            ) : reviewData ? (
              <ScrollView contentContainerStyle={s.reviewBody} showsVerticalScrollIndicator={false}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.reviewImages}>
                  {(reviewData.property.images ?? []).map((uri, index) => (
                    <Image key={`${uri}-${index}`} source={{ uri }} style={s.reviewImage} resizeMode="cover" />
                  ))}
                </ScrollView>
                <View style={s.reviewGrid}>
                  {[
                    ['Status', reviewData.property.approvalStatus ?? 'Pending'],
                    ['Type', reviewData.property.type],
                    ['Purpose', reviewData.property.status],
                    ['Price', `PKR ${Number(reviewData.property.price || 0).toLocaleString()}`],
                    ['Area', `${reviewData.property.area ?? 0} ${reviewData.property.areaUnit ?? ''}`],
                    ['Location', [
                      reviewData.property.location?.address || reviewData.property.address,
                      reviewData.property.location?.city || reviewData.property.city,
                    ].filter(Boolean).join(', ')],
                    ['Exact pin', getPropertyCoordinates(reviewData.property)
                      ? formatPropertyCoordinates(getPropertyCoordinates(reviewData.property)!)
                      : 'Not submitted'],
                  ].map(([label, value]) => (
                    <View key={label} style={s.reviewRow}>
                      <Text style={[s.reviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
                      <Text style={[s.reviewValue, { color: colors.foreground }]}>{value || 'Not provided'}</Text>
                    </View>
                  ))}
                </View>
                {getPropertyCoordinates(reviewData.property) ? (
                  <Pressable
                    style={[s.locBtn, { borderColor: GOLD, alignSelf: 'flex-start', marginTop: 12 }]}
                    onPress={() => openInMaps(reviewData.property)}
                  >
                    <Feather name="map" size={13} color={GOLD} />
                    <Text style={[s.locBtnText, { color: GOLD }]}>Open exact pin in Maps</Text>
                  </Pressable>
                ) : null}
                <Text style={[s.reviewSectionTitle, { color: colors.foreground }]}>Description</Text>
                <Text style={[s.reviewDescription, { color: colors.mutedForeground }]}>
                  {reviewData.property.description || 'No description provided.'}
                </Text>
                <Text style={[s.reviewSectionTitle, { color: colors.foreground }]}>Seller</Text>
                <Text style={[s.reviewDescription, { color: colors.mutedForeground }]}>
                  {reviewData.seller
                    ? [reviewData.seller.name, reviewData.seller.email, reviewData.seller.phone].filter(Boolean).join(' · ')
                    : 'Seller information unavailable.'}
                </Text>
                <Text style={[s.reviewAudit, { color: colors.mutedForeground }]}>
                  {reviewData.audit?.length ?? 0} review events recorded
                </Text>
              </ScrollView>
            ) : null}
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
  demoCard:    { borderRadius: 14, borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  demoThumb:   { width: 64, height: 64, borderRadius: 10 },
  demoInfo:    { flex: 1, minWidth: 0 },
  demoStatus:  { fontFamily: 'Inter_600SemiBold', fontSize: 10, marginTop: 3 },
  demoAction:  { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 9, paddingHorizontal: 9 },
  demoActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  demoHeader:  { gap: 10, marginBottom: 4 },
  demoDescription: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  removeAllDemos: { alignSelf: 'flex-start', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#dc262640', borderRadius: 10, paddingHorizontal: 12 },
  removeAllDemosText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#dc2626' },
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
  locBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, minHeight: 36 },
  locBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  actions:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, minHeight: 36 },
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
  modalCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, paddingVertical: 8, minHeight: 36 },
  modalCancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  modalSave: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, paddingVertical: 8, minHeight: 40 },
  modalSaveText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0B1F3A' },
  rejectSheet: { margin: 20, borderRadius: 18, padding: 18 },
  rejectInput: { minHeight: 110, borderWidth: 1, borderRadius: 11, padding: 12, marginTop: 16, fontFamily: 'Inter_400Regular', fontSize: 14 },
  reviewSheet: { maxHeight: '92%', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  reviewBody: { padding: 18, paddingBottom: 28 },
  reviewImages: { gap: 8, paddingBottom: 16 },
  reviewImage: { width: 138, height: 96, borderRadius: 10, backgroundColor: '#dfe5eb' },
  reviewGrid: { gap: 1, marginBottom: 18 },
  reviewRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#0B1F3A12' },
  reviewLabel: { width: 76, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  reviewValue: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12 },
  reviewSectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 8, marginBottom: 6 },
  reviewDescription: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  reviewAudit: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 18 },
});
