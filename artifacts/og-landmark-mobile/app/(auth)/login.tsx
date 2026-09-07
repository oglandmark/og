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
const BG     = '#ffffff';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { loginAPI, loginSocial } = useAuth();
  const { tr, isRTL } = useLanguage();

  const [identifier, setIdentifier] = useState('');
  const [loginMethod, setLoginMethod] = useState<'email' | 'username' | 'mobile'>('email');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [rememberMe, setRemember] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const rtl = isRTL ? 'right' as const : 'left' as const;
  const identifierLabel = loginMethod === 'email'
    ? tr('emailLabel')
    : loginMethod === 'username' ? tr('usernameLabel') : tr('mobileNumber');
  const identifierPlaceholder = loginMethod === 'email'
    ? tr('emailPlaceholderLogin')
    : loginMethod === 'username' ? tr('usernamePlaceholderLogin') : tr('mobilePlaceholderLogin');

  const handleFacebookLogin = useCallback(async (accessToken: string) => {
    const result = await loginSocial('facebook', accessToken);
    if (result.success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    }
    return result;
  }, [loginSocial]);
  const facebook = useFacebookAuth(handleFacebookLogin);

  const handleLogin = async () => {
    const value = identifier.trim();
    if (loginMethod === 'email' && (!value || !value.includes('@'))) { setError(tr('loginErrEmail')); return; }
    if (loginMethod === 'username' && !/^[A-Za-z][A-Za-z0-9._-]{2,29}$/.test(value)) { setError(tr('loginErrUsername')); return; }
    if (loginMethod === 'mobile' && value.replace(/\D/g, '').length < 10) { setError(tr('loginErrMobile')); return; }
    if (!password || password.length < 4)       { setError(tr('loginErrPassword')); return; }
    setError('');
    setLoading(true);
    const normalizedIdentifier = loginMethod === 'mobile' ? value : value.toLowerCase();
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
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: BG }]}
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

        {/* Brand logo */}
        <View style={styles.logoWrap}>
          <OGLandmarkLogo size={104} />
          <Text style={styles.logoName}>OG Landmark</Text>
          <Text style={styles.logoSub}>REAL ESTATE</Text>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { textAlign: 'center' }]}>{tr('loginTitle')}</Text>

          {/* Error banner */}
          {!!(error || facebook.error) && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={13} color="#b94b42" />
              <Text style={[styles.errorText, { textAlign: rtl }]}>{error || facebook.error}</Text>
            </View>
          )}

          {/* Login method */}
          <View style={styles.methodSection}>
            <Text style={[styles.label, { textAlign: rtl }]}>{tr('loginIdentifierLabel')}</Text>
            <View style={[styles.methodRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {([
                ['email', tr('loginMethodEmail')],
                ['username', tr('loginMethodUsername')],
                ['mobile', tr('loginMethodMobile')],
              ] as const).map(([method, label]) => (
                <Pressable
                  key={method}
                  onPress={() => { setLoginMethod(method); setIdentifier(''); setError(''); }}
                  style={[styles.methodBtn, loginMethod === method && styles.methodBtnActive]}
                >
                  <Text style={[styles.methodText, loginMethod === method && styles.methodTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Identifier */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { textAlign: rtl }]}>{identifierLabel}</Text>
            <TextInput
              value={identifier}
              onChangeText={(v) => { setIdentifier(v); setError(''); }}
              keyboardType={loginMethod === 'mobile' ? 'phone-pad' : loginMethod === 'email' ? 'email-address' : 'default'}
              autoCapitalize={loginMethod === 'username' ? 'none' : 'none'}
              placeholder={identifierPlaceholder}
              placeholderTextColor={MUTED}
              textAlign={rtl}
              style={styles.underlineInput}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { textAlign: rtl }]}>{tr('passwordLabel')}</Text>
            <View style={styles.passRow}>
              <TextInput
                value={password}
                onChangeText={(v) => { setPassword(v); setError(''); }}
                secureTextEntry={!showPass}
                placeholder={tr('passwordPlaceholderLogin')}
                placeholderTextColor={MUTED}
                textAlign={rtl}
                style={[styles.underlineInput, { flex: 1, borderBottomWidth: 0 }]}
              />
              <Pressable onPress={() => setShowPass(!showPass)} hitSlop={8} style={styles.eyeBtn}>
                <Feather name={showPass ? 'eye' : 'eye-off'} size={18} color={MUTED} />
              </Pressable>
            </View>
            <View style={[styles.underlineLine, { borderColor: BORDER }]} />
          </View>

          {/* Remember Me + Forgot Password */}
          <View style={[styles.remRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Pressable
              onPress={() => setRemember(!rememberMe)}
              style={[styles.remRowInner, isRTL && { flexDirection: 'row-reverse' }]}
              hitSlop={6}
            >
              <View style={[styles.checkbox, rememberMe && { backgroundColor: ACTION, borderColor: ACTION }]}>
                {rememberMe && <Feather name="check" size={10} color="#fff" />}
              </View>
              <Text style={styles.remText}>{tr('rememberMe')}</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/(auth)/forgot-password')} hitSlop={8}>
              <Text style={styles.forgotText}>{tr('forgotPassword')}</Text>
            </Pressable>
          </View>

          {/* Login button */}
          <Pressable
            onPress={() => { void handleLogin(); }}
            style={({ pressed }) => [
              styles.loginBtn,
              { opacity: pressed ? 0.88 : 1, backgroundColor: loading ? '#8fa8c0' : ACTION },
            ]}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.loginBtnText}>{tr('loginBtn')}</Text>
            }
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{tr('orContinueWith')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social buttons */}
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
              onPress={() => { void handleLogin(); }}
              disabled={loading || facebook.loading}
              style={({ pressed }) => [styles.socialBtn, { opacity: pressed ? 0.5 : 1 }]}
            >
              <Feather name="mail" size={18} color={ACTION} />
              <Text style={styles.socialText}>Email</Text>
            </Pressable>

            <Pressable
              onPress={() => setError('Apple sign in is not configured yet. Please use Facebook or email login.')}
              style={({ pressed }) => [styles.socialBtn, { opacity: pressed ? 0.5 : 1 }]}
            >
              <FontAwesome5 name="apple" size={18} color="#000" />
              <Text style={styles.socialText}>Apple</Text>
            </Pressable>
          </View>

          {/* Sign up link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>{tr('noAccount')}</Text>
            <Pressable onPress={() => router.push('/(auth)/signup')} hitSlop={6}>
              <Text style={styles.footerLink}> {tr('signUpWithEmail')}</Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1 },
  backBtn:       { marginLeft: 16, marginBottom: 4, width: 40, height: 40, justifyContent: 'center' },

  logoWrap:      { alignItems: 'center', marginBottom: 28, marginTop: 4, gap: 10 },
  logoName:      { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, letterSpacing: 0.4, color: ACTION },
  logoSub:       { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 3, color: GOLD, marginTop: -4 },

  content:       { paddingHorizontal: 24 },
  title:         { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#1c2024', marginBottom: 24, letterSpacing: -0.3 },

  errorBox:      { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#b94b4212',
                   borderRadius: 10, borderWidth: 1, borderColor: '#b94b4230', padding: 11, marginBottom: 16 },
  errorText:     { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#b94b42', flex: 1 },

  fieldWrap:     { marginBottom: 20 },
  methodSection: { marginBottom: 16 },
  label:         { fontFamily: 'Inter_500Medium', fontSize: 12, color: MUTED, marginBottom: 8 },
  methodRow:     { flexDirection: 'row', gap: 6 },
  methodBtn:     { flex: 1, minHeight: 38, borderRadius: 9, borderWidth: 1, borderColor: BORDER,
                   alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, backgroundColor: '#fff' },
  methodBtnActive:{ backgroundColor: ACTION, borderColor: ACTION },
  methodText:    { fontFamily: 'Inter_500Medium', fontSize: 11, color: MUTED },
  methodTextActive:{ color: '#fff' },
  underlineInput:{ fontFamily: 'Inter_400Regular', fontSize: 14, color: '#1c2024',
                   borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 10, paddingTop: 2 },
  passRow:       { flexDirection: 'row', alignItems: 'center' },
  eyeBtn:        { paddingLeft: 8 },
  underlineLine: { borderBottomWidth: 1, marginTop: 0 },

  remRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  remRowInner:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  checkbox:      { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: BORDER,
                   alignItems: 'center', justifyContent: 'center' },
  remText:       { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#1c2024' },
  forgotText:    { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: GOLD },

  loginBtn:      { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  loginBtnText:  { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },

  dividerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  dividerLine:   { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText:   { fontFamily: 'Inter_400Regular', fontSize: 12, color: MUTED },

  socialRow:     { flexDirection: 'row', gap: 10, marginBottom: 30 },
  socialBtn:     { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: BORDER,
                   flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                   backgroundColor: '#fff' },
  socialText:    { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#1c2024' },

  footerRow:     { flexDirection: 'row', justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' },
  footerText:    { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#1c2024' },
  footerLink:    { fontFamily: 'Inter_700Bold', fontSize: 13, color: GOLD },

  langBtn:       { alignItems: 'center', paddingVertical: 6, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  langText:      { fontFamily: 'Inter_400Regular', fontSize: 12, color: MUTED },
});
