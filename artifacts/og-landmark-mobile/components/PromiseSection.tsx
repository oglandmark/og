import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

const promisePoints = [
  { label: 'Verified Listings', icon: 'check-circle' as const },
  { label: 'Verified Agents', icon: 'award' as const },
  { label: 'Verified Developers', icon: 'layers' as const },
  { label: 'Transparent Info', icon: 'eye' as const },
  { label: 'Secure Inquiries', icon: 'lock' as const },
  { label: 'Professional Experience', icon: 'star' as const },
];

export function PromiseSection({ onExplore }: { onExplore: () => void }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const orbitRotation = useSharedValue(0);
  const shineOffset = useSharedValue(-120);
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbitRotation.value}deg` }],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ skewX: '-18deg' }, { translateX: shineOffset.value }],
  }));

  useFocusEffect(
    useCallback(() => {
      orbitRotation.value = withRepeat(
        withTiming(360, { duration: 70_000, easing: Easing.linear }),
        -1,
        false,
      );
      shineOffset.value = withRepeat(
        withTiming(width + 120, { duration: 5000, easing: Easing.linear }),
        -1,
        false,
      );
      return () => {
        cancelAnimation(orbitRotation);
        cancelAnimation(shineOffset);
      };
    }, [orbitRotation, shineOffset, width]),
  );

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <LinearGradient
          pointerEvents="none"
          colors={[colors.splashNavy, '#102B52', '#1B3A63']}
          locations={[0, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.tealGlow} />
        <View pointerEvents="none" style={styles.goldGlow} />
        <Animated.View pointerEvents="none" style={[styles.orbit, orbitStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 200 200">
            <Circle cx="100" cy="100" r="46" fill="none" stroke={colors.splashGold} strokeWidth="9" strokeDasharray="150 140" opacity=".42" />
            <Circle cx="100" cy="100" r="68" fill="none" stroke={colors.splashTeal} strokeWidth="9" strokeDasharray="220 210" opacity=".34" />
            <Circle cx="100" cy="100" r="90" fill="none" stroke={colors.splashGold} strokeWidth="9" strokeDasharray="300 270" opacity=".2" />
          </Svg>
        </Animated.View>
        <Svg pointerEvents="none" viewBox="0 0 358 180" preserveAspectRatio="xMidYMax slice" style={styles.skyline}>
          <G fill="#10264A">
            <Rect x="-12" y="90" width="115" height="100" />
            <Rect x="88" y="60" width="190" height="130" />
            <Rect x="265" y="92" width="112" height="98" />
            <Path d="M132 60c0-42 102-42 102 0Z" />
            <Rect x="180" y="31" width="5" height="20" />
          </G>
          <G fill="none" stroke="#07182F" strokeWidth="3" strokeLinecap="round">
            <Path d="M12 150c24-49 55-54 92-20M11 150c31-25 63-17 83 5M346 150c-24-49-55-54-92-20M347 150c-31-25-63-17-83 5" />
          </G>
          <Circle cx="182" cy="28" r="3.5" fill={colors.splashGold} />
          <G fill="#D5A94F" opacity=".55">
            <Rect x="115" y="82" width="6" height="9" rx="1" />
            <Rect x="139" y="82" width="6" height="9" rx="1" />
            <Rect x="213" y="82" width="6" height="9" rx="1" />
            <Rect x="237" y="82" width="6" height="9" rx="1" />
          </G>
        </Svg>
        <View style={styles.content}>
          <View style={styles.heading}>
            <Text style={[styles.eyebrow, { color: colors.splashMint }]}>
              THE OG LANDMARK PROMISE
            </Text>
            <Text style={[styles.title, { color: colors.actionForeground }]}>
              Property decisions{'\n'}made with{'\n'}
              <Text style={[styles.confidence, { color: colors.gold }]}>confidence.</Text>
            </Text>
          </View>

          <View style={styles.pointsGrid}>
            {promisePoints.map((point) => (
              <View key={point.label} style={styles.point}>
                <View style={[styles.pointCard, { borderColor: colors.actionGlassBorder }]}>
                  <View style={[styles.iconWrap, { borderColor: colors.goldGlassBorder, backgroundColor: colors.goldGlass }]}>
                    <Feather name={point.icon} size={20} color={colors.gold} />
                  </View>
                  <Text style={[styles.pointLabel, { color: colors.actionForeground }]}>
                    {point.label}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            onPress={onExplore}
            accessibilityRole="button"
            accessibilityLabel="Explore listings"
            testID="promise-explore-listings"
            style={({ pressed }) => [
              styles.button,
              { opacity: pressed ? 0.84 : 1 },
            ]}
          >
            <LinearGradient
              pointerEvents="none"
              colors={['#F7C96B', colors.gold, '#E9AA3B']}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View pointerEvents="none" style={[styles.buttonShine, shineStyle]} />
            <Text style={[styles.buttonText, { color: colors.foreground }]}>Explore listings</Text>
            <Feather name="arrow-up-right" size={20} color={colors.foreground} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 18,
    marginTop: 36,
    marginBottom: 4,
  },
  card: {
    width: '100%',
    aspectRatio: 358 / 500,
    minHeight: 465,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#0B1F3A',
    borderWidth: 1,
    borderColor: 'rgba(25,195,177,0.3)',
  },
  tealGlow: {
    position: 'absolute',
    top: -76,
    right: -84,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(25,195,177,0.1)',
  },
  goldGlow: {
    position: 'absolute',
    bottom: 34,
    left: -66,
    width: 220,
    height: 150,
    borderRadius: 110,
    backgroundColor: 'rgba(242,184,75,0.12)',
  },
  orbit: {
    position: 'absolute',
    top: -76,
    right: -76,
    width: 220,
    height: 220,
  },
  skyline: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '36%',
  },
  content: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
  },
  heading: { gap: 2 },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 29,
    lineHeight: 33,
    letterSpacing: -0.55,
  },
  confidence: {
    fontFamily: 'Inter_700Bold',
  },
  pointsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  point: {
    width: '48.5%',
    minHeight: 62,
  },
  pointCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  pointLabel: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 15,
  },
  button: {
    position: 'relative',
    height: 47,
    marginTop: 10,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  buttonShine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 48,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  buttonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
});
