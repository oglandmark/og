import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import {
  formatMapAreaRange,
  MAP_AREA_BLUE,
  MAP_AREA_BLUE_FILL,
  MAP_AREA_MAX_KM,
  MAP_AREA_MIN_KM,
  MAP_AREA_RANGE_STEPS,
} from '@/components/mapRadius';

export {
  formatMapAreaRange,
  MAP_AREA_BLUE,
  MAP_AREA_BLUE_FILL,
  MAP_AREA_MAX_KM,
  MAP_AREA_MIN_KM,
  MAP_AREA_RANGE_STEPS,
};

interface Props {
  value: number;
  onChange: (value: number) => void;
  colors: {
    card: string;
    border: string;
    foreground: string;
    mutedForeground: string;
  };
}
export function MapAreaRange({ value, onChange, colors }: Props) {
  const [trackWidth, setTrackWidth] = React.useState(0);
  const safeValue = Math.max(MAP_AREA_MIN_KM, Math.min(MAP_AREA_MAX_KM, Number(value) || MAP_AREA_MIN_KM));
  const progress = (safeValue - MAP_AREA_MIN_KM) / (MAP_AREA_MAX_KM - MAP_AREA_MIN_KM);

  const updateFromLocation = (locationX: number) => {
    const coordinate = Number(locationX);
    if (!trackWidth || !Number.isFinite(coordinate)) return;
    const rawPercent = Math.max(0, Math.min(1, coordinate / trackWidth));
    const percent = rawPercent <= 0.02 ? 0 : rawPercent >= 0.98 ? 1 : rawPercent;
    const nextValue = MAP_AREA_MIN_KM + percent * (MAP_AREA_MAX_KM - MAP_AREA_MIN_KM);
    onChange(Math.round(nextValue * 10) / 10);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.labelWrap}>
          <Feather name="map-pin" size={13} color={colors.mutedForeground} />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Area Range</Text>
        </View>
        <Text style={[styles.value, { color: colors.foreground }]}>{formatMapAreaRange(safeValue)}</Text>
      </View>
      <View
        style={styles.trackHitArea}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => updateFromLocation(event.nativeEvent.locationX)}
        onResponderMove={(event) => updateFromLocation(event.nativeEvent.locationX)}
        accessibilityRole="adjustable"
        accessibilityLabel="Area range"
        accessibilityValue={{
          now: Math.round(safeValue * 1000),
          min: MAP_AREA_MIN_KM * 1000,
          max: MAP_AREA_MAX_KM * 1000,
          text: formatMapAreaRange(safeValue),
        }}
        accessibilityHint="Drag to change the map search radius"
      >
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          {MAP_AREA_RANGE_STEPS.map((step, index) => (
            <View
              key={step}
              pointerEvents="none"
              style={[
                styles.tick,
                {
                  left: `${((step - MAP_AREA_MIN_KM) / (MAP_AREA_MAX_KM - MAP_AREA_MIN_KM)) * 100}%`,
                  backgroundColor: step <= safeValue ? MAP_AREA_BLUE : colors.border,
                },
              ]}
            />
          ))}
          <View
            style={[
              styles.thumb,
              { left: `${progress * 100}%` },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingTop: 11,
    paddingBottom: 7,
    shadowColor: '#102A43',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  value: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  trackHitArea: { paddingVertical: 9, position: 'relative' },
  track: { height: 4, borderRadius: 3, position: 'relative' },
  fill: { height: 4, borderRadius: 3, backgroundColor: MAP_AREA_BLUE },
  tick: {
    position: 'absolute',
    top: -1,
    marginLeft: -1,
    width: 2,
    height: 6,
    borderRadius: 1,
  },
  thumb: {
    position: 'absolute',
    top: -4,
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: MAP_AREA_BLUE,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#102A43',
    shadowOpacity: 0.24,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
