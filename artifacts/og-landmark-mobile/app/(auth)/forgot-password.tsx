/**
 * OG Landmark — Forgot Password
 * Step 1: Enter email  →  Step 2: 6-digit code  →  Step 3: New password
 * Uses the production API and SMTP-backed OTP flow.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
// BlurView removed — crashes Android GPU
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { BrandMark } from '@/components/BrandMark';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { requestPasswordReset, confirmPasswordReset } from '@/lib/api';

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  const [step, setStep]               = useState<1 | 2 | 3>(1);
  const [email, setEmail]             = useState('');
  const [code, setCode]               = useState(['', '', '', '', '', '']);
  const [sentCode, setSentCode]       = useState('');
  const [newPass, setNewPass]         = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [resendSecs, setResendSecs]   = useState(0);

  const digitRefs = useRef<(React.ElementRef<typeof TextInput> | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendSecs <= 0) return;
    const t = setInterval(() => setResendSecs((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendSecs]);

  // ── Step 1: Send code ──────────────────────────────────────────────────────

  const sendCode = async () => {
    if (loading) return;
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      if (res?.smtpOff) {
        setLoading(false);
        Alert.alert(
          'Email Service Unavailable',
          'Password reset email cannot be sent right now. Please contact admin at support@oglandmark.com or call us to get your reset code.',
          [{ text: 'OK' }],
        );
        return;
      }
    } catch (err: unknown) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Unable to send the code. Please try again.');
      return;
    }
    setResendSecs(60);
    setLoading(false);
    setStep(2);
  };

  // ── Step 2: Verify code ────────────────────────────────────────────────────

  const verifyCode = () => {
    const entered = code.join('');
    if (entered.length < 6) { setError('Enter the complete 6-digit code.'); return; }
    // OTP is verified by the backend in step 3; just advance here
    setError('');
    setSentCode(entered); // store to pass to confirmPasswordReset
    setStep(3);
  };

  const resendCode = async () => {
    if (resendSecs > 0) return;
    setLoading(true);
    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      if (res?.smtpOff) {
        setError('Email service is unavailable right now. Please contact admin for help.');
        setLoading(false);
        return;
      }
    } catch (err: unknown) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Unable to resend the code. Please try again.');
      return;
    }
    setCode(['', '', '', '', '', '']);
    setResendSecs(60);
    setLoading(false);
  };

  // ── Step 3: Reset password ─────────────────────────────────────────────────

  const resetPassword = async () => {
    if (newPass.length < 8 || !/[A-Za-z]/.test(newPass) || !/\d/.test(newPass)) {
      setError('Password must be at least 8 characters and include a letter and number.');
      return;
    }
    if (newPass !== confirmPass) { setError('Passwords do not match.'); return; }
    setError('');
    setLoading(true);
    try {
      await confirmPasswordReset(email.trim().toLowerCase(), sentCode, newPass);
      setLoading(false);
      Alert.alert(
        'Password Reset ✓',
        'Your password has been updated. You can now log in with your new password.',
        [{ text: 'Log In', onPress: () => router.replace('/(auth)/login') }],
      );
    } catch (err: unknown) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Reset failed. Please check your code and try again.');
    }
  };

  // ── OTP digit input handler ────────────────────────────────────────────────

  const handleDigit = (val: string, idx: number) => {
    const digit = val.replace(/[^0-9]/g, '').slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    setError('');
    if (digit && idx < 5) digitRefs.current[idx + 1]?.focus();
    if (!digit && idx > 0) digitRefs.current[idx - 1]?.focus();
  };

  const handleDigitKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[idx] && idx > 0) {
      const next = [...code];
      next[idx - 1] = '';
      setCode(next);
      digitRefs.current[idx - 1]?.focus();
    }
  };

  // ── Progress bar ───────────────────────────────────────────────────────────

  const pct = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <KeyboardAvoidingView
      style={[st.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={st.headerRow}>
          <Pressable onPress={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3) : router.back())}
            hitSlop={12} style={[st.backBtn, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[st.stepLabel, { color: colors.mutedForeground }]}>Step {step} of 3</Text>
            <View style={[st.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[st.progressFill, { width: `${pct}%`, backgroundColor: colors.action }]} />
            </View>
          </View>
        </View>

        {/* ── Brand ── */}
        <View style={st.brandWrap}>
          <BrandMark size="default" showName={false} />
        </View>

        {/* ════════════════════════════════════════════════════════
            STEP 1 — Email
        ════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <AnimatedReveal distance={16}>
            <Text style={[st.eyebrow, { color: colors.primary }]}>FORGOT PASSWORD</Text>
            <Text style={[st.title, { color: colors.foreground }]}>Reset your{'\n'}password</Text>
            <Text style={[st.sub, { color: colors.mutedForeground }]}>
              Enter the email address linked to your OG Landmark account. We'll send a 6-digit verification code.
            </Text>

            {error ? <ErrorBox error={error} colors={colors} /> : null}

            <Label colors={colors}>Email Address</Label>
            <GlassInput
              value={email} onChangeText={(v: string) => { setEmail(v); setError(''); }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              colors={colors}
            />

            <AnimatedPressable
              onPress={sendCode}
              style={[st.btn, { backgroundColor: loading ? colors.muted : colors.action }]}
            >
              {loading
                ? <Text style={[st.btnText, { color: colors.mutedForeground }]}>Sending…</Text>
                : <>
                    <Text style={[st.btnText, { color: colors.actionForeground }]}>Send Verification Code</Text>
                    <Feather name="send" size={16} color={colors.actionForeground} />
                  </>}
            </AnimatedPressable>

            <Pressable onPress={() => router.back()} style={st.linkRow}>
              <Text style={[st.link, { color: colors.action }]}>← Back to Login</Text>
            </Pressable>
          </AnimatedReveal>
        )}

        {/* ════════════════════════════════════════════════════════
            STEP 2 — 6-digit code
        ════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <AnimatedReveal distance={16}>
            <Text style={[st.eyebrow, { color: colors.primary }]}>VERIFY EMAIL</Text>
            <Text style={[st.title, { color: colors.foreground }]}>Enter the{'\n'}6-digit code</Text>
            <Text style={[st.sub, { color: colors.mutedForeground }]}>
              A verification code was sent to{' '}
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{email}</Text>.
              {'\n'}The code expires in 15 minutes.
            </Text>

            {error ? <ErrorBox error={error} colors={colors} /> : null}

            {/* OTP boxes */}
            <View style={st.otpRow}>
              {code.map((digit, i) => (
                <View
                  key={i}
                  style={[
                    st.otpBox,
                    {
                      backgroundColor: colors.glassCard,
                      borderColor: digit ? colors.action : colors.glassBorder,
                      shadowColor: digit ? colors.action : 'transparent',
                    },
                  ]}
                >
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
                  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
                  <TextInput
                    ref={(r) => { digitRefs.current[i] = r; }}
                    value={digit}
                    onChangeText={(v) => handleDigit(v, i)}
                    onKeyPress={(e) => handleDigitKeyPress(e, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    style={[st.otpInput, { color: colors.foreground }]}
                  />
                </View>
              ))}
            </View>

            <AnimatedPressable onPress={verifyCode} style={[st.btn, { backgroundColor: colors.action }]}>
              <Text style={[st.btnText, { color: colors.actionForeground }]}>Verify Code</Text>
              <Feather name="check" size={16} color={colors.actionForeground} />
            </AnimatedPressable>

            {/* Resend */}
            <View style={st.resendRow}>
              <Text style={[st.resendLabel, { color: colors.mutedForeground }]}>Didn't receive it?</Text>
              <Pressable onPress={resendCode} disabled={resendSecs > 0 || loading} hitSlop={8}>
                <Text style={[st.link, { color: resendSecs > 0 ? colors.mutedForeground : colors.action }]}>
                  {resendSecs > 0 ? ` Resend in ${resendSecs}s` : ' Resend Code'}
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={() => { setStep(1); setCode(['','','','','','']); setError(''); }} style={st.linkRow} hitSlop={8}>
              <Text style={[st.link, { color: colors.action }]}>← Change Email</Text>
            </Pressable>
          </AnimatedReveal>
        )}

        {/* ════════════════════════════════════════════════════════
            STEP 3 — New password
        ════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <AnimatedReveal distance={16}>
            <Text style={[st.eyebrow, { color: colors.primary }]}>NEW PASSWORD</Text>
            <Text style={[st.title, { color: colors.foreground }]}>Create a new{'\n'}password</Text>
            <Text style={[st.sub, { color: colors.mutedForeground }]}>
              Choose a strong password. It must be at least 8 characters long.
            </Text>

            {error ? <ErrorBox error={error} colors={colors} /> : null}

            <Label colors={colors}>New Password</Label>
            <View style={[st.inputShell, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
              <TextInput
                value={newPass} onChangeText={(v) => { setNewPass(v); setError(''); }}
                secureTextEntry={!showPass}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.mutedForeground}
                style={[st.input, { color: colors.foreground }]}
              />
              <Pressable onPress={() => setShowPass(!showPass)} style={st.eyeBtn} hitSlop={8}>
                <Feather name={showPass ? 'eye-off' : 'eye'} size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Strength indicator */}
            {newPass.length > 0 && (
              <View style={st.strengthRow}>
                {[4, 6, 8, 10].map((threshold, i) => {
                  const filled = newPass.length >= threshold;
                  const barColor = newPass.length < 6 ? '#e53e3e' : newPass.length < 8 ? '#f59e0b' : '#1a6b3a';
                  return (
                    <View key={i} style={[st.strengthBar, { backgroundColor: filled ? barColor : colors.border }]} />
                  );
                })}
                <Text style={[st.strengthLabel, { color: newPass.length < 8 ? '#e53e3e' : newPass.length < 10 ? '#f59e0b' : '#1a6b3a' }]}>
                  {newPass.length < 8 ? 'Too short' : newPass.length < 10 ? 'Fair' : 'Strong'}
                </Text>
              </View>
            )}

            <Label colors={colors}>Confirm Password</Label>
            <View style={[st.inputShell, { backgroundColor: colors.glassCard, borderColor: confirmPass && confirmPass !== newPass ? '#e53e3e' : colors.glassBorder }]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
              <TextInput
                value={confirmPass} onChangeText={(v) => { setConfirmPass(v); setError(''); }}
                secureTextEntry={!showConfirm}
                placeholder="Re-enter password"
                placeholderTextColor={colors.mutedForeground}
                style={[st.input, { color: colors.foreground }]}
              />
              <Pressable onPress={() => setShowConfirm(!showConfirm)} style={st.eyeBtn} hitSlop={8}>
                <Feather name={showConfirm ? 'eye-off' : 'eye'} size={16} color={colors.mutedForeground} />
              </Pressable>
              {confirmPass.length > 0 && (
                <View style={st.matchIcon}>
                  <Feather
                    name={confirmPass === newPass ? 'check-circle' : 'x-circle'}
                    size={15}
                    color={confirmPass === newPass ? '#1a6b3a' : '#e53e3e'}
                  />
                </View>
              )}
            </View>

            <AnimatedPressable
              onPress={resetPassword}
              style={[st.btn, { backgroundColor: loading ? colors.muted : colors.action, marginTop: 8 }]}
            >
              {loading
                ? <Text style={[st.btnText, { color: colors.mutedForeground }]}>Updating…</Text>
                : <>
                    <Text style={[st.btnText, { color: colors.actionForeground }]}>Reset Password</Text>
                    <Feather name="unlock" size={16} color={colors.actionForeground} />
                  </>}
            </AnimatedPressable>
          </AnimatedReveal>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ErrorBox({ error, colors }: { error: string; colors: any }) {
  return (
    <View style={[st.errorBox, { backgroundColor: '#e53e3e18', borderColor: '#e53e3e44' }]}>
      <Feather name="alert-circle" size={14} color="#e53e3e" />
      <Text style={[st.errorText, { color: '#e53e3e' }]}>{error}</Text>
    </View>
  );
}

function Label({ children, colors }: { children: React.ReactNode; colors: any }) {
  return <Text style={[st.label, { color: colors.foreground }]}>{children}</Text>;
}

function GlassInput({ value, onChangeText, placeholder, keyboardType, autoCapitalize, colors }: any) {
  return (
    <View style={[st.inputShell, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
      <TextInput
        value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType} autoCapitalize={autoCapitalize ?? 'none'}
        style={[st.input, { color: colors.foreground }]}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  screen:        { flex: 1 },
  headerRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtn:       { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepLabel:     { fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 6 },
  progressTrack: { height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: 3, borderRadius: 2 },
  brandWrap:     { alignItems: 'center', marginBottom: 28 },
  eyebrow:       { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.6, marginBottom: 8 },
  title:         { fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 34, letterSpacing: -0.4, marginBottom: 10 },
  sub:           { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginBottom: 24 },
  label:         { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8, marginTop: 4 },
  inputShell:    { height: 52, borderWidth: 1, borderRadius: 13, overflow: 'hidden', marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  input:         { flex: 1, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 13, zIndex: 1 },
  eyeBtn:        { paddingHorizontal: 14, zIndex: 1 },
  matchIcon:     { paddingRight: 8, zIndex: 1 },
  btn:           { height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 4 },
  btnText:       { fontFamily: 'Inter_700Bold', fontSize: 14 },
  errorBox:      { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  errorText:     { fontFamily: 'Inter_400Regular', fontSize: 12, flex: 1 },
  // OTP
  otpRow:        { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 28, marginTop: 4 },
  otpBox:        { width: 48, height: 58, borderRadius: 14, borderWidth: 1.5, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  otpInput:      { fontFamily: 'Inter_700Bold', fontSize: 24, textAlign: 'center', width: '100%', height: '100%', zIndex: 1 },
  resendRow:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  resendLabel:   { fontFamily: 'Inter_400Regular', fontSize: 12 },
  linkRow:       { alignItems: 'center', marginTop: 14 },
  link:          { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  // Password strength
  strengthRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -10, marginBottom: 14 },
  strengthBar:   { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, marginLeft: 4 },
});
