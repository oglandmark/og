import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type MapViewMode = 'map' | 'satellite';

const OPTIONS: { value: MapViewMode; label: string }[] = [
  { value: 'map', label: 'Map' },
  { value: 'satellite', label: 'Satellite' },
];

interface Props {
  mode: MapViewMode;
  onChange: (mode: MapViewMode) => void;
  top?: number;
  left?: number;
  right?: number;
  horizontal?: boolean;
  buttonHeight?: number;
}

export function MapViewModeControl({
  mode,
  onChange,
  top = 100,
  left = 12,
  right,
  horizontal = false,
  buttonHeight = 30,
}: Props) {
  const colors = useColors();
  const glassBlur = Platform.OS === 'web'
    ? { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } as any
    : undefined;

  return (
    <View style={[
      styles.container,
      horizontal && styles.horizontalContainer,
      {
        backgroundColor: colors.mapGlass,
        borderColor: colors.mapGlassBorder,
      },
      glassBlur,
      { top, left, right },
    ]}>
      {OPTIONS.map((option) => {
        const selected = mode === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={`${option.label} map view`}
            accessibilityState={{ selected }}
            testID={`map-view-mode-${option.value}`}
            onPress={() => onChange(option.value)}
            style={[
              styles.button,
              horizontal && styles.horizontalButton,
              horizontal && { height: buttonHeight, minHeight: buttonHeight },
              horizontal && option.value === 'map' && [
                styles.firstHorizontalButton,
                { borderRightColor: colors.mapGlassBorder },
              ],
              { borderBottomColor: selected ? colors.gold : 'transparent' },
            ]}
          >
            <Text style={[
              styles.label,
              { color: selected ? colors.gold : colors.foreground },
            ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    left: 12,
    zIndex: 1000,
    alignItems: 'stretch',
    gap: 2,
    padding: 3,
    borderWidth: 1,
    borderRadius: 10,
    shadowColor: '#102a43',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  horizontalContainer: {
    flexDirection: 'row',
    gap: 0,
    padding: 0,
    borderWidth: 0,
    overflow: 'hidden',
  },
  button: {
    width: 84,
    minHeight: 36,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    backgroundColor: 'transparent',
  },
  horizontalButton: {
    flex: 1,
    width: undefined,
    paddingHorizontal: 4,
  },
  firstHorizontalButton: {
    borderRightWidth: 1,
    borderRightColor: '#d6e0e8',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});