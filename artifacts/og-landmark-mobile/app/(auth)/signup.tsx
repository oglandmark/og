import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { AuthDivider, AuthPrimaryButton, AuthScreenFrame, AuthSocialButtons } from '@/components/AuthScreenUI';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { registerAPI, verifySignupEmail, resendSignupEmail } = useAuth();
  const { tr, isRTL } = useLanguage();
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<'name' | 'email' | 'phone' | 'password' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationNotice, setVerificationNotice] = useState('');
  const [isCodeFocused, setIsCodeFocused] = useState(false);
  const [resending, setResending] = useState(false);
  const verificationCodeInputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const rtl = isRTL ? 'right' as const : 'left' as const;
  const identifierValue = identifier.trim();
  const isMobileIdentifier = identifierValue.length > 0 && /^[+\d\s().-]+$/.test(identifierValue);
  const signupPhone = isMobileIdentifier ? identifierValue : mobileNumber.trim();
  const signupPhoneDigits = signupPhone.replace(/\D/g, '');
  const isValidSignupPhone = signupPhoneDigits.length >= 10 && signupPhoneDigits.length <= 15;

  async function handleRegister() {
    if (!termsAccepted) { setError(tr('authAcceptTermsError')); return; }
    if (!name.trim()) { setError('Full name is required.'); return; }
    const value = identifier.trim();
    if (!value) { setError(tr('signupIdentifierRequired')); return; }
    if (isMobileIdentifier || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter a valid email address to receive your verification code.'); return;
    }
    if (!signupPhone) { setError(tr('signupMobileRequired')); return; }
    if (!isValidSignupPhone) { setError(tr('signupMobileError')); return; }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('Password must be at least 8 characters and include a letter and number.');
      return;
    }

    setError('');
    setLoading(true);
    const result = await registerAPI({
      name: name.trim(),
      email: value.toLowerCase(),
      phone: signupPhone,
      password,
      role: 'user',
    });
    setLoading(false);
    if (result.pendingApproval) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Account submitted',
        'Your account is awaiting approval. You can continue exploring while we review your details.',
        [{ text: 'Continue', onPress: () => router.replace('/(tabs)') }],
      );
      return;
    }
    if (result.verificationRequired) {
      setVerificationEmail(result.email ?? value.toLowerCase());
      setError('');
      return;
    }
    if (!result.success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.error ?? 'Registration failed. Please try again.');
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  }

  async function handleVerifyEmail() {
    if (!/^\d{6}$/.test(verificationCode)) { setError('Enter the six-digit code from your email.'); return; }
    setError('');
    setVerificationNotice('');
    setLoading(true);
    const result = await verifySignupEmail(verificationEmail, verificationCode);
    setLoading(false);
    if (!result.success) { setError(result.error ?? 'Verification failed.'); return; }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  }

  async function handleResendEmail() {
    setError('');
    setVerificationNotice('');
    setResending(true);
    const result = await resendSignupEmail(verificationEmail);
    setResending(false);
    if (result.success) setVerificationNotice('A new code has been sent.');
    else setError(result.error ?? 'Unable to resend the code.');
  }

  const openLegal = () => router.push('/settings/legal?section=legal' as any);

  return (
    <AuthScreenFrame
      topInset={insets.top + (Platform.OS === 'web' ? 67 : 0)}
      bottomInset={insets.bottom + (Platform.OS === 'web' ? 34 : 0)}
      contentGap={6}
    >
      {verificationEmail ? (
        <View style={styles.otpContent}>
          <View style={styles.otpEyebrow}>
            <Feather name="shield" size={14} color={colors.teal} />
            <Text style={[styles.otpEyebrowText, { color: colors.teal }]}>ACCOUNT VERIFICATION</Text>
          </View>
          <Text style={[styles.otpTitle, { color: colors.foreground }]}>Verify your email</Text>
          <Text style={[styles.otpIntro, { color: colors.authMuted }]}>Enter the six-digit code we sent to your email.</Text>
          <View style={[styles.otpEmailCard, { backgroundColor: colors.surfaceTint, borderColor: colors.glassBorder }]}>
            <View style={[styles.otpMailIcon, { backgroundColor: colors.tealSoft }]}>
              <Feather name="mail" size={18} color={colors.teal} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.otpEmailLabel, { color: colors.mutedForeground }]}>CODE SENT TO</Text>
              <Text style={[styles.otpEmail, { color: colors.foreground }]} numberOfLines={2}>{verificationEmail}</Text>
            </View>
          </View>
          <Text style={[styles.otpCodeLabel, { color: colors.mutedForeground }]}>VERIFICATION CODE</Text>
          <View style={styles.otpCodeInputWrap} accessibilityLabel="Six-digit email verification code">
            <View pointerEvents="none" style={styles.otpDigitRow}>
              {Array.from({ length: 6 }, (_, index) => {
                const digit = verificationCode[index] ?? '';
                const active = isCodeFocused && index === Math.min(verificationCode.length, 5);
                return (
                  <View
                    key={index}
                    style={[
                      styles.otpDigit,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      digit ? { borderColor: `${colors.teal}88` } : null,
                      active ? { borderColor: colors.teal, backgroundColor: colors.tealSoft } : null,
                      error ? { borderColor: colors.destructive, backgroundColor: `${colors.destructive}0D` } : null,
                    ]}
                  >
                    <Text style={[styles.otpDigitText, { color: colors.foreground }]}>{digit}</Text>
                  </View>
                );
              })}
            </View>
            <TextInput
              ref={verificationCodeInputRef}
              value={verificationCode}
              onChangeText={(value) => {
                setVerificationCode(value.replace(/\D/g, '').slice(0, 6));
                setError('');
                setVerificationNotice('');
              }}
              onFocus={() => setIsCodeFocused(true)}
              onBlur={() => setIsCodeFocused(false)}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              accessibilityLabel="Six-digit email verification code"
              accessibilityHint="Enter the six-digit code from your email."
              selectionColor={colors.teal}
              style={styles.otpCodeInput}
            />
          </View>
          <Text style={[styles.otpExpiry, { color: colors.mutedForeground }]}>The code expires in 10 minutes.</Text>
          {(!!error || !!verificationNotice) && (
            <View
              style={[
                styles.otpMessage,
                { backgroundColor: error ? `${colors.destructive}0D` : colors.tealSoft },
                { borderColor: error ? `${colors.destructive}30` : `${colors.teal}40` },
              ]}
              accessibilityLiveRegion="polite"
              accessibilityRole={error ? 'alert' : 'text'}
            >
              <Feather name={error ? 'alert-circle' : 'check-circle'} size={15} color={error ? colors.destructive : colors.teal} />
              <Text style={[styles.otpMessageText, { color: error ? colors.destructive : colors.teal }]}>{error || verificationNotice}</Text>
            </View>
          )}
          <AuthPrimaryButton label="Verify email" accessibilityLabel="Verify email" loading={loading} onPress={() => { void handleVerifyEmail(); }} />
          <View style={styles.otpResendRow}>
            <Text style={[styles.footerText, { color: colors.authMuted }]}>Didn’t receive a code?</Text>
            <Pressable onPress={() => { void handleResendEmail(); }} disabled={loading || resending} accessibilityRole="button">
              {resending ? <ActivityIndicator size="small" color={colors.teal} /> : <Text style={[styles.footerLink, { color: colors.teal }]}>Resend code</Text>}
            </Pressable>
          </View>
          <View style={styles.otpTrustRow}>
            <Feather name="lock" size={13} color={colors.teal} />
            <Text style={[styles.otpTrustText, { color: colors.mutedForeground }]}>Your details stay protected</Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.heading}>
            <Text style={[styles.title, { color: colors.foreground }]}>{tr('authCreateHeading')}</Text>
            <Text style={[styles.subtitle, { color: colors.authMuted }]}>{tr('authCreateSubtitle')}</Text>
          </View>

          {!!error && (
            <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}0D`, borderColor: `${colors.destructive}30` }]}>
              <Feather name="alert-circle" size={15} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive, textAlign: rtl }]}>{error}</Text>
            </View>
          )}

          <View style={[styles.inputField, focusedField === 'name' && styles.inputFieldFocused, { backgroundColor: focusedField === 'name' ? colors.background : colors.authFieldSurface, borderColor: focusedField === 'name' ? colors.splashGold : colors.authBorder, shadowColor: colors.splashGold }]}>
            <Feather name="user" size={19} color={focusedField === 'name' ? colors.authGoldText : colors.authMuted} />
            <TextInput testID="signup-name-input" value={name} onChangeText={(value) => { setFocusedField('name'); setName(value); setError(''); }} onFocus={() => setFocusedField('name')} onBlur={() => setFocusedField((current) => current === 'name' ? null : current)} placeholder={tr('authFullNamePlaceholder')} placeholderTextColor={colors.authMuted} autoCapitalize="words" textAlign={rtl} style={[styles.input, { color: colors.foreground }]} />
          </View>
          <View style={[styles.inputField, focusedField === 'email' && styles.inputFieldFocused, { backgroundColor: focusedField === 'email' ? colors.background : colors.authFieldSurface, borderColor: focusedField === 'email' ? colors.splashGold : colors.authBorder, shadowColor: colors.splashGold }]}>
            <Feather name="mail" size={19} color={focusedField === 'email' ? colors.authGoldText : colors.authMuted} />
            <TextInput testID="signup-email-input" value={identifier} onChangeText={(value) => { setFocusedField('email'); setIdentifier(value); setError(''); }} onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField((current) => current === 'email' ? null : current)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder={tr('authEmailPlaceholder')} placeholderTextColor={colors.authMuted} textAlign="left" style={[styles.input, { color: colors.foreground }]} />
          </View>
          <View style={[styles.inputField, focusedField === 'phone' && styles.inputFieldFocused, { backgroundColor: focusedField === 'phone' ? colors.background : colors.authFieldSurface, borderColor: focusedField === 'phone' ? colors.splashGold : colors.authBorder, shadowColor: colors.splashGold }]}>
            <Feather name="smartphone" size={19} color={focusedField === 'phone' ? colors.authGoldText : colors.authMuted} />
            <TextInput testID="signup-phone-input" value={mobileNumber} onChangeText={(value) => { setFocusedField('phone'); setMobileNumber(value); setError(''); }} onFocus={() => setFocusedField('phone')} onBlur={() => setFocusedField((current) => current === 'phone' ? null : current)} keyboardType="phone-pad" autoComplete="tel" placeholder={tr('authPhonePlaceholder')} placeholderTextColor={colors.authMuted} textAlign="left" style={[styles.input, { color: colors.foreground }]} />
          </View>
          <View style={[styles.inputField, focusedField === 'password' && styles.inputFieldFocused, { backgroundColor: focusedField === 'password' ? colors.background : colors.authFieldSurface, borderColor: focusedField === 'password' ? colors.splashGold : colors.authBorder, shadowColor: colors.splashGold }]}>
            <Feather name="lock" size={19} color={focusedField === 'password' ? colors.authGoldText : colors.authMuted} />
            <TextInput testID="signup-password-input" value={password} onChangeText={(value) => { setFocusedField('password'); setPassword(value); setError(''); }} onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField((current) => current === 'password' ? null : current)} secureTextEntry={!showPassword} autoComplete="new-password" placeholder={tr('authCreatePasswordPlaceholder')} placeholderTextColor={colors.authMuted} textAlign={rtl} style={[styles.input, { color: colors.foreground }]} />
            <Pressable onPress={() => setShowPassword((value) => !value)} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
              <Feather name={showPassword ? 'eye' : 'eye-off'} size={19} color={colors.authMuted} />
            </Pressable>
          </View>

          <View style={styles.termsRow}>
            <Pressable
              onPress={() => { setTermsAccepted((value) => !value); setError(''); }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              accessibilityLabel="Agree to the Terms and Privacy Policy"
              style={[styles.checkbox, { borderColor: termsAccepted ? colors.splashGold : colors.authBorder, backgroundColor: termsAccepted ? colors.splashGold : colors.background }]}
            >
              {termsAccepted && <Feather name="check" size={14} color={colors.action} />}
            </Pressable>
            <Text style={[styles.termsText, { color: colors.authMuted }]}>
              {tr('authTermsPrefix')}{' '}
              <Text onPress={openLegal} style={[styles.termsLink, { color: colors.authGoldText }]}>{tr('authTermsLink')}</Text>
              {' & '}
              <Text onPress={openLegal} style={[styles.termsLink, { color: colors.authGoldText }]}>{tr('authPrivacyLink')}</Text>
            </Text>
          </View>

          <AuthPrimaryButton label={tr('createAccountBtn')} accessibilityLabel={tr('createAccountBtn')} loading={loading} onPress={() => { void handleRegister(); }} />
          <AuthDivider label={tr('authSignupDivider')} />
          <AuthSocialButtons disabled={loading} />
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.authMuted }]}>{tr('authAlreadyHaveAccount')}</Text>
            <Pressable onPress={() => router.push('/(auth)/login')} accessibilityRole="button">
              <Text style={[styles.footerLink, { color: colors.authGoldText }]}>{tr('authSignInButton')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </AuthScreenFrame>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 4, marginBottom: 2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 31 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 11 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1 },
  inputField: { minHeight: 48, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  inputFieldFocused: { borderWidth: 1.5, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2 },
  input: { flex: 1, minWidth: 0, borderWidth: 0, outlineWidth: 0, outlineColor: 'transparent', backgroundColor: 'transparent', fontFamily: 'Inter_400Regular', fontSize: 14, paddingVertical: 0 },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 1 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  termsText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  termsLink: { fontFamily: 'Inter_700Bold' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 8 },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  footerLink: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  otpContent: { alignSelf: 'center', maxWidth: 440, width: '100%', gap: 14 },
  otpEyebrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: -4 },
  otpEyebrowText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.3 },
  otpTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 36, textAlign: 'center' },
  otpIntro: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  otpEmailCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderRadius: 16 },
  otpMailIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  otpEmailLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1, marginBottom: 4 },
  otpEmail: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, writingDirection: 'ltr', textAlign: 'left' },
  otpCodeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.3, textAlign: 'center', marginBottom: -8 },
  otpCodeInputWrap: { height: 58, position: 'relative', justifyContent: 'center' },
  otpDigitRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  otpDigit: { flex: 1, maxWidth: 52, height: 54, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  otpDigitText: { fontFamily: 'Inter_700Bold', fontSize: 21, lineHeight: 27 },
  otpCodeInput: { ...StyleSheet.absoluteFill, zIndex: 2, opacity: 0.02, color: 'transparent', textAlign: 'center', fontSize: 24 },
  otpExpiry: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: -8 },
  otpMessage: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  otpMessageText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  otpResendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 5 },
  otpTrustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 8 },
  otpTrustText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
});
