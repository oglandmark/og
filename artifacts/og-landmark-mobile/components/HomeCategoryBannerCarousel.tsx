import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type HomeCategoryBannerSlide = {
  id: string | number;
  category: 'homes' | 'commercial' | 'agriculture' | 'plots' | 'projects';
  image: ImageSourcePropType;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  route: string;
  ctaParams: Record<string, string>;
};

type HomeCategoryBannerCarouselProps = {
  slides: HomeCategoryBannerSlide[];
  isVisible: boolean;
};

const AUTOPLAY_INTERVAL_MS = 5600;

export default function HomeCategoryBannerCarousel({
  slides,
  isVisible,
}: HomeCategoryBannerCarouselProps) {
  const colors = useColors();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [carouselWidth, setCarouselWidth] = useState(windowWidth);
  const [reduceMotion, setReduceMotion] = useState(false);
  const renderedSlides =
    slides.length > 1 ? [...slides, slides[0]] : slides;

  const setIndex = useCallback((index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (activeIndex >= slides.length) {
      setIndex(0);
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [activeIndex, setIndex, slides.length]);

  useEffect(() => {
    if (!isVisible || reduceMotion || slides.length < 2) return undefined;

    const timer = setInterval(() => {
      const currentIndex = activeIndexRef.current;
      const nextIndex = (currentIndex + 1) % slides.length;
      const targetIndex =
        currentIndex === slides.length - 1 ? slides.length : nextIndex;
      setIndex(nextIndex);
      scrollRef.current?.scrollTo({
        x: targetIndex * carouselWidth,
        animated: true,
      });
    }, AUTOPLAY_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [carouselWidth, isVisible, reduceMotion, setIndex, slides.length]);

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!carouselWidth) return;
      const physicalIndex = Math.max(
        0,
        Math.round(event.nativeEvent.contentOffset.x / carouselWidth),
      );
      if (physicalIndex >= slides.length) {
        setIndex(0);
        scrollRef.current?.scrollTo({ x: 0, animated: false });
        return;
      }
      setIndex(physicalIndex);
    },
    [carouselWidth, setIndex, slides.length],
  );

  const goToSlide = useCallback(
    (index: number) => {
      setIndex(index);
      scrollRef.current?.scrollTo({
        x: index * carouselWidth,
        animated: !reduceMotion,
      });
    },
    [carouselWidth, reduceMotion, setIndex],
  );

  if (slides.length === 0) return null;

  return (
    <View
      style={styles.carousel}
      testID="home-category-banner-carousel"
      accessibilityLabel="Explore property categories"
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && nextWidth !== carouselWidth) {
          setCarouselWidth(nextWidth);
          scrollRef.current?.scrollTo({
            x: activeIndexRef.current * nextWidth,
            animated: false,
          });
        }
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        accessibilityLabel="Property category banners. Swipe to browse."
        testID="home-category-banner-scroll"
        style={styles.scroller}
        contentContainerStyle={styles.scrollerContent}
      >
        {renderedSlides.map((slide, index) => {
          const isLoopClone = index >= slides.length;
          const logicalIndex = index % slides.length;
          const loopCloneSuffix = isLoopClone ? '-loop-clone' : '';
          return (
          <View
            key={isLoopClone ? `${slide.id}-loop-clone` : slide.id}
            style={[
              styles.slide,
              {
                width: carouselWidth,
                borderColor: colors.glassBorder,
                borderRadius: colors.radii?.xl ?? 22,
              },
            ]}
            accessibilityLabel={`${slide.eyebrow}. ${slide.title}. ${slide.subtitle}`}
            accessibilityElementsHidden={isLoopClone}
            importantForAccessibility={
              isLoopClone ? 'no-hide-descendants' : 'auto'
            }
            testID={`home-category-slide-${slide.category}${loopCloneSuffix}`}
          >
            <Image
              source={slide.image}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={reduceMotion ? 0 : 350}
              accessibilityIgnoresInvertColors
            />
            <LinearGradient
              colors={[
                colors.actionGlassSoft,
                colors.actionGlass,
                colors.actionGlassStrong,
              ]}
              locations={[0, 0.42, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.topLine} pointerEvents="none">
              <View style={styles.eyebrowGroup}>
                <View style={[styles.goldRule, { backgroundColor: colors.gold }]} />
                <Text style={[styles.eyebrow, { color: colors.gold }]} numberOfLines={1}>
                  {slide.eyebrow}
                </Text>
              </View>
              <View
                style={[
                  styles.countPill,
                  {
                    backgroundColor: colors.actionGlass,
                    borderColor: colors.actionGlassBorder,
                  },
                ]}
              >
                <Text style={[styles.countText, { color: colors.actionForeground }]}>
                  {String(logicalIndex + 1).padStart(2, '0')}
                  <Text style={[styles.countDivider, { color: colors.glassOverlay }]}>
                    {' / '}
                  </Text>
                  {String(slides.length).padStart(2, '0')}
                </Text>
              </View>
            </View>
            <View style={styles.copy}>
              <Text
                style={[
                  styles.title,
                  {
                    color: colors.actionForeground,
                    textShadowColor: colors.shadow,
                  },
                ]}
                numberOfLines={2}
              >
                {slide.title}
              </Text>
              <Text
                style={[styles.subtitle, { color: colors.glassOverlay }]}
                numberOfLines={2}
              >
                {slide.subtitle}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${slide.cta}: ${slide.title}`}
                testID={`home-category-cta-${slide.category}${loopCloneSuffix}`}
                onPress={() =>
                  router.push({
                    pathname: slide.route as never,
                    params: slide.ctaParams,
                  })
                }
                style={({ pressed }) => [
                  styles.cta,
                  {
                    backgroundColor: colors.gold,
                    opacity: pressed ? 0.88 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
              >
                <Text style={[styles.ctaText, { color: colors.actionDeep }]}>
                  {slide.cta}
                </Text>
                <Feather
                  name="arrow-up-right"
                  size={16}
                  color={colors.actionDeep}
                  accessible={false}
                />
              </Pressable>
            </View>
          </View>
          );
        })}
      </ScrollView>
      {slides.length > 1 ? (
        <View
          style={styles.pagination}
          accessibilityLabel={`Slide ${activeIndex + 1} of ${slides.length}`}
          testID="home-category-banner-pagination"
        >
          <View style={styles.dots}>
            {slides.map((slide, index) => {
              const selected = index === activeIndex;
              return (
                <Pressable
                  key={slide.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Show ${slide.eyebrow} banner`}
                  testID={`home-category-dot-${index + 1}`}
                  onPress={() => goToSlide(index)}
                  hitSlop={8}
                  style={styles.dotHitArea}
                >
                  <View
                    style={[
                      styles.dot,
                      {
                        width: selected ? 23 : 6,
                        backgroundColor: selected
                          ? colors.action
                          : colors.border,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.paginationLabel, { color: colors.mutedForeground }]}>
            DISCOVER
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: {
    width: '100%',
    alignSelf: 'stretch',
  },
  scroller: {
    width: '100%',
    overflow: 'hidden',
  },
  scrollerContent: {
    alignItems: 'stretch',
  },
  slide: {
    height: 176,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  topLine: {
    position: 'absolute',
    zIndex: 1,
    top: 12,
    left: 16,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowGroup: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  goldRule: {
    width: 22,
    height: 2,
    flexShrink: 0,
  },
  eyebrow: {
    flexShrink: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.45,
    textTransform: 'uppercase',
  },
  countPill: {
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  countText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  countDivider: {
  },
  copy: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 12,
    alignItems: 'flex-start',
  },
  title: {
    maxWidth: '100%',
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 21,
    lineHeight: 25,
    letterSpacing: -0.35,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  subtitle: {
    marginTop: 3,
    marginBottom: 7,
    maxWidth: 310,
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.1,
  },
  cta: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
  },
  ctaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.1,
  },
  pagination: {
    minHeight: 38,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8,
  },
  dotHitArea: {
    minWidth: 23,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 8,
  },
  paginationLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.8,
  },
});