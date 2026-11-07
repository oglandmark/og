import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

const promisePoints = [
  { label: 'Verified Listings', icon: 'check-circle' as const },
  { label: 'Verified Agents', icon: 'award' as const },
  { label: 'Verified Developers', icon: 'layers' as const },
  { label: 'Transparent Info', icon: 'eye' as const },
  { label: 'Secure Inquiries', icon: 'lock' as const },
  { label: 'Professional Experience', icon: 'star' as const },
];

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

function PromisePoint({
  point,
  index,
  colors,
  drawCycle,
  pulse,
  pingCycle,
}: {
  point: (typeof promisePoints)[number];
  index: number;
  colors: ReturnType<typeof useColors>;
  drawCycle: { value: number };
  pulse: { value: number };
  pingCycle: { value: number };
}) {
  const drawProps = useAnimatedProps(() => {
    const progress = Math.min(drawCycle.value / 0.4, 1);
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    return { strokeDashoffset: 60 * (1 - eased) };
  });
  const pulseStyle = useAnimatedStyle(() => ({
    shadowColor: colors.gold,
    shadowOpacity: pulse.value * 0.38,
    shadowRadius: pulse.value * 16,
    elevation: 2 + pulse.value * 4,
  }));
  const pingStyle = useAnimatedStyle(() => {
    const stagger = index % 2 === 0 ? 1.6 / 3.6 : 0;
    const progress = (pingCycle.value + stagger) % 1;
    return {
      opacity: progress < 0.75 ? 0.75 * (1 - progress / 0.75) : 0,
      transform: [{ scale: 0.85 + progress * 1.05 }],
    };
  });

  const iconShapes = (() => {
    switch (point.icon) {
      case 'check-circle':
        return (
          <>
            <AnimatedCircle cx="12" cy="12" r="9" animatedProps={drawProps} />
            <AnimatedPath d="m8 12 2.5 2.5L16.5 8" animatedProps={drawProps} />
          </>
        );
      case 'award':
        return (
          <>
            <AnimatedCircle cx="12" cy="8" r="6" animatedProps={drawProps} />
            <AnimatedPath d="m8.2 13.1-1.2 8 5-3 5 3-1.2-8" animatedProps={drawProps} />
          </>
        );
      case 'layers':
        return (
          <>
            <AnimatedPath d="m12 3 9 5-9 5-9-5 9-5Z" animatedProps={drawProps} />
            <AnimatedPath d="m3 12 9 5 9-5M3 16l9 5 9-5" animatedProps={drawProps} />
          </>
        );
      case 'eye':
        return (
          <>
            <AnimatedPath d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" animatedProps={drawProps} />
            <AnimatedCircle cx="12" cy="12" r="3" animatedProps={drawProps} />
          </>
        );
      case 'lock':
        return (
          <>
            <AnimatedRect x="5" y="11" width="14" height="10" rx="2" animatedProps={drawProps} />
            <AnimatedPath d="M8 11V8a4 4 0 0 1 8 0v3" animatedProps={drawProps} />
          </>
        );
      case 'star':
        return (
          <AnimatedPath d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" animatedProps={drawProps} />
        );
    }
  })();

  return (
    <View style={styles.point}>
      <View style={[styles.pointCard, { borderColor: colors.actionGlassBorder }]}>
        <Animated.View style={[styles.iconWrap, { borderColor: colors.goldGlassBorder, backgroundColor: colors.goldGlass }, pulseStyle]}>
          <Animated.View pointerEvents="none" style={[styles.pingRing, { borderColor: colors.gold }, pingStyle]} />
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            {iconShapes}
          </Svg>
        </Animated.View>
        <Text style={[styles.pointLabel, { color: colors.actionForeground }]}>
          {point.label}
        </Text>
      </View>
    </View>
  );
}

export function PromiseSection({ onExplore }: { onExplore: () => void }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const orbitRotation = useSharedValue(0);
  const shineOffset = useSharedValue(-120);
  const arrowProgress = useSharedValue(0);
  const drawCycle = useSharedValue(0);
  const pulse = useSharedValue(0);
  const pingCycle = useSharedValue(0);
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbitRotation.value}deg` }],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ skewX: '-18deg' }, { translateX: shineOffset.value }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: arrowProgress.value * 3 },
      { translateY: arrowProgress.value * -3 },
    ],
  }));

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return undefined;
      orbitRotation.value = withRepeat(
        withTiming(360, { duration: 70_000, easing: Easing.linear }),
        -1,
        false,
      );
      shineOffset.value = withRepeat(
        withTiming(width + 120, { duration: 5000, easing: Easing.linear }),
        -1,
        false,
      );
      arrowProgress.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      drawCycle.value = withRepeat(
        withTiming(1, { duration: 6000, easing: Easing.linear }),
        -1,
        false,
      );
      pulse.value = withRepeat(
        withTiming(1, { duration: 2250, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      pingCycle.value = withRepeat(
        withTiming(1, { duration: 3600, easing: Easing.linear }),
        -1,
        false,
      );
      return () => {
        cancelAnimation(orbitRotation);
        cancelAnimation(shineOffset);
        cancelAnimation(arrowProgress);
        cancelAnimation(drawCycle);
        cancelAnimation(pulse);
        cancelAnimation(pingCycle);
      };
    }, [arrowProgress, drawCycle, orbitRotation, pingCycle, pulse, reduceMotion, shineOffset, width]),
  );

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <LinearGradient
          pointerEvents="none"
          colors={[colors.splashNavy, '#102B52', '#1B3A63']}
          locations={[0, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.tealGlow} />
        <View pointerEvents="none" style={styles.goldGlow} />
        <Animated.View pointerEvents="none" style={[styles.orbit, orbitStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 200 200">
            <Circle cx="100" cy="100" r="46" fill="none" stroke={colors.splashGold} strokeWidth="9" strokeDasharray="150 140" opacity=".42" />
            <Circle cx="100" cy="100" r="68" fill="none" stroke={colors.splashTeal} strokeWidth="9" strokeDasharray="220 210" opacity=".34" />
            <Circle cx="100" cy="100" r="90" fill="none" stroke={colors.splashGold} strokeWidth="9" strokeDasharray="300 270" opacity=".2" />
          </Svg>
        </Animated.View>
        <Svg pointerEvents="none" viewBox="0 0 358 180" preserveAspectRatio="xMidYMax slice" style={styles.skyline}>
          <G fill="#10264A">
            <Rect x="-12" y="90" width="115" height="100" />
            <Rect x="88" y="60" width="190" height="130" />
            <Rect x="265" y="92" width="112" height="98" />
            <Path d="M132 60c0-42 102-42 102 0Z" />
            <Rect x="180" y="31" width="5" height="20" />
          </G>
          <G fill="none" stroke="#07182F" strokeWidth="3" strokeLinecap="round">
            <Path d="M12 150c24-49 55-54 92-20M11 150c31-25 63-17 83 5M346 150c-24-49-55-54-92-20M347 150c-31-25-63-17-83 5" />
          </G>
          <Circle cx="182" cy="28" r="3.5" fill={colors.splashGold} />
          <G fill="#D5A94F" opacity=".55">
            <Rect x="115" y="82" width="6" height="9" rx="1" />
            <Rect x="139" y="82" width="6" height="9" rx="1" />
            <Rect x="213" y="82" width="6" height="9" rx="1" />
            <Rect x="237" y="82" width="6" height="9" rx="1" />
          </G>
        </Svg>
        <View style={styles.content}>
          <View style={styles.heading}>
            <Text style={[styles.eyebrow, { color: colors.splashMint }]}>
              THE OG LANDMARK PROMISE
            </Text>
            <Text style={[styles.title, { color: colors.actionForeground }]}>
              Property decisions{'\n'}made with{'\n'}
              <Text style={[styles.confidence, { color: colors.gold }]}>confidence.</Text>
            </Text>
          </View>

          <View style={styles.pointsGrid}>
            {promisePoints.map((point, index) => (
              <PromisePoint
                key={point.label}
                point={point}
                index={index}
                colors={colors}
                drawCycle={drawCycle}
                pulse={pulse}
                pingCycle={pingCycle}
              />
            ))}
          </View>

          <Pressable
            onPress={onExplore}
            accessibilityRole="button"
            accessibilityLabel="Explore listings"
            testID="promise-explore-listings"
            style={({ pressed }) => [
              styles.button,
              { opacity: pressed ? 0.84 : 1 },
            ]}
          >
            <LinearGradient
              pointerEvents="none"
              colors={['#F7C96B', colors.gold, '#E9AA3B']}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View pointerEvents="none" style={[styles.buttonShine, shineStyle]} />
            <Text style={[styles.buttonText, { color: colors.foreground }]}>Explore listings</Text>
            <Animated.View style={arrowStyle}>
              <Feather name="arrow-up-right" size={20} color={colors.foreground} />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 18,
    marginTop: 36,
    marginBottom: 4,
  },
  card: {
    width: '100%',
    aspectRatio: 358 / 500,
    minHeight: 465,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#0B1F3A',
    borderWidth: 1,
    borderColor: 'rgba(25,195,177,0.3)',
  },
  tealGlow: {
    position: 'absolute',
    top: -76,
    right: -84,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(25,195,177,0.1)',
  },
  goldGlow: {
    position: 'absolute',
    bottom: 34,
    left: -66,
    width: 220,
    height: 150,
    borderRadius: 110,
    backgroundColor: 'rgba(242,184,75,0.12)',
  },
  orbit: {
    position: 'absolute',
    top: -76,
    right: -76,
    width: 220,
    height: 220,
  },
  skyline: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '36%',
  },
  content: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
  },
  heading: { gap: 2 },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 29,
    lineHeight: 33,
    letterSpacing: -0.55,
  },
  confidence: {
    fontFamily: 'Inter_700Bold',
  },
  pointsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  point: {
    width: '48.5%',
    minHeight: 62,
  },
  pointCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    position: 'relative',
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  pingRing: {
    position: 'absolute',
    top: -1,
    right: -1,
    bottom: -1,
    left: -1,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  pointLabel: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 15,
  },
  button: {
    position: 'relative',
    height: 47,
    marginTop: 10,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  buttonShine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 48,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  buttonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
});
