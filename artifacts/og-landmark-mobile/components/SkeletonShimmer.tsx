/**
 * SkeletonShimmer — static loading placeholder.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

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
  return (
    <View
      style={[
        styles.base,
        { width: width as any, height, borderRadius },
        style,
      ]}
    />
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
