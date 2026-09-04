import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';

export function PropertyDemoBadge({
  visible = true,
  compact = false,
  style,
}: {
  visible?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();

  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.badge,
        compact && styles.compact,
        {
          backgroundColor: colors.actionGlassStrong,
          borderColor: colors.actionGlassBorder,
        },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.gold }]} />
      <Text style={[styles.text, compact && styles.compactText, { color: colors.actionForeground }]}>
        DEMO
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  compact: {
    gap: 4,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  compactText: {
    fontSize: 8,
    letterSpacing: 0.6,
  },
});