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
  normalizeMapAreaRange,
} from '@/components/mapRadius';

export {
  formatMapAreaRange,
  MAP_AREA_BLUE,
  MAP_AREA_BLUE_FILL,
  MAP_AREA_MAX_KM,
  MAP_AREA_MIN_KM,
  MAP_AREA_RANGE_STEPS,
  normalizeMapAreaRange,
};

interface Props {
  value: number;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  colors: {
    card: string;
    border: string;
    foreground: string;
    mutedForeground: string;
  };
}
export function MapAreaRange({ value, onChange, onChangeEnd, colors }: Props) {
  const [trackWidth, setTrackWidth] = React.useState(0);
  const safeValue = normalizeMapAreaRange(value);
  const progress = (safeValue - MAP_AREA_MIN_KM) / (MAP_AREA_MAX_KM - MAP_AREA_MIN_KM);

  const valueFromLocation = (locationX: number) => {
    const coordinate = Number(locationX);
    if (!trackWidth || !Number.isFinite(coordinate)) return null;
    const rawPercent = Math.max(0, Math.min(1, coordinate / trackWidth));
    const percent = rawPercent <= 0.02 ? 0 : rawPercent >= 0.98 ? 1 : rawPercent;
    return normalizeMapAreaRange(MAP_AREA_MIN_KM + percent * (MAP_AREA_MAX_KM - MAP_AREA_MIN_KM));
  };

  const updateFromLocation = (locationX: number) => {
    const nextValue = valueFromLocation(locationX);
    if (nextValue != null) onChange(nextValue);
  };

  const commitFromLocation = (locationX: number) => {
    const nextValue = valueFromLocation(locationX);
    if (nextValue != null) onChangeEnd?.(nextValue);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.header}>
        <View style={styles.labelWrap}>
            <View style={[styles.iconWrap, { backgroundColor: `${MAP_AREA_BLUE}16` }]}>
              <Feather name="map-pin" size={13} color={MAP_AREA_BLUE} />
            </View>
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Area Range</Text>
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>Drag to expand the search area</Text>
            </View>
        </View>
          <View style={[styles.valuePill, { backgroundColor: `${MAP_AREA_BLUE}10`, borderColor: `${MAP_AREA_BLUE}28` }]}>
            <Text style={[styles.value, { color: MAP_AREA_BLUE }]}>{formatMapAreaRange(safeValue)}</Text>
          </View>
      </View>
      <View
        style={styles.trackHitArea}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => updateFromLocation(event.nativeEvent.locationX)}
        onResponderMove={(event) => updateFromLocation(event.nativeEvent.locationX)}
        onResponderRelease={(event) => commitFromLocation(event.nativeEvent.locationX)}
        onResponderTerminate={(event) => commitFromLocation(event.nativeEvent.locationX)}
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
        <View style={styles.trackLabels}>
          <Text style={[styles.trackLabel, { color: colors.mutedForeground }]}>
            {formatMapAreaRange(MAP_AREA_MIN_KM)}
          </Text>
          <Text style={[styles.trackLabel, { color: colors.mutedForeground }]}>
            {formatMapAreaRange(MAP_AREA_MAX_KM)}
          </Text>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingTop: 13,
    paddingBottom: 9,
    shadowColor: '#102A43',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  labelWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconWrap: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  helper: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2 },
  valuePill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  value: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  trackHitArea: { paddingTop: 14, paddingBottom: 5, position: 'relative' },
  track: { height: 6, borderRadius: 4, position: 'relative' },
  fill: { height: 6, borderRadius: 4, backgroundColor: MAP_AREA_BLUE },
  tick: {
    position: 'absolute',
    top: 0,
    marginLeft: -1,
    width: 2,
    height: 8,
    borderRadius: 1,
  },
  thumb: {
    position: 'absolute',
    top: -6,
    marginLeft: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: MAP_AREA_BLUE,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#102A43',
    shadowOpacity: 0.24,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 1 },
  trackLabel: { fontFamily: 'Inter_500Medium', fontSize: 9 },
});
