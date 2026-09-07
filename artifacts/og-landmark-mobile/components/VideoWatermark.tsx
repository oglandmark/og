import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { OGLandmarkLogo } from '@/components/OGLandmarkLogo';
import { useColors } from '@/hooks/useColors';

export function VideoWatermark({
  style,
  placement = 'center',
  compact = false,
}: {
  style?: StyleProp<ViewStyle>;
  placement?: 'center' | 'top-left';
  compact?: boolean;
}) {
  const colors = useColors();

  return (
    <View
      pointerEvents="none"
      style={[placement === 'top-left' ? styles.topLeftAnchor : styles.anchor, style]}
    >
      <View
        style={[
          styles.watermark,
          compact && styles.compactWatermark,
          {
            backgroundColor: colors.actionGlassStrong,
            borderColor: colors.actionGlassBorder,
          },
        ]}
      >
        <OGLandmarkLogo size={compact ? 22 : 32} />
        <Text style={[styles.title, compact && styles.compactTitle, { color: colors.actionForeground }]}>OG Landmark</Text>
        <View style={[styles.glint, { backgroundColor: colors.actionGlassHighlight }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
  },
  topLeftAnchor: {
    position: 'absolute',
    top: 10,
    left: 12,
    zIndex: 25,
  },
  watermark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
    overflow: 'hidden',
  },
  compactWatermark: {
    gap: 5,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  title: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  compactTitle: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  glint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 14,
  },
});