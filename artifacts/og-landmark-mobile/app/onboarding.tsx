import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OGLandmarkLogo } from '@/components/OGLandmarkLogo';
import { useColors } from '@/hooks/useColors';
import { glassControlStyle } from '@/components/glassControls';
import { useLanguage } from '@/context/LanguageContext';
import { markOnboardingComplete } from '@/lib/onboarding';

const slides = [
  {
    key: 'homes',
    image: require('@/assets/images/banner-categories/homes.jpg'),
    eyebrow: { en: 'FIND YOUR PLACE', ur: 'اپنا گھر تلاش کریں' },
    title: { en: 'A home that feels like yours.', ur: 'اپنا گھر، اپنی پہچان۔' },
    description: {
      en: 'Explore thoughtfully selected homes and find the right place for your next chapter.',
      ur: 'منتخب گھروں میں سے اپنے اگلے خوبصورت مرحلے کے لیے بہترین جگہ تلاش کریں۔',
    },
    note: { en: 'HOMES · PLOTS · COMMUNITIES', ur: 'گھر · پلاٹس · کمیونٹیز' },
  },
  {
    key: 'commercial',
    image: require('@/assets/images/banner-categories/commercial.jpg'),
    eyebrow: { en: 'MAKE YOUR NEXT MOVE', ur: 'اگلا قدم آگے بڑھائیں' },
    title: { en: 'Space for your next big move.', ur: 'آپ کے اگلے بڑے قدم کے لیے جگہ۔' },
    description: {
      en: 'Discover shops, offices and commercial spaces with room to grow your business.',
      ur: 'اپنے کاروبار کی ترقی کے لیے دکانیں، دفاتر اور تجارتی جگہیں دریافت کریں۔',
    },
    note: { en: 'SHOPS · OFFICES · INVESTMENT', ur: 'دکانیں · دفاتر · سرمایہ کاری' },
  },
  {
    key: 'agriculture',
    image: require('@/assets/images/banner-categories/agriculture.jpg'),
    eyebrow: { en: 'ROOM TO GROW', ur: 'ترقی کے لیے وسیع زمین' },
    title: { en: 'Land with room to grow.', ur: 'ترقی کے امکانات والی زمین۔' },
    description: {
      en: 'Explore agricultural land and discover opportunities rooted in a strong future.',
      ur: 'زرعی زمین تلاش کریں اور روشن مستقبل کے نئے مواقع دریافت کریں۔',
    },
    note: { en: 'FARMLAND · FERTILE · FUTURE-READY', ur: 'زرعی زمین · زرخیز · مستقبل ساز' },
  },
] as const;

export default function OnboardingScreen() {
  const colors = useColors();
  const { lang, isRTL } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [pageWidth, setPageWidth] = useState(width);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const isUrdu = lang === 'ur';
  const heroHeight = Math.min(Math.round(height * 0.53), 470);
  const pageHeight = Math.max(height - insets.top, 620);

  const completeOnboarding = useCallback(async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      await markOnboardingComplete();
      router.replace('/(tabs)');
    } catch {
      setIsCompleting(false);
      Alert.alert(
        isUrdu ? 'محفوظ نہیں ہو سکا' : 'Could not save',
        isUrdu
          ? 'براہِ کرم دوبارہ کوشش کریں۔'
          : 'Please try again to finish setting up the app.',
      );
    }
  }, [isCompleting, isUrdu, router]);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const viewportWidth = event.nativeEvent.layoutMeasurement.width || pageWidth;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / viewportWidth);
    setActiveIndex(Math.max(0, Math.min(slides.length - 1, nextIndex)));
  };

  const goToSlide = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * pageWidth, animated: true });
    setActiveIndex(index);
  };

  const advance = () => {
    if (activeIndex < slides.length - 1) goToSlide(activeIndex + 1);
    else void completeOnboarding();
  };

  const skipLabel = isUrdu ? 'چھوڑیں' : 'Skip';
  const actionLabel = isCompleting
    ? (isUrdu ? 'تیاری ہو رہی ہے…' : 'Getting things ready…')
    : activeIndex === slides.length - 1
      ? (isUrdu ? 'او جی لینڈمارک دیکھیں' : 'Explore OG Landmark')
      : (isUrdu ? 'اگلا' : 'Continue');

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pager}
        contentContainerStyle={{ direction: 'ltr' }}
        accessibilityLabel={isUrdu ? 'تعارفی صفحات' : 'Introduction screens'}
        onLayout={(event) => {
          const measuredWidth = event.nativeEvent.layout.width;
          if (measuredWidth > 0 && Math.abs(measuredWidth - pageWidth) > 0.5) {
            setPageWidth(measuredWidth);
          }
        }}
      >
        {slides.map((slide, index) => (
          <View key={slide.key} style={{ width: pageWidth, height: pageHeight }}>
            <View style={[styles.hero, { height: heroHeight, backgroundColor: colors.splashNavy }]}>
              <Image
                source={slide.image}
                contentFit="cover"
                transition={180}
                style={StyleSheet.absoluteFill}
                accessibilityLabel={slide.key}
              />
              <LinearGradient
                colors={[`${colors.splashNavy}38`, `${colors.splashNavy}14`, `${colors.splashNavy}C7`]}
                locations={[0, 0.42, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.heroHeader, { paddingTop: 16 }]}>
                <View style={styles.brandLockup}>
                  <OGLandmarkLogo size={34} inverse />
                  <Text style={[styles.brandName, { color: colors.splashWhite }]}>OG LANDMARK</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={skipLabel}
                  disabled={isCompleting}
                  onPress={() => void completeOnboarding()}
                  style={({ pressed }) => [
                    styles.skipButton,
                    glassControlStyle(colors, 'action'),
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.skipText, { color: colors.splashWhite }]}>{skipLabel}</Text>
                  <Feather name={isUrdu ? 'arrow-left' : 'arrow-right'} size={14} color={colors.splashWhite} />
                </Pressable>
              </View>
              <View style={[styles.heroFooter, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                <View style={[
                  styles.categoryPill,
                  { backgroundColor: colors.actionGlass, borderColor: colors.actionGlassBorder },
                ]}>
                  <View style={[styles.pillDot, { backgroundColor: colors.gold }]} />
                  <Text style={[styles.categoryLabel, { color: colors.splashWhite }]}>
                    {slide.eyebrow[isUrdu ? 'ur' : 'en']}
                  </Text>
                </View>
                <Text style={[
                  styles.slideCount,
                  { color: colors.splashWhite, alignSelf: isRTL ? 'flex-end' : 'flex-start' },
                ]}>
                  {String(index + 1).padStart(2, '0')}  /  03
                </Text>
              </View>
            </View>

            <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 22 }]}>
              <Text
                style={[
                  styles.title,
                  { color: colors.action, textAlign: isRTL ? 'right' : 'left' },
                  isUrdu && styles.urduText,
                ]}
              >
                {slide.title[isUrdu ? 'ur' : 'en']}
              </Text>
              <Text
                style={[
                  styles.description,
                  { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' },
                  isUrdu && styles.urduText,
                ]}
              >
                {slide.description[isUrdu ? 'ur' : 'en']}
              </Text>

              <View style={[styles.noteRow, { borderTopColor: colors.border }]}>
                <Feather name={index === 0 ? 'home' : index === 1 ? 'briefcase' : 'sun'} size={15} color={colors.teal} />
                <Text style={[styles.noteText, { color: colors.accentForeground }, isUrdu && styles.urduText]}>
                  {slide.note[isUrdu ? 'ur' : 'en']}
                </Text>
              </View>

              <View style={styles.bottomRow}>
                <View style={[styles.progressDots, { direction: 'ltr' }]}>
                  {slides.map((dot, dotIndex) => (
                    <Pressable
                      key={dot.key}
                      accessibilityRole="button"
                      accessibilityLabel={`${dotIndex + 1} / ${slides.length}`}
                      onPress={() => goToSlide(dotIndex)}
                      style={[
                        styles.progressDot,
                        { backgroundColor: dotIndex === activeIndex ? colors.teal : colors.border },
                        dotIndex === activeIndex && styles.progressDotActive,
                      ]}
                    />
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={actionLabel}
                  disabled={isCompleting}
                  onPress={advance}
                  style={({ pressed }) => [
                    styles.continueButton,
                    { ...glassControlStyle(colors, 'action'), shadowColor: colors.shadow },
                    pressed && styles.pressed,
                    isCompleting && styles.disabled,
                  ]}
                >
                  <Text style={[styles.continueText, { color: colors.splashWhite }, isUrdu && styles.urduText]}>
                    {actionLabel}
                  </Text>
                  <Feather name={isUrdu ? 'arrow-left' : 'arrow-right'} size={17} color={colors.splashWhite} />
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: { flex: 1 },
  hero: {
    position: 'relative',
    overflow: 'hidden',
  },
  heroHeader: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandName: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  skipText: { fontSize: 12, fontWeight: '600' },
  heroFooter: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 22,
    gap: 12,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  categoryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  slideCount: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 26,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  description: { fontSize: 15, lineHeight: 24, maxWidth: 360 },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 22,
    paddingTop: 16,
  },
  noteText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 22,
  },
  progressDots: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  progressDot: { width: 7, height: 7, borderRadius: 4 },
  progressDotActive: { width: 22, borderRadius: 5 },
  continueButton: {
    minHeight: 46,
    paddingHorizontal: 19,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 4,
  },
  continueText: { fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.65 },
  urduText: { fontFamily: 'Inter_500Medium' },
});
