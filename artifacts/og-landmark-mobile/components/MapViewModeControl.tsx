import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type MapViewMode = 'map' | 'satellite';

const OPTIONS: { value: MapViewMode; label: string; icon: 'map-marked-alt' | 'satellite' }[] = [
  { value: 'map', label: 'Map', icon: 'map-marked-alt' },
  { value: 'satellite', label: 'Satellite', icon: 'satellite' },
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
        backgroundColor: '#ffffff',
        borderColor: '#d6e0e8',
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
                { borderRightColor: '#d6e0e8' },
              ],
              { borderBottomColor: selected ? colors.gold : 'transparent' },
            ]}
          >
            <View style={styles.optionContent}>
              <FontAwesome5
                name={option.icon}
                size={14}
                color={selected ? '#987332' : '#0B1F3A'}
              />
              <Text style={[
                styles.label,
                { color: selected ? '#987332' : '#0B1F3A' },
              ]}>
                {option.label}
              </Text>
            </View>
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
    shadowColor: '#0B1F3A',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  horizontalContainer: {
    flexDirection: 'row',
    gap: 0,
    padding: 0,
    borderWidth: 1,
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
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});