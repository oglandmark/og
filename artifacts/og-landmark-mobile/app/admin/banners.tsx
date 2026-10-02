import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import { BannerSlide, createBanner, deleteBanner, getAdminBanners, toggleBanner } from '@/lib/api';

const CATEGORIES = ['homes', 'commercial', 'agriculture', 'plots', 'projects'] as const;
type BannerCategory = typeof CATEGORIES[number];

export default function AdminBannersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [banners, setBanners] = useState<BannerSlide[]>([]);
  const [category, setCategory] = useState<BannerCategory>('homes');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getAdminBanners();
      setBanners(Array.isArray(rows) ? rows : []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load banners.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveBanner() {
    if (!title.trim() || !imageUrl.trim()) {
      setError('Add a title and image URL before saving.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createBanner({
        category,
        title: title.trim(),
        subtitle: subtitle.trim(),
        imageUrl: imageUrl.trim(),
      });
      setTitle('');
      setSubtitle('');
      setImageUrl('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this banner.');
    } finally {
      setSaving(false);
    }
  }

  async function changeActive(banner: BannerSlide) {
    try {
      await toggleBanner(banner.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change banner visibility.');
    }
  }

  function confirmDelete(banner: BannerSlide) {
    Alert.alert('Delete banner?', `Remove “${banner.title}” from the mobile app?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBanner(banner.id);
            await load();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not delete this banner.');
          }
        },
      },
    ]);
  }

  const topInset = Platform.OS === 'web' ? Math.max(67, insets.top) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.action, paddingTop: topInset + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="admin-banners-back"
          onPress={() => router.back()}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={20} color={colors.actionForeground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.actionForeground }]}>Mobile Home Banners</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={50}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}
      >
        <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Update an image category</Text>
          <Text style={[styles.help, { color: colors.mutedForeground }]}>
            Saving replaces the current image banner for the selected category.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
            {CATEGORIES.map((item) => {
              const selected = item === category;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  testID={`admin-banner-category-${item}`}
                  onPress={() => setCategory(item)}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: selected ? colors.action : colors.background, borderColor: colors.border },
                  ]}
                >
                  <Text style={{ color: selected ? colors.actionForeground : colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' }}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <TextInput
            testID="admin-banner-title"
            accessibilityLabel="Banner title"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Banner title"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <TextInput
            testID="admin-banner-subtitle"
            accessibilityLabel="Banner subtitle"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Subtitle (optional)"
            placeholderTextColor={colors.mutedForeground}
            value={subtitle}
            onChangeText={setSubtitle}
            maxLength={180}
          />
          <TextInput
            testID="admin-banner-image-url"
            accessibilityLabel="Banner image URL"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Image URL"
            placeholderTextColor={colors.mutedForeground}
            value={imageUrl}
            onChangeText={setImageUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            testID="admin-banner-save"
            onPress={() => { void saveBanner(); }}
            disabled={saving || loading}
            style={[styles.saveButton, { backgroundColor: colors.action, opacity: saving || loading ? 0.65 : 1 }]}
          >
            {saving ? <ActivityIndicator size="small" color={colors.actionForeground} /> : <Feather name="save" size={16} color={colors.actionForeground} />}
            <Text style={{ color: colors.actionForeground, fontFamily: 'Inter_600SemiBold' }}>Save banner</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, styles.listTitle, { color: colors.foreground }]}>All banners</Text>
        {loading ? (
          <ActivityIndicator size="large" color={colors.action} style={{ marginTop: 24 }} />
        ) : banners.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.mutedForeground }}>No banners found.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {banners.map((banner) => (
              <View key={banner.id} style={[styles.bannerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.bannerCopy}>
                  <Text style={[styles.bannerTitle, { color: colors.foreground }]} numberOfLines={2}>{banner.title}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, textTransform: 'capitalize' }}>
                    {banner.category || banner.type} · {banner.active ? 'Visible' : 'Hidden'}
                  </Text>
                  {banner.imageUrl ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={1}>{banner.imageUrl}</Text> : null}
                </View>
                <View style={styles.bannerActions}>
                  <Pressable
                    accessibilityRole="button"
                    testID={`admin-banner-toggle-${banner.id}`}
                    accessibilityLabel={banner.active ? 'Hide banner' : 'Show banner'}
                    onPress={() => { void changeActive(banner); }}
                    hitSlop={8}
                  >
                    <Feather name={banner.active ? 'eye-off' : 'eye'} size={19} color={colors.action} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    testID={`admin-banner-delete-${banner.id}`}
                    accessibilityLabel="Delete banner"
                    onPress={() => confirmDelete(banner)}
                    hitSlop={8}
                  >
                    <Feather name="trash-2" size={19} color={colors.destructive} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 14 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  form: { margin: 16, padding: 16, borderWidth: 1, borderRadius: 14, gap: 12 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  help: { fontSize: 12, lineHeight: 18 },
  categories: { gap: 8 },
  categoryChip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  saveButton: { minHeight: 46, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  listTitle: { marginHorizontal: 16, marginTop: 8, marginBottom: 12 },
  list: { paddingHorizontal: 16, gap: 10 },
  bannerCard: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerCopy: { flex: 1, gap: 6 },
  bannerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  bannerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  emptyCard: { marginHorizontal: 16, padding: 24, borderWidth: 1, borderRadius: 14, alignItems: 'center' },
});