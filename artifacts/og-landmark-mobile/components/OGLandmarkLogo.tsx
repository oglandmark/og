/** OG Landmark roof-and-OG brand mark in teal and landmark gold. */
import React, { useCallback, useEffect } from 'react';
import { Defs, G, LinearGradient, Path, Stop, Svg } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { Platform } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ReduceMotion,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

const O_PATH = 'M110 100 A40 40 0 0 0 30 100 A40 40 0 0 0 110 100';
const G_PATH = 'M182.8 77.1 A40 40 0 1 0 190 100 L152 100';
const ROOF_PATH = 'M60 38 L110 5 L160 38';
const O_LENGTH = 2 * Math.PI * 40;
const G_LENGTH = 265;
const ROOF_LENGTH = 120;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedGroup = Animated.createAnimatedComponent(G);

function easedProgress(value: number, start: number, end: number, easeOut = false) {
  'worklet';
  const progress = Math.min(1, Math.max(0, (value - start) / (end - start)));
  if (easeOut) return 1 - Math.pow(1 - progress, 3);
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

export function OGLandmarkLogo({
  size = 80,
  inverse = false,
  animateOnWeb = false,
  focused,
}: {
  size?: number;
  inverse?: boolean;
  animateOnWeb?: boolean;
  focused?: boolean;
}) {
  const colors = useColors();
  const timeline = useSharedValue(8);
  const gradientId = React.useId().replace(/:/g, '');

  const startAnimation = useCallback(() => {
    cancelAnimation(timeline);
    timeline.value = 8;
    // The user explicitly wants the brand-mark animation on iOS even when
    // Reduce Motion is enabled. Keep this exception local to the logo.
    if (Platform.OS === 'web' && !animateOnWeb) return;
    timeline.value = withDelay(
      10_000,
      withRepeat(
        withSequence(
          ReduceMotion.Never,
          withTiming(0, { duration: 1, reduceMotion: ReduceMotion.Never }),
          withTiming(8, {
            duration: 8000,
            easing: Easing.linear,
            reduceMotion: ReduceMotion.Never,
          }),
        ),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      ),
      ReduceMotion.Never,
    );
  }, [animateOnWeb, timeline]);
  const stopAnimation = useCallback(() => {
    cancelAnimation(timeline);
    timeline.value = 8;
  }, [timeline]);

  useFocusEffect(
    useCallback(() => {
      if (focused !== undefined) return undefined;
      startAnimation();
      return stopAnimation;
    }, [focused, startAnimation, stopAnimation]),
  );
  useEffect(() => {
    if (focused === undefined) return undefined;
    if (!focused) {
      stopAnimation();
      return undefined;
    }
    startAnimation();
    return stopAnimation;
  }, [focused, startAnimation, stopAnimation]);

  const oAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset:
      O_LENGTH * (1 - easedProgress(timeline.value, 0.5, 1.75)),
  }));
  const gAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset:
      G_LENGTH * (1 - easedProgress(timeline.value, 1.25, 2.55)),
  }));
  const roofAnimatedProps = useAnimatedProps(() => {
    const progress = easedProgress(timeline.value, 2.45, 3.1, true);
    return {
      transform: `translate(0, ${-16 * (1 - progress)})`,
    };
  });
  const roofStrokeAnimatedProps = useAnimatedProps(() => {
    const progress = easedProgress(timeline.value, 2.45, 3.1, true);
    return {
      strokeDashoffset: ROOF_LENGTH * (1 - progress),
    };
  });

  const markStroke = inverse
    ? colors.splashWhite
    : `url(#${gradientId})`;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="15 0 190 150"
      preserveAspectRatio="xMidYMid meet"
      accessibilityLabel="OG Landmark roof and OG logo"
    >
      <Defs>
        <LinearGradient
          id={gradientId}
          x1="30"
          y1="0"
          x2="198"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={inverse ? colors.splashWhite : colors.splashTeal} />
          <Stop offset="0.5" stopColor={inverse ? colors.splashWhite : colors.splashMint} />
          <Stop offset="1" stopColor={inverse ? colors.splashWhite : colors.splashGold} />
        </LinearGradient>
      </Defs>

      <AnimatedPath
        d={O_PATH}
        fill="none"
        stroke={markStroke}
        strokeWidth={18}
        strokeOpacity={0.18}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${O_LENGTH} ${O_LENGTH}`}
        animatedProps={oAnimatedProps}
      />
      <AnimatedPath
        d={G_PATH}
        fill="none"
        stroke={markStroke}
        strokeWidth={18}
        strokeOpacity={0.18}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${G_LENGTH} ${G_LENGTH}`}
        animatedProps={gAnimatedProps}
      />
      <AnimatedGroup animatedProps={roofAnimatedProps}>
        <AnimatedPath
          d={ROOF_PATH}
          fill="none"
          stroke={colors.splashGold}
          strokeWidth={14}
          strokeOpacity={0.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${ROOF_LENGTH} ${ROOF_LENGTH}`}
          animatedProps={roofStrokeAnimatedProps}
        />
      </AnimatedGroup>

      <AnimatedPath
        d={O_PATH}
        fill="none"
        stroke={markStroke}
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${O_LENGTH} ${O_LENGTH}`}
        animatedProps={oAnimatedProps}
      />
      <AnimatedPath
        d={G_PATH}
        fill="none"
        stroke={markStroke}
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${G_LENGTH} ${G_LENGTH}`}
        animatedProps={gAnimatedProps}
      />
      <AnimatedGroup animatedProps={roofAnimatedProps}>
        <AnimatedPath
          d={ROOF_PATH}
          fill="none"
          stroke={colors.splashGold}
          strokeWidth={12}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${ROOF_LENGTH} ${ROOF_LENGTH}`}
          animatedProps={roofStrokeAnimatedProps}
        />
      </AnimatedGroup>
    </Svg>
  );
}
