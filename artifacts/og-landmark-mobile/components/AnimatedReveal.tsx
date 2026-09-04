/**
 * AnimatedReveal — lightweight entrance animation used across all screens.
 *
 * Performance notes:
 *  - All animation runs on the UI thread via Reanimated worklets.
 *  - 280ms duration: fast enough to feel snappy, slow enough to feel premium.
 *  - Respects reduced-motion (collapses to instant snap when true).
 *  - On tab return (progress ≥ 0.95) snaps to 1 — no re-animation.
 */
import React, { useCallback } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';

type AnimatedRevealProps = {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedReveal({
  children,
  delay = 0,
  distance = 8,
  style,
}: AnimatedRevealProps) {
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useFocusEffect(
    useCallback(() => {
      if (progress.value >= 0.95) {
        // Already animated — snap to remove any sub-pixel drift, no re-animation.
        progress.value = 1;
        return;
      }

      if (reducedMotion) {
        // Accessibility: skip animation for users who prefer reduced motion.
        progress.value = 1;
        return;
      }

      progress.value = withDelay(
        delay,
        withTiming(1, {
          duration: 280,
          easing: Easing.out(Easing.cubic),
        }),
      );
    }, [delay, progress, reducedMotion]),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * distance },
      { scale: 0.98 + progress.value * 0.02 },
    ],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
