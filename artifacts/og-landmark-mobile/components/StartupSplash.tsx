import React, { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
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
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;
const SKYLINE_HEIGHTS = [0.52, 0.82, 0.61, 1, 0.73, 0.91, 0.57, 0.96, 0.68, 0.86, 0.62, 1, 0.76, 0.54];
const SPLASH_STARS = Array.from({ length: 26 }, (_, index) => ({
  x: (index * 137 + 23) % DESIGN_WIDTH,
  y: 90 + ((index * 191 + 31) % 540),
  radius: 0.8 + (index % 4) * 0.45,
  opacity: 0.18 + (index % 5) * 0.07,
}));

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
  const splashAudioPlayer = useAudioPlayer(
    require('@/assets/audio/splash-brand-intro.mp3'),
  );

  const outerRotation = useSharedValue(0);
  const innerRotation = useSharedValue(0);
  const logoProgress = useSharedValue(reduceMotion ? 1 : 0);
  const glintProgress = useSharedValue(0);
  const wordmarkProgress = useSharedValue(reduceMotion ? 1 : 0);
  const dividerProgress = useSharedValue(reduceMotion ? 1 : 0);
  const categoryProgress = useSharedValue(reduceMotion ? 1 : 0);
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const hintProgress = useSharedValue(reduceMotion ? 1 : 0);

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerRotation.value}deg` }, { scale: 0.88 }],
  }));
  const innerRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerRotation.value}deg` }, { scale: 0.84 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + Math.min(0.45, logoProgress.value * 0.45),
    transform: [{ scale: 0.78 + Math.min(0.2, logoProgress.value * 0.2) }],
  }));
  const logoRevealStyle = useAnimatedStyle(() => ({
    opacity: logoProgress.value,
    transform: [{ scale: 0.94 + logoProgress.value * 0.06 }],
  }));
  const glintStyle = useAnimatedStyle(() => {
    const progressValue = glintProgress.value;
    return {
      opacity: progressValue > 0 && progressValue < 1 ? Math.sin(progressValue * Math.PI) * 0.8 : 0,
      transform: [{ translateX: -90 + progressValue * 300 }, { skewX: '-18deg' }],
    };
  });
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

  useEffect(() => {
    let active = true;
    const playIntro = () => {
      if (!active) return;
      splashAudioPlayer.volume = 0.7;
      splashAudioPlayer.play();
    };

    if (Platform.OS === 'web') {
      // Try autoplay on web too. Some browsers still require an earlier user
      // gesture; a blocked sound must never hold up the splash or show a prompt.
      try {
        playIntro();
      } catch {
        // Browser autoplay restrictions can reject unprompted playback.
      }
    } else {
      void setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: false,
      }).then(playIntro).catch(() => {
        // Audio setup must never block the app from opening.
      });
    }

    return () => {
      active = false;
      try {
        splashAudioPlayer.pause();
      } catch {
        // The audio player may already be released during teardown.
      }
    };
  }, [splashAudioPlayer]);

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
    logoProgress.value = withDelay(
      250,
      withTiming(1, { duration: 850, easing: Easing.out(Easing.quad) }),
    );
    glintProgress.value = withDelay(2950, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }));
    wordmarkProgress.value = withDelay(3500, withTiming(1, { duration: 650 }));
    dividerProgress.value = withDelay(3900, withTiming(1, { duration: 550 }));
    categoryProgress.value = withDelay(4200, withTiming(1, { duration: 550 }));
    progress.value = withTiming(1, { duration: 8000, easing: Easing.out(Easing.quad) });
    hintProgress.value = withDelay(5000, withTiming(1, { duration: 450 }));

    return () => {
      cancelAnimation(outerRotation);
      cancelAnimation(innerRotation);
      cancelAnimation(logoProgress);
      cancelAnimation(glintProgress);
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
    glintProgress,
    logoProgress,
    outerRotation,
    progress,
    reduceMotion,
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
        <SvgLinearGradient id="cityFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.splashNavy} stopOpacity={0.2} />
          <Stop offset="1" stopColor={colors.splashBackground} stopOpacity={0.92} />
        </SvgLinearGradient>
        </Defs>
        <Rect width={DESIGN_WIDTH} height={DESIGN_HEIGHT} fill="url(#splashBackground)" />
        {SPLASH_STARS.map((star, index) => (
          <Circle
            key={`star-${index}`}
            cx={star.x}
            cy={star.y}
            r={star.radius}
            fill={index % 3 === 0 ? colors.splashGold : colors.splashWhite}
            opacity={star.opacity}
          />
        ))}
        <Rect x={0} y={680} width={DESIGN_WIDTH} height={164} fill="url(#cityFade)" />
        {SKYLINE_HEIGHTS.map((buildingHeight, index) => {
          const buildingWidth = DESIGN_WIDTH / SKYLINE_HEIGHTS.length;
          const buildingX = index * buildingWidth;
          const buildingY = 844 - buildingHeight * 126;
          return (
            <React.Fragment key={`building-${index}`}>
              <Rect
                x={buildingX + 1}
                y={buildingY}
                width={buildingWidth - 2}
                height={844 - buildingY}
                fill={colors.splashNavy}
                opacity={0.55}
              />
              {[0, 1, 2].map((windowIndex) => (
                <Rect
                  key={`window-${windowIndex}`}
                  x={buildingX + 5 + (windowIndex % 2) * 8}
                  y={buildingY + 13 + Math.floor(windowIndex / 2) * 14}
                  width={3}
                  height={4}
                  fill={windowIndex % 2 === 0 ? colors.splashGold : colors.splashTeal}
                  opacity={0.35}
                />
              ))}
            </React.Fragment>
          );
        })}
      </Svg>

      <View
        pointerEvents="none"
        style={[
          styles.stage,
          { transform: [{ translateX: -DESIGN_WIDTH / 2 }, { translateY: -DESIGN_HEIGHT / 2 }, { scale }] },
        ]}
      >
        <Animated.View
          renderToHardwareTextureAndroid
          shouldRasterizeIOS
          style={[styles.orbit, outerRingStyle]}
        >
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

        <Animated.View
          renderToHardwareTextureAndroid
          shouldRasterizeIOS
          style={[styles.orbit, styles.innerOrbit, innerRingStyle]}
        >
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
          <Svg width={190} height={190} viewBox="0 0 190 190">
            <Defs>
              <RadialGradient id="splashHalo" cx="95" cy="95" r="95" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={colors.splashTeal} stopOpacity={0.3} />
                <Stop offset="1" stopColor={colors.splashTeal} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={95} cy={95} r={95} fill="url(#splashHalo)" />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.logo, logoRevealStyle]}>
          <Svg
            width={220}
            height={160}
            viewBox="0 -8 220 160"
            accessibilityLabel="OG Landmark roof logo"
          >
            <Defs>
              <SvgLinearGradient id="splashLogoGradient" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.splashTeal} />
                <Stop offset="0.5" stopColor={colors.splashMint} />
                <Stop offset="1" stopColor={colors.splashGold} />
              </SvgLinearGradient>
            </Defs>
            <Circle
              cx={70}
              cy={100}
              r={40}
              fill="none"
              stroke="url(#splashLogoGradient)"
              strokeWidth={16}
              strokeLinecap="round"
              strokeDasharray="251.3"
            />
            <Path
              d="M182.8 77.1 A40 40 0 1 0 190 100 L152 100"
              fill="none"
              stroke="url(#splashLogoGradient)"
              strokeWidth={16}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="330"
            />
            <Path
              d="M60 38 L110 5 L160 38"
              fill="none"
              stroke={colors.splashGold}
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="120"
            />
          </Svg>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.logoGlint, glintStyle]}>
          <LinearGradient
            colors={['transparent', colors.splashWhite, colors.splashGold, 'transparent']}
            locations={[0, 0.42, 0.58, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

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
          REAL ESTATE · HOMES · PROPERTIES
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
            styles.loadingLabel,
            hintStyle,
            { fontFamily: Platform.OS === 'web' ? 'Arial' : fontsReady ? 'Inter_600SemiBold' : 'sans-serif' },
            { color: colors.splashMuted },
          ]}
        >
          LOADING
        </Animated.Text>

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
    left: 100,
    top: 235,
    width: 190,
    height: 190,
  },
  logo: {
    position: 'absolute',
    left: 85,
    top: 250,
  },
  logoGlint: {
    position: 'absolute',
    left: 85,
    top: 238,
    width: 50,
    height: 184,
    overflow: 'hidden',
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
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 27,
  },
  wordmarkGap: {
    width: 12,
  },
  wordmarkLandmark: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 1.2,
    lineHeight: 27,
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
    top: 730,
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
    top: 778,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    letterSpacing: 0.96,
  },
  loadingLabel: {
    position: 'absolute',
    top: 750,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 4.5,
  },
});
