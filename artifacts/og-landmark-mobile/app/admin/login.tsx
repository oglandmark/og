/**
 * Admin Login — two-step: email+password → OTP → dashboard
 */
import React, { useState, useRef } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import brandColors from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Step = 'credentials' | 'otp';

export default function AdminLoginScreen() {
  const { loginAdmin, verifyAdminOtp } = useAuth();
  const colors = useColors();
  const { top } = useSafeAreaInsets();

  const [step,     setStep]     = useState<Step>('credentials');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [otp,      setOtp]      = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const otpRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // ── Step 1 ──────────────────────────────────────────────────────────────────
  async function handleVerify() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    const res = await loginAdmin(email.trim(), password);
    setLoading(false);
    if (res.success) {
      if (res.otpRequired === false) {
        router.replace('/admin/' as any);
      } else {
        setStep('otp');
        setTimeout(() => otpRef.current?.focus(), 400);
      }
    } else {
      Alert.alert('Access Denied', res.error || 'Invalid admin credentials.');
    }
  }

  // ── Step 2 ──────────────────────────────────────────────────────────────────
  async function handleOtp() {
    if (otp.trim().length < 4) {
      Alert.alert('Required', 'Enter the 6-digit OTP from your email.');
      return;
    }
    setLoading(true);
    const res = await verifyAdminOtp(email.trim(), otp.trim());
    setLoading(false);
    if (res.success) {
      router.replace('/admin/' as any);
    } else {
      Alert.alert('Invalid OTP', res.error || 'Incorrect or expired code.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.actionDeep }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: top + (Platform.OS === 'web' ? 67 : 0) + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Pressable onPress={() => router.back()} style={s.back} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={colors.splashMuted} />
        </Pressable>

        {/* Logo area */}
        <View style={s.logoWrap}>
          <View style={s.shield}>
            <Feather name="shield" size={36} color={colors.gold} />
          </View>
          <Text style={s.brand}>OG Landmark</Text>
          <Text style={s.sub}>Admin Panel</Text>
        </View>

        {/* Card */}
        <View style={[s.card, { backgroundColor: colors.actionGlassSoft, borderColor: colors.actionGlassBorder }]}>
          {step === 'credentials' ? (
            <>
              <Text style={s.title}>Admin Sign In</Text>
              <Text style={s.hint}>Enter your admin credentials. An email OTP may be required.</Text>

              <Text style={s.label}>Email Address</Text>
              <TextInput
                style={[s.input, { color: colors.primaryForeground, borderColor: colors.actionGlassBorder, backgroundColor: colors.actionGlassSoft }]}
                placeholder="admin@oglandmark.com"
                placeholderTextColor={colors.splashMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
              />

              <Text style={s.label}>Password</Text>
              <View style={s.pwdWrap}>
                <TextInput
                  style={[s.input, s.pwdInput, { color: colors.primaryForeground, borderColor: colors.actionGlassBorder, backgroundColor: colors.actionGlassSoft }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.splashMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPwd}
                  returnKeyType="done"
                  onSubmitEditing={handleVerify}
                />
                <Pressable style={s.eyeBtn} onPress={() => setShowPwd(v => !v)} hitSlop={8}>
                  <Feather name={showPwd ? 'eye-off' : 'eye'} size={18} color={colors.splashMuted} />
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [s.btn, { backgroundColor: colors.splashGold, opacity: pressed ? 0.85 : 1 }]}
                onPress={handleVerify}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={colors.goldForeground} />
                  : <><Text style={[s.btnText, { color: colors.goldForeground }]}>Send OTP</Text><Feather name="arrow-right" size={18} color={colors.goldForeground} /></>
                }
              </Pressable>
            </>
          ) : (
            <>
              <Text style={s.title}>Enter OTP</Text>
              <Text style={s.hint}>
                A 6-digit code was sent to{'\n'}
                <Text style={{ color: colors.gold }}>{email}</Text>
              </Text>

              <Text style={s.label}>One-Time Password</Text>
              <TextInput
                ref={otpRef}
                style={[s.input, s.otpInput, { color: colors.primaryForeground, borderColor: colors.goldGlassBorder, backgroundColor: colors.actionGlassSoft, letterSpacing: 10 }]}
                placeholder="— — — — — —"
                placeholderTextColor={colors.splashMuted}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleOtp}
              />
              <Text style={s.otpNote}>Code valid for 5 minutes · check server logs if email is not configured</Text>

              <Pressable
                style={({ pressed }) => [s.btn, { backgroundColor: colors.splashGold, opacity: pressed ? 0.85 : 1 }]}
                onPress={handleOtp}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={colors.goldForeground} />
                  : <><Text style={[s.btnText, { color: colors.goldForeground }]}>Verify &amp; Sign In</Text><Feather name="check" size={18} color={colors.goldForeground} /></>
                }
              </Pressable>

              <Pressable
                style={s.resend}
                onPress={() => { setStep('credentials'); setOtp(''); }}
              >
                <Text style={{ color: colors.splashMuted, fontSize: 13 }}>← Change email or resend OTP</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1 },
  scroll:   { flexGrow: 1, padding: 20 },
  back:     { marginBottom: 16 },
  logoWrap: { alignItems: 'center', marginBottom: 28 },
  shield:   { width: 72, height: 72, borderRadius: 22, backgroundColor: brandColors.light.gold + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brand:    { fontFamily: 'Inter_700Bold', fontSize: 22, color: brandColors.light.gold, letterSpacing: 0.5 },
  sub:      { fontFamily: 'Inter_400Regular', fontSize: 12, color: brandColors.light.splashMuted, letterSpacing: 2, marginTop: 3, textTransform: 'uppercase' },
  card:     { borderRadius: 22, borderWidth: 1, padding: 22 },
  title:    { fontFamily: 'Inter_700Bold', fontSize: 20, color: brandColors.light.primaryForeground, marginBottom: 6 },
  hint:     { fontFamily: 'Inter_400Regular', fontSize: 13, color: brandColors.light.splashMuted, marginBottom: 20, lineHeight: 19 },
  label:    { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: brandColors.light.splashMuted, marginBottom: 6, letterSpacing: 0.5 },
  input:    { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontFamily: 'Inter_400Regular', fontSize: 15, marginBottom: 14 },
  pwdWrap:  { position: 'relative' },
  pwdInput: { paddingRight: 44 },
  eyeBtn:   { position: 'absolute', right: 14, top: 14 },
  otpInput: { textAlign: 'center', fontSize: 22, letterSpacing: 14 },
  otpNote:  { fontFamily: 'Inter_400Regular', fontSize: 11, color: brandColors.light.splashMuted, textAlign: 'center', marginBottom: 16, lineHeight: 16 },
  btn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 8, marginTop: 4, minHeight: 44 },
  btnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: brandColors.light.goldForeground },
  resend:   { alignItems: 'center', marginTop: 14 },
});
