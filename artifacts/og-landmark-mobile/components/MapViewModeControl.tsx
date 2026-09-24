import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type MapViewMode = 'map' | 'satellite' | 'street';

const OPTIONS: { value: MapViewMode; label: string }[] = [
  { value: 'map', label: 'Map' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'street', label: 'Street View' },
];

interface Props {
  mode: MapViewMode;
  onChange: (mode: MapViewMode) => void;
}

export function MapViewModeControl({ mode, onChange }: Props) {
  return (
    <View style={styles.container}>
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
              { borderBottomColor: selected ? '#f2d18a' : 'transparent' },
            ]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>
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
    top: 6,
    right: 10,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
  button: {
    minHeight: 44,
    paddingHorizontal: 2,
    justifyContent: 'center',
    borderBottomWidth: 2,
    backgroundColor: 'transparent',
  },
  label: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  selectedLabel: { color: '#f2d18a' },
});