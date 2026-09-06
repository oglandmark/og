/**
 * Developer Registration — 4-step wizard
 * Step 1: Account Info   (Name, Mobile, Email, Password, Designation)
 * Step 2: Company Info   (Name, Type, Reg #, NTN, Address, City, Website, Established)
 * Step 3: Business Areas (multi-select)
 * Step 4: Documents      (placeholder — upload later)
 *
 * Verification status always starts as UNVERIFIED — admin must approve manually.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, View,
} from 'react-native';
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

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;

const COMPANY_TYPES = [
  'Housing Society', 'Residential Developer', 'Commercial Developer',
  'Apartment Developer', 'Mixed-Use Developer', 'Farmhouse Developer',
  'Construction Company', 'Real Estate Company',
];

const BUSINESS_AREAS = [
  { key: 'residential',      icon: 'home'       as const, label: 'Residential' },
  { key: 'commercial',       icon: 'briefcase'  as const, label: 'Commercial' },
  { key: 'apartments',       icon: 'layers'     as const, label: 'Apartments' },
  { key: 'housing_society',  icon: 'grid'       as const, label: 'Housing Societies' },
  { key: 'plots',            icon: 'map'        as const, label: 'Plots / Land' },
  { key: 'farmhouses',       icon: 'sunset'     as const, label: 'Farmhouses' },
  { key: 'industrial',       icon: 'tool'       as const, label: 'Industrial' },
  { key: 'mixed_use',        icon: 'layers'     as const, label: 'Mixed Use' },
];

// ── Blank state ───────────────────────────────────────────────────────────────

function blankState() {
  return {
    // Step 1 — Account Info
    repName: '',
    repPhone: '',
    repEmail: '',
    password: '',
    designation: '',
    // Step 2 — Company Info
    companyName: '',
    companyType: '',
    registrationNo: '',
    ntn: '',
    address: '',
    city: '',
    website: '',
    socialLink: '',
    establishedYear: '',
    // Step 3 — Business Areas
    businessAreas: [] as string[],
  };
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({
  current, total, labels, colors,
}: {
  current: number;
  total: number;
  labels: string[];
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={ind.wrap}>
      {Array.from({ length: total }).map((_, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <View style={ind.col}>
              <View style={[
                ind.circle,
                done   ? { backgroundColor: colors.action,     borderColor: colors.action,  borderWidth: 0 } :
                active ? { backgroundColor: colors.background, borderColor: colors.action,  borderWidth: 2 } :
                         { backgroundColor: colors.secondary,  borderColor: colors.border,  borderWidth: 1 },
              ]}>
                {done
                  ? <Feather name="check" size={11} color="#fff" />
                  : <Text style={[ind.num, { color: active ? colors.action : colors.mutedForeground }]}>{i + 1}</Text>}
              </View>
              <Text style={[ind.label, { color: active ? colors.action : colors.mutedForeground }]} numberOfLines={2}>
                {labels[i]}
              </Text>
            </View>
            {i < total - 1 && (
              <View style={[ind.line, { backgroundColor: done ? colors.action : colors.border }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ── Shared field ──────────────────────────────────────────────────────────────

function Field({
  label, value, onChangeText, placeholder, error, colors,
  keyboardType, secureTextEntry, optional,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  error?: string;
  colors: ReturnType<typeof useColors>;
  keyboardType?: 'phone-pad' | 'email-address' | 'numeric';
  secureTextEntry?: boolean;
  optional?: boolean;
}) {
  return (
    <View style={fl.wrap}>
      <View style={fl.labelRow}>
        <Text style={[fl.label, { color: colors.foreground }]}>{label}</Text>
        {optional && <Text style={[fl.optional, { color: colors.mutedForeground }]}> (optional)</Text>}
      </View>
      <View style={[fl.shell, { borderColor: error ? colors.destructive : colors.border, backgroundColor: colors.card }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground + '99'}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={keyboardType ? 'none' : 'words'}
          style={[fl.input, { color: colors.foreground }]}
        />
      </View>
      {error ? <Text style={[fl.error, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

// ── Step 1 — Account Info ─────────────────────────────────────────────────────

function Step1({
  data, errors, onChange, colors,
}: {
  data: ReturnType<typeof blankState>;
  errors: Record<string, string>;
  onChange: (k: string, v: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <>
      <Text style={[s.stepHeading, { color: colors.foreground }]}>Account Information</Text>
      <Text style={[s.stepSub, { color: colors.mutedForeground }]}>Your personal contact details for this account</Text>
      <Field label="Full Name" value={data.repName} onChangeText={(v) => onChange('repName', v)}
        placeholder="Your full name" error={errors.repName} colors={colors} />
      <Field label="Mobile Number" value={data.repPhone} onChangeText={(v) => onChange('repPhone', v)}
        placeholder="03XX-XXXXXXX" error={errors.repPhone} colors={colors} keyboardType="phone-pad" />
      <Field label="Email Address" value={data.repEmail} onChangeText={(v) => onChange('repEmail', v)}
        placeholder="email@example.com" error={errors.repEmail} colors={colors} keyboardType="email-address" />
      <Field label="Password" value={data.password} onChangeText={(v) => onChange('password', v)}
        placeholder="Min 6 characters" error={errors.password} colors={colors} secureTextEntry />
      <Field label="Designation" value={data.designation} onChangeText={(v) => onChange('designation', v)}
        placeholder="CEO / Director / Manager" colors={colors} optional />
    </>
  );
}

// ── Step 2 — Company Info ─────────────────────────────────────────────────────

function Step2({
  data, errors, onChange, colors,
}: {
  data: ReturnType<typeof blankState>;
  errors: Record<string, string>;
  onChange: (k: string, v: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [showCities, setShowCities]     = useState(false);
  const [showTypes,  setShowTypes]      = useState(false);

  return (
    <>
      <Text style={[s.stepHeading, { color: colors.foreground }]}>Company Information</Text>
      <Text style={[s.stepSub, { color: colors.mutedForeground }]}>Tell buyers and the admin team about your company</Text>

      <Field label="Company Name" value={data.companyName} onChangeText={(v) => onChange('companyName', v)}
        placeholder="OG Developers Pvt Ltd" error={errors.companyName} colors={colors} />

      {/* Company Type dropdown */}
      <View style={fl.wrap}>
        <Text style={[fl.label, { color: colors.foreground }]}>Company Type</Text>
        <Pressable
          onPress={() => { setShowTypes(!showTypes); setShowCities(false); }}
          style={[fl.shell, { borderColor: errors.companyType ? colors.destructive : colors.border, backgroundColor: colors.card }]}
        >
          <Text style={[fl.input, { color: data.companyType ? colors.foreground : colors.mutedForeground + '99' }]}>
            {data.companyType || 'Select company type'}
          </Text>
          <Feather name={showTypes ? 'chevron-up' : 'chevron-down'} size={15} color={colors.mutedForeground} />
        </Pressable>
        {errors.companyType ? <Text style={[fl.error, { color: colors.destructive }]}>{errors.companyType}</Text> : null}
        {showTypes && (
          <View style={[fl.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {COMPANY_TYPES.map((t) => (
              <Pressable key={t} onPress={() => { onChange('companyType', t); setShowTypes(false); }}
                style={[fl.dropItem, { borderBottomColor: colors.border }]}>
                <Text style={[fl.dropText, { color: colors.foreground }]}>{t}</Text>
                {data.companyType === t && <Feather name="check" size={13} color={colors.action} />}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Field label="Registration No." value={data.registrationNo} onChangeText={(v) => onChange('registrationNo', v)}
        placeholder="Company registration number" colors={colors} optional />
      <Field label="NTN Number" value={data.ntn} onChangeText={(v) => onChange('ntn', v)}
        placeholder="National Tax Number" colors={colors} optional />

      {/* City dropdown */}
      <View style={fl.wrap}>
        <Text style={[fl.label, { color: colors.foreground }]}>City *</Text>
        <Pressable
          onPress={() => { setShowCities(!showCities); setShowTypes(false); }}
          style={[fl.shell, { borderColor: errors.city ? colors.destructive : colors.border, backgroundColor: colors.card }]}
        >
          <Text style={[fl.input, { color: data.city ? colors.foreground : colors.mutedForeground + '99' }]}>
            {data.city || 'Select city'}
          </Text>
          <Feather name={showCities ? 'chevron-up' : 'chevron-down'} size={15} color={colors.mutedForeground} />
        </Pressable>
        {errors.city ? <Text style={[fl.error, { color: colors.destructive }]}>{errors.city}</Text> : null}
        {showCities && (
          <View style={[fl.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {okaraDistrict.cities.map((c) => (
              <Pressable key={c} onPress={() => { onChange('city', c); setShowCities(false); }}
                style={[fl.dropItem, { borderBottomColor: colors.border }]}>
                <Text style={[fl.dropText, { color: colors.foreground }]}>{c}</Text>
                {data.city === c && <Feather name="check" size={13} color={colors.action} />}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Field label="Office Address" value={data.address} onChangeText={(v) => onChange('address', v)}
        placeholder="Street address, area" colors={colors} optional />
      <Field label="Website" value={data.website} onChangeText={(v) => onChange('website', v)}
        placeholder="www.company.com" colors={colors} keyboardType="email-address" optional />
      <Field label="Social Media Link" value={data.socialLink} onChangeText={(v) => onChange('socialLink', v)}
        placeholder="Facebook / Instagram page URL" colors={colors} keyboardType="email-address" optional />
      <Field label="Year Established" value={data.establishedYear} onChangeText={(v) => onChange('establishedYear', v)}
        placeholder="e.g. 2010" colors={colors} keyboardType="numeric" optional />
    </>
  );
}

// ── Step 3 — Business Areas ───────────────────────────────────────────────────

function Step3({
  data, errors, toggleArea, colors,
}: {
  data: ReturnType<typeof blankState>;
  errors: Record<string, string>;
  toggleArea: (key: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <>
      <Text style={[s.stepHeading, { color: colors.foreground }]}>Business Areas</Text>
      <Text style={[s.stepSub, { color: colors.mutedForeground }]}>Select all areas your company operates in (select multiple)</Text>
      {errors.businessAreas ? (
        <Text style={[fl.error, { color: colors.destructive, marginBottom: 8 }]}>{errors.businessAreas}</Text>
      ) : null}
      <View style={s.areaGrid}>
        {BUSINESS_AREAS.map((area) => {
          const selected = data.businessAreas.includes(area.key);
          return (
            <Pressable
              key={area.key}
              onPress={() => toggleArea(area.key)}
              style={[s.areaCard, {
                borderColor:     selected ? colors.selectionBorder  : colors.border,
                backgroundColor: selected ? colors.selectionBackground  : colors.card,
                borderWidth:     selected ? 2 : 1,
              }]}
            >
              <View style={[s.areaIconWrap, { backgroundColor: selected ? colors.selectionTint : colors.action + '15' }]}>
                <Feather name={area.icon} size={20} color={selected ? colors.selectionForeground : colors.action} />
              </View>
              <Text style={[s.areaLabel, { color: selected ? colors.selectionForeground : colors.foreground, fontWeight: selected ? '600' : '400' }]}>{area.label}</Text>
              {selected && (
                <View style={s.areaCheck}>
                  <Feather name="check-circle" size={16} color={colors.selectionForeground} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {data.businessAreas.length > 0 && (
        <View style={[s.areaCount, { backgroundColor: colors.action + '15', borderColor: colors.action + '30' }]}>
          <Feather name="check" size={13} color={colors.action} />
          <Text style={[s.areaCountText, { color: colors.action }]}>
            {data.businessAreas.length} area{data.businessAreas.length !== 1 ? 's' : ''} selected
          </Text>
        </View>
      )}
    </>
  );
}

// ── Step 4 — Documents ────────────────────────────────────────────────────────

function Step4({ colors }: { colors: ReturnType<typeof useColors> }) {
  const docTypes = [
    { icon: 'file-text' as const, title: 'Company Registration Certificate',   subtitle: 'SECP / PEC registration document' },
    { icon: 'file-text' as const, title: 'NTN Certificate',                    subtitle: 'National Tax Number certificate from FBR' },
    { icon: 'credit-card' as const, title: 'Representative CNIC',              subtitle: 'Front and back of CNIC card' },
  ];

  return (
    <>
      <Text style={[s.stepHeading, { color: colors.foreground }]}>Document Upload</Text>
      <Text style={[s.stepSub, { color: colors.mutedForeground }]}>Documents speed up verification — you can also upload them later from your profile</Text>

      <View style={[s.docNotice, { backgroundColor: colors.accent, borderColor: colors.primary + '33' }]}>
        <Feather name="info" size={14} color={colors.primary} />
        <Text style={[s.docNoticeText, { color: colors.accentForeground }]}>
          Document upload will be available after account creation. Our team will guide you through the process.
        </Text>
      </View>

      {docTypes.map((doc, i) => (
        <View key={i} style={[s.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.docIcon, { backgroundColor: colors.action + '15' }]}>
            <Feather name={doc.icon} size={20} color={colors.action} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.docTitle, { color: colors.foreground }]}>{doc.title}</Text>
            <Text style={[s.docSub, { color: colors.mutedForeground }]}>{doc.subtitle}</Text>
          </View>
          <View style={[s.docPendingBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[s.docPendingText, { color: colors.mutedForeground }]}>Pending</Text>
          </View>
        </View>
      ))}

      <View style={[s.docVerifyBox, { backgroundColor: colors.accent, borderColor: colors.primary + '33' }]}>
        <Feather name="shield" size={16} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[s.docVerifyTitle, { color: colors.accentForeground }]}>Verification Timeline</Text>
          <Text style={[s.docVerifyDesc, { color: colors.accentForeground + 'cc' }]}>
            Admin reviews submitted documents within 48–72 hours. Your portal activates once verified.
          </Text>
        </View>
      </View>
    </>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function RegisterDeveloperScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { registerAPI } = useAuth();
  const { isRTL } = useLanguage();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const [step,    setStep]    = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [regError,  setRegError]  = useState('');
  const [data,    setDataRaw] = useState(blankState);

  const onChange = (key: string, value: string) => {
    setDataRaw((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const toggleArea = (key: string) => {
    setDataRaw((prev) => {
      const has = prev.businessAreas.includes(key);
      return {
        ...prev,
        businessAreas: has
          ? prev.businessAreas.filter((a) => a !== key)
          : [...prev.businessAreas, key],
      };
    });
    if (errors.businessAreas) setErrors((prev) => { const n = { ...prev }; delete n.businessAreas; return n; });
  };

  const stepLabels = ['Account', 'Company', 'Areas', 'Documents'];

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!data.repName.trim())                              e.repName  = 'Full name is required';
      if (!data.repPhone.trim() || data.repPhone.length < 10) e.repPhone = 'Enter a valid phone number';
      if (!data.repEmail.trim() || !data.repEmail.includes('@')) e.repEmail = 'Enter a valid email';
      if (!data.password || data.password.length < 8)        e.password = 'Password must be at least 8 characters';
    }
    if (step === 1) {
      if (!data.companyName.trim()) e.companyName  = 'Company name is required';
      if (!data.companyType)        e.companyType  = 'Select a company type';
      if (!data.city)               e.city         = 'Please select a city';
    }
    if (step === 2) {
      if (data.businessAreas.length === 0) e.businessAreas = 'Select at least one business area';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validate()) { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    setStep((prev) => prev + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBack = () => {
    if (step === 0) { router.back(); return; }
    setStep((prev) => prev - 1);
  };

  const handleRegister = async () => {
    setRegError('');
    setLoading(true);
    try {
      const result = await registerAPI({
        name:        data.repName.trim(),
        email:       data.repEmail.trim().toLowerCase(),
        password:    data.password,
        phone:       data.repPhone.trim(),
        role:        'developer',
        companyName: data.companyName.trim() || undefined,
        city:        data.city,
      });
      if (!result.success) {
        setRegError(result.error ?? 'Registration failed. Please try again.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.root, { backgroundColor: colors.background }]}>

        {/* ── Header ──────────────────────────────────────────── */}
        <View style={[s.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={handleBack} hitSlop={12} style={s.backBtn}>
            <Feather name="arrow-left" size={21} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { color: colors.primary }]}>DEVELOPER REGISTRATION</Text>
            <Text style={[s.headerTitle, { color: colors.foreground }]}>
              {stepLabels[step]}
            </Text>
          </View>
          <Text style={[s.stepCounter, { color: colors.mutedForeground }]}>{step + 1} / {TOTAL_STEPS}</Text>
        </View>

        {/* ── Step indicator ───────────────────────────────────── */}
        <View style={[s.stepWrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <StepIndicator current={step} total={TOTAL_STEPS} labels={stepLabels} colors={colors} />
        </View>

        {/* ── Verification notice (step 0 only) ────────────────── */}
        {step === 0 && (
          <View style={[s.notice, { backgroundColor: colors.accent, borderColor: colors.primary + '33' }]}>
            <Feather name="shield" size={14} color={colors.primary} />
            <Text style={[s.noticeText, { color: colors.accentForeground }]}>
              Company verification takes 48–72 hours. Documents can be uploaded after account creation.
            </Text>
          </View>
        )}

        {/* ── Form content ─────────────────────────────────────── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: botPad + 120 }}
        >
          <View style={{ gap: 14 }}>
            {step === 0 && <Step1 data={data} errors={errors} onChange={onChange} colors={colors} />}
            {step === 1 && <Step2 data={data} errors={errors} onChange={onChange} colors={colors} />}
            {step === 2 && <Step3 data={data} errors={errors} toggleArea={toggleArea} colors={colors} />}
            {step === 3 && <Step4 colors={colors} />}
          </View>
        </ScrollView>

        {/* ── Footer buttons ───────────────────────────────────── */}
        <View style={[s.footer, { paddingBottom: botPad + 16, borderTopColor: colors.border, backgroundColor: colors.background }]}>
          {regError ? (
            <View style={[s.apiError, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '40' }]}>
              <Text style={[s.apiErrorText, { color: colors.destructive }]}>{regError}</Text>
            </View>
          ) : null}
          <View style={s.footerRow}>
            {step > 0 && (
              <Pressable
                onPress={handleBack}
                style={[s.backFooterBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Feather name="arrow-left" size={15} color={colors.foreground} />
                <Text style={[s.backFooterText, { color: colors.foreground }]}>Back</Text>
              </Pressable>
            )}
            {!isLastStep ? (
              <AnimatedPressable
                onPress={handleNext}
                style={[s.nextBtn, { backgroundColor: colors.action, flex: step > 0 ? 1 : undefined }]}
              >
                <Text style={s.nextBtnText}>Next</Text>
                <Feather name={isRTL ? 'arrow-left' : 'arrow-right'} size={16} color="#fff" />
              </AnimatedPressable>
            ) : (
              <AnimatedPressable
                onPress={() => { void handleRegister(); }}
                style={[s.nextBtn, { backgroundColor: loading ? colors.muted : colors.action, flex: 1 }]}
              >
                <Text style={[s.nextBtnText, { color: loading ? colors.mutedForeground : '#fff' }]}>
                  {loading ? 'Creating account...' : 'Create Developer Account'}
                </Text>
                {!loading && <Feather name="check" size={16} color="#fff" />}
              </AnimatedPressable>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Indicator styles ──────────────────────────────────────────────────────────
const ind = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingVertical: 12 },
  col:    { alignItems: 'center', gap: 4 },
  circle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  num:    { fontFamily: 'Inter_700Bold', fontSize: 11 },
  label:  { fontFamily: 'Inter_500Medium', fontSize: 9, maxWidth: 52, textAlign: 'center', lineHeight: 13 },
  line:   { flex: 1, height: 1.5, marginTop: 12 },
});

// ── Field styles ──────────────────────────────────────────────────────────────
const fl = StyleSheet.create({
  wrap:     { gap: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 7 },
  label:    { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  optional: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  shell:    { height: 52, borderWidth: 1.5, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input:    { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, paddingVertical: 0 },
  error:    { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  dropdown: { borderWidth: 1.5, borderRadius: 13, marginTop: 4, overflow: 'hidden', maxHeight: 240 },
  dropItem: { height: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  dropText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:     { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow:     { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  stepCounter: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  stepWrap:    { borderBottomWidth: 1 },
  notice:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 22, paddingVertical: 12, borderBottomWidth: 1 },
  noticeText:  { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, flex: 1 },
  stepHeading: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.3, marginBottom: 2 },
  stepSub:     { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  // Business areas
  areaGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  areaCard:      { width: '47%', borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 8, position: 'relative' },
  areaIconWrap:  { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  areaLabel:     { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16 },
  areaCheck:     { position: 'absolute', top: 8, right: 8 },
  areaCount:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
  areaCountText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  // Document step
  docNotice:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 13, borderWidth: 1, padding: 14, marginBottom: 4 },
  docNoticeText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, flex: 1 },
  docCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  docIcon:       { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docTitle:      { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 3 },
  docSub:        { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  docPendingBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  docPendingText:  { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  docVerifyBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 4 },
  docVerifyTitle:  { fontFamily: 'Inter_700Bold', fontSize: 13, marginBottom: 4 },
  docVerifyDesc:   { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
  // Footer
  footer:        { paddingHorizontal: 22, paddingTop: 14, borderTopWidth: 1 },
  apiError:      { borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 10 },
  apiErrorText:  { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  footerRow:     { flexDirection: 'row', gap: 10 },
  backFooterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 13, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1 },
  backFooterText:{ fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  nextBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, paddingHorizontal: 28, paddingVertical: 14 },
  nextBtnText:   { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#fff' },
});
