import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { OGLandmarkLogo } from '@/components/OGLandmarkLogo';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';

const HOUSE = require('../assets/images/auth-house.png');

export function AuthScreenFrame({
  children,
  topInset,
  bottomInset,
}: {
  children: ReactNode;
  topInset: number;
  bottomInset: number;
}) {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const brandTop = Math.max(topInset, 44);
  const houseWidth = Math.min(width - 48, 330);

  return (
    <View style={[styles.root, { backgroundColor: colors.splashBackground }]}>
      <LinearGradient
        colors={[colors.splashGlow, colors.splashNavy, colors.splashBackground]}
        locations={[0, 0.52, 1]}
        start={{ x: 0.9, y: 0 }}
        end={{ x: 0.1, y: 1 }}
        style={styles.hero}
      />
      <Svg width={width} height={360} style={[styles.heroDetails, { pointerEvents: 'none' }]}>
        <Circle cx={width * 0.9} cy={70} r={150} fill="none" stroke={colors.splashWhite} strokeOpacity={0.07} />
        <Circle cx={width * 0.9} cy={70} r={150} fill="none" stroke={colors.splashGold} strokeWidth={2} strokeDasharray="90 900" />
        <Circle cx={width * 0.9} cy={70} r={112} fill="none" stroke={colors.splashTeal} strokeWidth={2} strokeDasharray="70 700" />
        <Circle cx={34} cy={132} r={1.3} fill={colors.splashWhite} />
        <Circle cx={88} cy={108} r={1} fill={colors.splashWhite} />
        <Circle cx={176} cy={126} r={1.2} fill={colors.splashGold} />
        <Circle cx={232} cy={104} r={1.1} fill={colors.splashWhite} />
        <Circle cx={width - 38} cy={128} r={1.2} fill={colors.splashMint} />
        <Circle cx={22} cy={206} r={1} fill={colors.splashWhite} />
      </Svg>
      <View style={[styles.brand, { top: brandTop }]}>
        <OGLandmarkLogo size={42} />
        <Text style={styles.wordmark}>
          <Text style={{ color: colors.splashGold, fontFamily: 'Inter_700Bold' }}>OG</Text>
          <Text style={{ color: colors.splashWhite, fontFamily: 'Inter_600SemiBold' }}> LANDMARK</Text>
        </Text>
      </View>
      <Image
        source={HOUSE}
        resizeMode="contain"
        style={[
          styles.house,
          { left: (width - houseWidth) / 2, width: houseWidth, height: houseWidth * 230 / 360 },
        ]}
        accessibilityLabel="OG Landmark luxury home illustration"
      />
      <KeyboardAvoidingView
        style={styles.keyboardFrame}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingTop: 262, paddingBottom: bottomInset, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.sheet,
              {
                minHeight: Math.max(height - 262, 520),
                paddingBottom: Math.max(bottomInset, 16) + 18,
                backgroundColor: colors.background,
              },
            ]}
          >
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function AuthPrimaryButton({
  label,
  accessibilityLabel,
  loading,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  loading: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.primaryButton,
        { shadowColor: colors.splashGold },
        pressed && !loading && { opacity: 0.9 },
      ]}
    >
      <LinearGradient
        colors={[colors.authGoldHighlight, colors.splashGold, colors.authGoldShadow]}
        locations={[0, 0.55, 1]}
        style={styles.primaryButtonFill}
      >
        {loading ? (
          <ActivityIndicator color={colors.action} />
        ) : (
          <>
            <Text style={[styles.primaryButtonText, { color: colors.action }]}>{label}</Text>
            <Feather name="arrow-right" size={20} color={colors.action} />
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function AuthSocialButtons({
  facebookLoading,
  disabled,
  onFacebook,
  onUnavailable,
}: {
  facebookLoading: boolean;
  disabled: boolean;
  onFacebook: () => void;
  onUnavailable: (provider: 'Google' | 'Apple') => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.socialRow}>
      <Pressable
        onPress={() => onUnavailable('Google')}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        style={[styles.socialButton, { backgroundColor: colors.background, borderColor: colors.authBorder, shadowColor: colors.action }]}
      >
        <FontAwesome5 name="google" size={22} color="#4285F4" />
      </Pressable>
      <Pressable
        onPress={() => onUnavailable('Apple')}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Continue with Apple"
        style={[styles.socialButton, { backgroundColor: colors.background, borderColor: colors.authBorder, shadowColor: colors.action }]}
      >
        <FontAwesome5 name="apple" size={24} color="#000000" />
      </Pressable>
      <Pressable
        onPress={onFacebook}
        disabled={disabled || facebookLoading}
        accessibilityRole="button"
        accessibilityLabel="Continue with Facebook"
        style={[styles.socialButton, { backgroundColor: colors.background, borderColor: colors.authBorder, shadowColor: colors.action }]}
      >
        {facebookLoading
          ? <ActivityIndicator size="small" color="#1877F2" />
          : <FontAwesome5 name="facebook" size={22} color="#1877F2" />}
      </Pressable>
    </View>
  );
}

export function AuthDivider({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.dividerLine, { backgroundColor: colors.authBorder }]} />
      <Text style={[styles.dividerText, { color: colors.authMuted }]}>{label}</Text>
      <View style={[styles.dividerLine, { backgroundColor: colors.authBorder }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
  heroDetails: { position: 'absolute', top: 0, left: 0 },
  brand: { position: 'absolute', left: 24, flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 3 },
  house: { position: 'absolute', top: 78 },
  keyboardFrame: { flex: 1 },
  scroll: { flex: 1 },
  sheet: {
    flexGrow: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 46,
    paddingHorizontal: 24,
    gap: 9,
  },
  primaryButton: {
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 2,
    marginBottom: 4,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
  },
  primaryButtonFill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontFamily: 'Inter_400Regular', fontSize: 12, letterSpacing: 0.3 },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
