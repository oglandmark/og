import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { OGLandmarkLogo } from '@/components/OGLandmarkLogo';

export function OpeningSplash({ onFinished }: { onFinished?: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  // Logo
  const logoOpacity   = useSharedValue(0);
  const logoScale     = useSharedValue(0.78);
  const logoTranslateY = useSharedValue(18);

  // Wordmark beneath logo
  const wordmarkOpacity    = useSharedValue(0);
  const wordmarkTranslateY = useSharedValue(10);

  // Divider + tagline at bottom
  const ruleScaleX       = useSharedValue(0);
  const taglineOpacity   = useSharedValue(0);
  const taglineTranslateY = useSharedValue(8);

  // Whole overlay
  const overlayOpacity = useSharedValue(1);

  useEffect(() => {
    // Logo entrance — fast scale + fade (320ms)
    logoOpacity.value    = withDelay(60,  withTiming(1, { duration: 320 }));
    logoScale.value      = withDelay(60,  withTiming(1, { duration: 420 }));
    logoTranslateY.value = withDelay(60,  withTiming(0, { duration: 420 }));

    // Wordmark rises quickly
    wordmarkOpacity.value    = withDelay(300, withTiming(1, { duration: 280 }));
    wordmarkTranslateY.value = withDelay(300, withTiming(0, { duration: 280 }));

    // Divider + tagline
    ruleScaleX.value        = withDelay(500, withTiming(1, { duration: 260 }));
    taglineOpacity.value    = withDelay(680, withTiming(1, { duration: 280 }));
    taglineTranslateY.value = withDelay(680, withTiming(0, { duration: 280 }));

    // Exit after 2.3s total — fast enough to feel snappy
    const exitTimer = setTimeout(() => setExiting(true), 2300);
    return () => clearTimeout(exitTimer);
  }, []);

  useEffect(() => {
    if (!exiting) return;
    // Safety fallback — if Reanimated callback doesn't fire (web), dismiss after 600ms
    const fallback = setTimeout(() => {
      setVisible(false);
      if (onFinished) onFinished();
    }, 600);
    overlayOpacity.value = withTiming(0, { duration: 480 }, (finished) => {
      if (finished) {
        runOnJS(setVisible)(false);
        if (onFinished) runOnJS(onFinished)();
      }
    });
    return () => clearTimeout(fallback);
  }, [exiting]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [{ translateY: logoTranslateY.value }, { scale: logoScale.value }],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity:   wordmarkOpacity.value,
    transform: [{ translateY: wordmarkTranslateY.value }],
  }));

  const ruleStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: ruleScaleX.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity:   taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.card }, overlayStyle]}
    >
      <StatusBar style="dark" />

      {/* ── Centered logo block ── */}
      <View style={styles.center}>
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <OGLandmarkLogo size={176} variant="splash" />
        </Animated.View>

        <Animated.View style={[styles.wordmark, wordmarkStyle]}>
          <Text style={[styles.name, { color: colors.action }]}>OG Landmark</Text>
          <Text style={[styles.category, { color: colors.primary }]}>REAL ESTATE</Text>
        </Animated.View>
      </View>

      {/* ── Bottom tagline ── */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 48 }]}>
        <Animated.View style={[styles.rule, { backgroundColor: colors.primary }, ruleStyle]} />
        <Animated.View style={taglineStyle}>
          <Text style={[styles.headline, { color: colors.primary }]}>FIND YOUR PLACE</Text>
          <Text style={[styles.subheadline, { color: colors.action }]}>
            Verified property. Better living.
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 100, elevation: 100 },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 160,
    height: 160,
  },
  wordmark: {
    alignItems: 'center',
    marginTop: 14,
  },
  name: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 24,
    letterSpacing: 0.8,
  },
  category: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9.5,
    letterSpacing: 4.5,
    marginTop: 7,
  },

  bottom: {
    alignItems: 'center',
    gap: 16,
  },
  rule: {
    width: 44,
    height: 1,
    opacity: 0.85,
  },
  headline: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    letterSpacing: 3.4,
    textAlign: 'center',
  },
  subheadline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    letterSpacing: 0.35,
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.75,
  },
});
