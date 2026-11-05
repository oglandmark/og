/** OG Landmark roof-and-OG brand mark in teal and landmark gold. */
import React, { useCallback } from 'react';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { Platform } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const logoAsset = require('@/assets/images/og-landmark-brand-mark-color.png');
const inverseLogoAsset = require('@/assets/images/og-landmark-brand-mark-inverse.png');

export function OGLandmarkLogo({
  size = 80,
  inverse = false,
}: {
  size?: number;
  inverse?: boolean;
}) {
  const markPulse = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useFocusEffect(
    useCallback(() => {
      cancelAnimation(markPulse);
      markPulse.value = 0;

      if (Platform.OS === 'web' || reduceMotion) return undefined;

      markPulse.value = withDelay(
        10_000,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) }),
            withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            withDelay(2200, withTiming(0, { duration: 1 })),
          ),
          -1,
          false,
        ),
      );

      return () => cancelAnimation(markPulse);
    }, [markPulse, reduceMotion]),
  );

  const motionStyle = useAnimatedStyle(() => ({
    opacity: 1 - markPulse.value * 0.04,
    transform: [
      { scale: 1 + markPulse.value * 0.035 },
      { translateY: -markPulse.value * 0.8 },
    ],
  }));

  return (
    <Animated.View style={motionStyle}>
      <Image
        source={inverse ? inverseLogoAsset : logoAsset}
        style={{ width: size, height: size }}
        contentFit="contain"
        transition={0}
        accessibilityLabel="OG Landmark logo"
      />
    </Animated.View>
  );
}
