/**
 * OG Landmark — Improved Buyer Request Screen
 * Separated from the property listing workflow per spec.
 */
import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// BlurView removed — crashes Android GPU
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { createProperty } from '@/lib/api';
import { okaraDistrict } from '@/lib/cities';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { AnimatedPressable } from '@/components/AnimatedPressable';

// ── Constants ──────────────────────────────────────────────────────────────────

const PROPERTY_TYPES = ['House', 'Apartment', 'Plot', 'Commercial', 'Agriculture Land', 'Other'];
const CITIES = okaraDistrict.cities;
const AREA_UNITS = ['Marla', 'Kanal', 'Sq. Ft.', 'Acre'];
const PURPOSE_OPTIONS = ['Personal Use', 'Investment', 'Business', 'Agriculture'];
const TIMELINE_OPTIONS = ['Immediately', 'Within 1 Month', '1–3 Months', '3–6 Months', 'Flexible'];
const CONTACT_OPTIONS = ['In-App Chat', 'WhatsApp', 'Phone Call'];
const BED_OPTIONS = ['Any', '1', '2', '3', '4', '5+'];
const BATH_OPTIONS = ['Any', '1', '2', '3', '4+'];

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function BuyerRequestScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  // Form state
  const [propertyType, setPropertyType] = useState('House');
  const [budget, setBudget]             = useState('');
  const [city, setCity]                 = useState('');
  const [locality, setLocality]         = useState('');
  const [minSize, setMinSize]           = useState('');
  const [maxSize, setMaxSize]           = useState('');
  const [sizeUnit, setSizeUnit]         = useState('Marla');
  const [bedrooms, setBedrooms]         = useState('Any');
  const [bathrooms, setBathrooms]       = useState('Any');
  const [purpose, setPurpose]           = useState('Personal Use');
  const [timeline, setTimeline]         = useState('Flexible');
  const [contactPref, setContactPref]   = useState('WhatsApp');
  const [requirements, setRequirements] = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [errors, setErrors]             = useState<Record<string, string>>({});

  const areas = city ? (okaraDistrict.areas[city] ?? []) : [];

  const validate = () => {
    const e: Record<string, string> = {};
    if (!budget.trim()) e.budget = 'Maximum budget is required';
    if (!city) e.city = 'Select at least one preferred city';
    if (!requirements.trim() || requirements.trim().length < 10)
      e.requirements = 'Please describe what you are looking for (at least 10 characters)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await createProperty({
        title: `Looking for ${propertyType} in ${city || 'Okara District'}`,
        type: propertyType,
        status: 'Looking For',
        price: Number(budget.replace(/[^0-9]/g, '')) || 0,
        area: 0,
        areaUnit: sizeUnit,
        city: city || 'Okara',
        address: locality,
        description: [requirements, `Purpose: ${purpose}`, `Timeline: ${timeline}`, `Contact: ${contactPref}`, minSize ? `Min: ${minSize} ${sizeUnit}` : '', maxSize ? `Max: ${maxSize} ${sizeUnit}` : ''].filter(Boolean).join('\n'),
        bedrooms: bedrooms === 'Any' ? 0 : Number(bedrooms.replace('+', '')) || 0,
        bathrooms: bathrooms === 'Any' ? 0 : Number(bathrooms.replace('+', '')) || 0,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <View style={[st.screen, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={[st.successIcon, { backgroundColor: colors.action + '18', borderColor: colors.action + '44' }]}>
          <Feather name="check-circle" size={42} color={colors.action} />
        </View>
        <Text style={[st.successTitle, { color: colors.foreground }]}>Request Submitted!</Text>
        <Text style={[st.successBody, { color: colors.mutedForeground }]}>
          Verified agents and sellers will reach out with matching properties via your preferred contact method.
        </Text>
        <View style={[st.statusBadge, { backgroundColor: '#1a6b3a14', borderColor: '#1a6b3a33' }]}>
          <Feather name="radio" size={12} color="#1a6b3a" />
          <Text style={[st.statusText, { color: '#1a6b3a' }]}>ACTIVE REQUEST</Text>
        </View>
        <AnimatedPressable onPress={() => router.push('/(tabs)/listings')} style={[st.successBtn, { backgroundColor: colors.action, marginTop: 24 }]}>
          <Text style={[st.successBtnText, { color: colors.actionForeground }]}>View My Requests</Text>
          <Feather name="arrow-right" size={16} color={colors.actionForeground} />
        </AnimatedPressable>
        <Pressable onPress={() => router.push('/(tabs)/' as any)} hitSlop={10} style={{ marginTop: 14 }}>
          <Text style={[st.successLink, { color: colors.action }]}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[st.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <AnimatedReveal>
          <Pressable onPress={() => router.back()} hitSlop={12} style={[st.backBtn, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <Text style={[st.eyebrow, { color: colors.primary }]}>BUYER REQUEST</Text>
          <Text style={[st.pageTitle, { color: colors.foreground }]}>What are you{'\n'}looking for?</Text>
          <Text style={[st.subtitle, { color: colors.mutedForeground }]}>
            Describe your ideal property and verified agents or sellers will respond with matching listings.
          </Text>
        </AnimatedReveal>

        {/* ── Property Type ── */}
        <AnimatedReveal delay={60}>
          <Label colors={colors}>Property Type</Label>
          <View style={st.pillWrap}>
            {PROPERTY_TYPES.map((t) => (
              <Pressable key={t} onPress={() => setPropertyType(t)}
                style={[st.pill, { backgroundColor: propertyType === t ? colors.selectionBackground : colors.glassCard, borderColor: propertyType === t ? colors.selectionBorder : colors.glassBorder, borderWidth: propertyType === t ? 1.5 : 1 }]}>
                <Text style={[st.pillText, { color: propertyType === t ? colors.selectionForeground : colors.foreground, fontWeight: propertyType === t ? '600' : '400' }]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </AnimatedReveal>

        {/* ── Purpose ── */}
        <AnimatedReveal delay={80}>
          <Label colors={colors}>Purpose</Label>
          <View style={st.pillWrap}>
            {PURPOSE_OPTIONS.map((p) => (
              <Pressable key={p} onPress={() => setPurpose(p)}
                style={[st.pill, { backgroundColor: purpose === p ? colors.selectionBackground : colors.glassCard, borderColor: purpose === p ? colors.selectionBorder : colors.glassBorder, borderWidth: purpose === p ? 1.5 : 1 }]}>
                <Text style={[st.pillText, { color: purpose === p ? colors.selectionForeground : colors.foreground, fontWeight: purpose === p ? '600' : '400' }]}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </AnimatedReveal>

        {/* ── Budget ── */}
        <AnimatedReveal delay={100}>
          <GlassField label="Maximum Budget (PKR)" placeholder="e.g. 8500000" keyboardType="numeric"
            value={budget} onChangeText={setBudget} colors={colors} error={errors.budget} />
        </AnimatedReveal>

        {/* ── Preferred City ── */}
        <AnimatedReveal delay={115}>
          <Label colors={colors}>Preferred City *</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {CITIES.map((c) => (
              <Pressable key={c} onPress={() => { setCity(c); setLocality(''); }}
                style={[st.pill, { backgroundColor: city === c ? colors.selectionBackground : colors.glassCard, borderColor: city === c ? colors.selectionBorder : colors.glassBorder, borderWidth: city === c ? 1.5 : 1 }]}>
                <Text style={[st.pillText, { color: city === c ? colors.selectionForeground : colors.foreground, fontWeight: city === c ? '600' : '400' }]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {errors.city ? <Text style={st.errorText}>{errors.city}</Text> : null}
        </AnimatedReveal>

        {/* ── Area / Locality ── */}
        {areas.length > 0 && (
          <AnimatedReveal delay={130}>
            <Label colors={colors}>Preferred Area / Locality</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {areas.map((a) => (
                <Pressable key={a} onPress={() => setLocality(locality === a ? '' : a)}
                  style={[st.pill, { backgroundColor: locality === a ? colors.selectionBackground : colors.glassCard, borderColor: locality === a ? colors.selectionBorder : colors.glassBorder, borderWidth: locality === a ? 1.5 : 1 }]}>
                  <Text style={[st.pillText, { color: locality === a ? colors.selectionForeground : colors.foreground, fontWeight: locality === a ? '600' : '400' }]}>{a}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </AnimatedReveal>
        )}

        {/* ── Property Size Range ── */}
        <AnimatedReveal delay={145}>
          <Label colors={colors}>Property Size Range (optional)</Label>
          <View style={st.sizeRow}>
            <View style={[st.inputWrap, { flex: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassCard }]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
              <TextInput value={minSize} onChangeText={setMinSize} placeholder="Min" keyboardType="numeric"
                placeholderTextColor={colors.mutedForeground} style={[st.input, { color: colors.foreground }]} />
            </View>
            <Text style={[st.toText, { color: colors.mutedForeground }]}>to</Text>
            <View style={[st.inputWrap, { flex: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassCard }]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
              <TextInput value={maxSize} onChangeText={setMaxSize} placeholder="Max" keyboardType="numeric"
                placeholderTextColor={colors.mutedForeground} style={[st.input, { color: colors.foreground }]} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
              {AREA_UNITS.map((u) => (
                <Pressable key={u} onPress={() => setSizeUnit(u)}
                  style={[st.unitChip, { backgroundColor: sizeUnit === u ? colors.selectionBackground : colors.glassCard, borderColor: sizeUnit === u ? colors.selectionBorder : colors.glassBorder, borderWidth: sizeUnit === u ? 1.5 : 1 }]}>
                  <Text style={[st.unitText, { color: sizeUnit === u ? colors.selectionForeground : colors.foreground, fontWeight: sizeUnit === u ? '600' : '400' }]}>{u}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </AnimatedReveal>

        {/* ── Bedrooms & Bathrooms ── */}
        <AnimatedReveal delay={160}>
          <View style={st.halfRow}>
            <View style={{ flex: 1 }}>
              <Label colors={colors}>Bedrooms</Label>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
                {BED_OPTIONS.map((b) => (
                  <Pressable key={b} onPress={() => setBedrooms(b)}
                    style={[st.unitChip, { backgroundColor: bedrooms === b ? colors.selectionBackground : colors.glassCard, borderColor: bedrooms === b ? colors.selectionBorder : colors.glassBorder, borderWidth: bedrooms === b ? 1.5 : 1 }]}>
                    <Text style={[st.unitText, { color: bedrooms === b ? colors.selectionForeground : colors.foreground, fontWeight: bedrooms === b ? '600' : '400' }]}>{b}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
          <View style={{ marginTop: 12 }}>
            <Label colors={colors}>Bathrooms</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
              {BATH_OPTIONS.map((b) => (
                <Pressable key={b} onPress={() => setBathrooms(b)}
                  style={[st.unitChip, { backgroundColor: bathrooms === b ? colors.selectionBackground : colors.glassCard, borderColor: bathrooms === b ? colors.selectionBorder : colors.glassBorder, borderWidth: bathrooms === b ? 1.5 : 1 }]}>
                  <Text style={[st.unitText, { color: bathrooms === b ? colors.selectionForeground : colors.foreground, fontWeight: bathrooms === b ? '600' : '400' }]}>{b}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </AnimatedReveal>

        {/* ── Purchase Timeline ── */}
        <AnimatedReveal delay={175}>
          <Label colors={colors}>Purchase Timeline</Label>
          <View style={st.pillWrap}>
            {TIMELINE_OPTIONS.map((t) => (
              <Pressable key={t} onPress={() => setTimeline(t)}
                style={[st.pill, { backgroundColor: timeline === t ? colors.accent : colors.glassCard, borderColor: timeline === t ? colors.primary : colors.glassBorder }]}>
                <Text style={[st.pillText, { color: timeline === t ? colors.primary : colors.foreground }]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </AnimatedReveal>

        {/* ── Contact Preference ── */}
        <AnimatedReveal delay={190}>
          <Label colors={colors}>Contact Preference</Label>
          <View style={st.pillWrap}>
            {CONTACT_OPTIONS.map((c) => {
              const icons: Record<string, keyof typeof Feather.glyphMap> = { 'In-App Chat': 'message-square', 'WhatsApp': 'message-circle', 'Phone Call': 'phone' };
              const sel = contactPref === c;
              return (
                <Pressable key={c} onPress={() => setContactPref(c)}
                  style={[st.contactChip, { backgroundColor: sel ? colors.selectionBackground : colors.glassCard, borderColor: sel ? colors.selectionBorder : colors.glassBorder, borderWidth: sel ? 1.5 : 1 }]}>
                  <Feather name={icons[c] ?? 'message-square'} size={13} color={sel ? colors.actionForeground : colors.mutedForeground} />
                  <Text style={[st.pillText, { color: sel ? colors.selectionForeground : colors.foreground, fontWeight: sel ? '600' : '400' }]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        </AnimatedReveal>

        {/* ── Requirements ── */}
        <AnimatedReveal delay={205}>
          <Label colors={colors}>Requirements *</Label>
          <View style={[st.textAreaWrap, { borderColor: errors.requirements ? '#e53e3e' : colors.glassBorder, backgroundColor: colors.glassCard }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
            <TextInput
              value={requirements} onChangeText={setRequirements}
              placeholder="Describe what you are looking for: specific area, construction quality, road access, urgency, anything else important to you…"
              placeholderTextColor={colors.mutedForeground}
              multiline numberOfLines={5} textAlignVertical="top"
              style={[st.textArea, { color: colors.foreground }]}
              maxLength={1000}
            />
            <Text style={[st.charCount, { color: colors.mutedForeground }]}>{requirements.length}/1000</Text>
          </View>
          {errors.requirements ? <Text style={st.errorText}>{errors.requirements}</Text> : null}
        </AnimatedReveal>

        {/* ── Submit ── */}
        <AnimatedReveal delay={220}>
          <AnimatedPressable onPress={submit} style={[st.submit, { backgroundColor: colors.action, opacity: submitting ? 0.7 : 1 }]}>
            <Text style={[st.submitText, { color: colors.actionForeground }]}>{submitting ? 'Submitting…' : 'Submit Buyer Request'}</Text>
            <Feather name="arrow-up-right" size={18} color={colors.actionForeground} />
          </AnimatedPressable>
          <Text style={[st.hint, { color: colors.mutedForeground }]}>
            Your request will be visible to verified agents matching your criteria.
          </Text>
        </AnimatedReveal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Label({ children, colors }: { children: React.ReactNode; colors: any }) {
  return <Text style={[st.label, { color: colors.foreground }]}>{children}</Text>;
}

function GlassField({ label, placeholder, value, onChangeText, keyboardType, colors, error }: any) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[st.label, { color: colors.foreground }]}>{label}</Text>
      <View style={[st.inputWrap, { borderColor: error ? '#e53e3e' : colors.glassBorder, backgroundColor: colors.glassCard }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground} keyboardType={keyboardType ?? 'default'}
          style={[st.input, { color: colors.foreground }]} />
      </View>
      {error ? <Text style={st.errorText}>{error}</Text> : null}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  screen:        { flex: 1 },
  backBtn:       { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  eyebrow:       { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.4, marginBottom: 4 },
  pageTitle:     { fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 36, marginBottom: 8 },
  subtitle:      { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  label:         { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 10, marginTop: 2 },
  pillWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  pill:          { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  pillText:      { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  contactChip:   { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  sizeRow:       { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 18 },
  toText:        { fontFamily: 'Inter_400Regular', fontSize: 13 },
  halfRow:       { gap: 14 },
  inputWrap:     { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  input:         { fontFamily: 'Inter_400Regular', fontSize: 14, paddingHorizontal: 14, paddingVertical: 13, zIndex: 1 },
  unitChip:      { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  unitText:      { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  textAreaWrap:  { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  textArea:      { fontFamily: 'Inter_400Regular', fontSize: 14, padding: 14, zIndex: 1, minHeight: 120 },
  charCount:     { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'right', paddingRight: 12, paddingBottom: 8, zIndex: 1 },
  submit:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingVertical: 16, marginTop: 8 },
  submitText:    { fontFamily: 'Inter_700Bold', fontSize: 15 },
  hint:          { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: 10 },
  errorText:     { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#e53e3e', marginTop: 2, marginBottom: 8 },
  // Success
  successIcon:   { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 20 },
  successTitle:  { fontFamily: 'Inter_700Bold', fontSize: 26, textAlign: 'center', marginBottom: 10 },
  successBody:   { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  statusBadge:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  statusText:    { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8 },
  successBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 28 },
  successBtnText:{ fontFamily: 'Inter_700Bold', fontSize: 15 },
  successLink:   { fontFamily: 'Inter_600SemiBold', fontSize: 14, textDecorationLine: 'underline' },
});
