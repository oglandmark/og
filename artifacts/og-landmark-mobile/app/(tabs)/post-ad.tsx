import React, { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
// BlurView removed — crashes Android GPU
import { useColors } from '@/hooks/useColors';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { BrandMark } from '@/components/BrandMark';
import { okaraDistrict } from '@/lib/cities';
import { useAuth } from '@/context/AuthContext';
import { addUserListing } from '@/lib/listingsStore';
import { uploadImage, uploadVideo } from '@/lib/api';
import { LocationPicker } from '@/components/LocationPicker';
import type { LocationData } from '@/lib/locationService';

// ─── Types & Constants ─────────────────────────────────────────────────────────

type PropertyType = 'House' | 'Apartment' | 'Plot' | 'Commercial' | 'Agriculture Land';
type SizeUnit = 'Acres' | 'Kanal' | 'Marla';
type SoilType = 'Clay' | 'Loam' | 'Sandy' | 'Silty' | 'Mixed';

const PROPERTY_TYPES: { key: PropertyType; icon: keyof typeof Feather.glyphMap; labelEn: string }[] = [
  { key: 'House', icon: 'home', labelEn: 'House' },
  { key: 'Apartment', icon: 'layers', labelEn: 'Apartment' },
  { key: 'Plot', icon: 'map-pin', labelEn: 'Plot' },
  { key: 'Commercial', icon: 'briefcase', labelEn: 'Commercial' },
  { key: 'Agriculture Land', icon: 'map', labelEn: '🌾 Agri Land' },
];

const CROPS = ['Cotton', 'Sugarcane', 'Wheat', 'Rice', 'Maize', 'Mixed Farming'];
const SOIL_TYPES: { key: SoilType; desc: string }[] = [
  { key: 'Clay', desc: 'Heavy, water-retaining' },
  { key: 'Loam', desc: 'Best for most crops' },
  { key: 'Sandy', desc: 'Light, fast-draining' },
  { key: 'Silty', desc: 'Fertile, smooth texture' },
  { key: 'Mixed', desc: 'Combined soil types' },
];
const AGRI_SIZE_UNITS: SizeUnit[] = ['Acres', 'Kanal', 'Marla'];

const CATEGORIES = ['Residential', 'Agricultural', 'Commercial', 'Industrial'] as const;
type Category = (typeof CATEGORIES)[number];

const TYPES_BY_CATEGORY: Record<Category, string[]> = {
  Residential:  ['House', 'Apartment', 'Villa', 'Plot', 'Upper Portion', 'Lower Portion', 'Farm House'],
  Agricultural: ['Agriculture Land', 'Farm House', 'Orchard', 'Dairy Farm', 'Irrigated Land'],
  Commercial:   ['Shop', 'Office', 'Plaza', 'Warehouse', 'Showroom', 'Building'],
  Industrial:   ['Industrial Plot', 'Factory', 'Warehouse', 'Industrial Building', 'Industrial Land'],
};

const INDUSTRIAL_COLOR = '#374151';

const STATUSES = ['For Sale', 'For Rent'] as const;
const AREA_UNITS = ['Marla', 'Kanal', 'Acre', 'Sq. Ft.'] as const;
const BUYER_TYPES = ['House', 'Apartment', 'Plot', 'Commercial', 'Agriculture Land'] as const;
const CITIES = okaraDistrict.cities;

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function PostAdScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, user } = useAuth();

  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  if (!isLoggedIn) {
    return <NotLoggedInPrompt colors={colors} topInset={topInset} insets={insets} router={router} />;
  }

  return <SelectionScreen colors={colors} topInset={topInset} insets={insets} router={router} />;
}

// ─── Selection Screen ───────────────────────────────────────────────────────────

const POST_OPTIONS = [
  {
    id: 'sale',
    icon: 'home' as const,
    title: 'Property for Sale',
    description: 'List a property for sale and connect with genuine buyers.',
    accent: '#0f4c81',
    route: (router: any) => router.push('/post/listing?purpose=sale'),
  },
  {
    id: 'rent',
    icon: 'key' as const,
    title: 'Property for Rent',
    description: 'Advertise your property for rent and receive inquiries.',
    accent: '#1a6b3a',
    route: (router: any) => router.push('/post/listing?purpose=rent'),
  },
  {
    id: 'buyer',
    icon: 'search' as const,
    title: 'Buyer Request',
    description: 'Tell agents and sellers what property you are looking for.',
    accent: '#8b6c2a',
    route: (router: any) => router.push('/post/buyer-request'),
  },
  {
    id: 'service',
    icon: 'briefcase' as const,
    title: 'Professional Service',
    description: 'Promote your real estate service or professional profile.',
    accent: '#374151',
    route: (router: any) => router.push('/(tabs)/profile'),
  },
] as const;

function SelectionScreen({ colors, topInset, router }: any) {
  const tabBarHeight = useTabBarHeight();
  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: tabBarHeight, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <AnimatedReveal>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>OG LANDMARK</Text>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>What would you{'\n'}like to post?</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Choose what you want to publish on OG Landmark.
        </Text>
      </AnimatedReveal>

      {POST_OPTIONS.map((opt, i) => (
        <AnimatedReveal key={opt.id} delay={80 + i * 60} distance={16}>
          <AnimatedPressable
            onPress={() => opt.route(router)}
            style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.postIconWrap, { backgroundColor: opt.accent + '18', borderColor: opt.accent + '33' }]}>
              <Feather name={opt.icon} size={26} color={opt.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.postTitle, { color: colors.foreground }]}>{opt.title}</Text>
              <Text style={[styles.postDesc, { color: colors.mutedForeground }]}>{opt.description}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </AnimatedPressable>
        </AnimatedReveal>
      ))}

      <AnimatedReveal delay={380} distance={8}>
        <View style={[styles.selectionHint, { backgroundColor: colors.accent, borderColor: colors.border }]}>
          <Feather name="shield" size={13} color={colors.accentForeground} />
          <Text style={[styles.selectionHintText, { color: colors.accentForeground }]}>
            All property listings are reviewed by the OG Landmark team before going live.
          </Text>
        </View>
      </AnimatedReveal>
    </ScrollView>
  );
}

// ─── Not logged in ─────────────────────────────────────────────────────────────

function NotLoggedInPrompt({ colors, topInset, insets, router }: any) {
  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: topInset + 16, paddingBottom: insets.bottom + 100 }]}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>SELL OR RENT</Text>
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>Post an Ad</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Reach verified buyers and tenants looking for their next place.
      </Text>

      <View style={[styles.loginCard, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
        <View style={[styles.loginIconWrap, { backgroundColor: colors.goldGlass, borderColor: colors.goldGlassBorder }]}>
          <Feather name="user" size={22} color={colors.goldForeground} />
        </View>
        <Text style={[styles.loginCardTitle, { color: colors.foreground }]}>Seller account required</Text>
        <Text style={[styles.loginCardBody, { color: colors.mutedForeground }]}>
          Log in or create a free account to list your property and reach thousands of verified buyers.
        </Text>
        <AnimatedPressable
          onPress={() => router.push({ pathname: '/(auth)/login', params: { from: 'post-ad' } })}
          style={[styles.submit, { backgroundColor: colors.action }]}
        >
          <Text style={styles.submitText}>Log In / Sign Up</Text>
          <Feather name="arrow-up-right" size={18} color={colors.actionForeground} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

// ─── Agent Form ────────────────────────────────────────────────────────────────

function AgentForm({ colors, topInset, user, router }: any) {
  const tabBarHeight = useTabBarHeight();
  const { isRTL } = useLanguage();
  const rtl = isRTL ? 'right' as const : 'left' as const;

  // Shared state
  const [category, setCategory] = useState<Category>('Residential');
  const [propType, setPropType] = useState('House');
  const [status, setStatus] = useState<'For Sale' | 'For Rent'>('For Sale');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Standard fields
  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState<'Marla' | 'Kanal' | 'Acre' | 'Sq. Ft.'>('Marla');
  const [city, setCity] = useState('Okara');
  const [neighborhood, setNeighborhood] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');

  // Industrial-specific fields
  const [gasConnection,  setGasConnection]  = useState<boolean | null>(null);
  const [loadingAccess,  setLoadingAccess]  = useState<boolean | null>(null);
  const [electricityKVA, setElectricityKVA] = useState('');
  const [industrialZone, setIndustrialZone] = useState('');
  const [roadFrontage,   setRoadFrontage]   = useState('');
  const [coveredArea,    setCoveredArea]    = useState('');

  // Agricultural-specific fields
  const [agriSize, setAgriSize] = useState('');
  const [agriUnit, setAgriUnit] = useState<SizeUnit>('Acres');
  const [nehriWater, setNehriWater] = useState<boolean | null>(null);
  const [tubeWell, setTubeWell] = useState<boolean | null>(null);
  const [soilType, setSoilType] = useState<SoilType | null>(null);
  const [mainCrop, setMainCrop] = useState('');
  const [village, setVillage] = useState('');
  const [tehsil, setTehsil] = useState('');
  const [unionCouncil, setUnionCouncil] = useState('');
  const [gpsBoundary, setGpsBoundary] = useState('');
  const [showVillages, setShowVillages] = useState(false);
  const [latitude,  setLatitude]  = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  // ── Media state ──
  const [photos, setPhotos] = useState<string[]>([]);
  const [video, setVideo] = useState<{ uri: string; duration?: number; filename?: string } | null>(null);

  const pickPhotos = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to add photos to your listing.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.82,
      selectionLimit: 10,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 10));
    }
  };

  const pickVideo = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to add a video.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      videoMaxDuration: 120,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setVideo({
        uri: asset.uri,
        duration: asset.duration ?? undefined,
        filename: asset.fileName ?? 'property-video.mp4',
      });
    }
  };


  const isAgri = category === 'Agricultural';
  const isIndustrial = category === 'Industrial';
  const isResidential = category === 'Residential';
  const types = TYPES_BY_CATEGORY[category];
  const neighborhoods = okaraDistrict.areas[city] ?? [];

  const handleCategoryChange = (c: Category) => {
    setCategory(c);
    setPropType(TYPES_BY_CATEGORY[c][0]);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!price.trim() || isNaN(Number(price.replace(/[^0-9]/g, '')))) e.price = 'Valid price is required';
    if (isAgri) {
      if (!agriSize.trim() || isNaN(Number(agriSize))) e.area = 'Land size is required';
    } else {
      if (!area.trim() || isNaN(Number(area))) e.area = 'Area is required';
    }
    if (!description.trim() || description.trim().length < 10) e.description = 'Add a short description (at least 10 characters)';
    if (latitude == null || longitude == null) {
      e.location = 'Set the exact property pin using search, GPS, the map, or coordinates';
    } else if (!locationConfirmed) {
      e.location = 'Confirm the exact property pin before publishing';
    }
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);

    const locationCity = isAgri ? (tehsil || 'Okara') : city;
    const locationNeighborhood = isAgri ? village : neighborhood;
    const addr = locationNeighborhood ? `${locationNeighborhood}, ${locationCity}` : locationCity;
    const finalArea = isAgri ? Number(agriSize) : Number(area);
    const finalUnit = isAgri ? agriUnit : areaUnit;
    const autoTitle = title.trim() ||
      (isAgri
        ? `${finalArea} ${finalUnit} ${propType} — ${locationCity}`
        : `${propType} ${status === 'For Sale' ? 'for Sale' : 'for Rent'} in ${addr}`);

    // ── Upload images & video to backend first ──────────────────────────────
    let uploadedImages: string[] = [];
    let uploadedVideoUrl: string | undefined;
    try {
      const imageUploads = await Promise.all(
        photos.map((uri, i) =>
          uploadImage(uri, `prop_${Date.now()}_${i}.jpg`).catch(() => null)
        )
      );
      uploadedImages = imageUploads.filter(Boolean).map((r) => r!.url);
    } catch { /* ignore — listing saved without images */ }

    if (video) {
      try {
        const vRes = await uploadVideo(video.uri, video.filename ?? 'property-video.mp4');
        uploadedVideoUrl = vRes.url;
      } catch { /* ignore — listing saved without video */ }
    }
    // ───────────────────────────────────────────────────────────────────────

    try {
      await addUserListing({
        id: `agent_${Date.now()}`,
        postedBy: user.id,
        agentName: user.name,
        role: 'agent',
        title: autoTitle,
        type: propType,
        category,
        status,
        price: Number(price.replace(/[^0-9]/g, '')),
        area: finalArea,
        areaUnit: finalUnit,
        city: locationCity,
        neighborhood: locationNeighborhood,
        description: description.trim(),
        bedrooms: isResidential ? Number(bedrooms) || 0 : 0,
        bathrooms: isResidential ? Number(bathrooms) || 0 : 0,
        postedAt: new Date().toISOString(),
        listingStatus: 'Pending',
        views: 0, saves: 0, leadsCount: 0,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
        videoUrl: uploadedVideoUrl,
        ...(latitude != null && longitude != null && { latitude, longitude }),
        fullAddress: selectedLocation?.fullAddress,
        placeId: selectedLocation?.placeId,
        locationAccuracy: selectedLocation?.accuracy,
        locationSource: selectedLocation?.locationSource,
        // agri extras
        ...(isAgri && {
          nehriWater,
          tubeWell,
          soilType,
          mainCrop,
          village,
          tehsil,
          unionCouncil,
          gpsBoundary,
        }),
        // industrial extras
        ...(isIndustrial && {
          gasConnection,
          loadingAccess,
          electricityKVA,
          industrialZone,
          roadFrontage,
          coveredArea,
        }),
      });

      Alert.alert(
        isAgri ? 'Listing Submitted!' : isIndustrial ? 'Listing Submitted!' : 'Listing Submitted!',
        'Your property has been submitted for admin review. It will appear on OG Landmark once approved. You can track its status in My Listings.',
        [{ text: 'My Listings', onPress: () => router.push('/(tabs)/listings') }],
      );
    } catch {
      Alert.alert('Error', 'Could not save listing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: topInset + 12, paddingBottom: tabBarHeight, paddingHorizontal: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <AnimatedReveal>
          <View style={styles.headerRow}>
            <BrandMark />
          </View>
          <Text style={[styles.eyebrow, { color: isAgri ? '#1a6b3a' : isIndustrial ? INDUSTRIAL_COLOR : colors.primary, textAlign: rtl }]}>
            {isAgri ? 'AGRICULTURAL LISTING' : isIndustrial ? 'INDUSTRIAL LISTING' : 'AGENT PORTAL'}
          </Text>
          <Text style={[styles.pageTitle, { color: colors.foreground, textAlign: rtl }]}>
            {isAgri ? 'Post Agricultural\nLand' : isIndustrial ? 'Post Industrial\nProperty' : 'Post a\nProperty'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: rtl }]}>
            {isAgri
              ? 'Reach farmers and investors looking for Okara District agricultural land'
              : isIndustrial
                ? 'List industrial plots, factories and warehouses across Okara District.'
                : 'List your property to reach verified buyers across Okara District.'}
          </Text>
        </AnimatedReveal>

        {/* Category (Residential / Agricultural / Commercial) */}
        <AnimatedReveal delay={60}>
          <Text style={[styles.label, { color: colors.foreground, textAlign: rtl }]}>Category</Text>
          <View style={styles.typeGrid}>
            {PROPERTY_TYPES.map((t) => {
              const sel = (
                (category === 'Agricultural' && t.key === 'Agriculture Land') ||
                (category === 'Residential' && ['House', 'Apartment', 'Plot'].includes(t.key) && propType === t.key) ||
                (category === 'Commercial' && t.key === 'Commercial')
              );
              // Use category pill rows instead of the grid for simplicity
              return null;
            })}
          </View>
          <View style={styles.pillRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => handleCategoryChange(c)}
                style={[styles.pill, {
                  borderColor: category === c
                    ? c === 'Agricultural' ? '#1a6b3a'
                    : c === 'Industrial' ? INDUSTRIAL_COLOR
                     : colors.selectionBorder
                    : colors.border,
                  backgroundColor: category === c
                    ? c === 'Agricultural' ? '#1a6b3a'
                    : c === 'Industrial' ? INDUSTRIAL_COLOR
                     : colors.selectionBackground
                    : colors.glassCard,
                }]}
              >
                 <Text style={[styles.pillText, { color: category === c ? colors.selectionForeground : colors.mutedForeground, fontWeight: category === c ? '600' : '400' }]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </AnimatedReveal>

        {/* Property type (scrollable chips) */}
        <AnimatedReveal delay={80}>
          <Text style={[styles.label, { color: colors.foreground, textAlign: rtl }]}>Property type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {types.map((t) => (
              <Pressable
                key={t}
                onPress={() => setPropType(t)}
                style={[styles.pill, {
                   borderColor: propType === t ? colors.selectionBorder : colors.border,
                   backgroundColor: propType === t ? colors.selectionBackground : colors.glassCard,
                }]}
              >
                 <Text style={[styles.pillText, { color: propType === t ? colors.selectionForeground : colors.mutedForeground, fontWeight: propType === t ? '600' : '400' }]}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </AnimatedReveal>

        {/* ─── AGRICULTURAL LAND FORM ─────────────────────────────────────── */}
        {isAgri ? (
          <>
            <AnimatedReveal delay={100}>
              <View style={[styles.agriNotice, { backgroundColor: '#1a6b3a14', borderColor: '#1a6b3a44' }]}>
                <Text style={styles.agriNoticeIcon}>🌾</Text>
                <Text style={[styles.agriNoticeText, { color: '#1a6b3a', textAlign: rtl }]}>
                  Specialized form for Okara District agricultural land. These details help farmers and investors find the right land.
                </Text>
              </View>
            </AnimatedReveal>

            {/* Ad title (optional) */}
            <AnimatedReveal delay={110}>
              <GlassField label="Listing Title (optional)" placeholder="e.g. 25 Acre Cotton Land — Depalpur" value={title} onChangeText={setTitle} colors={colors} rtl={isRTL} />
            </AnimatedReveal>

            {/* Land size */}
            <AnimatedReveal delay={120}>
              <Text style={[styles.label, { color: colors.foreground, textAlign: rtl }]}>Land Size</Text>
              <View style={styles.sizeRow}>
                <View style={[styles.sizeInputWrap, { borderColor: errors.area ? '#e53e3e' : colors.glassBorder }]}>
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
                  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
                  <TextInput value={agriSize} onChangeText={setAgriSize} placeholder="e.g. 25"
                    placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad"
                    style={[styles.sizeInput, { color: colors.foreground }]} />
                </View>
                <View style={styles.unitChips}>
                  {AGRI_SIZE_UNITS.map((u) => (
                    <Pressable key={u} onPress={() => setAgriUnit(u)}
                      style={[styles.unitChip, { borderColor: agriUnit === u ? '#1a6b3a' : colors.border, backgroundColor: agriUnit === u ? '#1a6b3a18' : 'transparent' }]}>
                      <Text style={[styles.unitChipText, { color: agriUnit === u ? '#1a6b3a' : colors.mutedForeground }]}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {agriSize && agriUnit === 'Acres' && (
                <Text style={[styles.sizeConvert, { color: colors.mutedForeground }]}>
                  = {(parseFloat(agriSize) * 8).toFixed(0)} Kanal · {(parseFloat(agriSize) * 160).toFixed(0)} Marla
                </Text>
              )}
              {agriSize && agriUnit === 'Kanal' && (
                <Text style={[styles.sizeConvert, { color: colors.mutedForeground }]}>
                  = {(parseFloat(agriSize) / 8).toFixed(2)} Acres · {(parseFloat(agriSize) * 20).toFixed(0)} Marla
                </Text>
              )}
              {errors.area ? <Text style={[styles.errorText, { color: '#e53e3e' }]}>{errors.area}</Text> : null}
            </AnimatedReveal>

            {/* Water Access */}
            <AnimatedReveal delay={140}>
              <SectionDivider label="WATER ACCESS" colors={colors} />
              <ToggleField label="Nehri (Canal) Water" subtitle="Government irrigation channel access"
                icon="droplet" value={nehriWater} onChange={setNehriWater} colors={colors} accentColor="#1a6b3a" />
              <ToggleField label="Tube Well" subtitle="Electric or diesel pump installed"
                icon="zap" value={tubeWell} onChange={setTubeWell} colors={colors} accentColor="#1a6b3a" />
            </AnimatedReveal>

            {/* Soil Type */}
            <AnimatedReveal delay={160}>
              <SectionDivider label="SOIL TYPE" colors={colors} />
              <View style={styles.soilGrid}>
                {SOIL_TYPES.map((s) => {
                  const sel = soilType === s.key;
                  return (
                    <Pressable key={s.key} onPress={() => setSoilType(s.key)}
                      style={[styles.soilCard, { borderColor: sel ? '#1a6b3a' : colors.border, backgroundColor: sel ? '#1a6b3a18' : colors.card }]}>
                      <Text style={[styles.soilName, { color: sel ? '#1a6b3a' : colors.foreground }]}>{s.key}</Text>
                      <Text style={[styles.soilDesc, { color: sel ? '#1a6b3acc' : colors.mutedForeground }]}>{s.desc}</Text>
                      {sel && <View style={styles.soilCheck}><Feather name="check" size={10} color="#1a6b3a" /></View>}
                    </Pressable>
                  );
                })}
              </View>
            </AnimatedReveal>

            {/* Main Crop */}
            <AnimatedReveal delay={180}>
              <SectionDivider label="MAIN CROP GROWN" colors={colors} />
              <View style={styles.chipGrid}>
                {CROPS.map((c) => {
                  const sel = mainCrop === c;
                  return (
                    <Pressable key={c} onPress={() => setMainCrop(c)}
                      style={[styles.cropChip, { borderColor: sel ? '#1a6b3a' : colors.border, backgroundColor: sel ? '#1a6b3a' : 'transparent' }]}>
                      <Text style={[styles.cropChipText, { color: sel ? '#ffffff' : colors.mutedForeground }]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </AnimatedReveal>

            {/* Location */}
            <AnimatedReveal delay={200}>
              <SectionDivider label="LOCATION (OKARA DISTRICT)" colors={colors} />

              <Text style={[styles.label, { color: colors.foreground, textAlign: rtl }]}>Tehsil</Text>
              <View style={styles.tehsilRow}>
                {okaraDistrict.tehsils.map((t) => (
                  <Pressable key={t} onPress={() => setTehsil(t)}
                    style={[styles.tehsilChip, { borderColor: tehsil === t ? '#1a6b3a' : colors.border, backgroundColor: tehsil === t ? '#1a6b3a18' : 'transparent' }]}>
                    <Text style={[styles.tehsilChipText, { color: tehsil === t ? '#1a6b3a' : colors.mutedForeground }]}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.foreground, textAlign: rtl, marginTop: 14 }]}>Village / Mauza</Text>
              <Pressable onPress={() => setShowVillages(!showVillages)}
                style={[styles.dropdownShell, { borderColor: colors.glassBorder }]}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
                <Text style={[styles.dropdownText, { color: village ? colors.foreground : colors.mutedForeground }]}>
                  {village || 'Select village or type a mauza name'}
                </Text>
                <Feather name={showVillages ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
              </Pressable>
              {showVillages && (
                <View style={[styles.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {okaraDistrict.villages.map((v) => (
                    <Pressable key={v} onPress={() => { setVillage(v); setShowVillages(false); }}
                      style={[styles.dropdownItem, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.dropdownItemText, { color: colors.foreground }]}>{v}</Text>
                      {village === v && <Feather name="check" size={13} color="#1a6b3a" />}
                    </Pressable>
                  ))}
                </View>
              )}

              <GlassField label="Union Council (Optional)" placeholder="e.g. UC Depalpur-1" value={unionCouncil} onChangeText={setUnionCouncil} colors={colors} rtl={isRTL} />

              <LocationPicker
                latitude={latitude}
                longitude={longitude}
                address={selectedLocation?.fullAddress}
                onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); setGpsBoundary(`${lat}, ${lng}`); }}
                onLocationChange={setSelectedLocation}
                onClear={() => {
                  setLatitude(null); setLongitude(null); setGpsBoundary('');
                  setSelectedLocation(null); setLocationConfirmed(false);
                }}
                colors={colors}
                accentColor="#1a6b3a"
                requireConfirm
                onConfirmationChange={setLocationConfirmed}
                errorMessage={errors.location}
              />
            </AnimatedReveal>

            {/* Price */}
            <AnimatedReveal delay={220}>
              <SectionDivider label="PRICING" colors={colors} />
              <GlassField label="Expected Price (PKR)" placeholder="e.g. 35000000" value={price} onChangeText={setPrice} keyboardType="numeric" colors={colors} rtl={isRTL} />
              {errors.price ? <Text style={[styles.errorText, { color: '#e53e3e', marginTop: -10 }]}>{errors.price}</Text> : null}
            </AnimatedReveal>

            {/* Description */}
            <AnimatedReveal delay={240}>
              <Text style={[styles.label, { color: colors.foreground, textAlign: rtl }]}>Description</Text>
              <View style={[styles.textAreaShell, { borderColor: errors.description ? '#e53e3e' : colors.glassBorder }]}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
                <TextInput value={description} onChangeText={setDescription}
                  placeholder="Describe the land — soil condition, water availability, crop history, access road, electricity..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline numberOfLines={4} textAlignVertical="top" textAlign={rtl}
                  style={[styles.textArea, { color: colors.foreground }]} />
              </View>
              {errors.description ? <Text style={[styles.errorText, { color: '#e53e3e' }]}>{errors.description}</Text> : null}
            </AnimatedReveal>

            {/* Photos + Video */}
            <AnimatedReveal delay={260}>
              <MediaPicker
                photos={photos}
                video={video}
                onPickPhotos={pickPhotos}
                onRemovePhoto={(i) => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                onPickVideo={pickVideo}
                onRemoveVideo={() => setVideo(null)}
                colors={colors}
                accentColor="#1a6b3a"
                photoHint="Boundary, water channel, soil, access road"
              />
            </AnimatedReveal>

            {/* Submit */}
            <AnimatedReveal delay={280}>
              <AnimatedPressable onPress={submit}
                style={[styles.submit, { backgroundColor: '#1a6b3a', opacity: submitting ? 0.7 : 1 }]}>
                <Text style={styles.submitText}>{submitting ? 'Posting…' : 'Post Agricultural Listing'}</Text>
                <Feather name="arrow-up-right" size={18} color="#ffffff" />
              </AnimatedPressable>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Your listing will appear in the Listings tab and on the home feed immediately.
              </Text>
            </AnimatedReveal>
          </>
        ) : isIndustrial ? (
          /* ─── INDUSTRIAL PROPERTY FORM ──────────────────────────────────── */
          <>
            <AnimatedReveal delay={100}>
              <View style={[styles.agriNotice, { backgroundColor: `${INDUSTRIAL_COLOR}14`, borderColor: `${INDUSTRIAL_COLOR}44` }]}>
                <Text style={styles.agriNoticeIcon}>🏭</Text>
                <Text style={[styles.agriNoticeText, { color: INDUSTRIAL_COLOR, textAlign: rtl }]}>
                  Industrial listing form — for plots, factories, warehouses and industrial buildings in Okara District.
                </Text>
              </View>
            </AnimatedReveal>

            {/* Listing type */}
            <AnimatedReveal delay={102}>
              <Text style={[styles.label, { color: colors.foreground, marginTop: 18 }]}>Listing type</Text>
              <View style={styles.pillRow}>
                {STATUSES.map((s) => (
                  <Pressable key={s} onPress={() => setStatus(s)}
                     style={[styles.pill, { borderColor: status === s ? colors.selectionBorder : colors.border, backgroundColor: status === s ? colors.selectionBackground : colors.glassCard }]}>
                     <Text style={[styles.pillText, { color: status === s ? colors.selectionForeground : colors.mutedForeground, fontWeight: status === s ? '600' : '400' }]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </AnimatedReveal>

            {/* Title */}
            <AnimatedReveal delay={108}>
              <GlassField label="Listing Title (optional)" placeholder={`e.g. 10 Kanal ${propType} — GT Road Okara`} value={title} onChangeText={setTitle} colors={colors} rtl={isRTL} />
            </AnimatedReveal>

            {/* Area */}
            <AnimatedReveal delay={115}>
              <Text style={[styles.label, { color: colors.foreground }]}>Plot / Land Area</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                <View style={[styles.inputShell, { flex: 1, borderColor: errors.area ? '#e53e3e' : colors.glassBorder }]}>
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
                  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
                  <TextInput value={area} onChangeText={setArea} placeholder="e.g. 10"
                    placeholderTextColor={colors.mutedForeground} keyboardType="numeric"
                    style={[styles.input, { color: colors.foreground }]} />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
                  {AREA_UNITS.map((u) => (
                    <Pressable key={u} onPress={() => setAreaUnit(u as any)}
                       style={[styles.pill, { borderColor: areaUnit === u ? colors.selectionBorder : colors.border, backgroundColor: areaUnit === u ? colors.selectionBackground : colors.glassCard }]}>
                       <Text style={[styles.pillText, { color: areaUnit === u ? colors.selectionForeground : colors.mutedForeground, fontWeight: areaUnit === u ? '600' : '400' }]}>{u}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              {errors.area ? <Text style={[styles.errorText, { color: '#e53e3e', marginTop: -14 }]}>{errors.area}</Text> : null}
            </AnimatedReveal>

            {/* Covered area */}
            <AnimatedReveal delay={120}>
              <GlassField label="Covered / Built-up Area (optional)" placeholder="e.g. 5 Kanal or 22,000 sq ft" value={coveredArea} onChangeText={setCoveredArea} colors={colors} rtl={isRTL} />
            </AnimatedReveal>

            {/* City */}
            <AnimatedReveal delay={125}>
              <Text style={[styles.label, { color: colors.foreground }]}>City</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {CITIES.map((c) => (
                  <Pressable key={c} onPress={() => { setCity(c); setNeighborhood(''); }}
                     style={[styles.pill, { borderColor: city === c ? colors.selectionBorder : colors.border, backgroundColor: city === c ? colors.selectionBackground : colors.glassCard }]}>
                     <Text style={[styles.pillText, { color: city === c ? colors.selectionForeground : colors.mutedForeground, fontWeight: city === c ? '600' : '400' }]}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </AnimatedReveal>

            {/* Industrial details */}
            <AnimatedReveal delay={135}>
              <SectionDivider label="INDUSTRIAL UTILITIES" colors={colors} />
              <ToggleField label="Gas Connection" subtitle="Sui gas or compressed gas available"
                icon="wind" value={gasConnection} onChange={setGasConnection} colors={colors} accentColor={INDUSTRIAL_COLOR} />
              <ToggleField label="Loading / Unloading Access" subtitle="Heavy truck and lorry access road"
                icon="truck" value={loadingAccess} onChange={setLoadingAccess} colors={colors} accentColor={INDUSTRIAL_COLOR} />
            </AnimatedReveal>

            <AnimatedReveal delay={145}>
              <GlassField label="Electricity Capacity (optional)" placeholder="e.g. 100 KVA, 3-phase" value={electricityKVA} onChangeText={setElectricityKVA} colors={colors} rtl={isRTL} />
              <GlassField label="Road Frontage (optional)" placeholder="e.g. 60 ft on GT Road" value={roadFrontage} onChangeText={setRoadFrontage} colors={colors} rtl={isRTL} />
              <GlassField label="Industrial Zone (optional)" placeholder="e.g. GT Road Industrial Zone" value={industrialZone} onChangeText={setIndustrialZone} colors={colors} rtl={isRTL} />
            </AnimatedReveal>

            {/* Location pin */}
            <AnimatedReveal delay={155}>
              <LocationPicker
                latitude={latitude}
                longitude={longitude}
                address={selectedLocation?.fullAddress}
                onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }}
                onLocationChange={setSelectedLocation}
                onClear={() => {
                  setLatitude(null); setLongitude(null);
                  setSelectedLocation(null); setLocationConfirmed(false);
                }}
                colors={colors}
                accentColor={INDUSTRIAL_COLOR}
                requireConfirm
                onConfirmationChange={setLocationConfirmed}
                errorMessage={errors.location}
              />
            </AnimatedReveal>

            {/* Price */}
            <AnimatedReveal delay={165}>
              <SectionDivider label="PRICING" colors={colors} />
              <Field label={`Price (PKR)${status === 'For Rent' ? ' per month' : ''}`} placeholder="e.g. 18000000" keyboardType="numeric" value={price} onChangeText={setPrice} error={errors.price} colors={colors} />
            </AnimatedReveal>

            {/* Description */}
            <AnimatedReveal delay={175}>
              <Field label="Description" placeholder="Describe the property: access road, utilities, zone, surroundings, existing structures…"
                value={description} onChangeText={setDescription} multiline error={errors.description} colors={colors} />
            </AnimatedReveal>

            {/* Photos + Video */}
            <AnimatedReveal delay={190}>
              <MediaPicker photos={photos} video={video}
                onPickPhotos={pickPhotos} onRemovePhoto={(i) => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                onPickVideo={pickVideo} onRemoveVideo={() => setVideo(null)}
                colors={colors} accentColor={INDUSTRIAL_COLOR} photoHint="Boundary, road, structures, utilities" />
            </AnimatedReveal>

            {/* Submit */}
            <AnimatedReveal delay={210}>
              <AnimatedPressable onPress={submit}
                style={[styles.submit, { backgroundColor: INDUSTRIAL_COLOR, opacity: submitting ? 0.7 : 1 }]}>
                <Text style={styles.submitText}>{submitting ? 'Posting…' : 'Post Industrial Listing'}</Text>
                <Feather name="arrow-up-right" size={18} color="#ffffff" />
              </AnimatedPressable>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Your listing will appear in Industrial search results immediately.
              </Text>
            </AnimatedReveal>
          </>
        ) : (
          /* ─── STANDARD PROPERTY FORM ─────────────────────────────────────── */
          <>
            {/* Status */}
            <AnimatedReveal delay={100}>
              <Text style={[styles.label, { color: colors.foreground, marginTop: 18 }]}>Listing type</Text>
              <View style={styles.pillRow}>
                {STATUSES.map((s) => (
                  <Pressable key={s} onPress={() => setStatus(s)}
                     style={[styles.pill, { borderColor: status === s ? colors.selectionBorder : colors.border, backgroundColor: status === s ? colors.selectionBackground : colors.glassCard }]}>
                     <Text style={[styles.pillText, { color: status === s ? colors.selectionForeground : colors.mutedForeground, fontWeight: status === s ? '600' : '400' }]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </AnimatedReveal>

            {/* Title (optional) */}
            <AnimatedReveal delay={110}>
              <Field label="Ad title (optional)"
                placeholder={`e.g. ${TYPES_BY_CATEGORY[category][0]} in Satellite Town`}
                value={title} onChangeText={setTitle} colors={colors} />
            </AnimatedReveal>

            {/* Price */}
            <AnimatedReveal delay={120}>
              <Field label={`Price (PKR)${status === 'For Rent' ? ' per month' : ''}`}
                placeholder="e.g. 8500000" keyboardType="numeric"
                value={price} onChangeText={setPrice} error={errors.price} colors={colors} />
            </AnimatedReveal>

            {/* Area */}
            <AnimatedReveal delay={130}>
              <Text style={[styles.label, { color: colors.foreground }]}>Area</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                <View style={[styles.inputShell, { flex: 1, borderColor: errors.area ? '#e53e3e' : colors.glassBorder }]}>
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
                  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
                  <TextInput value={area} onChangeText={setArea} placeholder="e.g. 10"
                    placeholderTextColor={colors.mutedForeground} keyboardType="numeric"
                    style={[styles.input, { color: colors.foreground }]} />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
                  {AREA_UNITS.map((u) => (
                    <Pressable key={u} onPress={() => setAreaUnit(u as any)}
                       style={[styles.pill, { borderColor: areaUnit === u ? colors.selectionBorder : colors.border, backgroundColor: areaUnit === u ? colors.selectionBackground : colors.glassCard }]}>
                       <Text style={[styles.pillText, { color: areaUnit === u ? colors.selectionForeground : colors.mutedForeground, fontWeight: areaUnit === u ? '600' : '400' }]}>{u}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              {errors.area ? <Text style={[styles.errorText, { color: '#e53e3e', marginTop: -14 }]}>{errors.area}</Text> : null}
            </AnimatedReveal>

            {/* City */}
            <AnimatedReveal delay={140}>
              <Text style={[styles.label, { color: colors.foreground }]}>City</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {CITIES.map((c) => (
                  <Pressable key={c} onPress={() => { setCity(c); setNeighborhood(''); }}
                     style={[styles.pill, { borderColor: city === c ? colors.selectionBorder : colors.border, backgroundColor: city === c ? colors.selectionBackground : colors.glassCard }]}>
                     <Text style={[styles.pillText, { color: city === c ? colors.selectionForeground : colors.mutedForeground, fontWeight: city === c ? '600' : '400' }]}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </AnimatedReveal>

            {/* Neighborhood */}
            {neighborhoods.length > 0 && (
              <AnimatedReveal delay={150}>
                <Text style={[styles.label, { color: colors.foreground, marginTop: 18 }]}>Area / Neighborhood</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  {neighborhoods.map((a) => (
                    <Pressable key={a} onPress={() => setNeighborhood(a)}
                       style={[styles.pill, { borderColor: neighborhood === a ? colors.selectionBorder : colors.border, backgroundColor: neighborhood === a ? colors.selectionBackground : colors.glassCard }]}>
                       <Text style={[styles.pillText, { color: neighborhood === a ? colors.selectionForeground : colors.mutedForeground, fontWeight: neighborhood === a ? '600' : '400' }]}>{a}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </AnimatedReveal>
            )}

            {/* Bedrooms / Bathrooms (residential only) */}
            {isResidential && (
              <AnimatedReveal delay={160}>
                <View style={styles.rowFields}>
                  <View style={{ flex: 1 }}>
                    <Field label="Bedrooms" placeholder="e.g. 3" keyboardType="numeric" value={bedrooms} onChangeText={setBedrooms} colors={colors} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Bathrooms" placeholder="e.g. 2" keyboardType="numeric" value={bathrooms} onChangeText={setBathrooms} colors={colors} />
                  </View>
                </View>
              </AnimatedReveal>
            )}

            {/* Location pin */}
            <AnimatedReveal delay={163}>
              <LocationPicker
                latitude={latitude}
                longitude={longitude}
                address={selectedLocation?.fullAddress}
                onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }}
                onLocationChange={setSelectedLocation}
                onClear={() => {
                  setLatitude(null); setLongitude(null);
                  setSelectedLocation(null); setLocationConfirmed(false);
                }}
                colors={colors}
                requireConfirm
                onConfirmationChange={setLocationConfirmed}
                errorMessage={errors.location}
              />
            </AnimatedReveal>

            {/* Description */}
            <AnimatedReveal delay={170}>
              <Field label="Description"
                placeholder="Describe the property: key features, condition, surroundings…"
                value={description} onChangeText={setDescription}
                multiline error={errors.description} colors={colors} />
            </AnimatedReveal>

            {/* Photos + Video */}
            <AnimatedReveal delay={190}>
              <MediaPicker
                photos={photos}
                video={video}
                onPickPhotos={pickPhotos}
                onRemovePhoto={(i) => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                onPickVideo={pickVideo}
                onRemoveVideo={() => setVideo(null)}
                colors={colors}
                accentColor={colors.action}
                photoHint="Clear photos get 3× more enquiries"
              />
            </AnimatedReveal>

            {/* Submit */}
            <AnimatedReveal delay={210}>
              <AnimatedPressable onPress={submit}
                style={[styles.submit, { backgroundColor: colors.action, opacity: submitting ? 0.7 : 1 }]}>
                <Text style={styles.submitText}>{submitting ? 'Posting…' : 'Post Listing'}</Text>
                <Feather name="arrow-up-right" size={18} color={colors.actionForeground} />
              </AnimatedPressable>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Your listing will appear in the Listings tab and on the home feed immediately.
              </Text>
            </AnimatedReveal>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Media Picker Component ────────────────────────────────────────────────────

function MediaPicker({
  photos, video, onPickPhotos, onRemovePhoto, onPickVideo, onRemoveVideo,
  colors, accentColor, photoHint,
}: {
  photos: string[];
  video: { uri: string; duration?: number; filename?: string } | null;
  onPickPhotos: () => void;
  onRemovePhoto: (i: number) => void;
  onPickVideo: () => void;
  onRemoveVideo: () => void;
  colors: ReturnType<typeof useColors>;
  accentColor: string;
  photoHint: string;
}) {
  const formatDuration = (sec?: number) => {
    if (!sec) return '';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={mStyles.root}>
      {/* ── Photos section ── */}
      <View style={mStyles.sectionHead}>
        <View style={[mStyles.sectionIcon, { backgroundColor: accentColor + '18' }]}>
          <Feather name="camera" size={15} color={accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[mStyles.sectionTitle, { color: colors.foreground }]}>
            Photos{photos.length > 0 ? ` (${photos.length}/10)` : ''}
          </Text>
          <Text style={[mStyles.sectionHint, { color: colors.mutedForeground }]}>{photoHint}</Text>
        </View>
        <Pressable
          onPress={onPickPhotos}
          style={[mStyles.addBtn, { borderColor: accentColor, backgroundColor: accentColor + '14' }]}
        >
          <Feather name="plus" size={14} color={accentColor} />
          <Text style={[mStyles.addBtnText, { color: accentColor }]}>Add</Text>
        </Pressable>
      </View>

      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={mStyles.thumbStrip} contentContainerStyle={mStyles.thumbStripContent}>
          {photos.map((uri, i) => (
            <View key={i} style={mStyles.thumbWrap}>
              <Image source={{ uri }} style={mStyles.thumb} resizeMode="cover" />
              <Pressable onPress={() => onRemovePhoto(i)} style={[mStyles.thumbRemove, { backgroundColor: '#000000bb' }]}>
                <Feather name="x" size={10} color="#ffffff" />
              </Pressable>
            </View>
          ))}
          {photos.length < 10 && (
            <Pressable onPress={onPickPhotos} style={[mStyles.thumbAdd, { borderColor: accentColor + '66', backgroundColor: accentColor + '0e' }]}>
              <Feather name="plus" size={20} color={accentColor} />
              <Text style={[mStyles.thumbAddText, { color: accentColor }]}>More</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* ── Video section ── */}
      <View style={[mStyles.divider, { backgroundColor: colors.border }]} />

      <View style={mStyles.sectionHead}>
        <View style={[mStyles.sectionIcon, { backgroundColor: accentColor + '18' }]}>
          <Feather name="video" size={15} color={accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[mStyles.sectionTitle, { color: colors.foreground }]}>
            Property Video{video ? ' (1/1)' : ''}
          </Text>
          <Text style={[mStyles.sectionHint, { color: colors.mutedForeground }]}>
            Up to 2 min — walk-through, exterior, or land boundary
          </Text>
        </View>
        {!video && (
          <Pressable
            onPress={onPickVideo}
            style={[mStyles.addBtn, { borderColor: accentColor, backgroundColor: accentColor + '14' }]}
          >
            <Feather name="plus" size={14} color={accentColor} />
            <Text style={[mStyles.addBtnText, { color: accentColor }]}>Add</Text>
          </Pressable>
        )}
      </View>

      {video ? (
        <View style={[mStyles.videoCard, { backgroundColor: colors.card, borderColor: accentColor + '44' }]}>
          <View style={[mStyles.videoIconWrap, { backgroundColor: accentColor + '18' }]}>
            <Feather name="film" size={22} color={accentColor} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[mStyles.videoName, { color: colors.foreground }]} numberOfLines={1}>
              {video.filename ?? 'property-video.mp4'}
            </Text>
            <View style={mStyles.videoMeta}>
              {video.duration ? (
                <View style={[mStyles.videoBadge, { backgroundColor: accentColor + '18' }]}>
                  <Feather name="clock" size={9} color={accentColor} />
                  <Text style={[mStyles.videoBadgeText, { color: accentColor }]}>{formatDuration(video.duration)}</Text>
                </View>
              ) : null}
              <View style={[mStyles.videoBadge, { backgroundColor: colors.secondary }]}>
                <Feather name="check-circle" size={9} color={colors.mutedForeground} />
                <Text style={[mStyles.videoBadgeText, { color: colors.mutedForeground }]}>Ready to upload</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={onRemoveVideo} style={[mStyles.videoRemove, { backgroundColor: '#e5383822' }]}>
            <Feather name="trash-2" size={14} color="#e53838" />
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onPickVideo} style={[mStyles.videoPickBtn, { borderColor: accentColor + '44', backgroundColor: accentColor + '08' }]}>
          <Feather name="video" size={16} color={accentColor} />
          <Text style={[mStyles.videoPickText, { color: accentColor }]}>Pick a video from your gallery</Text>
          <Feather name="chevron-right" size={14} color={accentColor + '88'} />
        </Pressable>
      )}
    </View>
  );
}

const mStyles = StyleSheet.create({
  root: { marginTop: 6, marginBottom: 4, gap: 0 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  sectionIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 2 },
  sectionHint: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  addBtnText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  divider: { height: 1, marginVertical: 4 },
  // photo strip
  thumbStrip: { marginBottom: 8 },
  thumbStripContent: { gap: 8, paddingRight: 4 },
  thumbWrap: { width: 80, height: 80, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  thumb: { width: 80, height: 80 },
  thumbRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  thumbAdd: { width: 80, height: 80, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  thumbAddText: { fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  // video
  videoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 4 },
  videoIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  videoName: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  videoMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  videoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  videoBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  videoRemove: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  videoPickBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 4 },
  videoPickText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});

// ─── Buyer Form ────────────────────────────────────────────────────────────────

function BuyerForm({ colors, topInset, user, router }: any) {
  const tabBarHeight = useTabBarHeight();
  const [buyerType, setBuyerType] = useState('House');
  const [budget, setBudget] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [requirements, setRequirements] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!budget.trim()) e.budget = 'Budget is required';
    if (!city.trim()) e.city = 'City is required';
    if (!requirements.trim()) e.requirements = 'Please describe what you are looking for';
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await addUserListing({
        id: `buyer_${Date.now()}`,
        postedBy: user.id,
        agentName: user.name,
        role: 'buyer',
        title: `Looking for ${buyerType} in ${city || 'Okara District'}`,
        type: buyerType,
        category: 'Looking For',
        status: 'Looking For',
        price: Number(budget.replace(/[^0-9]/g, '')) || 0,
        area: 0,
        areaUnit: 'Marla',
        city: city || 'Okara',
        neighborhood,
        description: requirements,
        bedrooms: 0,
        bathrooms: 0,
        postedAt: new Date().toISOString(),
        listingStatus: 'Active',
        views: 0, saves: 0, leadsCount: 0,
        requirements,
      });
      Alert.alert('Request Sent!', 'Agents will contact you with matching properties.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not save your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const areas = city ? (okaraDistrict.areas[city] ?? []) : [];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: tabBarHeight, paddingHorizontal: 20 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>BUYER REQUEST</Text>
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>What are you{'\n'}looking for?</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Describe your ideal property and agents will reach out with matching listings.
      </Text>

      <Text style={[styles.label, { color: colors.foreground }]}>Property type</Text>
      <View style={styles.pillRow}>
        {BUYER_TYPES.map((t) => (
          <Pressable key={t} onPress={() => setBuyerType(t)}
            style={[styles.pill, { borderColor: buyerType === t ? colors.selectionBorder : colors.border, backgroundColor: buyerType === t ? colors.selectionBackground : colors.glassCard }]}>
            <Text style={[styles.pillText, { color: buyerType === t ? colors.selectionForeground : colors.mutedForeground, fontWeight: buyerType === t ? '600' : '400' }]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <Field label="Maximum budget (PKR)" placeholder="e.g. 5000000" keyboardType="numeric"
        value={budget} onChangeText={setBudget} error={errors.budget} colors={colors} />

      <Text style={[styles.label, { color: colors.foreground }]}>Preferred city</Text>
      <View style={styles.pillRow}>
        {CITIES.map((c) => (
          <Pressable key={c} onPress={() => { setCity(c); setNeighborhood(''); }}
            style={[styles.pill, { borderColor: city === c ? colors.selectionBorder : colors.border, backgroundColor: city === c ? colors.selectionBackground : colors.glassCard }]}>
            <Text style={[styles.pillText, { color: city === c ? colors.selectionForeground : colors.mutedForeground, fontWeight: city === c ? '600' : '400' }]}>{c}</Text>
          </Pressable>
        ))}
      </View>
      {errors.city ? <Text style={[styles.errorText, { color: '#e53e3e' }]}>{errors.city}</Text> : null}

      {areas.length > 0 && (
        <>
          <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Preferred area</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {areas.map((a) => (
              <Pressable key={a} onPress={() => setNeighborhood(a)}
                style={[styles.pill, { borderColor: neighborhood === a ? colors.selectionBorder : colors.border, backgroundColor: neighborhood === a ? colors.selectionBackground : colors.glassCard }]}>
                <Text style={[styles.pillText, { color: neighborhood === a ? colors.selectionForeground : colors.mutedForeground, fontWeight: neighborhood === a ? '600' : '400' }]}>{a}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <Field label="Requirements"
        placeholder="Describe your needs: bedrooms, plot size, budget, preferred area…"
        value={requirements} onChangeText={setRequirements}
        multiline error={errors.requirements} colors={colors} />

      <AnimatedPressable onPress={submit}
        style={[styles.submit, { backgroundColor: colors.action, opacity: submitting ? 0.7 : 1 }]}>
        <Text style={styles.submitText}>{submitting ? 'Sending…' : 'Send Request'}</Text>
        <Feather name="arrow-up-right" size={18} color={colors.actionForeground} />
      </AnimatedPressable>
    </ScrollView>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────────

/** Glass-backed input used in the agri form */
function GlassField({ label, placeholder, value, onChangeText, keyboardType, colors, rtl }: {
  label: string; placeholder: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: 'numeric' | 'decimal-pad' | 'numbers-and-punctuation';
  colors: ReturnType<typeof useColors>; rtl?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground, textAlign: rtl ? 'right' : 'left' }]}>{label}</Text>
      <View style={[styles.inputShell, { borderColor: colors.glassBorder }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground} keyboardType={keyboardType}
          textAlign={rtl ? 'right' : 'left'}
          style={[styles.input, { color: colors.foreground }]} />
      </View>
    </View>
  );
}

/** Yes/No toggle used for water access fields */
function ToggleField({ label, subtitle, icon, value, onChange, colors, accentColor }: {
  label: string; subtitle: string; icon: keyof typeof Feather.glyphMap;
  value: boolean | null; onChange: (v: boolean) => void;
  colors: ReturnType<typeof useColors>; accentColor: string;
}) {
  return (
    <View style={[styles.toggleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.toggleIconWrap, { backgroundColor: value === true ? accentColor + '18' : colors.secondary }]}>
        <Feather name={icon} size={18} color={value === true ? accentColor : colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>{subtitle}</Text>
      </View>
      <View style={styles.toggleBtns}>
        <Pressable onPress={() => onChange(true)}
          style={[styles.yesNo, { backgroundColor: value === true ? accentColor : colors.secondary, borderColor: value === true ? accentColor : colors.border }]}>
          <Text style={[styles.yesNoText, { color: value === true ? '#ffffff' : colors.mutedForeground }]}>Yes</Text>
        </Pressable>
        <Pressable onPress={() => onChange(false)}
          style={[styles.yesNo, { backgroundColor: value === false ? '#b94b42' : colors.secondary, borderColor: value === false ? '#b94b42' : colors.border }]}>
          <Text style={[styles.yesNoText, { color: value === false ? '#ffffff' : colors.mutedForeground }]}>No</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SectionDivider({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.sectionDivRow}>
      <View style={[styles.sectionDivLine, { backgroundColor: colors.border }]} />
      <Text style={[styles.sectionDivLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.sectionDivLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

/** Plain field used in standard agent form and buyer form */
function Field({
  label, placeholder, value, onChangeText, keyboardType, multiline, error, colors,
}: {
  label: string; placeholder: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: 'numeric'; multiline?: boolean; error?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <View style={[styles.inputShell, multiline && { height: 100 }, { borderColor: error ? '#e53e3e' : colors.glassBorder }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground} keyboardType={keyboardType}
          multiline={multiline}
          style={[styles.input, multiline && { height: 90, paddingTop: 12, textAlignVertical: 'top' }, { color: colors.foreground }]} />
      </View>
      {error ? <Text style={[styles.errorText, { color: '#e53e3e' }]}>{error}</Text> : null}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerRow: { marginBottom: 16 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.6, marginBottom: 7 },
  pageTitle: { fontFamily: 'Inter_700Bold', fontSize: 27, letterSpacing: -0.4 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 22 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 9 },
  field: { marginBottom: 16 },
  inputShell: {
    height: 52, borderWidth: 1, borderRadius: 13, overflow: 'hidden',
    shadowColor: '#1c2024', shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  input: { flex: 1, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 13 },
  // pill selectors (category, type, status, city, area)
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  pill: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  pillText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  // type grid (kept for compatibility — not rendered but referenced in dead code)
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeCard: { width: '30%', borderRadius: 14, borderWidth: 1.5, padding: 12, alignItems: 'center', gap: 7 },
  typeCardText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, textAlign: 'center' },
  // agri notice
  agriNotice: { borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 20 },
  agriNoticeIcon: { fontSize: 20 },
  agriNoticeText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, flex: 1 },
  // land size row
  sizeRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  sizeInputWrap: { flex: 1.2, height: 52, borderWidth: 1, borderRadius: 13, overflow: 'hidden' },
  sizeInput: { flex: 1, paddingHorizontal: 14, fontFamily: 'Inter_700Bold', fontSize: 15 },
  unitChips: { flex: 1.8, flexDirection: 'row', gap: 6, alignItems: 'center' },
  unitChip: { flex: 1, height: 52, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  unitChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  sizeConvert: { fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 12, marginTop: -2 },
  // section divider
  sectionDivRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  sectionDivLine: { flex: 1, height: 1 },
  sectionDivLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.4 },
  // toggle (water access)
  toggleCard: { borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  toggleIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toggleLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 3 },
  toggleSub: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
  toggleBtns: { flexDirection: 'row', gap: 6 },
  yesNo: { width: 44, height: 36, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  yesNoText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  // soil grid
  soilGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  soilCard: { width: '47%', borderRadius: 13, borderWidth: 1.5, padding: 12, position: 'relative' },
  soilName: { fontFamily: 'Inter_700Bold', fontSize: 13, marginBottom: 3 },
  soilDesc: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
  soilCheck: { position: 'absolute', top: 9, right: 9, width: 18, height: 18, borderRadius: 9, backgroundColor: '#1a6b3a22', alignItems: 'center', justifyContent: 'center' },
  // crop chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  cropChip: { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 9 },
  cropChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  // tehsil / location
  tehsilRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tehsilChip: { flex: 1, borderRadius: 12, borderWidth: 1.5, paddingVertical: 11, alignItems: 'center' },
  tehsilChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  // village dropdown
  dropdownShell: { height: 52, borderWidth: 1, borderRadius: 13, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 6 },
  dropdownText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13 },
  dropdownList: { borderWidth: 1.5, borderRadius: 13, overflow: 'hidden', marginBottom: 10 },
  dropdownItem: { height: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  dropdownItemText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  // GPS
  gpsShell: { height: 52, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 14, marginBottom: 6, overflow: 'hidden' },
  gpsIconWrap: { width: 52, height: '100%', alignItems: 'center', justifyContent: 'center' },
  gpsInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12 },
  gpsHint: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginBottom: 14 },
  // description textarea
  textAreaShell: { borderWidth: 1, borderRadius: 13, overflow: 'hidden', marginBottom: 16 },
  textArea: { height: 110, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  // photo upload
  upload: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 2 },
  uploadIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  uploadCopy: { flex: 1 },
  uploadTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 4 },
  uploadText: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  // submit
  submit: {
    height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8, marginTop: 20,
    shadowColor: '#1a6b3a', shadowOpacity: 0.2, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  submitText: { color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 14 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 10 },
  // error
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4, marginBottom: 6 },
  // row layout
  rowFields: { flexDirection: 'row', gap: 10 },
  // not-logged-in card
  loginCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', padding: 24, marginTop: 10, alignItems: 'center', gap: 12 },
  loginIconWrap: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  loginCardTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  loginCardBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  // selection screen
  postCard:          { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 18, borderWidth: 1, padding: 20, marginBottom: 14 },
  postIconWrap:      { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  postTitle:         { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 4 },
  postDesc:          { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  selectionHint:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 6 },
  selectionHintText: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, flex: 1 },
});
