import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useOnboarding } from '@/context/OnboardingContext';
import { BrandMark } from '@/components/BrandMark';

type OnboardingSlide = {
  eyebrow: string;
  title: string;
  description: string;
  image: ImageSourcePropType;
  icon: keyof typeof Feather.glyphMap;
};

const SLIDES: OnboardingSlide[] = [
  {
    eyebrow: 'A CLEARER WAY TO SEARCH',
    title: 'Discover\nProperties',
    description: 'Explore homes, land and developments chosen to help you move with confidence.',
    image: require('@/assets/images/property-3.jpg'),
    icon: 'compass',
  },
  {
    eyebrow: 'TRUST EVERY DETAIL',
    title: 'Verified\nProperties',
    description: 'Find listings, agents and developers reviewed with the care your next move deserves.',
    image: require('@/assets/images/property-5.jpg'),
    icon: 'check-circle',
  },
  {
    eyebrow: 'MAKE IT YOURS',
    title: 'Find\nYour Place',
    description: 'From the first search to the front door, OG Landmark brings the right place closer.',
    image: require('@/assets/images/property-1.jpg'),
    icon: 'home',
  },
];

function Slide({ slide, width, colors, index, total }: {
  slide: OnboardingSlide;
  width: number;
  colors: ReturnType<typeof useColors>;
  index: number;
  total: number;
}) {
  return (
    <View style={[styles.slide, { width, backgroundColor: colors.actionDeep }]}>
      <ExpoImage source={slide.image} style={styles.image} contentFit="cover" transition={250} />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[colors.actionDeep + '18', colors.actionDeep + '30', colors.actionDeep + 'E8']}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.slideMeta}>
        <View style={[styles.slideIcon, { backgroundColor: colors.primary }]}>
          <Feather name={slide.icon} size={18} color={colors.action} />
        </View>
        <Text style={[styles.slideCount, { color: colors.background + 'CC' }]}>
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </Text>
      </View>
      <View style={styles.slideContent}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>{slide.eyebrow}</Text>
        <Text style={[styles.title, { color: colors.background }]}>{slide.title}</Text>
        <Text style={[styles.description, { color: colors.background + 'CC' }]}>{slide.description}</Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { completeOnboarding } = useOnboarding();
  const [page, setPage] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomInset = insets.bottom + (Platform.OS === 'web' ? 34 : 0);
  const isLastPage = page === SLIDES.length - 1;

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
    void Haptics.selectionAsync();
  }, []);

  const handleNext = useCallback(() => {
    if (isLastPage) {
      if (isCompleting) return;
      setIsCompleting(true);
      void completeOnboarding().then(() => router.replace('/(tabs)')).catch(() => setIsCompleting(false));
      return;
    }
    const nextPage = page + 1;
    scrollRef.current?.scrollTo({ x: nextPage * width, animated: true });
    handlePageChange(nextPage);
  }, [completeOnboarding, handlePageChange, isCompleting, isLastPage, page, router, width]);

  const handleSkip = useCallback(() => {
    if (isCompleting) return;
    setIsCompleting(true);
    void Haptics.selectionAsync();
    void completeOnboarding().then(() => router.replace('/(tabs)')).catch(() => setIsCompleting(false));
  }, [completeOnboarding, isCompleting, router]);

  return (
    <View style={[styles.root, { backgroundColor: colors.actionDeep }]}>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.actionSoft, colors.action, colors.actionDeep]}
        locations={[0, 0.38, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.glow, styles.glowTop, { backgroundColor: colors.actionGlassSoft }]} />
      <View pointerEvents="none" style={[styles.glow, styles.glowBottom, { backgroundColor: colors.actionGlassSoft }]} />

      <View
        style={[
          styles.topBarShell,
          {
            marginTop: topInset,
            backgroundColor: colors.actionGlass,
            borderColor: colors.actionGlassBorder,
          },
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[colors.actionGlassHighlight, 'transparent']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.topBar}>
          <BrandMark inverse />
          {!isLastPage ? (
            <Pressable onPress={handleSkip} disabled={isCompleting} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip onboarding">
              <Text style={[styles.skip, { color: colors.background + 'CC' }]}>Skip</Text>
            </Pressable>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </View>
      </View>

      <View style={styles.intro}>
        <Text style={[styles.introKicker, { color: colors.primary }]}>WELCOME TO OG LANDMARK</Text>
        <Text style={[styles.introText, { color: colors.background }]}>Property, with perspective.</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const nextPage = Math.round(event.nativeEvent.contentOffset.x / width);
          if (nextPage !== page) handlePageChange(nextPage);
        }}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      >
        {SLIDES.map((slide, index) => (
          <Slide key={slide.title} slide={slide} width={width - 40} colors={colors} index={index} total={SLIDES.length} />
        ))}
      </ScrollView>

      <View
        style={[
          styles.bottom,
          {
            paddingBottom: bottomInset + 12,
            backgroundColor: colors.actionGlass,
            borderColor: colors.actionGlassBorder,
          },
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', colors.actionGlassHighlight]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.indicators} accessibilityLabel={`Onboarding page ${page + 1} of ${SLIDES.length}`}>
          {SLIDES.map((slide, index) => (
            <View
              key={slide.title}
              style={[
                styles.indicator,
                { backgroundColor: index === page ? colors.primary : colors.background + '38' },
                index === page && styles.indicatorActive,
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={handleNext}
          disabled={isCompleting}
          style={({ pressed }) => [
            styles.nextButton,
            { backgroundColor: colors.primary, opacity: pressed || isCompleting ? 0.72 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isLastPage ? 'Get started' : 'Next'}
          testID={isLastPage ? 'get-started-button' : 'next-onboarding-button'}
        >
          {isCompleting ? (
            <ActivityIndicator size="small" color={colors.action} />
          ) : (
            <>
              <Text style={[styles.nextText, { color: colors.action }]}>
                {isLastPage ? 'Get Started' : 'Next'}
              </Text>
              <Feather name="arrow-right" size={17} color={colors.action} />
            </>
          )}
        </Pressable>
        <Text style={[styles.footer, { color: colors.background + '70' }]}>
          Verified property. Better living.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.45,
  },
  glowTop: { top: 80, right: -100 },
  glowBottom: { bottom: 110, left: -120 },
  topBarShell: {
    marginHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  topBar: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skip: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 0.2 },
  skipPlaceholder: { width: 30 },
  intro: { paddingHorizontal: 24, marginTop: 30, marginBottom: 18 },
  introKicker: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 2.5, marginBottom: 8 },
  introText: { fontFamily: 'Inter_500Medium', fontSize: 17, letterSpacing: 0.1 },
  carousel: { flex: 1 },
  carouselContent: { paddingHorizontal: 20, flexGrow: 1, gap: 12 },
  slide: { flex: 1, minHeight: 0, paddingHorizontal: 0, borderRadius: 28, overflow: 'hidden' },
  image: StyleSheet.absoluteFill,
  slideMeta: { position: 'absolute', top: 20, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slideCount: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4 },
  slideContent: { padding: 24, paddingBottom: 28 },
  slideIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 2, marginBottom: 9 },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 36, lineHeight: 42, letterSpacing: 0, marginBottom: 12 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, maxWidth: 285 },
  bottom: {
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingTop: 19,
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 13,
  },
  indicators: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 6 },
  indicator: { width: 7, height: 7, borderRadius: 4 },
  indicatorActive: { width: 25 },
  nextButton: { height: 44, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  nextText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, letterSpacing: 0.1 },
  footer: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', letterSpacing: 0.3 },
});