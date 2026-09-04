/**
 * Agent — Quick Add Lead
 * Add a new buyer lead directly from the agent dashboard.
 */
import React, { useState } from 'react';
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
import { AnimatedReveal } from '@/components/AnimatedReveal';
import {
  Lead, LeadPriority, LeadSource, LeadStatus,
  LEAD_SOURCES, addLead, getLeads, nextLeadId,
} from '@/lib/leadsStore';

const STATUSES: { key: LeadStatus; label: string; color: string }[] = [
  { key: 'new',        label: 'New',       color: '#102a43' },
  { key: 'contacted',  label: 'Contacted', color: '#c8a45a' },
  { key: 'interested', label: 'Interested',color: '#1a6b3a' },
  { key: 'viewing',    label: 'Viewing',   color: '#7c3aed' },
];

const PRIORITIES: { key: LeadPriority; label: string; color: string }[] = [
  { key: 'high',   label: '🔴 High',   color: '#b94b42' },
  { key: 'medium', label: '🟡 Medium', color: '#c8a45a' },
  { key: 'low',    label: '🟢 Low',    color: '#1a6b3a' },
];

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#888', letterSpacing: 0.3 }}>{label}</Text>
      {required && <Text style={{ color: '#dc2626', fontSize: 11, fontFamily: 'Inter_700Bold' }}>*</Text>}
    </View>
  );
}

export default function AddLeadScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const router  = useRouter();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [property, setProperty] = useState('');
  const [area, setArea]         = useState('Okara City');
  const [budget, setBudget]     = useState('');
  const [status, setStatus]     = useState<LeadStatus>('new');
  const [priority, setPriority] = useState<LeadPriority>('medium');
  const [source, setSource]     = useState<LeadSource>('Direct Inquiry');
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);

  const inp = (value: string, onChangeText: (v: string) => void, placeholder: string, kbType?: React.ComponentProps<typeof TextInput>['keyboardType']) => (
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={kbType}
      placeholderTextColor={colors.mutedForeground + '66'}
      style={[al.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]} />
  );

  const save = async () => {
    if (!name.trim())     { Alert.alert('', 'Client name is required'); return; }
    if (!phone.trim())    { Alert.alert('', 'Phone number is required'); return; }
    if (!property.trim()) { Alert.alert('', 'Interested property is required'); return; }
    setSaving(true);
    try {
      const existing = await getLeads();
      const now = new Date().toISOString();
      const lead: Lead = {
        id: nextLeadId(existing),
        agentId: user?.id,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        property: property.trim(),
        area: area.trim() || 'Okara City',
        budget: budget.trim() || 'Not specified',
        status,
        priority,
        source,
        time: 'Just now',
        createdAt: now,
        notes: notes.trim(),
      };
      await addLead(lead);
      Alert.alert('Lead Added!', `${lead.name} has been added to your CRM.`, [
        { text: 'View CRM', onPress: () => router.replace('/(tabs)/leads') },
        { text: 'Add Another', onPress: () => {
          setName(''); setPhone(''); setEmail(''); setProperty('');
          setBudget(''); setNotes(''); setStatus('new'); setPriority('medium'); setSource('Direct Inquiry');
        }},
      ]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[al.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad + 100 }}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <AnimatedReveal>
          <View style={[al.header, { paddingTop: topPad + 12, paddingHorizontal: 20 }]}>
            <Pressable onPress={() => router.back()} hitSlop={12}
              style={[al.backBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[al.eyebrow, { color: colors.action }]}>AGENT CRM</Text>
              <Text style={[al.title, { color: colors.foreground }]}>Add New Lead</Text>
            </View>
          </View>
          <Text style={[al.subtitle, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 4, marginBottom: 20 }]}>
            Add a buyer inquiry directly to your CRM
          </Text>
        </AnimatedReveal>

        <View style={{ paddingHorizontal: 20, gap: 18 }}>

          {/* CLIENT INFO */}
          <AnimatedReveal delay={40}>
            <View style={[al.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[al.sectionTitle, { color: colors.mutedForeground }]}>CLIENT INFORMATION</Text>
              <View style={al.sectionBody}>
                <View style={al.fWrap}>
                  <FieldLabel label="Full Name" required />
                  {inp(name, setName, 'e.g. Muhammad Ali')}
                </View>
                <View style={al.fWrap}>
                  <FieldLabel label="Phone Number" required />
                  {inp(phone, setPhone, '0301-1234567', 'phone-pad')}
                </View>
                <View style={al.fWrap}>
                  <FieldLabel label="Email (optional)" />
                  {inp(email, setEmail, 'email@example.com', 'email-address')}
                </View>
              </View>
            </View>
          </AnimatedReveal>

          {/* REQUIREMENTS */}
          <AnimatedReveal delay={60}>
            <View style={[al.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[al.sectionTitle, { color: colors.mutedForeground }]}>REQUIREMENTS</Text>
              <View style={al.sectionBody}>
                <View style={al.fWrap}>
                  <FieldLabel label="Interested Property" required />
                  {inp(property, setProperty, 'e.g. 5 Marla House – Okara City')}
                </View>
                <View style={al.fWrap}>
                  <FieldLabel label="Preferred Area" />
                  {inp(area, setArea, 'e.g. Okara City')}
                </View>
                <View style={al.fWrap}>
                  <FieldLabel label="Budget" />
                  {inp(budget, setBudget, 'e.g. PKR 40–50 Lac')}
                </View>
              </View>
            </View>
          </AnimatedReveal>

          {/* LEAD DETAILS */}
          <AnimatedReveal delay={80}>
            <View style={[al.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[al.sectionTitle, { color: colors.mutedForeground }]}>LEAD DETAILS</Text>
              <View style={al.sectionBody}>

                {/* Status */}
                <View style={al.fWrap}>
                  <FieldLabel label="Status" />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {STATUSES.map((s) => (
                      <Pressable key={s.key} onPress={() => setStatus(s.key)}
                        style={[al.chip, { borderColor: status === s.key ? s.color : colors.border, backgroundColor: status === s.key ? s.color + '18' : colors.secondary }]}>
                        <Text style={[al.chipText, { color: status === s.key ? s.color : colors.mutedForeground }]}>{s.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Priority */}
                <View style={al.fWrap}>
                  <FieldLabel label="Priority" />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {PRIORITIES.map((p) => (
                      <Pressable key={p.key} onPress={() => setPriority(p.key)}
                        style={[al.chip, { borderColor: priority === p.key ? p.color : colors.border, backgroundColor: priority === p.key ? p.color + '18' : colors.secondary, flex: 1, justifyContent: 'center' }]}>
                        <Text style={[al.chipText, { color: priority === p.key ? p.color : colors.mutedForeground }]}>{p.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Source */}
                <View style={al.fWrap}>
                  <FieldLabel label="Lead Source" />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                    {LEAD_SOURCES.map((s) => (
                      <Pressable key={s} onPress={() => setSource(s)}
                        style={[al.chip, { borderColor: source === s ? colors.action : colors.border, backgroundColor: source === s ? colors.action + '18' : colors.secondary }]}>
                        <Text style={[al.chipText, { color: source === s ? colors.action : colors.mutedForeground }]}>{s}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Notes */}
                <View style={al.fWrap}>
                  <FieldLabel label="Notes" />
                  <TextInput value={notes} onChangeText={setNotes} multiline
                    placeholder="Client requirements, special notes, last conversation..."
                    placeholderTextColor={colors.mutedForeground + '66'}
                    style={[al.input, al.textarea, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]} />
                </View>
              </View>
            </View>
          </AnimatedReveal>

          {/* Save */}
          <AnimatedReveal delay={100}>
            <Pressable onPress={() => { void save(); }} disabled={saving}
              style={[al.saveBtn, { backgroundColor: colors.action }]}>
              <Feather name="user-plus" size={16} color="#ffffff" />
              <Text style={al.saveBtnText}>{saving ? 'Adding Lead…' : 'Add Lead to CRM'}</Text>
            </Pressable>
          </AnimatedReveal>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const al = StyleSheet.create({
  screen:      { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow:     { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title:       { fontFamily: 'Inter_700Bold', fontSize: 22 },
  subtitle:    { fontFamily: 'Inter_400Regular', fontSize: 12 },
  section:     { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  sectionTitle:{ fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  sectionBody: { padding: 16, paddingTop: 4, gap: 14 },
  fWrap:       { gap: 0 },
  input:       { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 14 },
  textarea:    { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  chip:        { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  chipText:    { fontFamily: 'Inter_500Medium', fontSize: 11 },
  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingVertical: 16 },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#ffffff' },
});
