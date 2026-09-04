import React from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

type GlassCardProps = ViewProps & {
  children: React.ReactNode;
  intensity?: number;
  contentStyle?: StyleProp<ViewStyle>;
};

export function GlassCard({
  children,
  style,
  contentStyle,
  intensity = 42,
  ...props
}: GlassCardProps) {
  const colors = useColors();

  return (
    <View {...props} style={[styles.shell, { borderColor: colors.glassBorder }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
      <LinearGradient
        pointerEvents="none"
        colors={[colors.glassOverlay, '#ffffff00']}
        style={styles.highlight}
      />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#1c2024',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 34,
  },
});
