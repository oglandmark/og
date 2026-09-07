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
  const otpRef = useRef<React.ElementRef<typeof TextInput>>(null);

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
      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 400);
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
      style={[s.root, { backgroundColor: '#0B1F3A' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: top + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Pressable onPress={() => router.back()} style={s.back} hitSlop={10}>
          <Feather name="arrow-left" size={20} color="#8a9ab5" />
        </Pressable>

        {/* Logo area */}
        <View style={s.logoWrap}>
          <View style={s.shield}>
            <Feather name="shield" size={36} color="#C8A45A" />
          </View>
          <Text style={s.brand}>OG Landmark</Text>
          <Text style={s.sub}>Admin Panel</Text>
        </View>

        {/* Card */}
        <View style={[s.card, { backgroundColor: '#ffffff08', borderColor: '#ffffff14' }]}>
          {step === 'credentials' ? (
            <>
              <Text style={s.title}>Admin Sign In</Text>
              <Text style={s.hint}>Enter your admin credentials to receive an OTP.</Text>

              <Text style={s.label}>Email Address</Text>
              <TextInput
                style={[s.input, { color: '#fff', borderColor: '#ffffff22', backgroundColor: '#ffffff0a' }]}
                placeholder="admin@oglandmark.com"
                placeholderTextColor="#8a9ab5"
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
                  style={[s.input, s.pwdInput, { color: '#fff', borderColor: '#ffffff22', backgroundColor: '#ffffff0a' }]}
                  placeholder="••••••••"
                  placeholderTextColor="#8a9ab5"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPwd}
                  returnKeyType="done"
                  onSubmitEditing={handleVerify}
                />
                <Pressable style={s.eyeBtn} onPress={() => setShowPwd(v => !v)} hitSlop={8}>
                  <Feather name={showPwd ? 'eye-off' : 'eye'} size={18} color="#8a9ab5" />
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [s.btn, { backgroundColor: '#C8A45A', opacity: pressed ? 0.85 : 1 }]}
                onPress={handleVerify}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#0B1F3A" />
                  : <><Text style={s.btnText}>Send OTP</Text><Feather name="arrow-right" size={18} color="#0B1F3A" /></>
                }
              </Pressable>
            </>
          ) : (
            <>
              <Text style={s.title}>Enter OTP</Text>
              <Text style={s.hint}>
                A 6-digit code was sent to{'\n'}
                <Text style={{ color: '#C8A45A' }}>{email}</Text>
              </Text>

              <Text style={s.label}>One-Time Password</Text>
              <TextInput
                ref={otpRef}
                style={[s.input, s.otpInput, { color: '#fff', borderColor: '#C8A45A55', backgroundColor: '#ffffff0a', letterSpacing: 10 }]}
                placeholder="— — — — — —"
                placeholderTextColor="#8a9ab5"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleOtp}
              />
              <Text style={s.otpNote}>Code valid for 5 minutes · check server logs if email is not configured</Text>

              <Pressable
                style={({ pressed }) => [s.btn, { backgroundColor: '#C8A45A', opacity: pressed ? 0.85 : 1 }]}
                onPress={handleOtp}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#0B1F3A" />
                  : <><Text style={s.btnText}>Verify &amp; Sign In</Text><Feather name="check" size={18} color="#0B1F3A" /></>
                }
              </Pressable>

              <Pressable
                style={s.resend}
                onPress={() => { setStep('credentials'); setOtp(''); }}
              >
                <Text style={{ color: '#8a9ab5', fontSize: 13 }}>← Change email or resend OTP</Text>
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
  shield:   { width: 72, height: 72, borderRadius: 22, backgroundColor: '#C8A45A18', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brand:    { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#C8A45A', letterSpacing: 0.5 },
  sub:      { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8a9ab5', letterSpacing: 2, marginTop: 3, textTransform: 'uppercase' },
  card:     { borderRadius: 22, borderWidth: 1, padding: 22 },
  title:    { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#ffffff', marginBottom: 6 },
  hint:     { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#8a9ab5', marginBottom: 20, lineHeight: 19 },
  label:    { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#8a9ab5', marginBottom: 6, letterSpacing: 0.5 },
  input:    { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontFamily: 'Inter_400Regular', fontSize: 15, marginBottom: 14 },
  pwdWrap:  { position: 'relative' },
  pwdInput: { paddingRight: 44 },
  eyeBtn:   { position: 'absolute', right: 14, top: 14 },
  otpInput: { textAlign: 'center', fontSize: 22, letterSpacing: 14 },
  otpNote:  { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8a9ab5', textAlign: 'center', marginBottom: 16, lineHeight: 16 },
  btn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15, marginTop: 4 },
  btnText:  { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#0B1F3A' },
  resend:   { alignItems: 'center', marginTop: 14 },
});
