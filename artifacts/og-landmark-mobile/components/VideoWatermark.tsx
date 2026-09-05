import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { OGLandmarkLogo } from '@/components/OGLandmarkLogo';
import { useColors } from '@/hooks/useColors';

export function VideoWatermark({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useColors();

  return (
    <View
      pointerEvents="none"
      style={[styles.anchor, style]}
    >
      <View
        style={[
          styles.watermark,
          {
            backgroundColor: colors.actionGlassStrong,
            borderColor: colors.actionGlassBorder,
          },
        ]}
      >
        <OGLandmarkLogo size={32} />
        <Text style={[styles.title, { color: colors.actionForeground }]}>OG Landmark</Text>
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
  title: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  glint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 14,
  },
});