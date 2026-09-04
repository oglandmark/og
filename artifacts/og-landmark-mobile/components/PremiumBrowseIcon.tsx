import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

export type BrowseIconName =
  | 'home'
  | 'map-pin'
  | 'briefcase'
  | 'map'
  | 'shopping-bag'
  | 'archive'
  | 'layers'
  | 'maximize-2'
  | 'star'
  | 'tag'
  | 'key'
  | 'grid'
  | 'zap'
  | 'cpu';

export type BrowseMode = 'Popular' | 'Types' | 'Locations' | 'Area Sizes';

export function getBrowseIconName(label: string, mode: BrowseMode): BrowseIconName {
  const value = label.toLowerCase();

  if (mode === 'Area Sizes') {
    return 'maximize-2';
  }

  if (mode === 'Locations') {
    return 'map-pin';
  }

  if (/\b(industrial|factory|factories|warehouse|warehouses|industrial plot|industrial land|industrial building|industrial zone|loading|truck access)\b/.test(value)) {
    return value.includes('warehouse') ? 'archive' : 'zap';
  }

  if (/\b(project|projects|housing society|apartment project|development|gated community|mixed.use|farm development)\b/.test(value)) {
    return 'layers';
  }

  if (/\b(plot|plots|land|orchard|farm|ranch|greenhouse|nursery|cultivable|irrigated|canal|estate)\b/.test(value)) {
    return 'map';
  }

  if (/\b(house|houses|home|homes|villa|apartment|penthouse|townhouse|duplex|studio|portion|guest house)\b/.test(value)) {
    return 'home';
  }

  if (/\b(shop|shops|retail|showroom|restaurant|medical|office|offices|corporate|school|hotel|plaza|factory|warehouse|building|commercial)\b/.test(value)) {
    return value.includes('warehouse') || value.includes('factory') ? 'archive' : 'briefcase';
  }

  if (/\b(luxury|premium|new|ready|corner|park facing|main boulevard|possession|balloted|overseas)\b/.test(value)) {
    return 'star';
  }

  if (/\b(installment|low price|file|mixed use)\b/.test(value)) {
    return 'tag';
  }

  if (mode === 'Types') {
    return 'layers';
  }

  return 'grid';
}

export function PremiumBrowseIcon({
  name,
  active = false,
  size = 'small',
}: {
  name: BrowseIconName;
  active?: boolean;
  size?: 'small' | 'medium';
}) {
  const colors = useColors();
  const pulse = useSharedValue(1);
  const isMedium = size === 'medium';
  const frameSize = isMedium ? 38 : 32;
  const iconSize = isMedium ? 17 : 14;

  useEffect(() => {
    pulse.value = withDelay(
      active ? 0 : 180,
      withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.cubic) }),
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) }),
        ),
        -1,
        false,
      ),
    );
  }, [active, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: active ? 1 : 0.72,
  }));

  return (
    <Animated.View style={[styles.halo, { width: frameSize + 8, height: frameSize + 8 }, pulseStyle]}>
      <LinearGradient
        colors={active ? [colors.primary, '#f4d992', colors.primary] : [colors.border, colors.secondary, colors.border]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.frame, { width: frameSize, height: frameSize, borderRadius: frameSize / 2 }]}
      >
        <View style={[styles.inner, { backgroundColor: active ? colors.accent : colors.card, borderRadius: frameSize / 2 }]}>
          <Feather name={name} size={iconSize} color={active ? colors.primary : colors.mutedForeground} />
        </View>
      </LinearGradient>
      {active && <View style={[styles.status, { backgroundColor: colors.primary, borderColor: colors.card }]} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  halo: { alignItems: 'center', justifyContent: 'center' },
  frame: { alignItems: 'center', justifyContent: 'center', padding: 1.5 },
  inner: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  status: { position: 'absolute', right: 1, bottom: 1, width: 7, height: 7, borderRadius: 4, borderWidth: 2 },
});