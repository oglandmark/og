import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { AuthDivider, AuthPrimaryButton, AuthScreenFrame, AuthSocialButtons } from '@/components/AuthScreenUI';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { loginAPI } = useAuth();
  const { tr, isRTL } = useLanguage();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<'identifier' | 'password' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const identifierValue = identifier.trim();
  const isMobileIdentifier = identifierValue.length > 0 && /^[+\d\s().-]+$/.test(identifierValue);
  const rtl = isRTL ? 'right' as const : 'left' as const;

  const handleLogin = async () => {
    const value = identifier.trim();
    if (!value) { setError(tr('loginErrEmail')); return; }
    if (isMobileIdentifier && value.replace(/\D/g, '').length < 10) { setError(tr('loginErrMobile')); return; }
    if (!isMobileIdentifier && value.includes('@') && !value.includes('.')) { setError(tr('loginErrEmail')); return; }
    if (!isMobileIdentifier && !value.includes('@') && !/^[A-Za-z][A-Za-z0-9._-]{2,29}$/.test(value)) {
      setError(tr('loginErrUsername')); return;
    }
    if (!password || password.length < 4) { setError(tr('loginErrPassword')); return; }
    setError('');
    setLoading(true);
    const normalizedIdentifier = isMobileIdentifier ? value : value.toLowerCase();
    const result = await loginAPI(normalizedIdentifier, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Login failed. Please try again.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  };

  return (
    <AuthScreenFrame
      topInset={insets.top + (Platform.OS === 'web' ? 67 : 0)}
      bottomInset={insets.bottom + (Platform.OS === 'web' ? 34 : 0)}
    >
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.foreground }]}>{tr('authLoginHeading')}</Text>
        <Text style={[styles.subtitle, { color: colors.authMuted }]}>{tr('authLoginSubtitle')}</Text>
      </View>

      {!!error && (
        <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}0D`, borderColor: `${colors.destructive}30` }]}>
          <Feather name="alert-circle" size={15} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive, textAlign: rtl }]}>{error}</Text>
        </View>
      )}

      <View
        style={[
          styles.inputField,
          focusedField === 'identifier' && styles.inputFieldFocused,
          {
            borderColor: focusedField === 'identifier' ? colors.splashGold : colors.authBorder,
            backgroundColor: focusedField === 'identifier' ? colors.background : colors.authFieldSurface,
            shadowColor: colors.splashGold,
          },
        ]}
      >
        <Feather name="mail" size={19} color={focusedField === 'identifier' ? colors.authGoldText : colors.authMuted} />
        <TextInput
          testID="login-identifier-input"
          value={identifier}
          onChangeText={(value) => { setFocusedField('identifier'); setIdentifier(value); setError(''); }}
          onFocus={() => setFocusedField('identifier')}
          onBlur={() => setFocusedField((current) => current === 'identifier' ? null : current)}
          keyboardType={isMobileIdentifier ? 'phone-pad' : 'email-address'}
          autoCapitalize="none"
          autoComplete="email"
          placeholder={tr('authEmailPlaceholder')}
          placeholderTextColor={colors.authMuted}
          textAlign={rtl}
          style={[styles.input, { color: colors.foreground }]}
        />
      </View>

      <View
        style={[
          styles.inputField,
          focusedField === 'password' && styles.inputFieldFocused,
          {
            borderColor: focusedField === 'password' ? colors.splashGold : colors.authBorder,
            backgroundColor: focusedField === 'password' ? colors.background : colors.authFieldSurface,
            shadowColor: colors.splashGold,
          },
        ]}
      >
        <Feather name="lock" size={19} color={focusedField === 'password' ? colors.authGoldText : colors.authMuted} />
        <TextInput
          testID="login-password-input"
          value={password}
          onChangeText={(value) => { setFocusedField('password'); setPassword(value); setError(''); }}
          onFocus={() => setFocusedField('password')}
          onBlur={() => setFocusedField((current) => current === 'password' ? null : current)}
          secureTextEntry={!showPassword}
          autoComplete="current-password"
          placeholder={tr('authPasswordPlaceholder')}
          placeholderTextColor={colors.authMuted}
          textAlign={rtl}
          style={[styles.input, { color: colors.foreground }]}
        />
        <Pressable onPress={() => setShowPassword((value) => !value)} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
          <Feather name={showPassword ? 'eye' : 'eye-off'} size={19} color={colors.authMuted} />
        </Pressable>
      </View>

      <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotLink} accessibilityRole="button">
        <Text style={[styles.forgotText, { color: colors.authGoldText }]}>{tr('forgotPassword')}</Text>
      </Pressable>

      <AuthPrimaryButton label={tr('authSignInButton')} accessibilityLabel={tr('loginBtn')} loading={loading} onPress={() => { void handleLogin(); }} />
      <AuthDivider label={tr('authLoginDivider')} />
      <AuthSocialButtons disabled={loading} />
      <View style={styles.footerRow}>
        <Text style={[styles.footerText, { color: colors.authMuted }]}>{tr('noAccount')}</Text>
        <Pressable onPress={() => router.push('/(auth)/signup')} accessibilityRole="button">
          <Text style={[styles.footerLink, { color: colors.authGoldText }]}>{tr('signUpWithEmail')}</Text>
        </Pressable>
      </View>
    </AuthScreenFrame>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 5, marginBottom: 4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 31 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 11 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1 },
  inputField: { height: 47, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  inputFieldFocused: { borderWidth: 1.5, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2 },
  input: { flex: 1, minWidth: 0, borderWidth: 0, outlineWidth: 0, outlineColor: 'transparent', backgroundColor: 'transparent', fontFamily: 'Inter_400Regular', fontSize: 14, paddingVertical: 0 },
  forgotLink: { alignSelf: 'flex-end', paddingVertical: 2, marginTop: -4 },
  forgotText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 12 },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  footerLink: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
