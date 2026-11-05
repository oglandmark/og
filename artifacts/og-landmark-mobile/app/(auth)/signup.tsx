import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { OGLandmarkLogo } from '@/components/OGLandmarkLogo';
import { useFacebookAuth } from '@/lib/facebookAuth';
import { Button } from '@/components/PolishedUI';
import brandColors from '@/constants/colors';

const ACTION = '#0B1F3A';
const GOLD = brandColors.light.gold;
const MUTED = '#8a8f98';
const BORDER = '#e4e6ea';

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { registerAPI, verifySignupEmail, resendSignupEmail, loginSocial } = useAuth();
  const { tr, isRTL } = useLanguage();
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
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

  const handleFacebookSignup = useCallback(async (accessToken: string) => {
    if (!signupPhone) {
      const message = tr('signupMobileRequired');
      setError(message);
      return { success: false, error: message };
    }
    if (!isValidSignupPhone) {
      const message = tr('signupMobileError');
      setError(message);
      return { success: false, error: message };
    }
    const result = await loginSocial('facebook', accessToken, signupPhone);
    if (result.success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    }
    return result;
  }, [isValidSignupPhone, loginSocial, signupPhone, tr]);
  const facebook = useFacebookAuth(handleFacebookSignup);

  const startFacebookSignup = () => {
    if (!signupPhone) { setError(tr('signupMobileRequired')); return; }
    if (!isValidSignupPhone) { setError(tr('signupMobileError')); return; }
    setError('');
    void facebook.signIn();
  };

  async function handleRegister() {
    if (!name.trim()) { setError('Full name is required.'); return; }
    const value = identifier.trim();
    if (!value) { setError(tr('signupIdentifierRequired')); return; }
    if (isMobileIdentifier || !value.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter a valid email address to receive your verification code.'); return;
    }
    if (!isMobileIdentifier && value.includes('@') && !value.includes('.')) {
      setError(tr('signupEmailError')); return;
    }
    if (!isMobileIdentifier && !value.includes('@') && !/^[A-Za-z][A-Za-z0-9._-]{2,29}$/.test(value)) {
      setError(tr('signupUsernameError')); return;
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
      email: !isMobileIdentifier && value.includes('@') ? value.toLowerCase() : undefined,
      username: !isMobileIdentifier && !value.includes('@') ? value.toLowerCase() : undefined,
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

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            verificationEmail && styles.otpBackBtn,
            verificationEmail && { borderColor: colors.border, backgroundColor: colors.card },
          ]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={verificationEmail ? 20 : 26} color={verificationEmail ? colors.foreground : ACTION} />
        </Pressable>
        <View style={[styles.logoWrap, verificationEmail && styles.otpLogoWrap]}>
          <OGLandmarkLogo size={verificationEmail ? 72 : 104} />
          <Text style={styles.logoName}>OG Landmark</Text>
          <Text style={styles.logoSub}>REAL ESTATE</Text>
        </View>

        <View style={[styles.content, verificationEmail && styles.otpContent]}>
          {verificationEmail ? (
            <View style={styles.otpEyebrow}>
              <Feather name="shield" size={13} color={colors.teal} />
              <Text style={[styles.otpEyebrowText, { color: colors.teal }]}>ACCOUNT VERIFICATION</Text>
            </View>
          ) : null}
          <Text style={[styles.title, verificationEmail && styles.otpTitle, verificationEmail && { color: colors.foreground }]}>
            {verificationEmail ? 'Verify your email' : 'Create Account'}
          </Text>
          {verificationEmail ? (
            <>
              <Text style={[styles.otpIntro, { color: colors.mutedForeground }]}>
                Enter the six-digit code we sent to your email.
              </Text>
              <View style={[styles.otpEmailCard, { backgroundColor: colors.surfaceTint, borderColor: colors.glassBorder }]}>
                <View style={[styles.otpMailIcon, { backgroundColor: colors.tealSoft }]}>
                  <Feather name="mail" size={18} color={colors.teal} />
                </View>
                <View style={styles.otpEmailCopy}>
                  <Text style={[styles.otpEmailLabel, { color: colors.mutedForeground }]}>CODE SENT TO</Text>
                  <Text style={[styles.otpEmail, { color: colors.foreground }]} numberOfLines={2}>{verificationEmail}</Text>
                </View>
              </View>

              <Text style={[styles.otpCodeLabel, { color: colors.mutedForeground }]}>VERIFICATION CODE</Text>
              <View
                style={styles.otpCodeInputWrap}
                accessibilityLabel="Six-digit email verification code"
              >
                <View
                  pointerEvents="none"
                  style={styles.otpDigitRow}
                >
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
              <Text style={[styles.otpExpiry, { color: colors.mutedForeground }]}>
                The code expires in 10 minutes.
              </Text>

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
                  <Feather
                    name={error ? 'alert-circle' : 'check-circle'}
                    size={15}
                    color={error ? colors.destructive : colors.teal}
                  />
                  <Text style={[styles.otpMessageText, { color: error ? colors.destructive : colors.teal }]}>
                    {error || verificationNotice}
                  </Text>
                </View>
              )}

              <Button
                onPress={() => { void handleVerifyEmail(); }}
                loading={loading}
                icon="arrow-right"
                accessibilityLabel="Verify email"
                style={[styles.submitBtn, styles.otpSubmitBtn]}
              >
                Verify email
              </Button>
              <View style={styles.otpResendRow}>
                <Text style={[styles.otpResendPrompt, { color: colors.mutedForeground }]}>Didn’t receive a code?</Text>
                <Pressable
                  onPress={() => { void handleResendEmail(); }}
                  disabled={loading || resending}
                  accessibilityRole="button"
                  accessibilityLabel="Resend verification code"
                  style={styles.otpResendButton}
                >
                  {resending
                    ? <ActivityIndicator size="small" color={colors.teal} />
                    : <Text style={[styles.otpResendText, { color: colors.teal }]}>Resend code</Text>}
                </Pressable>
              </View>
              <View style={styles.otpTrustRow}>
                <Feather name="lock" size={13} color={colors.teal} />
                <Text style={[styles.otpTrustText, { color: colors.mutedForeground }]}>Your details stay protected</Text>
              </View>
            </>
          ) : (
            <>
          {!!(error || facebook.error) && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={13} color="#b94b42" />
              <Text style={[styles.errorText, { textAlign: rtl }]}>{error || facebook.error}</Text>
            </View>
          )}

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { textAlign: rtl }]}>FULL NAME</Text>
            <TextInput value={name} onChangeText={(v) => { setName(v); setError(''); }}
              placeholder="Muhammad Ali" placeholderTextColor={MUTED} textAlign={rtl}
              autoCapitalize="words" style={styles.underlineInput} />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { textAlign: rtl }]}>{tr('signupIdentifierLabel')}</Text>
            <TextInput value={identifier} onChangeText={(v) => { setIdentifier(v); setError(''); }}
              keyboardType={isMobileIdentifier ? 'phone-pad' : 'default'} autoCapitalize="none"
              placeholder={tr('signupEmailPlaceholder')} placeholderTextColor={MUTED}
              textAlign="left" style={[styles.underlineInput, styles.identifierInput]} />
          </View>

          {!isMobileIdentifier && (
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { textAlign: rtl }]}>{tr('signupMobileLabel')} *</Text>
              <TextInput value={mobileNumber} onChangeText={(v) => { setMobileNumber(v); setError(''); }}
                keyboardType="phone-pad" placeholder={tr('signupMobilePlaceholder')}
                placeholderTextColor={MUTED} textAlign="left"
                style={[styles.underlineInput, styles.identifierInput]} />
            </View>
          )}

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { textAlign: rtl }]}>PASSWORD</Text>
            <View style={styles.passRow}>
              <TextInput value={password} onChangeText={(v) => { setPassword(v); setError(''); }}
                secureTextEntry={!showPwd} placeholder="Min. 8 characters"
                placeholderTextColor={MUTED} textAlign={rtl}
                style={[styles.underlineInput, { flex: 1, borderBottomWidth: 0 }]} />
              <Pressable onPress={() => setShowPwd((v) => !v)} hitSlop={8} style={styles.eyeBtn}>
                <Feather name={showPwd ? 'eye' : 'eye-off'} size={18} color={MUTED} />
              </Pressable>
            </View>
            <View style={styles.underlineLine} />
          </View>

          <Button onPress={() => { void handleRegister(); }} loading={loading}
            accessibilityLabel="Create Account" style={styles.submitBtn}>
            Create Account
          </Button>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>
          <View style={styles.socialRow}>
            <Pressable onPress={startFacebookSignup} disabled={loading || facebook.loading}
              style={({ pressed }) => [styles.socialBtn, { opacity: pressed || facebook.loading ? 0.5 : 1 }]}>
              {facebook.loading ? <ActivityIndicator size="small" color="#1877f2" />
                : <FontAwesome5 name="facebook" size={18} color="#1877f2" />}
              <Text style={styles.socialText}>Facebook</Text>
            </Pressable>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => router.push('/(auth)/login')} hitSlop={6}>
              <Text style={styles.footerLink}> Sign In</Text>
            </Pressable>
          </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  backBtn: { marginLeft: 16, marginBottom: 4, width: 40, height: 40, justifyContent: 'center' },
  otpBackBtn: { alignItems: 'center', borderWidth: 1, borderRadius: 14, marginBottom: 0 },
  logoWrap: { alignItems: 'center', marginBottom: 28, marginTop: 4, gap: 10 },
  otpLogoWrap: { marginTop: 14, marginBottom: 24, gap: 4 },
  logoName: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, letterSpacing: 0.4, color: ACTION },
  logoSub: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 3, color: GOLD, marginTop: -4 },
  content: { paddingHorizontal: 24 },
  otpContent: { alignSelf: 'center', maxWidth: 440, width: '100%', paddingBottom: 8 },
  otpEyebrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 10 },
  otpEyebrowText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.4 },
  otpTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 31, lineHeight: 38, marginBottom: 9, letterSpacing: -0.5 },
  otpIntro: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, textAlign: 'center', paddingHorizontal: 6 },
  otpEmailCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 21, marginBottom: 24, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderRadius: 16 },
  otpMailIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  otpEmailCopy: { flex: 1, minWidth: 0 },
  otpEmailLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1, marginBottom: 4 },
  otpEmail: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, writingDirection: 'ltr', textAlign: 'left' },
  otpCodeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.3, textAlign: 'center', marginBottom: 10 },
  otpCodeInputWrap: { height: 58, position: 'relative', justifyContent: 'center' },
  otpDigitRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  otpDigit: { flex: 1, maxWidth: 52, height: 54, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  otpDigitText: { fontFamily: 'Inter_700Bold', fontSize: 21, lineHeight: 27 },
  otpCodeInput: { ...StyleSheet.absoluteFill, zIndex: 2, opacity: 0.02, color: 'transparent', textAlign: 'center', fontSize: 24 },
  otpExpiry: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: 10 },
  otpMessage: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  otpMessageText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  otpSubmitBtn: { height: 54, borderRadius: 15, marginTop: 21, marginBottom: 0, flexDirection: 'row', gap: 8 },
  otpResendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 16 },
  otpResendPrompt: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  otpResendButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 3 },
  otpResendText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  otpTrustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 24 },
  otpTrustText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#1c2024', marginBottom: 24, letterSpacing: -0.3, textAlign: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#b94b4212', borderRadius: 10, borderWidth: 1, borderColor: '#b94b4230', padding: 11, marginBottom: 16 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#b94b42', flex: 1 },
  fieldWrap: { marginBottom: 20 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 12, color: MUTED, marginBottom: 8, letterSpacing: 0.5 },
  underlineInput: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#1c2024', borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 10, paddingTop: 2 },
  identifierInput: { writingDirection: 'ltr' },
  passRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { paddingLeft: 8 },
  underlineLine: { borderBottomWidth: 1, borderColor: BORDER },
  submitBtn: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: MUTED },
  socialRow: { flexDirection: 'row', gap: 10, marginBottom: 30 },
  socialBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff' },
  socialText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#1c2024' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#1c2024' },
  footerLink: { fontFamily: 'Inter_700Bold', fontSize: 13, color: GOLD },
});
