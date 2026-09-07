/**
 * SkeletonShimmer — lightweight loading placeholder.
 *
 * Uses a LinearGradient swept horizontally via Reanimated (UI thread).
 * No JS-thread loops, no Lottie, no GIFs.
 * Respects reduced-motion — shows a static muted block instead of shimmer.
 */
import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface SkeletonShimmerProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonShimmer({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonShimmerProps) {
  const reducedMotion = useReducedMotion();
  const translateX = useSharedValue(-1);

  useEffect(() => {
    if (reducedMotion) return;
    translateX.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => {
      translateX.value = -1;
    };
  }, [reducedMotion, translateX]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * 300 }],
  }));

  return (
    <View
      style={[
        styles.base,
        { width: width as any, height, borderRadius },
        style,
      ]}
    >
      {!reducedMotion && (
        <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
          <LinearGradient
            colors={[
              'transparent',
              'rgba(255,255,255,0.35)',
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          />
        </Animated.View>
      )}
    </View>
  );
}

// ── Preset skeleton rows ───────────────────────────────────────────────────────

export function SkeletonCard({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      <SkeletonShimmer height={174} borderRadius={0} style={styles.cardImage} />
      <View style={styles.cardBody}>
        <SkeletonShimmer width="55%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonShimmer width="80%" height={11} style={{ marginBottom: 6 }} />
        <SkeletonShimmer width="40%" height={10} />
      </View>
    </View>
  );
}

export function SkeletonLine({
  width = '100%',
  height = 12,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <SkeletonShimmer width={width} height={height} style={style} />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'rgba(150,150,150,0.13)',
    overflow: 'hidden',
  },
  gradient: {
    width: 200,
    height: '100%',
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(150,150,150,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.13)',
    marginBottom: 14,
  },
  cardImage: {
    width: '100%',
  },
  cardBody: {
    padding: 13,
    gap: 4,
  },
});
