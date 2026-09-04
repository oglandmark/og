import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { okaraDistrict } from '@/lib/cities';

export default function RegisterAgentScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { registerAPI } = useAuth();
  const { tr, isRTL } = useLanguage();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cnic, setCnic] = useState('');
  const [password, setPassword] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [city, setCity] = useState('');
  const [experience, setExperience] = useState('');
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [showCities, setShowCities] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [regError, setRegError] = useState('');

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);
  const rtl = isRTL ? 'right' as const : 'left' as const;

  const expOptions = [tr('exp0'), tr('exp1'), tr('exp2'), tr('exp3'), tr('exp4')];
  const specOptions = [
    tr('specResidential'), tr('specCommercial'), tr('specAgricultural'), tr('specIndustrial'),
    tr('specRental'), tr('specInvestment'), tr('specNewProjects'), tr('specHousing'),
  ];

  const toggleSpec = (s: string) =>
    setSelectedSpecs((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = tr('errName');
    if (!phone.trim() || phone.length < 10) e.phone = tr('errPhone');
    if (!email.trim() || !email.includes('@')) e.email = tr('errEmail');
    if (!password || password.length < 8) e.password = tr('errPassword');
    if (!city) e.city = tr('errCity');
    if (selectedSpecs.length === 0) e.specs = tr('errSpec');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    setRegError('');
    setLoading(true);
    const result = await registerAPI({
      name: name.trim(), email: email.trim().toLowerCase(),
      password, phone: phone.trim(), role: 'agent',
      agencyName: agencyName.trim() || undefined, city,
    });
    setLoading(false);
    if (!result.success) {
      setRegError(result.error ?? 'Registration failed. Please try again.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (result.pendingApproval) {
      // Agent accounts require admin approval — do not navigate to the app
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Application Submitted ✓',
        result.pendingMessage ?? 'Your agent account is under review. We will notify you once approved.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
      );
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: botPad + 100, paddingHorizontal: 22 }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.eyebrow, { color: colors.primary, textAlign: rtl }]}>{tr('agentRegEyebrow')}</Text>
          <Text style={[styles.title, { color: colors.foreground, textAlign: rtl }]}>{tr('agentRegTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: rtl }]}>{tr('agentRegSub')}</Text>

          <View style={[styles.notice, { backgroundColor: colors.accent, borderColor: colors.primary + '44' }]}>
            <Feather name="shield" size={16} color={colors.accentForeground} />
            <Text style={[styles.noticeText, { color: colors.accentForeground, textAlign: rtl }]}>{tr('agentVerifyNotice')}</Text>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign: rtl }]}>{tr('sectionPersonal')}</Text>
          <Field label={tr('fullName')} value={name} onChangeText={setName} placeholder={tr('namePlaceholder')} error={errors.name} colors={colors} rtl={isRTL} />
          <Field label={tr('mobileNumber')} value={phone} onChangeText={setPhone} placeholder={tr('phonePlaceholder')} error={errors.phone} colors={colors} keyboardType="phone-pad" rtl={isRTL} />
          <Field label={tr('emailAddress')} value={email} onChangeText={setEmail} placeholder={tr('emailPlaceholder')} error={errors.email} colors={colors} keyboardType="email-address" rtl={isRTL} />
          <Field label={tr('cnicLabel')} value={cnic} onChangeText={setCnic} placeholder={tr('cnicPlaceholder')} colors={colors} keyboardType="phone-pad" rtl={isRTL} />
          <Field label={tr('password')} value={password} onChangeText={setPassword} placeholder={tr('passwordPlaceholder')} error={errors.password} colors={colors} secureTextEntry rtl={isRTL} />

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign: rtl, marginTop: 8 }]}>{tr('sectionProfessional')}</Text>
          <Field label={tr('agencyNameLabel')} value={agencyName} onChangeText={setAgencyName} placeholder={tr('agencyNamePlaceholder')} colors={colors} rtl={isRTL} />

          {/* City */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.foreground, textAlign: rtl }]}>{tr('city')}</Text>
            <Pressable onPress={() => setShowCities(!showCities)}
              style={[styles.inputShell, { borderColor: errors.city ? colors.destructive : colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.inputText, { color: city ? colors.foreground : colors.mutedForeground }]}>{city || tr('selectCity')}</Text>
              <Feather name={showCities ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </Pressable>
            {errors.city ? <Text style={[styles.error, { color: colors.destructive }]}>{errors.city}</Text> : null}
            {showCities && (
              <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {okaraDistrict.cities.map((c) => (
                  <Pressable key={c} onPress={() => { setCity(c); setShowCities(false); }}
                    style={[styles.dropItem, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.dropItemText, { color: colors.foreground }]}>{c}</Text>
                    {city === c && <Feather name="check" size={14} color={colors.action} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Experience */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.foreground, textAlign: rtl }]}>{tr('experienceLabel')}</Text>
            <View style={styles.chipGrid}>
              {expOptions.map((e) => (
                <Pressable key={e} onPress={() => setExperience(e)}
                  style={[styles.chip, { borderColor: experience === e ? colors.action : colors.border, backgroundColor: experience === e ? colors.action : 'transparent' }]}>
                  <Text style={[styles.chipText, { color: experience === e ? colors.actionForeground : colors.mutedForeground }]}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Specializations */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.foreground, textAlign: rtl }]}>{tr('specLabel')}</Text>
            {errors.specs ? <Text style={[styles.error, { color: colors.destructive }]}>{errors.specs}</Text> : null}
            <View style={styles.chipGrid}>
              {specOptions.map((s) => {
                const sel = selectedSpecs.includes(s);
                return (
                  <Pressable key={s} onPress={() => toggleSpec(s)}
                    style={[styles.chip, { borderColor: sel ? colors.action : colors.border, backgroundColor: sel ? colors.action : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
                    {sel && <Feather name="check" size={11} color={colors.actionForeground} />}
                    <Text style={[styles.chipText, { color: sel ? colors.actionForeground : colors.mutedForeground }]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: botPad + 16, borderTopColor: colors.border, backgroundColor: colors.background }]}>
          {regError ? (
            <View style={[styles.apiError, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '40' }]}>
              <Text style={[styles.apiErrorText, { color: colors.destructive }]}>{regError}</Text>
            </View>
          ) : null}
          <AnimatedPressable onPress={() => { void handleRegister(); }}
            style={[styles.registerBtn, { backgroundColor: loading ? colors.muted : colors.action }]}>
            <Text style={[styles.registerBtnText, { color: loading ? colors.mutedForeground : colors.actionForeground }]}>
              {loading ? tr('creatingAccount') : tr('agentCreateBtn')}
            </Text>
            {!loading && <Feather name={isRTL ? 'arrow-left' : 'arrow-right'} size={18} color={colors.actionForeground} />}
          </AnimatedPressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, error, colors, keyboardType, secureTextEntry, rtl }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder: string;
  error?: string; colors: ReturnType<typeof useColors>; keyboardType?: 'phone-pad' | 'email-address'; secureTextEntry?: boolean; rtl?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: colors.foreground, textAlign: rtl ? 'right' : 'left' }]}>{label}</Text>
      <View style={[styles.inputShell, { borderColor: error ? colors.destructive : colors.border, backgroundColor: colors.card }]}>
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground} keyboardType={keyboardType}
          secureTextEntry={secureTextEntry} autoCapitalize={keyboardType ? 'none' : 'words'}
          textAlign={rtl ? 'right' : 'left'}
          style={[styles.input, { color: colors.foreground }]} />
      </View>
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.5, marginBottom: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.4, marginBottom: 8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  notice: { borderRadius: 13, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 24 },
  noticeText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, flex: 1 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 16, marginTop: 4 },
  fieldWrap: { marginBottom: 16 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8 },
  inputShell: { height: 52, borderWidth: 1.5, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputText: { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, paddingVertical: 0 },
  error: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  dropdown: { borderWidth: 1.5, borderRadius: 13, marginTop: 4, overflow: 'hidden' },
  dropItem: { height: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  dropItemText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 22, paddingTop: 14, borderTopWidth: 1 },
  apiError: { borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 10 },
  apiErrorText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  registerBtn: { height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  registerBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
});
