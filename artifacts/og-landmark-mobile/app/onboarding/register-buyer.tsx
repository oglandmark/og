import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { okaraDistrict } from '@/lib/cities';
import { getMobileSettings } from '@/lib/api';

const ACTION  = '#102a43';
const GOLD    = '#c8a45a';
const MUTED   = '#8a8f98';
const BORDER  = '#e4e6ea';
const BG      = '#ffffff';
const DEST    = '#b94b42';

// ── Feature carousel slides ────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: 'home' as const,
    title: 'Find Your Dream Property',
    desc: 'Browse verified listings across Okara District tailored to your interest.',
  },
  {
    icon: 'trending-up' as const,
    title: 'Smart Investment Guide',
    desc: 'Get AI-powered insights and market trends for the best investment decisions.',
  },
  {
    icon: 'shield' as const,
    title: 'Sell or Rent Your Property',
    desc: 'Easily list your property and reach thousands of qualified buyers and renters.',
  },
];

export default function RegisterBuyerScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { registerAPI } = useAuth();
  const { tr, isRTL }   = useLanguage();

  const [slide, setSlide] = useState(0);
  const [featureSlides, setFeatureSlides] = useState(FEATURES);
  useEffect(() => {
    getMobileSettings()
      .then((settings) => {
        const slides = settings.content?.screens?.onboarding?.buyerSlides;
        if (slides?.length) setFeatureSlides(slides as typeof FEATURES);
      })
      .catch(() => undefined);
  }, []);

  // Form state
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [city,     setCity]     = useState('');
  const [area,     setArea]     = useState('');
  const [purpose,  setPurpose]  = useState('');
  const [showCities, setShowCities] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [regError, setRegError] = useState('');

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);
  const rtl    = isRTL ? 'right' as const : 'left' as const;

  const purposes = [
    { key: 'buy',        labelKey: 'purposeBuy'        as const, icon: 'home'       as const },
    { key: 'rent',       labelKey: 'purposeRent'       as const, icon: 'key'        as const },
    { key: 'sell',       labelKey: 'purposeSell'       as const, icon: 'tag'        as const },
    { key: 'agri',       labelKey: 'purposeAgri'       as const, icon: 'map'        as const },
    { key: 'commercial', labelKey: 'purposeCommercial' as const, icon: 'briefcase'  as const },
    { key: 'invest',     labelKey: 'purposeInvest'     as const, icon: 'trending-up'as const },
  ];

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())                       e.name    = tr('errName');
    if (!phone.trim() || phone.length < 10) e.phone   = tr('errPhone');
    if (!email.trim() || !email.includes('@')) e.email = tr('errEmail');
    if (!password || password.length < 8)   e.password = tr('errPassword');
    if (!city)                              e.city    = tr('errCity');
    if (!purpose)                           e.purpose = tr('errPurpose');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    setRegError('');
    setLoading(true);
    const result = await registerAPI({
      name: name.trim(), email: email.trim().toLowerCase(),
      password, phone: phone.trim(), role: 'buyer', city,
    });
    setLoading(false);
    if (!result.success) {
      setRegError(result.error ?? 'Registration failed. Please try again.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  };

  const areas = city ? (okaraDistrict.areas[city] ?? []) : [];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BG }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: botPad + 32 }}
      >
        {/* Header bar */}
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Feather name="chevron-left" size={26} color={ACTION} />
          </Pressable>
          <Text style={styles.headerTitle}>Become a Free Member</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Feature carousel */}
        <View style={styles.carousel}>
          <View style={styles.carouselCard}>
            <View style={styles.featureIconWrap}>
              <Feather name={(featureSlides[slide] || featureSlides[0]).icon as any} size={28} color={ACTION} />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureTitle}>{(featureSlides[slide] || featureSlides[0]).title}</Text>
              <Text style={styles.featureDesc}>{(featureSlides[slide] || featureSlides[0]).desc}</Text>
            </View>
          </View>
          {/* Dots */}
          <View style={styles.dotsRow}>
            {featureSlides.map((_, i) => (
              <Pressable key={i} onPress={() => setSlide(i)} hitSlop={8}>
                <View style={[styles.dot, i === slide && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>

          {/* Name */}
          <UnderlineField
            label="Name" value={name} onChangeText={setName}
            placeholder="Your Name" error={errors.name} rtl={isRTL}
          />

          {/* Email */}
          <UnderlineField
            label="Email Address" value={email} onChangeText={setEmail}
            placeholder="Email Address" error={errors.email} rtl={isRTL}
            keyboardType="email-address"
          />

          {/* Password */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { textAlign: rtl }]}>Password</Text>
            <View style={styles.passRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                placeholder="Password"
                placeholderTextColor={MUTED}
                textAlign={rtl}
                style={[styles.underlineInput, { flex: 1, borderBottomWidth: 0 }]}
              />
              <Pressable onPress={() => setShowPass(!showPass)} hitSlop={8}>
                <Feather name={showPass ? 'eye' : 'eye-off'} size={18} color={MUTED} />
              </Pressable>
            </View>
            <View style={styles.underlineLine} />
            {!!errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          {/* Phone with +92 prefix */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { textAlign: rtl }]}>Phone</Text>
            <View style={styles.passRow}>
              <View style={styles.phonePre}>
                <Text style={styles.phoneFlag}>🇵🇰</Text>
                <Text style={styles.phoneCode}>+92</Text>
                <Feather name="chevron-down" size={13} color={MUTED} />
              </View>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="3xx xxxxxxx"
                placeholderTextColor={MUTED}
                keyboardType="phone-pad"
                textAlign={rtl}
                style={[styles.underlineInput, { flex: 1, borderBottomWidth: 0 }]}
              />
            </View>
            <View style={styles.underlineLine} />
            {!!errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>

          {/* City */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { textAlign: rtl }]}>{tr('city')}</Text>
            <Pressable
              onPress={() => setShowCities(!showCities)}
              style={styles.passRow}
            >
              <Text style={[styles.underlineInput,
                { flex: 1, borderBottomWidth: 0, color: city ? '#1c2024' : MUTED }]}>
                {city || tr('selectCity')}
              </Text>
              <Feather name={showCities ? 'chevron-up' : 'chevron-down'} size={16} color={MUTED} />
            </Pressable>
            <View style={[styles.underlineLine, { borderColor: errors.city ? DEST : BORDER }]} />
            {!!errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
            {showCities && (
              <View style={styles.dropdown}>
                {okaraDistrict.cities.map((c) => (
                  <Pressable key={c} onPress={() => { setCity(c); setArea(''); setShowCities(false); }}
                    style={[styles.dropItem, { borderBottomColor: BORDER }]}>
                    <Text style={styles.dropItemText}>{c}</Text>
                    {city === c && <Feather name="check" size={13} color={ACTION} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Area chips */}
          {areas.length > 0 && (
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { textAlign: rtl }]}>{tr('area')}</Text>
              <View style={styles.chipGrid}>
                {areas.map((a) => (
                  <Pressable key={a} onPress={() => setArea(a)}
                    style={[styles.chip, { borderColor: area === a ? ACTION : BORDER, backgroundColor: area === a ? ACTION : 'transparent' }]}>
                    <Text style={[styles.chipText, { color: area === a ? '#fff' : MUTED }]}>{a}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Purpose */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { textAlign: rtl }]}>{tr('purposeLabel')}</Text>
            {!!errors.purpose && <Text style={styles.errorText}>{errors.purpose}</Text>}
            <View style={styles.purposeGrid}>
              {purposes.map((p) => (
                <Pressable key={p.key} onPress={() => setPurpose(p.key)}
                  style={[styles.purposeCard, {
                    borderColor: purpose === p.key ? ACTION : BORDER,
                    backgroundColor: purpose === p.key ? ACTION : '#f9f9fb',
                  }]}>
                  <Feather name={p.icon} size={16} color={purpose === p.key ? '#fff' : ACTION} />
                  <Text style={[styles.purposeText, { color: purpose === p.key ? '#fff' : '#1c2024' }]}>
                    {tr(p.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* API error */}
          {!!regError && (
            <View style={styles.apiErrorBox}>
              <Feather name="alert-circle" size={13} color={DEST} />
              <Text style={styles.apiErrorText}>{regError}</Text>
            </View>
          )}

          {/* Register button */}
          <Pressable
            onPress={() => { void handleRegister(); }}
            disabled={loading}
            style={({ pressed }) => [styles.registerBtn, { backgroundColor: loading ? '#8fa8c0' : ACTION, opacity: pressed ? 0.88 : 1 }]}
          >
            <Text style={styles.registerBtnText}>
              {loading ? tr('creatingAccount') : 'Register Now'}
            </Text>
          </Pressable>

          {/* Already a member */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already a member?</Text>
            <Pressable onPress={() => router.push('/(auth)/login')} hitSlop={6}>
              <Text style={styles.footerLink}> Log In Instead</Text>
            </Pressable>
          </View>

          {/* Terms */}
          <Text style={styles.termsText}>
            By pressing "Register Now" I declare that I've read and I agree to the OG Landmark{' '}
            <Text style={styles.termsLink}>Terms & Conditions.</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Shared underline field component ──────────────────────────────────────────
function UnderlineField({
  label, value, onChangeText, placeholder, error, rtl,
  keyboardType, secureTextEntry,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; error?: string; rtl?: boolean;
  keyboardType?: 'email-address' | 'phone-pad'; secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { textAlign: rtl ? 'right' : 'left' }]}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={MUTED}
        keyboardType={keyboardType} secureTextEntry={secureTextEntry}
        autoCapitalize={keyboardType ? 'none' : 'words'}
        textAlign={rtl ? 'right' : 'left'}
        style={[styles.underlineInput, { borderBottomColor: error ? DEST : BORDER }]}
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16 },
  backBtn:        { width: 40, height: 40, justifyContent: 'center' },
  headerTitle:    { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#1c2024', letterSpacing: -0.2 },

  /* Carousel */
  carousel:       { marginHorizontal: 20, marginBottom: 28, backgroundColor: '#f7f8fa', borderRadius: 16, padding: 16 },
  carouselCard:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 12 },
  featureIconWrap:{ width: 52, height: 52, borderRadius: 15, backgroundColor: '#e8eef4', alignItems: 'center', justifyContent: 'center' },
  featureTextWrap:{ flex: 1 },
  featureTitle:   { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#1c2024', marginBottom: 4 },
  featureDesc:    { fontFamily: 'Inter_400Regular', fontSize: 11, color: MUTED, lineHeight: 16 },
  dotsRow:        { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot:            { width: 7, height: 7, borderRadius: 4, backgroundColor: BORDER },
  dotActive:      { backgroundColor: ACTION, width: 18 },

  /* Form */
  form:           { paddingHorizontal: 22 },
  fieldWrap:      { marginBottom: 22 },
  label:          { fontFamily: 'Inter_500Medium', fontSize: 12, color: MUTED, marginBottom: 8 },
  underlineInput: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#1c2024',
                    borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 10, paddingTop: 2 },
  passRow:        { flexDirection: 'row', alignItems: 'center' },
  underlineLine:  { borderBottomWidth: 1, borderColor: BORDER },
  errorText:      { fontFamily: 'Inter_400Regular', fontSize: 11, color: DEST, marginTop: 5 },

  /* Phone prefix */
  phonePre:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 10, paddingBottom: 10 },
  phoneFlag:      { fontSize: 17 },
  phoneCode:      { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#1c2024' },

  /* Dropdown */
  dropdown:       { borderWidth: 1, borderColor: BORDER, borderRadius: 12, marginTop: 4, overflow: 'hidden', backgroundColor: '#fff' },
  dropItem:       { height: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  dropItemText:   { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#1c2024' },

  /* Area chips */
  chipGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip:           { borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 11, paddingVertical: 7 },
  chipText:       { fontFamily: 'Inter_500Medium', fontSize: 11 },

  /* Purpose */
  purposeGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  purposeCard:    { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  purposeText:    { fontFamily: 'Inter_500Medium', fontSize: 11 },

  /* API error */
  apiErrorBox:    { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#b94b4212',
                    borderRadius: 10, borderWidth: 1, borderColor: '#b94b4230', padding: 11, marginBottom: 16 },
  apiErrorText:   { fontFamily: 'Inter_400Regular', fontSize: 12, color: DEST, flex: 1 },

  /* Register button */
  registerBtn:    { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  registerBtnText:{ fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },

  /* Footer */
  footerRow:      { flexDirection: 'row', justifyContent: 'center', marginBottom: 14 },
  footerText:     { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#1c2024' },
  footerLink:     { fontFamily: 'Inter_700Bold', fontSize: 13, color: GOLD },

  /* Terms */
  termsText:      { fontFamily: 'Inter_400Regular', fontSize: 11, color: MUTED, textAlign: 'center', lineHeight: 16 },
  termsLink:      { color: GOLD, fontFamily: 'Inter_600SemiBold' },
});
