/**
 * Developer Portal — Add New Lead
 * Manually add a project lead to the developer CRM.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  DevLead, DevLeadSource, DEV_LEAD_SOURCES, newDevLeadId, saveDevLead,
} from '@/lib/devLeadsStore';
import { getDevProjects } from '@/lib/developerStore';

export default function AddDevLeadScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const { tr } = useLanguage();
  const router  = useRouter();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const [projects, setProjects] = useState<string[]>([]);
  const [saving, setSaving]     = useState(false);

  // Form state
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [project, setProject]     = useState('');
  const [unit, setUnit]           = useState('');
  const [budget, setBudget]       = useState('');
  const [source, setSource]       = useState<DevLeadSource>('Walk-in');
  const [notes, setNotes]         = useState('');
  const [followUp, setFollowUp]   = useState('');

  useEffect(() => {
    void getDevProjects(user?.id ?? '').then((p) => setProjects(p.map((x) => x.name)));
  }, [user?.id]);

  const handleSave = async () => {
    if (!name.trim())  { Alert.alert('', tr('errDevLeadName'));  return; }
    if (!phone.trim()) { Alert.alert('', tr('errDevLeadPhone')); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const lead: DevLead = {
      id: newDevLeadId(), developerId: user?.id ?? '',
      name: name.trim(), phone: phone.trim(), email: email.trim(),
      interestedProject: project.trim(), interestedUnit: unit.trim(),
      budget: budget.trim(), propertyType: '',
      source, assignedTo: 'Self',
      notes: notes.trim(), nextFollowUp: followUp.trim(),
      status: 'new', createdAt: now, updatedAt: now,
    };
    await saveDevLead(lead);
    setSaving(false);
    router.back();
  };

  const Field = ({
    label, value, onChangeText, placeholder, multiline, keyboardType,
  }: {
    label: string; value: string; onChangeText: (v: string) => void;
    placeholder?: string; multiline?: boolean;
    keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  }) => (
    <View style={s.fWrap}>
      <Text style={[s.fLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.mutedForeground + '77'}
        multiline={multiline} numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType ?? 'default'}
        style={[
          s.fInput,
          { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground },
          multiline && { height: 80, textAlignVertical: 'top', paddingTop: 12 },
        ]}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[s.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={[s.backBtn, { backgroundColor: colors.secondary }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>{tr('addDevLeadTitle')}</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>Developer CRM</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: botPad + 100, gap: 18 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Contact Info */}
        <Text style={[s.section, { color: colors.mutedForeground }]}>CONTACT INFORMATION</Text>
        <Field label={`${tr('devLeadNameField')} *`} value={name} onChangeText={setName} placeholder="Muhammad Imran" />
        <Field label={`${tr('devLeadPhoneField')} *`} value={phone} onChangeText={setPhone} placeholder="030X-XXXXXXX" keyboardType="phone-pad" />
        <Field label={tr('devLeadEmailField')} value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" />

        {/* Interest */}
        <Text style={[s.section, { color: colors.mutedForeground, marginTop: 8 }]}>PROPERTY INTEREST</Text>

        {/* Project select */}
        <View style={s.fWrap}>
          <Text style={[s.fLabel, { color: colors.mutedForeground }]}>{tr('devLeadProjectField')}</Text>
          {projects.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {projects.map((pn) => (
                <Pressable key={pn} onPress={() => setProject(pn)}
                  style={[s.chip, { borderColor: project === pn ? colors.action : colors.border, backgroundColor: project === pn ? colors.action + '15' : colors.secondary }]}>
                  <Text style={[s.chipText, { color: project === pn ? colors.action : colors.mutedForeground }]}>{pn}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <TextInput value={project} onChangeText={setProject} placeholder="e.g. OG Green Valley"
              placeholderTextColor={colors.mutedForeground + '77'}
              style={[s.fInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
            />
          )}
        </View>

        <Field label={tr('devLeadUnitField')} value={unit} onChangeText={setUnit} placeholder="e.g. 5 Marla Plot" />
        <Field label={tr('devLeadBudgetField')} value={budget} onChangeText={setBudget} placeholder="e.g. 35-45 Lakh" />

        {/* Lead Source */}
        <View style={s.fWrap}>
          <Text style={[s.fLabel, { color: colors.mutedForeground }]}>{tr('devLeadSourceField')}</Text>
          <View style={s.sourceGrid}>
            {DEV_LEAD_SOURCES.map((src) => (
              <Pressable key={src} onPress={() => setSource(src)}
                style={[s.sourceChip, {
                  borderColor: source === src ? colors.action : colors.border,
                  backgroundColor: source === src ? colors.action + '15' : colors.secondary,
                }]}>
                <Text style={[s.sourceChipText, { color: source === src ? colors.action : colors.mutedForeground }]}>{src}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Notes & Follow-up */}
        <Text style={[s.section, { color: colors.mutedForeground, marginTop: 8 }]}>NOTES & FOLLOW-UP</Text>
        <Field label={tr('devLeadNoteField')} value={notes} onChangeText={setNotes} multiline placeholder="Any notes about this lead..." />
        <Field label={tr('devLeadFollowUpField')} value={followUp} onChangeText={setFollowUp} placeholder="e.g. 2026-08-20" />
      </ScrollView>

      {/* Save button */}
      <View style={[s.footer, { paddingBottom: botPad + 12, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => { void handleSave(); }}
          disabled={saving}
          style={({ pressed }) => [s.saveBtn, { backgroundColor: colors.action, opacity: pressed ? 0.87 : 1 }]}
        >
          <Feather name="check" size={16} color="#ffffff" />
          <Text style={s.saveBtnText}>{saving ? 'Saving...' : tr('saveDevLeadBtn')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:     { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title:       { fontFamily: 'Inter_700Bold', fontSize: 17 },
  subtitle:    { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  section:     { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5 },
  fWrap:       { gap: 6 },
  fLabel:      { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.3 },
  fInput:      { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 14 },
  chip:        { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText:    { fontFamily: 'Inter_500Medium', fontSize: 12 },
  sourceGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  sourceChip:  { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  sourceChipText:{ fontFamily: 'Inter_500Medium', fontSize: 11 },
  footer:      { paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1 },
  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#ffffff' },
});
