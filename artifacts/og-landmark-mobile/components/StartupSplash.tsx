import React, { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;

export function StartupSplash({
  colors,
  overlay = false,
  fontsReady = true,
}: {
  colors: ReturnType<typeof useColors>;
  overlay?: boolean;
  fontsReady?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);

  const outerRotation = useSharedValue(0);
  const innerRotation = useSharedValue(0);
  const logoOProgress = useSharedValue(reduceMotion ? 1 : 0);
  const logoGProgress = useSharedValue(reduceMotion ? 1 : 0);
  const roofProgress = useSharedValue(reduceMotion ? 1 : 0);
  const wordmarkProgress = useSharedValue(reduceMotion ? 1 : 0);
  const dividerProgress = useSharedValue(reduceMotion ? 1 : 0);
  const categoryProgress = useSharedValue(reduceMotion ? 1 : 0);
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const hintProgress = useSharedValue(reduceMotion ? 1 : 0);

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerRotation.value}deg` }],
  }));
  const innerRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerRotation.value}deg` }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + Math.min(0.45, roofProgress.value * 0.45),
    transform: [{ scale: 0.78 + Math.min(0.32, roofProgress.value * 0.32) }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkProgress.value,
    transform: [{ translateY: (1 - wordmarkProgress.value) * 12 }],
  }));
  const dividerStyle = useAnimatedStyle(() => ({
    opacity: dividerProgress.value,
    transform: [{ scaleX: dividerProgress.value }],
  }));
  const categoryStyle = useAnimatedStyle(() => ({
    opacity: categoryProgress.value,
    transform: [{ translateY: (1 - categoryProgress.value) * 6 }],
  }));
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintProgress.value,
  }));

  const oAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: 251.3 * (1 - logoOProgress.value),
    opacity: logoOProgress.value,
  }));
  const gAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: 330 * (1 - logoGProgress.value),
    opacity: logoGProgress.value,
  }));
  const roofAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: 120 * (1 - roofProgress.value),
    opacity: roofProgress.value,
  }));

  useEffect(() => {
    if (reduceMotion) return undefined;

    outerRotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false,
    );
    innerRotation.value = withRepeat(
      withTiming(-360, { duration: 4200, easing: Easing.linear }),
      -1,
      false,
    );
    logoOProgress.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) });
    logoGProgress.value = withDelay(
      650,
      withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }),
    );
    roofProgress.value = withDelay(
      1650,
      withTiming(1, { duration: 850, easing: Easing.out(Easing.quad) }),
    );
    wordmarkProgress.value = withDelay(2600, withTiming(1, { duration: 650 }));
    dividerProgress.value = withDelay(3400, withTiming(1, { duration: 550 }));
    categoryProgress.value = withDelay(3900, withTiming(1, { duration: 550 }));
    progress.value = withTiming(1, { duration: 7000, easing: Easing.out(Easing.quad) });
    hintProgress.value = withDelay(5000, withTiming(1, { duration: 450 }));

    return () => {
      cancelAnimation(outerRotation);
      cancelAnimation(innerRotation);
      cancelAnimation(logoOProgress);
      cancelAnimation(logoGProgress);
      cancelAnimation(roofProgress);
      cancelAnimation(wordmarkProgress);
      cancelAnimation(dividerProgress);
      cancelAnimation(categoryProgress);
      cancelAnimation(progress);
      cancelAnimation(hintProgress);
    };
  }, [
    categoryProgress,
    dividerProgress,
    hintProgress,
    innerRotation,
    logoGProgress,
    logoOProgress,
    outerRotation,
    progress,
    reduceMotion,
    roofProgress,
    wordmarkProgress,
  ]);

  return (
    <Animated.View
      accessible
      accessibilityLabel="Loading OG Landmark"
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(280)}
      style={[styles.root, overlay && styles.overlay, { backgroundColor: colors.splashBackground }]}
    >
      <StatusBar style="light" />
      <Svg
        pointerEvents="none"
        width={DESIGN_WIDTH}
        height={DESIGN_HEIGHT}
        viewBox={`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`}
        style={[styles.backgroundSvg, { transform: [{ scale }] }]}
      >
        <Defs>
          <RadialGradient
            id="splashBackground"
            cx="195"
            cy="320"
            r="580"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={colors.splashGlow} />
            <Stop offset="0.58" stopColor={colors.splashNavy} />
            <Stop offset="1" stopColor={colors.splashBackground} />
          </RadialGradient>
        </Defs>
        <Rect width={DESIGN_WIDTH} height={DESIGN_HEIGHT} fill="url(#splashBackground)" />
      </Svg>

      <View
        pointerEvents="none"
        style={[
          styles.stage,
          { transform: [{ translateX: -DESIGN_WIDTH / 2 }, { translateY: -DESIGN_HEIGHT / 2 }, { scale }] },
        ]}
      >
        <Animated.View style={[styles.orbit, outerRingStyle]}>
          <Svg width={400} height={400} viewBox="0 0 400 400">
            <Circle cx={200} cy={200} r={190} fill="none" stroke={colors.splashWhite} strokeOpacity={0.07} />
            <Circle
              cx={200}
              cy={200}
              r={190}
              fill="none"
              stroke={colors.splashTeal}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="90 1104"
              transform="rotate(-30 200 200)"
            />
            <Circle
              cx={200}
              cy={200}
              r={190}
              fill="none"
              stroke={colors.splashGold}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="90 1104"
              transform="rotate(90 200 200)"
            />
            <Circle
              cx={200}
              cy={200}
              r={190}
              fill="none"
              stroke={colors.splashMint}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="90 1104"
              transform="rotate(210 200 200)"
            />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.orbit, styles.innerOrbit, innerRingStyle]}>
          <Svg width={400} height={400} viewBox="0 0 400 400">
            <Circle cx={200} cy={200} r={150} fill="none" stroke={colors.splashWhite} strokeOpacity={0.09} />
            <Circle
              cx={200}
              cy={200}
              r={150}
              fill="none"
              stroke={colors.splashGold}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="70 872"
              transform="rotate(140 200 200)"
            />
            <Circle
              cx={200}
              cy={200}
              r={150}
              fill="none"
              stroke={colors.splashTeal}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="70 872"
              transform="rotate(260 200 200)"
            />
            <Circle
              cx={200}
              cy={200}
              r={150}
              fill="none"
              stroke={colors.splashWhite}
              strokeOpacity={0.8}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="70 872"
              transform="rotate(20 200 200)"
            />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.halo, haloStyle]}>
          <Svg width={220} height={220} viewBox="0 0 220 220">
            <Defs>
              <RadialGradient id="splashHalo" cx="110" cy="110" r="110" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={colors.splashTeal} stopOpacity={0.3} />
                <Stop offset="1" stopColor={colors.splashTeal} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={110} cy={110} r={110} fill="url(#splashHalo)" />
          </Svg>
        </Animated.View>

        <Svg
          width={260}
          height={189}
          viewBox="0 -8 220 160"
          accessibilityLabel="OG Landmark roof logo"
          style={styles.logo}
        >
          <Defs>
            <SvgLinearGradient id="splashLogoGradient" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.splashTeal} />
              <Stop offset="0.5" stopColor={colors.splashMint} />
              <Stop offset="1" stopColor={colors.splashGold} />
            </SvgLinearGradient>
          </Defs>
          <AnimatedCircle
            cx={70}
            cy={100}
            r={40}
            fill="none"
            stroke="url(#splashLogoGradient)"
            strokeWidth={16}
            strokeLinecap="round"
            strokeDasharray="251.3"
            animatedProps={oAnimatedProps}
          />
          <AnimatedPath
            d="M182.8 77.1 A40 40 0 1 0 190 100 L152 100"
            fill="none"
            stroke="url(#splashLogoGradient)"
            strokeWidth={16}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="330"
            animatedProps={gAnimatedProps}
          />
          <AnimatedPath
            d="M60 38 L110 5 L160 38"
            fill="none"
            stroke={colors.splashGold}
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="120"
            animatedProps={roofAnimatedProps}
          />
        </Svg>

        <Animated.View style={[styles.wordmark, wordmarkStyle]}>
          <Animated.Text
            style={[
              styles.wordmarkOg,
              { fontFamily: Platform.OS === 'web' ? 'Arial' : fontsReady ? 'Inter_700Bold' : 'sans-serif' },
              { color: colors.splashGold },
            ]}
          >
            OG
          </Animated.Text>
          <View style={styles.wordmarkGap} />
          <Animated.Text
            style={[
              styles.wordmarkLandmark,
              { fontFamily: Platform.OS === 'web' ? 'Arial' : fontsReady ? 'Inter_600SemiBold' : 'sans-serif' },
              { color: colors.splashWhite },
            ]}
          >
            LANDMARK
          </Animated.Text>
        </Animated.View>

        <Animated.View style={[styles.divider, dividerStyle]}>
          <LinearGradient
            colors={['transparent', colors.splashTeal, colors.splashGold, 'transparent']}
            locations={[0, 0.25, 0.75, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.Text
          style={[
            styles.category,
            categoryStyle,
            { fontFamily: Platform.OS === 'web' ? 'Arial' : fontsReady ? 'Inter_600SemiBold' : 'sans-serif' },
            { color: colors.splashMuted },
          ]}
        >
          REAL ESTATE
        </Animated.Text>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              progressStyle,
            ]}
          >
            <LinearGradient
              colors={[colors.splashTeal, colors.splashGold]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        <Animated.Text
          style={[
            styles.hint,
            hintStyle,
            { fontFamily: Platform.OS === 'web' ? 'Arial' : fontsReady ? 'Inter_400Regular' : 'sans-serif' },
            { color: colors.splashMuted },
          ]}
        >
          Find your next landmark
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 200,
    elevation: 200,
  },
  backgroundSvg: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -DESIGN_WIDTH / 2,
    marginTop: -DESIGN_HEIGHT / 2,
  },
  stage: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
  },
  orbit: {
    position: 'absolute',
    left: -5,
    top: 130,
    width: 400,
    height: 400,
  },
  innerOrbit: {
    opacity: 0.9,
  },
  halo: {
    position: 'absolute',
    left: 85,
    top: 220,
    width: 220,
    height: 220,
  },
  logo: {
    position: 'absolute',
    left: 65,
    top: 236,
  },
  wordmark: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 560,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
  },
  wordmarkOg: {
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 30,
  },
  wordmarkGap: {
    width: 14,
  },
  wordmarkLandmark: {
    fontSize: 27,
    fontWeight: '600',
    letterSpacing: 1.2,
    lineHeight: 30,
  },
  divider: {
    position: 'absolute',
    left: 135,
    top: 614,
    width: 120,
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    opacity: 0.9,
  },
  category: {
    position: 'absolute',
    top: 632,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 5,
    paddingLeft: 5,
  },
  progressTrack: {
    position: 'absolute',
    top: 738,
    left: 135,
    width: 120,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressFill: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    transformOrigin: 'left',
  },
  hint: {
    position: 'absolute',
    top: 760,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    letterSpacing: 0.96,
  },
});
