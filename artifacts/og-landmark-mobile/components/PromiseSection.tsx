import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
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
  const photoScale = useSharedValue(1.02);
  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: photoScale.value }],
  }));

  useFocusEffect(
    useCallback(() => {
      photoScale.value = withRepeat(
        withTiming(1.09, {
          duration: 9000,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      );
      return () => cancelAnimation(photoScale);
    }, [photoScale]),
  );

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <Animated.Image
          source={require('@/assets/images/hero-bg.jpg')}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, styles.photo, photoStyle]}
          accessibilityIgnoresInvertColors
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(5,13,25,0.62)', 'rgba(5,13,25,0.56)', 'rgba(4,12,25,0.78)']}
          locations={[0, 0.56, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.splashMint }]}>
              THE OG LANDMARK PROMISE
            </Text>
            <Text style={[styles.title, { color: colors.actionForeground }]}>
              Property decisions{'\n'}made with confidence.
            </Text>
          </View>

          <View style={styles.pointsGrid}>
            {promisePoints.map((point) => (
              <View key={point.label} style={styles.point}>
                <View style={[styles.iconWrap, { backgroundColor: colors.goldGlass }]}>
                  <Feather name={point.icon} size={14} color={colors.gold} />
                </View>
                <Text style={[styles.pointLabel, { color: colors.actionForeground }]}>
                  {point.label}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={onExplore}
            accessibilityRole="button"
            accessibilityLabel="Explore listings"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.gold, opacity: pressed ? 0.84 : 1 },
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
              Explore listings
            </Text>
            <Feather name="arrow-up-right" size={16} color={colors.primaryForeground} />
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
    aspectRatio: 1.12,
    maxHeight: 480,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0B1F3A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  content: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 22,
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.7,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 25,
    lineHeight: 30,
    letterSpacing: -0.35,
  },
  pointsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 9,
  },
  point: {
    width: '48%',
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  pointLabel: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 14,
  },
  button: {
    minHeight: 42,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 13,
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
});
