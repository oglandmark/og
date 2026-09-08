/**
 * Sign Up — buyer-only registration.
 * Agent / Developer accounts are created by admin.
 * Design mirrors the Sign In screen exactly.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { OGLandmarkLogo } from '@/components/OGLandmarkLogo';
import { useFacebookAuth } from '@/lib/facebookAuth';

const ACTION = '#102a43';
const GOLD   = '#c8a45a';
const MUTED  = '#8a8f98';
const BORDER = '#e4e6ea';

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const { registerAPI, loginSocial } = useAuth();
  const { tr, isRTL } = useLanguage();

  const [name,     setName]     = useState('');
  const [identifier, setIdentifier] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const rtl = isRTL ? 'right' as const : 'left' as const;
  const identifierValue = identifier.trim();
  const isMobileIdentifier = identifierValue.length > 0
    && /^[+\d\s().-]+$/.test(identifierValue);

  const handleFacebookSignup = useCallback(async (accessToken: string) => {
    const result = await loginSocial('facebook', accessToken);
    if (result.success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    }
    return result;
  }, [loginSocial]);
  const facebook = useFacebookAuth(handleFacebookSignup);

  async function handleRegister() {
    if (!name.trim())                                          { setError('Full name is required.');                              return; }
    const value = identifier.trim();
    if (!value)                                                 { setError(tr('signupIdentifierRequired'));                      return; }
    if (isMobileIdentifier && value.replace(/\D/g,'').length < 10) {
      setError(tr('signupMobileError')); return;
    }
    if (!isMobileIdentifier && value.includes('@') && !value.includes('.')) {
      setError(tr('signupEmailError')); return;
    }
    if (!isMobileIdentifier && !value.includes('@') && !/^[A-Za-z][A-Za-z0-9._-]{2,29}$/.test(value)) {
      setError(tr('signupUsernameError')); return;
    }
    const secondaryPhone = mobileNumber.trim();
    if (!isMobileIdentifier && secondaryPhone && secondaryPhone.replace(/\D/g, '').length < 10) {
      setError(tr('signupMobileError')); return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('Password must be at least 8 characters and include a letter and number.');
      return;
    }
    if (password !== confirmPassword)                          { setError('Passwords do not match.');                           return; }

    setError('');
    setLoading(true);

    const res = await registerAPI({
      name:    name.trim(),
      email:   !isMobileIdentifier && value.includes('@') ? value.toLowerCase() : undefined,
      username: !isMobileIdentifier && !value.includes('@') ? value.toLowerCase() : undefined,
      phone:   isMobileIdentifier ? value : secondaryPhone || undefined,
      password,
      confirmPassword,
      role:    'buyer',
    });

    setLoading(false);

    if (res.pendingApproval) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // Still let them in; show message
      router.replace('/(tabs)');
      return;
    }

    if (!res.success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(res.error ?? 'Registration failed. Please try again.');
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: '#ffffff' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back arrow */}
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={ACTION} />
        </Pressable>

        {/* Brand logo — same as login */}
        <View style={styles.logoWrap}>
          <OGLandmarkLogo size={104} />
          <Text style={styles.logoName}>OG Landmark</Text>
          <Text style={styles.logoSub}>REAL ESTATE</Text>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { textAlign: 'center' }]}>Create Account</Text>

          {/* Error banner */}
          {!!(error || facebook.error) && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={13} color="#b94b42" />
              <Text style={[styles.errorText, { textAlign: rtl }]}>{error || facebook.error}</Text>
            </View>
          )}

          {/* Full Name */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { textAlign: rtl }]}>FULL NAME</Text>
            <TextInput
              value={name}
              onChangeText={(v) => { setName(v); setError(''); }}
              placeholder="Muhammad Ali"
              placeholderTextColor={MUTED}
              textAlign={rtl}
              autoCapitalize="words"
              style={styles.underlineInput}
            />
          </View>

          {/* Account identifier */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { textAlign: rtl }]}>{tr('signupIdentifierLabel')}</Text>
            <TextInput
              value={identifier}
              onChangeText={(v) => { setIdentifier(v); setError(''); }}
              keyboardType={isMobileIdentifier ? 'phone-pad' : 'default'}
              autoCapitalize="none"
              placeholder={tr('signupEmailPlaceholder')}
              placeholderTextColor={MUTED}
              textAlign="left"
              style={[styles.underlineInput, styles.identifierInput]}
            />
          </View>

          {/* Optional secondary mobile number. A mobile identifier already fills this value. */}
          {!isMobileIdentifier && (
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { textAlign: rtl }]}>{tr('signupMobileLabel')}</Text>
              <TextInput
                value={mobileNumber}
                onChangeText={(v) => { setMobileNumber(v); setError(''); }}
                keyboardType="phone-pad"
                placeholder={tr('signupMobilePlaceholder')}
                placeholderTextColor={MUTED}
                textAlign="left"
                style={[styles.underlineInput, styles.identifierInput]}
              />
            </View>
          )}

          {/* Password */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { textAlign: rtl }]}>PASSWORD</Text>
            <View style={styles.passRow}>
              <TextInput
                value={password}
                onChangeText={(v) => { setPassword(v); setError(''); }}
                secureTextEntry={!showPwd}
                placeholder="Min. 8 characters"
                placeholderTextColor={MUTED}
                textAlign={rtl}
                style={[styles.underlineInput, { flex: 1, borderBottomWidth: 0 }]}
              />
              <Pressable onPress={() => setShowPwd(v => !v)} hitSlop={8} style={styles.eyeBtn}>
                <Feather name={showPwd ? 'eye' : 'eye-off'} size={18} color={MUTED} />
              </Pressable>
            </View>
            <View style={[styles.underlineLine, { borderColor: BORDER }]} />
          </View>

          {/* Confirm password */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { textAlign: rtl }]}>CONFIRM PASSWORD</Text>
            <View style={styles.passRow}>
              <TextInput
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setError(''); }}
                secureTextEntry={!showConfirmPwd}
                placeholder="Re-enter your password"
                placeholderTextColor={MUTED}
                textAlign={rtl}
                style={[styles.underlineInput, { flex: 1, borderBottomWidth: 0 }]}
              />
              <Pressable onPress={() => setShowConfirmPwd(v => !v)} hitSlop={8} style={styles.eyeBtn}>
                <Feather name={showConfirmPwd ? 'eye' : 'eye-off'} size={18} color={MUTED} />
              </Pressable>
            </View>
            <View style={[styles.underlineLine, { borderColor: BORDER }]} />
          </View>

          {/* Create Account button */}
          <Pressable
            onPress={() => { void handleRegister(); }}
            disabled={loading}
            style={({ pressed }) => [
              styles.submitBtn,
              { backgroundColor: loading ? '#8fa8c0' : ACTION, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.submitText}>Create Account</Text>
            }
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social buttons — matching login exactly */}
          <View style={styles.socialRow}>
            <Pressable
              onPress={() => { void facebook.signIn(); }}
              disabled={loading || facebook.loading}
              style={({ pressed }) => [styles.socialBtn, { opacity: pressed || facebook.loading ? 0.5 : 1 }]}
            >
              {facebook.loading
                ? <ActivityIndicator size="small" color="#1877f2" />
                : <FontAwesome5 name="facebook" size={18} color="#1877f2" />}
              <Text style={styles.socialText}>Facebook</Text>
            </Pressable>

            <Pressable
              onPress={() => { void handleRegister(); }}
              disabled={loading || facebook.loading}
              style={({ pressed }) => [styles.socialBtn, { opacity: pressed ? 0.5 : 1 }]}
            >
              <Feather name="mail" size={18} color={ACTION} />
              <Text style={styles.socialText}>Email</Text>
            </Pressable>

            <Pressable
              onPress={() => setError('Apple sign in is not configured yet. Please use Facebook or email sign up.')}
              style={({ pressed }) => [styles.socialBtn, { opacity: pressed ? 0.5 : 1 }]}
            >
              <FontAwesome5 name="apple" size={18} color="#000" />
              <Text style={styles.socialText}>Apple</Text>
            </Pressable>
          </View>

          {/* Sign in link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => router.push('/(auth)/login')} hitSlop={6}>
              <Text style={styles.footerLink}> Sign In</Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:         { flex: 1 },
  backBtn:        { marginLeft: 16, marginBottom: 4, width: 40, height: 40, justifyContent: 'center' },

  logoWrap:       { alignItems: 'center', marginBottom: 28, marginTop: 4, gap: 10 },
  logoName:       { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, letterSpacing: 0.4, color: ACTION },
  logoSub:        { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 3, color: GOLD, marginTop: -4 },

  content:        { paddingHorizontal: 24 },
  title:          { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#1c2024', marginBottom: 24, letterSpacing: -0.3 },

  errorBox:       { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#b94b4212',
                    borderRadius: 10, borderWidth: 1, borderColor: '#b94b4230', padding: 11, marginBottom: 16 },
  errorText:      { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#b94b42', flex: 1 },

  fieldWrap:      { marginBottom: 20 },
  label:          { fontFamily: 'Inter_500Medium', fontSize: 12, color: MUTED, marginBottom: 8, letterSpacing: 0.5 },
  underlineInput: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#1c2024',
                    borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 10, paddingTop: 2 },
  identifierInput: { writingDirection: 'ltr' },
  passRow:        { flexDirection: 'row', alignItems: 'center' },
  eyeBtn:         { paddingLeft: 8 },
  underlineLine:  { borderBottomWidth: 1, marginTop: 0 },

  submitBtn:      { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  submitText:     { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },

  dividerRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  dividerLine:    { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText:    { fontFamily: 'Inter_400Regular', fontSize: 12, color: MUTED },

  socialRow:      { flexDirection: 'row', gap: 10, marginBottom: 30 },
  socialBtn:      { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: BORDER,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    backgroundColor: '#fff' },
  socialText:     { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#1c2024' },

  footerRow:      { flexDirection: 'row', justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' },
  footerText:     { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#1c2024' },
  footerLink:     { fontFamily: 'Inter_700Bold', fontSize: 13, color: GOLD },

  langBtn:        { alignItems: 'center', paddingVertical: 6, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  langText:       { fontFamily: 'Inter_400Regular', fontSize: 12, color: MUTED },
});
