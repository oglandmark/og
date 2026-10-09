import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, ImageBackground,
  Modal, PanResponder, Platform, Pressable, ScrollView, StatusBar,
  StyleSheet, View, useWindowDimensions,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { setAudioModeAsync } from 'expo-audio';
import { VideoView, useVideoPlayer, type VideoPlayer, type VideoSource } from 'expo-video';
import { Image as ExpoImage } from 'expo-image';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
// BlurView removed — crashes Android GPU
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { SkeletonShimmer } from '@/components/SkeletonShimmer';
import { PropertyCard } from '@/components/PropertyCard';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useDemoPropertyVisibility } from '@/context/DemoPropertyVisibilityContext';
import { BrandMark } from '@/components/BrandMark';
import { NotificationBell } from '@/components/NotificationBell';
import { BrowseDiscoveryModule } from '@/components/BrowseDiscoveryModule';
import HomeCategoryBannerCarousel, { type HomeCategoryBannerSlide } from '@/components/HomeCategoryBannerCarousel';
import { PropertyDemoBadge } from '@/components/PropertyDemoBadge';
import { VideoWatermark } from '@/components/VideoWatermark';
import { getAgents, getBanners, getMobileSettings, getProperties, API_BASE, type BannerSlide as ApiBannerSlide, type MobileContent } from '@/lib/api';
import { apiPropertyToProperty } from '@/lib/properties';
import {
  filterVisibleDemoProperties,
  selectHomePropertySource,
} from '@/lib/demoPropertyVisibility';
import { ExploreMapView } from '@/components/ExploreMapView';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { formatPrice, properties, propertyImages, Property } from '@/lib/properties';
import { getUserListings, UserListing } from '@/lib/listingsStore';
import { useAuth } from '@/context/AuthContext';
import { useTabBarScrollHandler } from '@/context/TabBarScrollContext';
import { getDevProjects, DeveloperProject } from '@/lib/developerStore';
import { projects } from '@/lib/projects';
import { apiAgentToSample, SAMPLE_AGENTS, SampleAgent } from '@/lib/agentsData';
import { useSaved } from '@/context/SavedContext';
import {
  CalcCorners as SharedCalcCorners,
  CalcUnit as SharedCalcUnit,
  CalcResult as SharedCalcResult,
  computePlotArea as computeSharedPlotArea,
  CALC_FIELDS as SHARED_CALC_FIELDS,
} from '@/lib/plotCalculator';
import { PlotMeasurementCalculator } from '@/components/PlotMeasurementCalculator';
import { StatusNotice } from '@/components/PolishedUI';

type Transaction = 'Buy' | 'Rent';

// ─── Drawer types & data ──────────────────────────────────────────────────────

type DrawerRoute = '/explore' | '/(tabs)/post-ad' | '/(tabs)/saved' | '/(auth)/login';
type DrawerInfo  = { title: string; eyebrow: string; body: string };
type DrawerItem  = { label: string; detail: string; icon: keyof typeof Feather.glyphMap; route?: DrawerRoute; info?: DrawerInfo };

const drawerItems: DrawerItem[] = [
  { label: 'Home',              detail: 'Discover your next property',    icon: 'home' },
  { label: 'Add Property',      detail: 'List a property for buyers',     icon: 'plus-circle',  route: '/(tabs)/post-ad' },
  { label: 'Search Properties', detail: 'Find homes, plots and more',     icon: 'search',       route: '/explore' },
  { label: 'Favorites',         detail: 'Your saved properties',          icon: 'heart',        route: '/(tabs)/saved' },
  { label: 'Saved Searches',    detail: 'Keep your property searches close', icon: 'bookmark' },
];
const discoverItems: DrawerItem[] = [
  { label: 'OG Landmark News',  detail: 'Property market updates',               icon: 'trending-up', info: { eyebrow: 'FROM THE LANDMARK DESK',  title: 'OG Landmark News',  body: 'Keep up with property market updates, new opportunities and the stories shaping real estate across Pakistan.' } },
  { label: 'OG Landmark Blogs', detail: 'Ideas for better property decisions',   icon: 'edit-3',      info: { eyebrow: 'THE LANDMARK JOURNAL',     title: 'OG Landmark Blogs', body: 'Thoughtful guides for buyers, sellers and investors — from choosing the right area to making confident property decisions.' } },
];
const companyItems: DrawerItem[] = [
  { label: 'About Us',              detail: 'The people behind OG Landmark', icon: 'info',      info: { eyebrow: 'OUR PERSPECTIVE',    title: 'About OG Landmark',     body: 'OG Landmark brings a clearer, more considered way to explore property. We connect people with places that fit the way they want to live.' } },
  { label: 'Contact Us',            detail: 'We are here to help',          icon: 'phone',     info: { eyebrow: 'LET\u2019S TALK PROPERTY', title: 'Contact OG Landmark', body: 'Our team is ready to help with a listing, a viewing or your next property question. Reach out and we will be happy to guide you.' } },
  { label: 'Terms & Privacy Policy',detail: 'Your trust matters to us',    icon: 'file-text', info: { eyebrow: 'YOUR TRUST MATTERS',  title: 'Terms & Privacy Policy', body: 'OG Landmark respects your privacy and handles your information responsibly. Full terms and privacy details will be available here as the app goes live.' } },
];

// ─── MenuDrawer ───────────────────────────────────────────────────────────────

function MenuDrawer({ open, onClose, onNavigate, onInfo }: { open: boolean; onClose: () => void; onNavigate: (route?: DrawerRoute) => void; onInfo: (info: DrawerInfo) => void }) {
  const colors = useColors();
  const { lang, setLang } = useLanguage();
  const { role: drawerRole } = useAuth();
  const drawerRouter = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const mounted = open;
  const [selectedInfo, setSelectedInfo] = useState<DrawerInfo | null>(null);

  useEffect(() => {
    if (!open) setSelectedInfo(null);
  }, [open]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.drawerRoot}>
        <View style={[StyleSheet.absoluteFill, s.drawerBackdrop]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
        </View>
        <View style={[s.drawerPanel, { width: Math.min(width * 0.86, 360), paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 18, paddingBottom: insets.bottom + 18, backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
          <LinearGradient pointerEvents="none" colors={[colors.glassOverlay, 'transparent']} style={StyleSheet.absoluteFill} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.drawerScrollContent} keyboardShouldPersistTaps="handled">
            <View style={s.drawerHeader}>
              <BrandMark />
              <Pressable onPress={onClose} style={({ pressed }) => [s.drawerClose, { backgroundColor: colors.actionGlass, opacity: pressed ? 0.72 : 1 }]} accessibilityRole="button" accessibilityLabel="Close navigation menu">
                <Feather name="x" size={18} color={colors.actionForeground} />
              </Pressable>
            </View>
            <Pressable onPress={() => onNavigate('/(auth)/login')} style={({ pressed }) => [s.drawerAccount, { backgroundColor: colors.actionGlass, borderColor: colors.actionGlassBorder, opacity: pressed ? 0.78 : 1 }]} accessibilityRole="button" accessibilityLabel="Sign in or create account">
              <View style={[s.drawerAccountIcon, { backgroundColor: colors.goldGlass }]}><Feather name="user" size={18} color={colors.goldForeground} /></View>
              <View style={s.drawerAccountCopy}><Text style={[s.drawerAccountTitle, { color: colors.actionForeground }]}>Welcome to OG Landmark</Text><Text style={[s.drawerAccountDetail, { color: colors.actionForeground }]}>Sign in to manage your properties</Text></View>
              <Feather name="arrow-up-right" size={16} color={colors.gold} />
            </Pressable>
            <Text style={[s.drawerSectionLabel, { color: colors.mutedForeground }]}>EXPLORE</Text>
            <View style={s.drawerList}>
              {drawerItems.map((item, i) => (
                <Pressable key={item.label} onPress={() => item.info ? onInfo(item.info) : onNavigate(item.route)} style={({ pressed }) => [s.drawerItem, i === 0 && { backgroundColor: colors.goldGlass }, { borderColor: i === 0 ? colors.goldGlassBorder : colors.glassBorder, opacity: pressed ? 0.72 : 1 }]} accessibilityRole="button" accessibilityLabel={item.label}>
                  <View style={[s.drawerItemIcon, { backgroundColor: i === 0 ? colors.goldGlass : colors.glassOverlay }]}><Feather name={item.icon} size={18} color={i === 0 ? colors.goldForeground : colors.action} /></View>
                  <View style={s.drawerItemCopy}><Text style={[s.drawerItemLabel, { color: colors.foreground }]}>{item.label}</Text><Text style={[s.drawerItemDetail, { color: colors.mutedForeground }]}>{item.detail}</Text></View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
            <View style={[s.drawerDivider, { backgroundColor: colors.border }]} />
            <Text style={[s.drawerSectionLabel, { color: colors.mutedForeground }]}>DISCOVER</Text>
            <View style={s.drawerList}>
              {discoverItems.map((item) => (
                <Pressable key={item.label} onPress={() => { if (item.info) { setSelectedInfo(item.info); onInfo(item.info); } }} style={({ pressed }) => [s.drawerItem, { borderColor: colors.glassBorder, opacity: pressed ? 0.72 : 1 }]} accessibilityRole="button" accessibilityLabel={item.label}>
                  <View style={[s.drawerItemIcon, { backgroundColor: colors.glassOverlay }]}><Feather name={item.icon} size={18} color={colors.action} /></View>
                  <View style={s.drawerItemCopy}><Text style={[s.drawerItemLabel, { color: colors.foreground }]}>{item.label}</Text><Text style={[s.drawerItemDetail, { color: colors.mutedForeground }]}>{item.detail}</Text></View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
            <View style={[s.drawerDivider, { backgroundColor: colors.border }]} />
            <Text style={[s.drawerSectionLabel, { color: colors.mutedForeground }]}>COMPANY & SUPPORT</Text>
            <View style={s.drawerList}>
              {companyItems.map((item) => (
                <Pressable key={item.label} onPress={() => { if (item.info) { setSelectedInfo(item.info); onInfo(item.info); } }} style={({ pressed }) => [s.drawerSupportItem, { opacity: pressed ? 0.72 : 1 }]} accessibilityRole="button" accessibilityLabel={item.label}>
                  <View style={[s.drawerItemIcon, { backgroundColor: colors.glassOverlay }]}><Feather name={item.icon} size={18} color={colors.action} /></View>
                  <View style={s.drawerItemCopy}><Text style={[s.drawerItemLabel, { color: colors.foreground }]}>{item.label}</Text><Text style={[s.drawerItemDetail, { color: colors.mutedForeground }]}>{item.detail}</Text></View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
            {/* Admin Panel — only visible to admin role */}
            {drawerRole === 'admin' && (
              <>
                <View style={[s.drawerDivider, { backgroundColor: colors.border }]} />
                <Text style={[s.drawerSectionLabel, { color: colors.mutedForeground }]}>ADMIN</Text>
                <View style={s.drawerList}>
                  {[
                    { label: 'Admin Dashboard', detail: 'Stats, approvals & overview', icon: 'shield' as const, route: '/admin/' },
                    { label: 'Property Management', detail: 'Approve, reject & feature listings', icon: 'home' as const, route: '/admin/properties' },
                    { label: 'User Management', detail: 'View & manage user accounts', icon: 'users' as const, route: '/admin/users' },
                    { label: 'App Settings', detail: 'Feature flags & push notifications', icon: 'settings' as const, route: '/admin/settings' },
                  ].map((item) => (
                    <Pressable
                      key={item.label}
                      onPress={() => { onClose(); drawerRouter.push(item.route as any); }}
                      style={({ pressed }) => [s.drawerItem, { borderColor: '#C8A45A33', backgroundColor: pressed ? '#C8A45A0f' : 'transparent', opacity: pressed ? 0.88 : 1 }]}
                    >
                      <View style={[s.drawerItemIcon, { backgroundColor: '#C8A45A18' }]}>
                        <Feather name={item.icon} size={18} color="#C8A45A" />
                      </View>
                      <View style={s.drawerItemCopy}>
                        <Text style={[s.drawerItemLabel, { color: colors.foreground }]}>{item.label}</Text>
                        <Text style={[s.drawerItemDetail, { color: colors.mutedForeground }]}>{item.detail}</Text>
                      </View>
                      <Feather name="chevron-right" size={16} color="#C8A45A" />
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <View style={[s.drawerDivider, { backgroundColor: colors.border }]} />
            <Text style={[s.drawerSectionLabel, { color: colors.mutedForeground }]}>LANGUAGE / زبان</Text>
            <View style={s.drawerLangRow}>
              {(['en', 'ur'] as const).map((l) => (
                <Pressable key={l} onPress={() => { void setLang(l); }} style={[s.drawerLangBtn, { borderColor: lang === l ? colors.action : colors.border, backgroundColor: lang === l ? colors.action : 'transparent' }]}>
                <Text style={[s.drawerLangBtnText, { color: lang === l ? colors.actionForeground : colors.mutedForeground }]}>{l === 'en' ? 'English' : 'اردو'}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.drawerFooter}><BrandMark showName={false} size="hero" /><Text style={[s.drawerFooterText, { color: colors.mutedForeground }]}>Real estate with perspective</Text></View>
          </ScrollView>
          {selectedInfo && (
            <View style={[s.infoOverlay, { backgroundColor: colors.actionGlass }]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedInfo(null)} accessibilityLabel="Close information panel" />
              <View style={[s.infoCard, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
                <View style={s.infoCardTop}><View style={[s.infoCardIcon, { backgroundColor: colors.goldGlass }]}><Feather name="compass" size={20} color={colors.goldForeground} /></View><Pressable onPress={() => setSelectedInfo(null)} accessibilityLabel="Close information panel"><Feather name="x" size={20} color={colors.foreground} /></Pressable></View>
                <Text style={[s.infoEyebrow, { color: colors.primary }]}>{selectedInfo.eyebrow}</Text>
                <Text style={[s.infoTitle, { color: colors.foreground }]}>{selectedInfo.title}</Text>
                <Text style={[s.infoBody, { color: colors.mutedForeground }]}>{selectedInfo.body}</Text>
                <Pressable onPress={() => setSelectedInfo(null)} style={[s.infoButton, { backgroundColor: colors.action }]}><Text style={[s.infoButtonText, { color: colors.actionForeground }]}>Got it</Text><Feather name="arrow-right" size={15} color={colors.actionForeground} /></Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Home category banners ────────────────────────────────────────────────────
type HomeBannerCategory = HomeCategoryBannerSlide['category'];

const HOME_BANNER_COPY: Record<HomeBannerCategory, Omit<HomeCategoryBannerSlide, 'id' | 'image' | 'route' | 'ctaParams'>> = {
  homes: {
    category: 'homes',
    eyebrow: 'Find your place',
    title: 'Homes that feel like home',
    subtitle: 'Explore verified homes across Pakistan.',
    cta: 'Explore homes',
  },
  commercial: {
    category: 'commercial',
    eyebrow: 'Make your next move',
    title: 'Commercial spaces with potential',
    subtitle: 'Discover shops, offices and commercial properties.',
    cta: 'Explore commercial',
  },
  agriculture: {
    category: 'agriculture',
    eyebrow: 'Room to grow',
    title: 'Agricultural land for tomorrow',
    subtitle: 'Find fertile land and investment opportunities.',
    cta: 'Explore land',
  },
  plots: {
    category: 'plots',
    eyebrow: 'Build what’s next',
    title: 'The right plot starts here',
    subtitle: 'Explore plots in the locations you love.',
    cta: 'Explore plots',
  },
  projects: {
    category: 'projects',
    eyebrow: 'A better way forward',
    title: 'Discover exceptional projects',
    subtitle: 'Explore thoughtfully selected developments.',
    cta: 'Explore projects',
  },
};

const HOME_BANNER_IMAGES: Record<HomeBannerCategory, HomeCategoryBannerSlide['image']> = {
  homes: require('@/assets/images/banner-categories/homes.jpg'),
  commercial: require('@/assets/images/banner-categories/commercial.jpg'),
  agriculture: require('@/assets/images/banner-categories/agriculture.jpg'),
  plots: require('@/assets/images/banner-categories/plots.jpg'),
  projects: require('@/assets/images/banner-categories/projects.jpg'),
};

const CATEGORY_PROPERTY_TYPE: Record<HomeBannerCategory, string> = {
  homes: 'House',
  commercial: 'Commercial',
  agriculture: 'Agriculture Land',
  plots: 'Plot',
  projects: 'Project',
};

const CATEGORY_QUERY_LABEL: Record<HomeBannerCategory, string> = {
  homes: 'Homes',
  commercial: 'Commercial',
  agriculture: 'Agriculture Land',
  plots: 'Plots',
  projects: 'Projects',
};

const LOCAL_HOME_BANNER_SLIDES: HomeCategoryBannerSlide[] = (
  Object.keys(HOME_BANNER_COPY) as HomeBannerCategory[]
).map((category) => ({
  id: category,
  ...HOME_BANNER_COPY[category],
  image: HOME_BANNER_IMAGES[category],
  route: '/explore',
  ctaParams: {
    category: CATEGORY_QUERY_LABEL[category],
    propertyType: CATEGORY_PROPERTY_TYPE[category],
  },
}));

function normalizeHomeBannerCategory(value?: string | null): HomeBannerCategory | null {
  const normalized = value?.trim().toLowerCase().replace(/[\s_-]+/g, '');
  switch (normalized) {
    case 'home':
    case 'homes':
    case 'house':
    case 'houses':
      return 'homes';
    case 'commercial':
      return 'commercial';
    case 'agriculture':
    case 'agriculturalland':
      return 'agriculture';
    case 'plot':
    case 'plots':
      return 'plots';
    case 'project':
    case 'projects':
      return 'projects';
    default:
      return null;
  }
}

function mapApiBanner(slide: ApiBannerSlide): HomeCategoryBannerSlide | null {
  if (!slide.active || slide.type !== 'image') return null;

  const category =
    normalizeHomeBannerCategory(slide.category) ??
    normalizeHomeBannerCategory(slide.ctaParams?.category) ??
    normalizeHomeBannerCategory(slide.ctaParams?.propertyType);
  if (!category) return null;

  const defaults = HOME_BANNER_COPY[category];
  const image = slide.imageUrl
    ? { uri: slide.imageUrl.startsWith('http') ? slide.imageUrl : `${API_BASE}${slide.imageUrl}` }
    : HOME_BANNER_IMAGES[category];

  return {
    id: slide.id,
    category,
    image,
    eyebrow: slide.eyebrow || defaults.eyebrow,
    title: slide.title || defaults.title,
    subtitle: slide.subtitle || defaults.subtitle,
    cta: slide.cta || defaults.cta,
    route: slide.route || '/explore',
    ctaParams: {
      category: CATEGORY_QUERY_LABEL[category],
      propertyType: CATEGORY_PROPERTY_TYPE[category],
    },
  };
}

// ─── Static placeholder images ────────────────────────────────────────────────

const HOME_PLACEHOLDERS = [
  require('@/assets/images/property-3.jpg'),
  require('@/assets/images/property-4.jpg'),
  require('@/assets/images/property-5.jpg'),
  require('@/assets/images/property-6.jpg'),
];

// ─── Location areas ───────────────────────────────────────────────────────────

const LOCATION_AREAS = [
  { label: 'All of Okara District',  value: 'Okara District',      icon: 'map'       as const },
  { label: 'Okara City',             value: 'Okara',               icon: 'home'      as const },
  { label: 'Depalpur',               value: 'Depalpur',            icon: 'map-pin'   as const },
  { label: 'Renala Khurd',           value: 'Renala Khurd',        icon: 'map-pin'   as const },
  { label: 'Hujra Shah Muqeem',      value: 'Hujra Shah Muqeem',   icon: 'map-pin'   as const },
  { label: 'Basirpur',               value: 'Basirpur',            icon: 'map-pin'   as const },
  { label: 'Haveli Lakha',           value: 'Haveli Lakha',        icon: 'map-pin'   as const },
  { label: 'Select on Map',          value: '__map__',             icon: 'navigation' as const },
];

// ─── Trust points ─────────────────────────────────────────────────────────────

const TRUST_POINTS = [
  { icon: 'check-circle' as const, label: 'Verified Listings' },
  { icon: 'award'        as const, label: 'Verified Agents' },
  { icon: 'layers'       as const, label: 'Verified Developers' },
  { icon: 'eye'          as const, label: 'Transparent Info' },
  { icon: 'lock'         as const, label: 'Secure Inquiries' },
  { icon: 'star'         as const, label: 'Professional Experience' },
];

// ─── Helper types ─────────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useColors>;

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title, onViewAll, colors }: { eyebrow: string; title: string; onViewAll?: () => void; colors: Colors }) {
  return (
    <View style={s.sectionHeader}>
      <View>
        <Text style={[s.sectionEyebrow, { color: colors.primary }]}>{eyebrow}</Text>
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      {onViewAll && (
        <Pressable onPress={onViewAll} hitSlop={10}>
          <View style={[s.viewAllBtn, { backgroundColor: colors.action + '14', borderColor: colors.action + '33' }]}>
            <Text style={[s.viewAllText, { color: colors.action }]}>View all</Text>
            <Feather name="arrow-right" size={11} color={colors.action} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

// ─── Fullscreen video playback (Expo 57 expo-video) ───────────────────────────
function FullscreenVideo({
  source, muted, onPlayerReady, onBufferingChange, onPlayingChange, onError, onFinished, style,
}: {
  source: VideoSource;
  muted: boolean;
  onPlayerReady: (player: VideoPlayer) => void;
  onBufferingChange: (buffering: boolean) => void;
  onPlayingChange: (playing: boolean) => void;
  onError: () => void;
  onFinished: () => void;
  style: any;
}) {
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = muted;
    videoPlayer.volume = 1;
    videoPlayer.play();
  });

  useEffect(() => {
    onPlayerReady(player);
    const statusSubscription = player.addListener('statusChange', ({ status }) => {
      onBufferingChange(status === 'loading');
      if (status === 'error') onError();
    });
    const playingSubscription = player.addListener('playingChange', ({ isPlaying }) => {
      onPlayingChange(isPlaying);
    });
    const completionSubscription = player.addListener('playToEnd', onFinished);
    return () => {
      statusSubscription.remove();
      playingSubscription.remove();
      completionSubscription.remove();
    };
  }, [onBufferingChange, onError, onFinished, onPlayerReady, onPlayingChange, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  return <VideoView player={player} style={style} contentFit="contain" nativeControls={false} />;
}

// ─── Featured Property Card (large cinematic) ─────────────────────────────────

function FeaturedPropertyCard({ property, colors, onPress, onSave }: {
  property: Property; colors: Colors;
  onPress: () => void; onSave: () => void;
}) {
  const { isSaved } = useSaved();
  const saved        = isSaved(property.id);
  const images       = propertyImages(property);
  const [activeImage, setActiveImage] = useState(0);
  const imageSwipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      images.length > 1
      && Math.abs(gesture.dx) > 12
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) < 36) return;
      setActiveImage((current) => gesture.dx < 0
        ? (current + 1) % images.length
        : (current - 1 + images.length) % images.length);
      void Haptics.selectionAsync();
    },
    onPanResponderTerminationRequest: () => false,
  }), [images.length]);

  // ── Video tour state ───────────────────────────────────────────────────────
  const [videoVisible, setVideoVisible] = useState(false);
  const [isBuffering,  setIsBuffering]  = useState(true);
  const [isMutedV,     setIsMutedV]     = useState(false);
  const [isPlayingV,   setIsPlayingV]   = useState(false);
  const [hasError,     setHasError]     = useState(false);
  const videoPlayerRef = useRef<VideoPlayer | null>(null);

  const videoSource: { uri: string } | number | null =
    property.videoAsset != null ? property.videoAsset
    : property.videoUrl ? { uri: property.videoUrl }
    : null;
  const hasVideo = videoSource !== null;

  async function openVideoTour(e: any) {
    e.stopPropagation();
    if (!hasVideo) return;
    try { await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, shouldPlayInBackground: false }); } catch {}
    setIsBuffering(true); setHasError(false); setIsPlayingV(true); setIsMutedV(false);
    setVideoVisible(true);
  }
  function closeVideo() {
    videoPlayerRef.current?.pause();
    if (videoPlayerRef.current) videoPlayerRef.current.currentTime = 0;
    setVideoVisible(false); setIsPlayingV(false);
  }
  function toggleMute() {
    const next = !isMutedV; setIsMutedV(next);
    if (videoPlayerRef.current) videoPlayerRef.current.muted = next;
  }
  function togglePlay() {
    if (isPlayingV) { videoPlayerRef.current?.pause(); }
    else            { videoPlayerRef.current?.play(); }
    setIsPlayingV(p => !p);
  }
  // ──────────────────────────────────────────────────────────────────────────

  const priceStr = formatPrice(property.price, property.status);

  const handleSave = (e: any) => {
    e.stopPropagation(); onSave();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <>
    <Pressable
      onPress={onPress}
    >
      <View style={fp.card} {...imageSwipeResponder.panHandlers}>
        <ExpoImage
          source={images[activeImage] ?? property.image}
          style={[fp.image, { backgroundColor: '#1a2e42' }]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        {images.length > 1 && (
          <View pointerEvents="none" style={fp.galleryStatus}>
            <View style={fp.galleryDots}>
              {images.slice(0, 5).map((_, index) => (
                <View
                  key={index}
                  style={[fp.galleryDot, index === activeImage % 5 && fp.galleryDotActive]}
                />
              ))}
            </View>
            <Text style={fp.galleryCount}>{activeImage + 1}/{images.length}</Text>
          </View>
        )}
        <LinearGradient colors={['#00000000', '#000000cc']} style={StyleSheet.absoluteFill} />

        {/* ── Top row: type badge + verified + save ── */}
        <View style={fp.topRow}>
          <View style={[fp.badge, { backgroundColor: '#c8a45acc' }]}>
            <Text style={fp.badgeText}>{property.type.toUpperCase()}</Text>
          </View>
          <PropertyDemoBadge visible={property.isDemo === true} compact />
          <View style={[fp.badge, { backgroundColor: '#183B60cc', flexDirection: 'row', gap: 4, alignItems: 'center' }]}>
            <Feather name="check-circle" size={9} color="#fff" />
            <Text style={fp.badgeText}>VERIFIED</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable onPress={handleSave} style={[fp.saveBtn, { backgroundColor: saved ? '#ef444488' : '#ffffff22', borderColor: saved ? '#ef4444aa' : '#ffffff55' }]}>
            <Feather name="heart" size={14} color={saved ? '#ef4444' : '#ffffff'} />
          </Pressable>
        </View>

        {/* ── Bottom info ── */}
        <View style={fp.info}>
          <Text style={fp.price}>{priceStr}</Text>
          <Text style={fp.title} numberOfLines={1}>{property.title}</Text>
          <View style={fp.metaRow}>
            <Feather name="map-pin" size={11} color="#ffffffaa" />
            <Text style={fp.meta}>{property.city}</Text>
            {property.bedrooms > 0 && (<>
              <View style={fp.metaDot} />
              <Feather name="home" size={11} color="#ffffffaa" />
              <Text style={fp.meta}>{property.bedrooms} bed</Text>
            </>)}
            <View style={fp.metaDot} />
            <Text style={fp.meta}>{property.area} {property.areaUnit}</Text>
          </View>

          {/* Agent row + Video Tour button */}
          <View style={fp.agentRow}>
            <View style={fp.agentDot}><Text style={fp.agentInitial}>{property.agent.charAt(0)}</Text></View>
            <Text style={fp.agentName}>{property.agent}</Text>

            {/* Video Tour pill */}
            <Pressable
              onPress={openVideoTour}
              style={[fp.videoTourBtn, !hasVideo && { opacity: 0.4 }]}
              hitSlop={6}
            >
              <View style={fp.videoTourIcon}>
                <Feather name="play" size={9} color="#0B1F3A" />
              </View>
              <Text style={fp.videoTourText}>Video Tour</Text>
            </Pressable>

            <View style={fp.viewBtn}>
              <Text style={fp.viewBtnText}>View</Text>
              <Feather name="arrow-up-right" size={11} color="#ffffff" />
            </View>
          </View>
        </View>
      </View>
    </Pressable>

    {/* ── Fullscreen Video Player Modal ── */}
    <Modal
      visible={videoVisible}
      animationType="none"
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={closeVideo}
    >
      <StatusBar hidden />
      <View style={fp.fsContainer}>

        {/* Close */}
        <Pressable style={fp.fsClose} onPress={closeVideo} hitSlop={14}>
          <View style={fp.fsCloseInner}><Feather name="x" size={20} color="#fff" /></View>
        </Pressable>

        {hasError ? (
          <View style={fp.fsError}>
            <Feather name="alert-circle" size={36} color="#c8a45a" />
            <Text style={fp.fsErrorText}>Video load nahi ho saka</Text>
            <Pressable onPress={closeVideo} style={fp.fsErrorBtn}>
              <Text style={fp.fsErrorBtnText}>Close</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable style={fp.fsVideoWrap} onPress={togglePlay}>
              <FullscreenVideo
                source={videoSource!}
                muted={isMutedV}
                onPlayerReady={(player) => { videoPlayerRef.current = player; }}
                onBufferingChange={setIsBuffering}
                onPlayingChange={setIsPlayingV}
                onError={() => setHasError(true)}
                onFinished={closeVideo}
                style={fp.fsVideo}
              />
              <VideoWatermark />
            </Pressable>

            {isBuffering && (
              <View style={fp.fsBuffer} pointerEvents="none">
                <ActivityIndicator size="large" color="#c8a45a" />
              </View>
            )}

            {!isPlayingV && !isBuffering && (
              <View style={fp.fsPauseIcon} pointerEvents="none">
                <Feather name="play" size={38} color="#fff" />
              </View>
            )}

            {/* Control bar */}
            <View style={fp.fsBar}>
              <Pressable onPress={toggleMute} style={fp.fsMuteBtn}>
                <Feather name={isMutedV ? 'volume-x' : 'volume-2'} size={18} color={isMutedV ? '#888' : '#c8a45a'} />
                <Text style={[fp.fsMuteLabel, { color: isMutedV ? '#888' : '#c8a45a' }]}>
                  {isMutedV ? 'Unmute' : 'Sound On'}
                </Text>
              </Pressable>
              <View style={fp.fsTitleWrap}>
                <Feather name="video" size={12} color="#c8a45a" />
                <Text style={fp.fsTitleText} numberOfLines={1}>{property.title}</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
    </>
  );
}

const fp = StyleSheet.create({
  // ── Card ──────────────────────────────────────────────────────────────────
  card:         { width: 300, height: 320, borderRadius: 22, overflow: 'hidden', marginRight: 16, shadowColor: '#0B1F3A', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  image:        { ...StyleSheet.absoluteFill },
  galleryStatus:{ position: 'absolute', top: 56, right: 14, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#071521aa', borderWidth: 1, borderColor: '#ffffff33', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  galleryDots:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  galleryDot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: '#ffffff66' },
  galleryDotActive:{ width: 10, backgroundColor: '#c8a45a' },
  galleryCount: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 9 },
  topRow:       { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge:        { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText:    { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#ffffff', letterSpacing: 0.5 },
  saveBtn:      { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  info:         { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18 },
  price:        { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#ffffff', marginBottom: 4 },
  title:        { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#ffffffee', marginBottom: 8 },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  meta:         { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#ffffffaa' },
  metaDot:      { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#ffffff55' },
  agentRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  agentDot:     { width: 26, height: 26, borderRadius: 13, backgroundColor: '#c8a45a', alignItems: 'center', justifyContent: 'center' },
  agentInitial: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#ffffff' },
  agentName:    { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#ffffffcc', flex: 1 },

  // Video Tour pill
  videoTourBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#c8a45a', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  videoTourIcon: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  videoTourText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#0B1F3A', letterSpacing: 0.3 },

  viewBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ffffff22', borderWidth: 1, borderColor: '#ffffff44', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  viewBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#ffffff' },

  // ── Fullscreen player ─────────────────────────────────────────────────────
  fsContainer:  { flex: 1, backgroundColor: '#000' },
  fsVideoWrap:  { ...StyleSheet.absoluteFill },
  fsVideo:      { flex: 1 },
  fsClose:      { position: 'absolute', top: 48, right: 16, zIndex: 30 },
  fsCloseInner: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  fsBuffer:     { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 10 },
  fsPauseIcon:  { position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -30, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  fsBar:        { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 32, paddingTop: 14, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 20, gap: 12 },
  fsMuteBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(200,164,90,0.12)', borderWidth: 1.5, borderColor: 'rgba(200,164,90,0.4)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  fsMuteLabel:  { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  fsTitleWrap:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  fsTitleText:  { color: '#fff', fontWeight: '600', fontSize: 12, flex: 1, textAlign: 'right', opacity: 0.85 },
  fsError:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  fsErrorText:  { color: '#c8a45a', fontWeight: '700', fontSize: 15 },
  fsErrorBtn:   { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#c8a45a', borderRadius: 10 },
  fsErrorBtnText:{ color: '#0B1F3A', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});

// ─── Agent Card (premium) ─────────────────────────────────────────────────────

function AgentCarousel({ agents, colors, onAgentPress }: { agents: SampleAgent[]; colors: Colors; onAgentPress: (id: string) => void }) {
  const visibleAgents = agents.length
    ? agents
    : [];
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const loopWidthRef = useRef(0);
  const pausedRef = useRef(false);
  const marqueeAgents = visibleAgents.length > 1
    ? [...visibleAgents, ...visibleAgents]
    : visibleAgents;

  useEffect(() => {
    if (visibleAgents.length < 2) return;

    const timer = setInterval(() => {
      if (pausedRef.current || !loopWidthRef.current) return;

      let nextOffset = offsetRef.current + 0.55;
      if (nextOffset >= loopWidthRef.current) {
        nextOffset -= loopWidthRef.current;
      }

      offsetRef.current = nextOffset;
      scrollRef.current?.scrollTo({ x: nextOffset, animated: false });
    }, 32);

    return () => clearInterval(timer);
  }, [visibleAgents.length]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      nestedScrollEnabled
      directionalLockEnabled
      scrollEnabled={visibleAgents.length > 1}
      decelerationRate="fast"
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onContentSizeChange={(width) => {
        loopWidthRef.current = visibleAgents.length > 1 ? width / 2 : 0;
      }}
      onScroll={(event) => {
        offsetRef.current = event.nativeEvent.contentOffset.x;
      }}
      onScrollBeginDrag={() => {
        pausedRef.current = true;
      }}
      onMomentumScrollEnd={() => {
        pausedRef.current = false;
      }}
      onScrollEndDrag={() => {
        pausedRef.current = false;
      }}
      style={s.agentCarouselViewport}
      contentContainerStyle={[s.agentTrack, s.hRow]}
      showsHorizontalScrollIndicator={false}
    >
      {marqueeAgents.map((agent, index) => (
          <AgentCard
            key={`${agent.id}-${index}`}
            agent={agent}
            colors={colors}
            onPress={() => onAgentPress(agent.id)}
          />
      ))}
    </ScrollView>
  );
}

function AgentCard({ agent, colors, onPress }: { agent: SampleAgent; colors: Colors; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
    >
      <View style={[ac.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={ac.photoWrap}>
          {agent.profileImage ? (
            <Image source={agent.profileImage} style={ac.photo} resizeMode="cover" />
          ) : (
            <View style={[ac.avatar, { backgroundColor: agent.color }]}>
              <Text style={ac.initials}>{agent.initials}</Text>
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(7,24,39,0.78)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={ac.photoAccent} />
          {agent.verified && (
            <View style={ac.verifiedBadge}>
              <Feather name="shield" size={10} color="#d9b85f" />
              <Text style={ac.badgeText}>VERIFIED</Text>
            </View>
          )}
          <View style={ac.photoMeta}>
            <View style={ac.availabilityDot} />
            <Text style={ac.availabilityText}>Available for consultation</Text>
          </View>
        </View>

        <View style={ac.body}>
          <Text style={[ac.name, { color: colors.foreground }]} numberOfLines={1}>{agent.displayName}</Text>
          <Text style={[ac.agency, { color: colors.mutedForeground }]} numberOfLines={1}>{agent.agency}</Text>

          <View style={ac.ratingRow}>
            <View style={ac.stars}>
              {Array.from({ length: 5 }).map((_, index) => (
                <FontAwesome key={index} name="star" size={12} color="#d3aa4e" />
              ))}
            </View>
            <Text style={[ac.ratingValue, { color: colors.foreground }]}>{agent.rating.toFixed(1)}</Text>
            <Text style={[ac.reviewCount, { color: colors.mutedForeground }]}>({agent.reviewCount} reviews)</Text>
          </View>

          <View style={ac.stats}>
            <View style={[ac.stat, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="award" size={13} color="#c8a45a" />
              <View>
                <Text style={[ac.statVal, { color: colors.foreground }]}>{agent.years}+ years</Text>
                <Text style={[ac.statLabel, { color: colors.mutedForeground }]}>Experience</Text>
              </View>
            </View>
            <View style={[ac.stat, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="home" size={13} color="#c8a45a" />
              <View>
                <Text style={[ac.statVal, { color: colors.foreground }]}>{agent.listings}</Text>
                <Text style={[ac.statLabel, { color: colors.mutedForeground }]}>Active listings</Text>
              </View>
            </View>
          </View>

          <View style={ac.areasRow}>
            <View style={[ac.locationIcon, { backgroundColor: colors.action + '13' }]}>
              <Feather name="map-pin" size={10} color={colors.action} />
            </View>
            <Text style={[ac.areasText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {agent.areas.join(' · ')}
            </Text>
          </View>

          <View style={ac.footerRow}>
            <View style={[ac.chip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[ac.chipText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {agent.specialties[0]}
              </Text>
            </View>
            <Pressable onPress={onPress} style={[ac.cta, { backgroundColor: colors.action }]}>
              <Text style={[ac.ctaText, { color: colors.actionForeground }]}>View profile</Text>
              <Feather name="arrow-up-right" size={13} color={colors.actionForeground} />
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const ac = StyleSheet.create({
  card:         { width: 250, borderRadius: 22, borderWidth: 1, overflow: 'hidden', marginRight: 14,
                  shadowColor: '#0B1F3A', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  photoWrap:    { height: 142, backgroundColor: '#0B1F3A', overflow: 'hidden' },
  photo:        { width: '100%', height: '100%' },
  photoAccent:  { position: 'absolute', left: 0, bottom: 0, width: 4, height: 46, backgroundColor: '#c8a45a' },
  avatar:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initials:     { fontFamily: 'Inter_700Bold', fontSize: 34, color: '#ffffff' },
  verifiedBadge:{ position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4,
                  borderWidth: 1, borderColor: 'rgba(216,184,108,0.52)', backgroundColor: 'rgba(10,30,47,0.76)',
                  borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  badgeText:    { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#ffffff', letterSpacing: 0.7 },
  photoMeta:    { position: 'absolute', left: 13, bottom: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  availabilityDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80', borderWidth: 1, borderColor: '#ffffff' },
  availabilityText:{ fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#ffffff', letterSpacing: 0.15 },
  body:         { padding: 15 },
  name:         { fontFamily: 'Inter_700Bold', fontSize: 16, lineHeight: 21, marginBottom: 2 },
  agency:       { fontFamily: 'Inter_400Regular', fontSize: 10.5, marginBottom: 9 },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stars:        { flexDirection: 'row', gap: 2, marginRight: 7 },
  ratingValue:  { fontFamily: 'Inter_700Bold', fontSize: 11, marginRight: 4 },
  reviewCount:  { fontFamily: 'Inter_400Regular', fontSize: 9.5 },
  stats:        { flexDirection: 'row', gap: 7, marginBottom: 10 },
  stat:         { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 11, paddingHorizontal: 8, paddingVertical: 7 },
  statVal:      { fontFamily: 'Inter_700Bold', fontSize: 10.5 },
  statLabel:    { fontFamily: 'Inter_400Regular', fontSize: 8.5, marginTop: 1 },
  areasRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  locationIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  areasText:    { fontFamily: 'Inter_500Medium', fontSize: 9.5, flex: 1 },
  footerRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip:         { flex: 1, borderRadius: 9, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 8 },
  chipText:     { fontFamily: 'Inter_600SemiBold', fontSize: 9, textAlign: 'center' },
  cta:          { minHeight: 36, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  ctaText:      { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});

// ─── Project Showcase Card ────────────────────────────────────────────────────

function ProjectShowcaseCard({ project, colors, onPress }: { project: typeof projects[number]; colors: Colors; onPress: () => void }) {
  const units = project.units.length;
  const totalUnits = units * 18;
  const available = Math.floor(totalUnits * 0.62);
  const progress = 1 - (available / totalUnits);
  return (
    <Pressable
      onPress={onPress}
    >
      <View style={pc.card}>
        <Image source={project.image} style={pc.image} resizeMode="cover" />
        <LinearGradient colors={['#00000000', '#00000099']} style={pc.gradient} />
        <View style={pc.topRow}>
          <View style={[pc.typeBadge, { backgroundColor: '#c8a45acc' }]}>
            <Text style={pc.typeBadgeText}>{project.category}</Text>
          </View>
          <View style={[pc.verifiedBadge, { backgroundColor: '#183B60cc' }]}>
            <Feather name="check-circle" size={9} color="#ffffff" />
            <Text style={pc.verifiedText}>VERIFIED</Text>
          </View>
        </View>
        <View style={pc.info}>
          <Text style={pc.projectName} numberOfLines={1}>{project.name}</Text>
          <Text style={pc.developerName} numberOfLines={1}>{project.developer}</Text>
          <View style={pc.metaRow}>
            <Feather name="map-pin" size={10} color="#ffffffaa" />
            <Text style={pc.metaText} numberOfLines={1}>{project.location.split(',')[0]}</Text>
          </View>
        <View style={pc.progressWrap}>
          <View style={pc.progressBg}>
            <View style={[pc.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
          </View>
          <Text style={pc.progressText}>{available} units available</Text>
        </View>
        <View style={pc.priceRow}>
          <Text style={pc.price} numberOfLines={1}>{project.priceRange.split(' to ')[0]}</Text>
          <View style={pc.viewBtn}><Text style={pc.viewBtnText}>View</Text><Feather name="arrow-up-right" size={11} color="#ffffff" /></View>
        </View>
      </View>
      </View>
    </Pressable>
  );
}

const pc = StyleSheet.create({
  card:         { width: 290, height: 320, borderRadius: 22, overflow: 'hidden', marginRight: 16, position: 'relative' },
  image:        { ...StyleSheet.absoluteFill },
  gradient:     { ...StyleSheet.absoluteFill },
  topRow:       { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', gap: 8 },
  typeBadge:    { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  typeBadgeText:{ fontFamily: 'Inter_700Bold', fontSize: 9, color: '#ffffff', letterSpacing: 0.4 },
  verifiedBadge:{ borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#ffffff', letterSpacing: 0.4 },
  info:         { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18 },
  projectName:  { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#ffffff', marginBottom: 3 },
  developerName:{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#ffffffbb', marginBottom: 7 },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  metaText:     { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#ffffffaa', flex: 1 },
  progressWrap: { gap: 5, marginBottom: 12 },
  progressBg:   { height: 3, backgroundColor: '#ffffff33', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: '#c8a45a', borderRadius: 2 },
  progressText: { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#ffffffaa' },
  priceRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price:        { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff', flex: 1 },
  viewBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ffffff22', borderWidth: 1, borderColor: '#ffffff44', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  viewBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#ffffff' },
});

// ─── Dev Project Card ──────────────────────────────────────────────────────────

function DevProjectCard({ project, colors, onPress }: { project: DeveloperProject; colors: Colors; onPress: () => void }) {
  const fillPct = project.totalUnits > 0 ? Math.round(((project.totalUnits - project.availableUnits) / project.totalUnits) * 100) : 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [dpc.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}>
      {project.coverImageUri ? (
        <Image source={{ uri: project.coverImageUri }} style={dpc.image} resizeMode="cover" />
      ) : (
        <View style={[dpc.imagePlaceholder, { backgroundColor: colors.secondary }]}>
          <Feather name="layers" size={28} color={colors.mutedForeground} />
        </View>
      )}
      <LinearGradient colors={['#00000000', '#00000088']} style={dpc.gradient} />
      <View style={[dpc.statusBadge, { backgroundColor: '#c8a45acc' }]}>
        <Text style={dpc.statusText}>{project.status}</Text>
      </View>
      <View style={dpc.info}>
        <Text style={dpc.name} numberOfLines={1}>{project.name}</Text>
        <Text style={dpc.type} numberOfLines={1}>{project.type} · {project.city}</Text>
        <View style={dpc.progressBg}><View style={[dpc.progressFill, { width: `${fillPct}%` as any }]} /></View>
        <Text style={dpc.units}>{project.availableUnits} of {project.totalUnits} units available</Text>
      </View>
    </Pressable>
  );
}

const dpc = StyleSheet.create({
  card:             { width: 250, height: 270, borderRadius: 22, borderWidth: 1, overflow: 'hidden', marginRight: 14, position: 'relative' },
  image:            { ...StyleSheet.absoluteFill },
  imagePlaceholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  gradient:         { ...StyleSheet.absoluteFill },
  statusBadge:      { position: 'absolute', top: 14, left: 14, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  statusText:       { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#ffffff', letterSpacing: 0.4 },
  info:             { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  name:             { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#ffffff', marginBottom: 3 },
  type:             { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#ffffffbb', marginBottom: 8 },
  progressBg:       { height: 3, backgroundColor: '#ffffff33', borderRadius: 2, overflow: 'hidden', marginBottom: 5 },
  progressFill:     { height: 3, backgroundColor: '#c8a45a', borderRadius: 2 },
  units:            { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#ffffffaa' },
});

// ─── Recommended For You ───────────────────────────────────────────────────────

function RecommendedCard({ property, colors, onPress }: { property: Property; colors: Colors; onPress: () => void }) {
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(property.id);

  return (
    <Pressable
      onPress={onPress}
    >
      <View style={[rc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Image source={property.image} style={rc.image} resizeMode="cover" />
        <LinearGradient colors={['#00000000', '#000000aa']} style={rc.imageGradient} />

        {/* Save */}
        <Pressable
          onPress={(e) => { e.stopPropagation(); toggleSaved(property.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          style={[rc.saveBtn, { backgroundColor: saved ? '#ef444466' : '#00000044' }]}
        >
          <Feather name="heart" size={12} color={saved ? '#ef4444' : '#ffffff'} />
        </Pressable>

        {/* AI match chip */}
        <View style={[rc.matchChip, { backgroundColor: '#c8a45acc' }]}>
          <Feather name="zap" size={8} color="#ffffff" />
          <Text style={rc.matchText}>RECOMMENDED</Text>
        </View>
        <PropertyDemoBadge visible={property.isDemo === true} compact style={rc.demoBadge} />

        <View style={rc.body}>
          <Text style={[rc.price, { color: colors.foreground }]}>{formatPrice(property.price, property.status)}</Text>
          <Text style={[rc.title, { color: colors.foreground }]} numberOfLines={1}>{property.title}</Text>
          <View style={rc.metaRow}>
            <Feather name="map-pin" size={10} color={colors.mutedForeground} />
            <Text style={[rc.meta, { color: colors.mutedForeground }]}>{property.city}</Text>
            <View style={{ flex: 1 }} />
            <Text style={[rc.area, { color: colors.mutedForeground }]}>{property.area} {property.areaUnit}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const rc = StyleSheet.create({
  card:         { width: 220, borderRadius: 18, overflow: 'hidden', marginRight: 14, borderWidth: 1, shadowColor: '#0B1F3A', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  image:        { width: '100%', height: 140 },
  imageGradient:{ position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  saveBtn:      { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  matchChip:    { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  demoBadge:    { position: 'absolute', top: 46, left: 10 },
  matchText:    { fontFamily: 'Inter_700Bold', fontSize: 7, color: '#ffffff', letterSpacing: 0.5 },
  body:         { padding: 12 },
  price:        { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 4 },
  title:        { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, marginBottom: 8 },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta:         { fontFamily: 'Inter_400Regular', fontSize: 10 },
  area:         { fontFamily: 'Inter_400Regular', fontSize: 10 },
});

// ─── Agricultural & Commercial Card ──────────────────────────────────────────

function AgriCommCard({ property, colors, isAgri, onPress }: {
  property: Property; colors: Colors; isAgri: boolean; onPress: () => void;
}) {
  const accentColor = isAgri ? '#183B60' : '#0B1F3A';
  return (
    <Pressable
      onPress={onPress}
    >
      <View style={[acp.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Image source={property.image} style={acp.image} resizeMode="cover" />
        <LinearGradient colors={['#00000000', '#000000cc']} style={acp.gradient} />
        <View style={[acp.typeBadge, { backgroundColor: accentColor + 'cc' }]}>
          <Text style={acp.typeBadgeText}>{isAgri ? 'AGRI LAND' : 'COMMERCIAL'}</Text>
        </View>
        <PropertyDemoBadge visible={property.isDemo === true} compact style={acp.demoBadge} />
        <View style={acp.info}>
          <Text style={acp.price}>{formatPrice(property.price, property.status)}</Text>
          <Text style={acp.title} numberOfLines={1}>{property.title}</Text>
          <View style={acp.metaRow}>
            <Feather name="map-pin" size={9} color="#ffffffaa" />
            <Text style={acp.meta}>{property.city}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const acp = StyleSheet.create({
  card:        { width: 200, height: 200, borderRadius: 18, overflow: 'hidden', marginRight: 14, borderWidth: 1 },
  image:       { ...StyleSheet.absoluteFill },
  gradient:    { ...StyleSheet.absoluteFill },
  typeBadge:   { position: 'absolute', top: 12, left: 12, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  demoBadge:   { position: 'absolute', top: 12, right: 12 },
  typeBadgeText:{ fontFamily: 'Inter_700Bold', fontSize: 8, color: '#ffffff', letterSpacing: 0.6 },
  info:        { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  price:       { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff', marginBottom: 3 },
  title:       { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#ffffffee', marginBottom: 5 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta:        { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#ffffffaa' },
});

// ─── Location Sheet ───────────────────────────────────────────────────────────

function LocationSheet({ visible, selected, onSelect, onClose, colors, insets, mapProperties }: {
  visible: boolean; selected: string; onSelect: (v: string) => void;
  onClose: () => void; colors: Colors; insets: ReturnType<typeof useSafeAreaInsets>;
  mapProperties: Property[];
}) {
  const [mapOpen, setMapOpen] = useState(false);

  if (!visible) return null;

  const handlePropertySelect = (id: number) => {
    const prop = mapProperties.find((p) => p.id === id);
    if (prop) { onSelect(prop.city); onClose(); }
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#071428bb' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </View>
        <View style={[ls.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20, borderColor: colors.border }]}>
          <View style={[ls.handle, { backgroundColor: colors.border }]} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ls.scrollContent} keyboardShouldPersistTaps="handled">
            <Text style={[ls.heading, { color: colors.foreground }]}>Select Location</Text>
            <Text style={[ls.sub, { color: colors.mutedForeground }]}>Browse properties in a specific area</Text>
            {LOCATION_AREAS.map((area) => {
              const isMapRow = area.value === '__map__';
              const isSelected = isMapRow ? mapOpen : selected === area.value;
              return (
                <Pressable key={area.value} onPress={() => { if (isMapRow) { setMapOpen((o) => !o); } else { onSelect(area.value); onClose(); } }} style={({ pressed }) => [ls.row, { borderColor: colors.border, backgroundColor: isSelected ? colors.action + '0f' : 'transparent', opacity: pressed ? 0.72 : 1 }]} accessibilityRole="button" accessibilityLabel={isMapRow ? 'Select a location on the map' : area.label} testID={isMapRow ? 'home-select-on-map' : undefined}>
                  <View style={[ls.rowIcon, { backgroundColor: isSelected ? colors.action + '18' : colors.secondary }]}>
                    <Feather name={area.icon} size={15} color={isSelected ? colors.action : colors.mutedForeground} />
                  </View>
                  <Text style={[ls.rowLabel, { color: isSelected ? colors.action : colors.foreground }]}>{area.label}</Text>
                  {isSelected && !isMapRow && <Feather name="check" size={15} color={colors.action} />}
                  {isMapRow && <Feather name={mapOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.action} />}
                </Pressable>
              );
            })}
            {mapOpen && (
              <View style={[ls.mapPanel, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <View style={ls.mapHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[ls.mapTitle, { color: colors.foreground }]}>Browse Properties on Map</Text>
                    <Text style={[ls.mapSub, { color: colors.mutedForeground }]}>Tap a property pin to select that area</Text>
                  </View>
                  <Feather name="map" size={18} color={colors.action} />
                </View>
                <ExploreMapView
                  properties={mapProperties}
                  count={mapProperties.length}
                  colors={colors}
                  onSelect={handlePropertySelect}
                />
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const ls = StyleSheet.create({
  sheet:    { maxHeight: '92%', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, paddingTop: 12, paddingHorizontal: 20, shadowColor: '#0B1F3A', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: -6 }, elevation: 12 },
  scrollContent: { paddingBottom: 4 },
  handle:   { width: 36, height: 3, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  heading:  { fontFamily: 'Inter_700Bold', fontSize: 20, marginBottom: 4 },
  sub:      { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 18 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderRadius: 4 },
  rowIcon:  { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14 },
  mapPanel: { marginTop: 14, borderWidth: 1, borderRadius: 16, padding: 10, gap: 10 },
  mapHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2 },
  mapTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  mapSub: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 3 },
});

// ─── Plot Area Calculator ─────────────────────────────────────────────────────

function CalcResultCell({ label, value, accent, colors }: { label: string; value: string; accent?: boolean; colors: Colors }) {
  return (
    <View style={[cc.cell, { backgroundColor: colors.card, borderColor: accent ? colors.primary + '55' : colors.border }]}>
      <Text style={[cc.cellVal, { color: accent ? colors.primary : colors.foreground }]}>{value}</Text>
      <Text style={[cc.cellLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function PlotCalculator({ colors }: { colors: Colors }) {
  return <PlotMeasurementCalculator colors={colors} compact />;

  const [open,    setOpen]    = useState(false);
  const [corners, setCorners] = useState<SharedCalcCorners>(4);
  const [unit,    setUnit]    = useState<SharedCalcUnit>('ft');
  const [inputs,  setInputs]  = useState<Record<string, string>>({});
  const [result,  setResult]  = useState<SharedCalcResult | null>(null);
  const [error,   setError]   = useState('');
  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (!next) { setResult(null); setError(''); }
  };

  const panelStyle = { overflow: 'hidden' as const };

  // Auto-calculate whenever any input, corner count, or unit changes
  useEffect(() => {
    const hasAnyInput = Object.values(inputs).some(value => value.trim() !== '');
    if (!hasAnyInput) { setResult(null); setError(''); return; }
    const res = computeSharedPlotArea(corners, inputs, unit);
    if (typeof res === 'string') { setError(res); setResult(null); }
    else {
      setResult(res); setError('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [inputs, corners, unit]);

  const setField = (key: string, val: string) => setInputs(p => ({ ...p, [key]: val }));
  const switchCorners = (n: SharedCalcCorners) => { setCorners(n); setInputs({}); };
  const reset = () => { setInputs({}); };

  const fields = SHARED_CALC_FIELDS[corners];

  return (
    <View style={[cc.wrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header toggle */}
      <Pressable onPress={toggleOpen} style={({ pressed }) => [cc.header, { opacity: pressed ? 0.8 : 1 }]}>
        <View style={[cc.headerIcon, { backgroundColor: colors.action + '18' }]}>
          <Feather name="grid" size={16} color={colors.action} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cc.headerTitle, { color: colors.foreground }]}>Plot Area Calculator</Text>
          <Text style={[cc.headerSub,   { color: colors.mutedForeground }]}>3 · 4 · 5 · 6 · 7 corners — surface measurements only</Text>
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={17} color={colors.action} />
      </Pressable>

      {/* Expandable body */}
      <View style={panelStyle}>
        <View style={[cc.body, { borderTopColor: colors.border }]}>

          {/* Corner + Unit selectors */}
          <View style={cc.selRow}>
            <View style={{ flex: 1 }}>
              <Text style={[cc.selLabel, { color: colors.mutedForeground }]}>Corners</Text>
              <View style={[cc.seg, { backgroundColor: colors.secondary }]}>
                {([3, 4, 5, 6, 7] as SharedCalcCorners[]).map(n => (
                  <Pressable key={n} onPress={() => switchCorners(n)}
                    style={[cc.segItem, n === corners && { backgroundColor: colors.action }]}>
                    <Text style={[cc.segText, { color: n === corners ? colors.actionForeground : colors.mutedForeground }]}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[cc.selLabel, { color: colors.mutedForeground }]}>Input unit</Text>
              <View style={[cc.seg, { backgroundColor: colors.secondary }]}>
                {(['ft', 'in', 'm'] as SharedCalcUnit[]).map(u => (
                  <Pressable key={u} onPress={() => { setUnit(u); setResult(null); }}
                    style={[cc.segItem, u === unit && { backgroundColor: colors.action }]}>
                    <Text style={[cc.segText, { color: u === unit ? colors.actionForeground : colors.mutedForeground }]}>
                      {u === 'ft' ? 'Feet' : u === 'in' ? 'Inches' : 'Meters'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Diagram hint */}
          <View style={[cc.hint, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="info" size={11} color={colors.mutedForeground} />
            <Text style={[cc.hintText, { color: colors.mutedForeground }]}>
              {corners === 3
                ? 'Triangle: enter all 3 boundary sides.'
                : corners === 4
                  ? '4 corners: enter 4 boundary sides + surface diagonal AC.'
                  : corners === 5
                    ? '5 corners: enter 5 boundary sides + surface diagonals AC and AD.'
                    : corners === 6
                      ? '6 corners: enter 6 boundary sides + surface diagonals AC, AD and AE.'
                      : '7 corners: enter 7 boundary sides + surface diagonals AC, AD, AE and AF.'}
              {' Surface measurements only — height/depth is not used.'}
            </Text>
          </View>

          {/* Input grid */}
          <View style={cc.grid}>
            {fields.map(f => (
              <View key={f.key} style={cc.fieldBox}>
                <View style={cc.fieldLabelRow}>
                  <Text style={[cc.fieldLabel, { color: colors.foreground }]}>{f.label}</Text>
                  <Text style={[cc.fieldHint,  { color: colors.mutedForeground }]}>{f.hint}</Text>
                </View>
                <TextInput
                  value={inputs[f.key] ?? ''}
                  onChangeText={v => setField(f.key, v)}
                  keyboardType="decimal-pad"
                  placeholder={`0.00 ${unit}`}
                  placeholderTextColor={colors.mutedForeground + '66'}
                  style={[cc.input, {
                    backgroundColor: colors.background,
                    borderColor: inputs[f.key] ? colors.action + '66' : colors.border,
                    color: colors.foreground,
                  }]}
                />
              </View>
            ))}
          </View>

          {/* Error */}
          {!!error && (
            <View style={cc.errorRow}>
              <Feather name="alert-circle" size={12} color="#dc2626" />
              <Text style={cc.errorText}>{error}</Text>
            </View>
          )}

          {/* Reset */}
          <Pressable onPress={reset}
            style={({ pressed }) => [cc.resetBtn, { borderColor: colors.border, backgroundColor: colors.secondary, opacity: pressed ? 0.72 : 1 }]}>
            <Feather name="refresh-ccw" size={13} color={colors.mutedForeground} />
            <Text style={[cc.resetText, { color: colors.mutedForeground }]}>Clear all fields</Text>
          </Pressable>

          {/* Results */}
          {result && (
            <View style={[cc.results, { backgroundColor: colors.secondary, borderColor: colors.primary + '44' }]}>
              <View style={cc.resultHeader}>
                <Feather name="check-circle" size={14} color={colors.primary} />
                <Text style={[cc.resultTitle, { color: colors.primary }]}>AREA RESULT</Text>
              </View>
              <View style={cc.resultGrid}>
                <CalcResultCell label="Square Feet"  value={result!.sqft.toLocaleString('en', { maximumFractionDigits: 2 })} accent colors={colors} />
                <CalcResultCell label="Marla"        value={result!.marla.toFixed(3)} colors={colors} />
                <CalcResultCell label="Kanal"        value={result!.kanal.toFixed(3)} colors={colors} />
                <CalcResultCell label="Acre"         value={result!.acre.toFixed(4)}  colors={colors} />
                <CalcResultCell label="Square Meter" value={result!.sqm.toFixed(2)} colors={colors} />
              </View>
              <Text style={[cc.resultNote, { color: colors.mutedForeground }]}>
                1 Marla = 272.25 sq ft · 1 Kanal = 20 Marla · 1 Acre = 8 Kanal
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const cc = StyleSheet.create({
  wrapper:      { marginHorizontal: 18, marginBottom: 14, borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  headerIcon:   { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  headerSub:    { fontFamily: 'Inter_400Regular',  fontSize: 10, marginTop: 2 },
  body:         { borderTopWidth: 1, padding: 16, gap: 14 },
  selRow:       { flexDirection: 'row', gap: 12 },
  selLabel:     { fontFamily: 'Inter_500Medium', fontSize: 10, marginBottom: 6 },
  seg:          { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segItem:      { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  segText:      { fontFamily: 'Inter_700Bold', fontSize: 11 },
  hint:         { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  hintText:     { fontFamily: 'Inter_400Regular', fontSize: 10, flex: 1, lineHeight: 15 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fieldBox:     { width: '47.5%' },
  fieldLabelRow:{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 },
  fieldLabel:   { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  fieldHint:    { fontFamily: 'Inter_400Regular',  fontSize: 9 },
  input:        { borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  errorRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText:    { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#dc2626', flex: 1 },
  resetBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: 12, paddingVertical: 11 },
  resetText:    { fontFamily: 'Inter_500Medium', fontSize: 12 },
  results:      { borderWidth: 1.5, borderRadius: 16, padding: 14, gap: 12 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  resultTitle:  { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5 },
  resultGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell:         { width: '47.5%', borderWidth: 1, borderRadius: 13, padding: 13, alignItems: 'center' },
  cellVal:      { fontFamily: 'Inter_700Bold', fontSize: 20, marginBottom: 3 },
  cellLabel:    { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 0.5 },
  resultNote:   { fontFamily: 'Inter_400Regular', fontSize: 9, textAlign: 'center', lineHeight: 13 },
});

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const baseColors = useColors();
  const router     = useRouter();
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const tabBarScrollHandler = useTabBarScrollHandler();
  const { role, user } = useAuth();
  const { hiddenDemoPropertyIds } = useDemoPropertyVisibility();
  const { toggleSaved } = useSaved();

  // Scroll-to-top when user taps the Home tab icon while already on this screen
  const mainScrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    const unsub = navigation.addListener('tabPress' as any, () => {
      mainScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return unsub;
  }, [navigation]);

  const [query,            setQuery]            = useState('');
  const [transaction,      setTransaction]      = useState<Transaction>('Buy');
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [locationOpen,     setLocationOpen]     = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('Okara District');
  const [apiProps,         setApiProps]         = useState<Property[]>([]);
  const [apiLoading,       setApiLoading]       = useState(true);
  const [userListings,     setUserListings]     = useState<Property[]>([]);
  const [devProjects,      setDevProjects]      = useState<DeveloperProject[]>([]);
  const [managedAgents,    setManagedAgents]    = useState<SampleAgent[]>([]);
  const [mobileContent,    setMobileContent]    = useState<MobileContent | null>(null);
  const homeContent = mobileContent?.homepage;
  const homeSections = homeContent?.sections ?? {};
  const colors = {
    ...baseColors,
    primary: homeContent?.theme?.primary || baseColors.primary,
    action: homeContent?.theme?.action || baseColors.action,
  };

  // ── Static toggle pill ────────────────────────────────────────────────────
  const [switcherW,   setSwitcherW]   = useState(0);

  // ── Home banner visibility tracking ───────────────────────────────────────
  const [tabFocused,     setTabFocused]     = useState(true);
  const [bannerVisible,  setBannerVisible]  = useState(true);
  const bannerBottomRef  = useRef(400);        // updated by onLayout; generous default
  const lastVisibleRef   = useRef(true);

  const isHomeBannerVisible = bannerVisible && tabFocused;

  const handleMainScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const scrollY   = e.nativeEvent.contentOffset.y;
    const isVisible = scrollY < bannerBottomRef.current;
    if (isVisible !== lastVisibleRef.current) {
      lastVisibleRef.current = isVisible;
      setBannerVisible(isVisible);
    }
  }, []);

  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  // ── Tab focus → pause banner auto-advance while Home is inactive ──────────
  useFocusEffect(useCallback(() => {
    setTabFocused(true);
    return () => setTabFocused(false);
  }, []));


  // ── Fetch banner slides on focus; local categories are only the offline fallback.
  const [homeBannerSlides, setHomeBannerSlides] = useState<HomeCategoryBannerSlide[]>(
    LOCAL_HOME_BANNER_SLIDES,
  );
  const [propertyError, setPropertyError] = useState('');
  useFocusEffect(useCallback(() => {
    getMobileSettings()
      .then((settings) => setMobileContent(settings.content))
      .catch(() => undefined);
  }, []));

  useFocusEffect(useCallback(() => {
    let active = true;
    getBanners()
      .then((raw) => {
        if (!active) return;
        const mapped = raw.map(mapApiBanner).filter(
          (slide): slide is HomeCategoryBannerSlide => slide !== null,
        );
        setHomeBannerSlides(mapped.length > 0 ? mapped : LOCAL_HOME_BANNER_SLIDES);
      })
      .catch(() => {
        if (active) setHomeBannerSlides(LOCAL_HOME_BANNER_SLIDES);
      });
    return () => {
      active = false;
    };
  }, []));

  useFocusEffect(useCallback(() => {
    getAgents()
      .then((records) => setManagedAgents(records.map(apiAgentToSample)))
      .catch(() => setManagedAgents([]));
  }, []));

  // Fetch live properties on focus; bundled examples remain the offline fallback
  useFocusEffect(useCallback(() => {
    setApiLoading(true);
    setPropertyError('');
    getProperties({ limit: 60 })
      .then((ps) => setApiProps(ps.map(apiPropertyToProperty)))
      .catch(() => setPropertyError('Live properties are temporarily unavailable. Showing curated examples instead.'))
      .finally(() => setApiLoading(false));
  }, []));

  useFocusEffect(useCallback(() => {
    getUserListings()
      .then((ls) => setUserListings(ls.filter((l) => l.role === 'agent').map(userListingToProperty)))
      .catch(() => undefined);
  }, []));

  useEffect(() => {
    if (user && role === 'developer') {
      getDevProjects(user.id).then(setDevProjects).catch(() => undefined);
    }
  }, [user, role]);

  const handleDrawerNavigate = (route?: DrawerRoute) => { setDrawerOpen(false); if (route) router.push(route); };
  const handleDrawerInfo = (_info: DrawerInfo) => { setDrawerOpen(true); };

  // Use API properties when available, fall back to local mock
  const propertySource = selectHomePropertySource(apiProps, properties);
  const allProps = filterVisibleDemoProperties(propertySource, hiddenDemoPropertyIds);

  // Data slices — all driven from live API data (or local fallback)
  const featuredProps    = allProps.filter((p) => p.featured);
  const agriProps        = allProps.filter((p) => p.type === 'Agriculture Land').slice(0, 6);
  const commercialProps  = allProps.filter((p) => p.type === 'Commercial').slice(0, 6);
  const latestCandidates = [...userListings, ...allProps.slice().sort((a, b) => b.id - a.id)];
  const seenLatestIds = new Set<number>();
  const latestProps = latestCandidates.filter((property) => {
    if (seenLatestIds.has(property.id)) return false;
    seenLatestIds.add(property.id);
    return true;
  }).slice(0, 6);
  const recommendedProps = allProps
    .filter((p) => transaction === 'Rent' ? p.status === 'For Rent' : p.status === 'For Sale')
    .slice(0, 8);
  const visibleAgents = managedAgents.length > 0 ? managedAgents : SAMPLE_AGENTS;

  const ctaContent = role === 'agent'
    ? { eyebrow: 'AGENT PORTAL', title: 'Manage your\nlistings', desc: 'Add new properties or track your existing listings.', btn1: 'Add Property', btn1Route: '/(tabs)/post-ad', btn2: 'My Listings', btn2Route: '/(tabs)/listings' }
    : role === 'developer'
    ? { eyebrow: 'DEVELOPER PORTAL', title: 'Promote your\nprojects', desc: 'Showcase your developments to thousands of buyers.', btn1: 'My Projects', btn1Route: '/(tabs)/dashboard', btn2: 'Post Property', btn2Route: '/(tabs)/post-ad' }
    : { eyebrow: 'HAVE A PROPERTY?', title: 'Sell or rent\nwith OG Landmark', desc: 'Connect your property with verified buyers and tenants across Okara District.', btn1: 'Post a Property', btn1Route: '/(tabs)/post-ad', btn2: 'Join as an Agent', btn2Route: '/(auth)/login' };

  return (
    <ScrollView
      ref={mainScrollRef}
      style={[s.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: tabBarHeight }}
      showsVerticalScrollIndicator={false}
      onScroll={(event) => {
        handleMainScroll(event);
        tabBarScrollHandler(event);
      }}
      scrollEventThrottle={16}
    >

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: topInset + 12 }]}>
        <View style={s.topBar}>
          <Pressable
            onPress={() => setDrawerOpen(true)}
            accessibilityRole="button" accessibilityLabel="Open navigation menu" testID="open-navigation-menu"
          >
            <View style={[s.headerIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="menu" size={21} color={colors.action} />
            </View>
          </Pressable>
          <BrandMark />
          <NotificationBell compact />
        </View>

        {/* Buy / Rent toggle */}
        <View
          style={[s.switcher, { backgroundColor: colors.surfaceTint, borderColor: colors.border }]}
          onLayout={(e) => setSwitcherW(e.nativeEvent.layout.width)}
        >
          {switcherW > 0 && (
            <View
              style={[
                s.switchPill,
                {
                  width: switcherW / 2 - 4,
                  left: transaction === 'Rent' ? switcherW / 2 + 2 : 2,
                  backgroundColor: colors.action,
                },
              ]}
              pointerEvents="none"
            />
          )}
          {(['Buy', 'Rent'] as Transaction[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                setTransaction(item);
                setQuery('');
              }}
              style={({ pressed }) => [s.switchItem, { opacity: pressed ? 0.72 : 1 }]}
            >
              <Text style={[s.switchText, { color: transaction === item ? colors.actionForeground : colors.mutedForeground }]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        {/* Smart Search */}
        <View style={[s.searchRow, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <Pressable
            onPress={() => router.push({ pathname: '/explore', params: { type: transaction, search: query } })}
            accessibilityRole="button"
            accessibilityLabel={`Search ${transaction === 'Buy' ? 'properties to buy' : 'properties to rent'}`}
          >
            <View style={[s.searchIconWrap, { backgroundColor: colors.action + '18' }]}>
              <Feather name="search" size={16} color={colors.action} />
            </View>
          </Pressable>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${transaction === 'Buy' ? 'properties' : 'rentals in Okara District'}`}
            placeholderTextColor={colors.mutedForeground}
            style={[s.searchInput, { color: colors.foreground }]}
            returnKeyType="search"
            onSubmitEditing={() => router.push({ pathname: '/explore', params: { type: transaction, search: query } })}
          />
          <Pressable
            onPress={() => setLocationOpen(true)}
            style={[s.locationChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={`Change location, currently ${selectedLocation}`}
          >
            <Feather name="map-pin" size={11} color={colors.action} />
            <Text style={[s.locationChipText, { color: colors.action }]} numberOfLines={1}>{selectedLocation}</Text>
            <Feather name="chevron-down" size={11} color={colors.action} />
          </Pressable>
        </View>
      </View>

      {/* ─── HOME CATEGORY BANNERS ──────────────────────────────────────── */}
      <View onLayout={(e) => {
        bannerBottomRef.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
      }}>
        <HomeCategoryBannerCarousel
          slides={homeBannerSlides}
          isVisible={isHomeBannerVisible}
        />
      </View>

      {/* ─── FIND YOUR PROPERTY (Browse / Discovery) ────────────────────── */}
      <AnimatedReveal>
        {homeContent?.browse?.enabled !== false && <BrowseDiscoveryModule
          transaction={transaction}
          selectedLocation={selectedLocation}
          colors={colors}
          router={router}
          content={{ ...(homeContent?.browse || {}), eyebrow: homeSections.browseEyebrow, title: homeSections.browseTitle }}
          categoryLabels={mobileContent?.screens?.categories}
        />}
      </AnimatedReveal>

      {/* ─── FEATURED PROPERTIES ────────────────────────────────────────── */}
      <View>
        <SectionHeader eyebrow={homeSections.featuredEyebrow || 'HANDPICKED FOR YOU'} title={homeSections.featuredTitle || 'Featured properties'} onViewAll={() => router.push({ pathname: '/explore', params: { type: transaction } })} colors={colors} />
        {apiLoading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
            {[1, 2, 3].map((i) => (
              <SkeletonShimmer key={i} width={300} height={320} borderRadius={22} style={{ marginRight: 16 }} />
            ))}
          </ScrollView>
        ) : featuredProps.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} removeClippedSubviews contentContainerStyle={s.hRow}>
            {featuredProps.map((p) => (
              <FeaturedPropertyCard
                key={p.id}
                property={p}
                colors={colors}
                onPress={() => router.push(`/property/${p.id}`)}
                onSave={() => toggleSaved(p.id)}
              />
            ))}
          </ScrollView>
        ) : (
          <StatusNotice
            icon={propertyError ? 'wifi-off' : 'search'}
            title={propertyError ? 'Unable to load live properties' : 'No featured properties yet'}
            message={propertyError || 'Newly approved properties will appear here.'}
            actionLabel={propertyError ? 'Try again' : undefined}
            onAction={propertyError ? () => { setApiLoading(true); getProperties({ limit: 60 }).then((ps) => setApiProps(ps.map(apiPropertyToProperty))).catch(() => setPropertyError('Please check your connection and try again.')).finally(() => setApiLoading(false)); } : undefined}
            tone={propertyError ? 'error' : 'neutral'}
          />
        )}
      </View>

      {/* ─── RECOMMENDED FOR YOU ─────────────────────────────────────────── */}
      {recommendedProps.length > 0 && (
        <AnimatedReveal delay={140}>
          <View style={[s.sectionHeader, { paddingTop: 36 }]}>
            <View style={{ flex: 1 }}>
              <View style={s.recommendedEyebrowRow}>
                <View style={[s.recommendedDot, { backgroundColor: colors.primary }]} />
                <Text style={[s.sectionEyebrow, { color: colors.primary, marginBottom: 0 }]}>
                  {transaction === 'Buy' ? (homeSections.recommendedEyebrow || 'FOR BUYERS') : (homeSections.recommendedEyebrow || 'FOR RENTERS')}
                </Text>
              </View>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>{homeSections.recommendedTitle || 'Recommended for you'}</Text>
            </View>
            <Pressable onPress={() => router.push({ pathname: '/explore', params: { type: transaction } })} hitSlop={10}>
              <View style={[s.viewAllBtn, { backgroundColor: colors.action + '14', borderColor: colors.action + '33' }]}>
                <Text style={[s.viewAllText, { color: colors.action }]}>View all</Text>
                <Feather name="arrow-right" size={11} color={colors.action} />
              </View>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} removeClippedSubviews contentContainerStyle={s.hRow}>
            {recommendedProps.map((p) => (
              <RecommendedCard
                key={`rec-${p.id}`}
                property={p}
                colors={colors}
                onPress={() => router.push(`/property/${p.id}`)}
              />
            ))}
          </ScrollView>
        </AnimatedReveal>
      )}

      {/* ─── LATEST PROPERTIES ───────────────────────────────────────────── */}
      <AnimatedReveal delay={170}>
        <SectionHeader eyebrow={homeSections.latestEyebrow || 'JUST LISTED'} title={homeSections.latestTitle || 'Latest properties'} onViewAll={() => router.push({ pathname: '/explore', params: { type: transaction } })} colors={colors} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} removeClippedSubviews contentContainerStyle={s.hRow}>
          {latestProps.map((p, i) => <PropertyCard key={`latest-${p.id}-${i}`} property={p} />)}
        </ScrollView>
      </AnimatedReveal>

      {/* ─── PREMIUM PROJECTS ────────────────────────────────────────────── */}
      {(devProjects.length > 0 || projects.length > 0) && <AnimatedReveal delay={200}>
        <SectionHeader eyebrow={homeSections.projectsEyebrow || 'PREMIUM PROJECTS'} title={homeSections.projectsTitle || 'Exceptional developments'} onViewAll={() => router.push({ pathname: '/explore', params: { propertyType: 'House,Apartment' } })} colors={colors} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} removeClippedSubviews contentContainerStyle={s.hRow}>
          {devProjects.map((p) => (
            <DevProjectCard key={p.id} project={p} colors={colors} onPress={() => router.push(`/project/${p.id}` as any)} />
          ))}
          {projects.map((p) => (
            <ProjectShowcaseCard key={p.id} project={p} colors={colors} onPress={() => router.push(`/project/${p.id}`)} />
          ))}
        </ScrollView>
      </AnimatedReveal>}

      {/* ─── AGRICULTURAL & COMMERCIAL OPPORTUNITIES ────────────────────── */}
      {(agriProps.length > 0 || commercialProps.length > 0) && (
        <AnimatedReveal delay={230}>
          {/* Section header with dual tabs */}
          <View style={[s.acHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Agricultural */}
            <Pressable onPress={() => router.push({ pathname: '/explore', params: { propertyType: 'Agriculture Land' } })} style={[s.acTab, { borderRightColor: colors.border }]}>
              <View style={[s.acTabIcon, { backgroundColor: '#183B6018' }]}>
                <Feather name="sun" size={16} color="#183B60" />
              </View>
              <View>
                <Text style={[s.acTabEyebrow, { color: '#183B60' }]}>AGRICULTURE</Text>
                <Text style={[s.acTabTitle, { color: colors.foreground }]}>Farm & Land</Text>
              </View>
              <Feather name="arrow-up-right" size={14} color="#183B60" style={{ marginLeft: 'auto' }} />
            </Pressable>
            {/* Commercial */}
            <Pressable onPress={() => router.push({ pathname: '/explore', params: { propertyType: 'Commercial' } })} style={s.acTab}>
              <View style={[s.acTabIcon, { backgroundColor: colors.action + '18' }]}>
                <Feather name="briefcase" size={16} color={colors.action} />
              </View>
              <View>
                <Text style={[s.acTabEyebrow, { color: colors.action }]}>COMMERCIAL</Text>
                <Text style={[s.acTabTitle, { color: colors.foreground }]}>Shops & Offices</Text>
              </View>
              <Feather name="arrow-up-right" size={14} color={colors.action} style={{ marginLeft: 'auto' }} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} removeClippedSubviews contentContainerStyle={s.hRow}>
            {agriProps.map((p) => (
              <AgriCommCard key={`agri-${p.id}`} property={p} colors={colors} isAgri onPress={() => router.push(`/property/${p.id}`)} />
            ))}
            {commercialProps.map((p) => (
              <AgriCommCard key={`comm-${p.id}`} property={p} colors={colors} isAgri={false} onPress={() => router.push(`/property/${p.id}`)} />
            ))}
          </ScrollView>
        </AnimatedReveal>
      )}

      {/* ─── VERIFIED AGENTS ─────────────────────────────────────────────── */}
      <AnimatedReveal delay={260}>
        {/* Section header with inline See All */}
        <View style={s.agentSectionRow}>
          <View>
            <Text style={[s.agentEyebrow, { color: colors.action }]}>{homeSections.agentsEyebrow || 'VERIFIED PROFESSIONALS'}</Text>
            <Text style={[s.agentTitle, { color: colors.foreground }]}>{homeSections.agentsTitle || 'Verified Agents'}</Text>
          </View>
          <Pressable onPress={() => router.push('/agent/find' as any)}
            style={({ pressed }) => [s.seeAllPill, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={[s.seeAllText, { color: colors.action }]}>See All</Text>
            <Feather name="arrow-right" size={12} color={colors.action} />
          </Pressable>
        </View>
        {/* Agent cards — 18-card slow marquee */}
        <AgentCarousel
          agents={visibleAgents}
          colors={colors}
          onAgentPress={(agentId) => router.push(`/agent/${agentId}` as any)}
        />
      </AnimatedReveal>

      {/* ─── TOOLS & CALCULATORS ─────────────────────────────────────────── */}
      <AnimatedReveal delay={290}>
        <View style={s.toolsSectionRow}>
          <View>
            <Text style={[s.agentEyebrow, { color: colors.action }]}>OG LANDMARK</Text>
            <Text style={[s.agentTitle, { color: colors.foreground }]}>{homeSections.toolsTitle || 'Explore Tools'}</Text>
          </View>
          <Pressable onPress={() => router.push('/tools' as any)}
            style={({ pressed }) => [s.seeAllPill, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={[s.seeAllText, { color: colors.action }]}>Open All</Text>
            <Feather name="arrow-right" size={12} color={colors.action} />
          </Pressable>
        </View>
        {/* 4-tile compact utility grid — each deep-links to the right section */}
        <View style={s.toolsGrid}>
          {([
            { icon: 'maximize-2'  as const, label: 'Area\nConverter',   sub: 'Marla · Kanal · Sq.ft', toolKey: 'area'  },
            { icon: 'trending-up' as const, label: 'Price\nEstimator',  sub: '6 cities · 5 types',    toolKey: 'price' },
            { icon: 'percent'     as const, label: 'ROI\nCalculator',   sub: 'Yield & returns',        toolKey: 'roi'   },
            { icon: 'feather'     as const, label: 'Agri\nLand Tools',  sub: '8 farming terms',        toolKey: 'agri'  },
            { icon: 'grid'        as const, label: 'Land\nCalculator',  sub: 'Area, price & ROI',      toolKey: 'calc'  },
          ]).map((tool) => (
            <Pressable key={tool.label}
              onPress={() =>
                tool.toolKey === 'calc'
                  ? router.push('/(tabs)/calculator' as any)
                  : router.push({ pathname: '/tools', params: { tool: tool.toolKey } } as any)
              }
              style={({ pressed }) => [s.toolTile, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
              <View style={[s.toolTileIcon, { backgroundColor: colors.action + '14' }]}>
                <Feather name={tool.icon} size={18} color={colors.action} />
              </View>
              <Text style={[s.toolTileLabel, { color: colors.foreground }]}>{tool.label}</Text>
              <Text style={[s.toolTileSub, { color: colors.mutedForeground }]}>{tool.sub}</Text>
            </Pressable>
          ))}
        </View>
      </AnimatedReveal>

      {/* ─── OG LANDMARK PROMISE ──────────────────────────────────────────── */}
      <AnimatedReveal delay={290}>
        <ImageBackground source={require('@/assets/images/hero-bg.jpg')} imageStyle={s.heroImage} style={s.hero}>
          <View style={s.heroShade} />
          <Text style={s.heroKicker}>THE OG LANDMARK PROMISE</Text>
          <Text style={s.heroTitle}>Property decisions{'\n'}made with confidence.</Text>
          <View style={s.trustGrid}>
            {TRUST_POINTS.map((pt) => (
              <View key={pt.label} style={s.trustPoint}>
                <View style={s.trustIconWrap}>
                  <Feather name={pt.icon} size={13} color="#c8a45a" />
                </View>
                <Text style={s.trustLabel}>{pt.label}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={() => router.push('/explore')} style={({ pressed }) => [s.heroButton, { opacity: pressed ? 0.82 : 1 }]}>
            <Text style={s.heroButtonText}>Explore listings</Text>
            <Feather name="arrow-up-right" size={15} color="#ffffff" />
          </Pressable>
        </ImageBackground>
      </AnimatedReveal>

      {/* ─── SMART POST-AN-AD CTA ─────────────────────────────────────────── */}
      <AnimatedReveal delay={310}>
        <View style={[s.ctaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.ctaIcon, { backgroundColor: colors.action + '15' }]}>
            <Feather name={role === 'developer' ? 'layers' : role === 'agent' ? 'briefcase' : 'home'} size={22} color={colors.action} />
          </View>
          <Text style={[s.ctaEyebrow, { color: colors.primary }]}>{ctaContent.eyebrow}</Text>
          <Text style={[s.ctaTitle, { color: colors.foreground }]}>{ctaContent.title}</Text>
          <Text style={[s.ctaDesc, { color: colors.mutedForeground }]}>{ctaContent.desc}</Text>
          <View style={s.ctaBtns}>
            <Pressable onPress={() => router.push(ctaContent.btn1Route as any)} style={({ pressed }) => [s.ctaBtn1, { backgroundColor: colors.action, opacity: pressed ? 0.82 : 1 }]}>
              <Text style={[s.ctaBtn1Text, { color: colors.actionForeground }]}>{ctaContent.btn1}</Text>
              <Feather name="arrow-up-right" size={15} color={colors.actionForeground} />
            </Pressable>
            <Pressable onPress={() => router.push(ctaContent.btn2Route as any)} style={({ pressed }) => [s.ctaBtn2, { borderColor: colors.border, backgroundColor: colors.secondary, opacity: pressed ? 0.82 : 1 }]}>
              <Text style={[s.ctaBtn2Text, { color: colors.foreground }]}>{ctaContent.btn2}</Text>
            </Pressable>
          </View>
        </View>
      </AnimatedReveal>

      {/* ─── DRAWERS & MODALS ─────────────────────────────────────────────── */}
      <MenuDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onNavigate={handleDrawerNavigate} onInfo={handleDrawerInfo} />
      <LocationSheet visible={locationOpen} selected={selectedLocation} onSelect={setSelectedLocation} onClose={() => setLocationOpen(false)} colors={colors} insets={insets} mapProperties={allProps} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1 },

  // Header
  header:           { paddingHorizontal: 18, paddingBottom: 20 },
  topBar:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerIcon:       { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0, elevation: 0 },
  switcher:         { flexDirection: 'row', borderRadius: 30, alignSelf: 'flex-start', padding: 3, marginBottom: 15, borderWidth: 1 },
  switchPill:       { position: 'absolute', top: 3, left: 3, bottom: 3, borderRadius: 26 },
  switchItem:       { paddingHorizontal: 24, paddingVertical: 7, borderRadius: 26, zIndex: 1 },
  switchText:       { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  searchRow:        { flexDirection: 'row', alignItems: 'center', borderRadius: 22, borderWidth: 1, paddingLeft: 10, paddingRight: 10, height: 50, gap: 9, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  searchIconWrap:   { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  searchInput:      { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13 },
  locationChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, maxWidth: 128 },
  locationChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, flex: 1 },

  // Section headers
  sectionHeader:    { paddingHorizontal: 18, paddingTop: 36, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionEyebrow:   { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.8, marginBottom: 6 },
  sectionTitle:     { fontFamily: 'Inter_700Bold', fontSize: 22 },
  viewAllBtn:       { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  viewAllText:      { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  hRow:             { paddingHorizontal: 18, paddingBottom: 4 },
  agentCarouselViewport: { width: '100%', overflow: 'hidden' },
  agentTrack:       { flexDirection: 'row' },

  // Recommended eyebrow
  recommendedEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  recommendedDot:   { width: 6, height: 6, borderRadius: 3 },

  // Agricultural & Commercial section
  acHeader:         { marginHorizontal: 18, marginTop: 36, marginBottom: 16, borderWidth: 1, borderRadius: 20, overflow: 'hidden', flexDirection: 'row' },
  acTab:            { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRightWidth: 0.5 },
  acTabIcon:        { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  acTabEyebrow:     { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1.5, marginBottom: 2 },
  acTabTitle:       { fontFamily: 'Inter_700Bold', fontSize: 13 },

  // Agents section header
  agentSectionRow:  { paddingHorizontal: 18, paddingTop: 36, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  agentEyebrow:     { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.8, marginBottom: 5 },
  agentTitle:       { fontFamily: 'Inter_700Bold', fontSize: 22 },
  seeAllPill:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  seeAllText:       { fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  // Tools utility section
  toolsSectionRow:  { paddingHorizontal: 18, paddingTop: 36, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toolsGrid:        { marginHorizontal: 18, marginBottom: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toolTile:         { width: '47.5%', borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  toolTileIcon:     { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toolTileLabel:    { fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 17 },
  toolTileSub:      { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 13 },

  // Hero / Trust
  hero:             { marginHorizontal: 18, marginTop: 36, borderRadius: 22, overflow: 'hidden', paddingHorizontal: 22, paddingTop: 26, paddingBottom: 24 },
  heroImage:        { borderRadius: 22 },
  heroShade:        { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12, 20, 28, 0.75)' },
  heroKicker:       { color: '#bcebd4', fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.8, marginBottom: 10 },
  heroTitle:        { color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 26, lineHeight: 31, marginBottom: 22 },
  trustGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  trustPoint:       { flexDirection: 'row', alignItems: 'center', gap: 8, width: '47%' },
  trustIconWrap:    { width: 28, height: 28, borderRadius: 9, backgroundColor: '#c8a45a22', alignItems: 'center', justifyContent: 'center' },
  trustLabel:       { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#ffffffcc', flex: 1 },
  heroButton:       { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#c8a45a' },
  heroButtonText:   { color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  // Smart CTA
  ctaCard:          { marginHorizontal: 18, marginTop: 36, borderRadius: 24, borderWidth: 1, padding: 24 },
  ctaIcon:          { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  ctaEyebrow:       { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.8, marginBottom: 6 },
  ctaTitle:         { fontFamily: 'Inter_700Bold', fontSize: 26, lineHeight: 31, marginBottom: 10 },
  ctaDesc:          { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginBottom: 22 },
  ctaBtns:          { flexDirection: 'row', gap: 12 },
  ctaBtn1:          { flex: 1, minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, paddingVertical: 6 },
  ctaBtn1Text:      { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  ctaBtn2:          { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 14, paddingVertical: 6 },
  ctaBtn2Text:      { fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  // Drawer styles (unchanged)
  drawerRoot:         { flex: 1, flexDirection: 'row' },
  drawerBackdrop:     { backgroundColor: '#07142899' },
  drawerPanel:        { height: '100%', overflow: 'hidden', borderRightWidth: 1, shadowColor: '#03251d', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 8, height: 0 }, elevation: 16 },
  drawerScrollContent:{ paddingTop: 0, paddingBottom: 18, flexGrow: 1 },
  drawerHeader:       { paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drawerClose:        { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  drawerAccount:      { marginHorizontal: 18, marginTop: 24, borderRadius: 18, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  drawerAccountIcon:  { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  drawerAccountCopy:  { flex: 1 },
  drawerAccountTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 4 },
  drawerAccountDetail:{ opacity: 0.7, fontFamily: 'Inter_400Regular', fontSize: 9 },
  drawerSectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginHorizontal: 20, marginTop: 26, marginBottom: 9 },
  drawerList:         { paddingHorizontal: 12, gap: 7 },
  drawerItem:         { minHeight: 60, borderRadius: 16, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  drawerItemIcon:     { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  drawerItemCopy:     { flex: 1 },
  drawerItemLabel:    { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 3 },
  drawerItemDetail:   { fontFamily: 'Inter_400Regular', fontSize: 9 },
  drawerDivider:      { height: 1, marginHorizontal: 20, marginTop: 22 },
  drawerSupportItem:  { minHeight: 60, marginHorizontal: 12, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  drawerLangRow:      { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginTop: 4, marginBottom: 8 },
  drawerLangBtn:      { flex: 1, borderRadius: 13, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  drawerLangBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  drawerFooter:       { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 },
  drawerFooterText:   { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 5 },
  infoOverlay:        { ...StyleSheet.absoluteFill, justifyContent: 'center', padding: 18 },
  infoCard:           { borderWidth: 1, borderRadius: 22, padding: 18, overflow: 'hidden', shadowColor: '#03251d', shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  infoCardTop:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoCardIcon:       { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  infoEyebrow:        { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.4, marginTop: 22, marginBottom: 6 },
  infoTitle:          { fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 27 },
  infoBody:           { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 11 },
  infoButton:         { height: 40, borderRadius: 13, marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  infoButtonText:     { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CITY_CENTRE: Record<string, { lat: number; lng: number }> = {
  'Okara':             { lat: 30.8139, lng: 73.4467 },
  'Depalpur':          { lat: 30.6647, lng: 73.9742 },
  'Renala Khurd':      { lat: 30.8794, lng: 73.5975 },
  'Hujra Shah Muqeem': { lat: 30.7389, lng: 73.8237 },
  'Basirpur':          { lat: 30.5802, lng: 73.8317 },
  'Haveli Lakha':      { lat: 30.4508, lng: 73.6936 },
};

function userListingToProperty(l: UserListing, index: number): Property {
  const { lat, lng } = CITY_CENTRE[l.city] ?? CITY_CENTRE['Okara'];
  return {
    id: parseInt(l.id.replace(/\D/g, '').slice(-6), 10) || Date.now(),
    title: l.title, type: l.type, status: l.status, price: l.price,
    area: l.area, areaUnit: l.areaUnit, bedrooms: l.bedrooms, bathrooms: l.bathrooms,
    city: l.city, lat, lng,
    address: l.neighborhood ? `${l.neighborhood}, ${l.city}` : l.city,
    description: l.description, image: HOME_PLACEHOLDERS[index % HOME_PLACEHOLDERS.length],
    gallery: [], agent: l.agentName, agentTitle: 'Property Consultant', score: 4.0,
  };
}
