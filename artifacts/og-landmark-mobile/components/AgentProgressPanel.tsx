import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import {
  getAgentProgressReports,
  reviewAgentProgressReport,
  submitAgentProgressReport,
  type AgentProgressReport,
} from '@/lib/api';

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function AgentProgressPanel({ admin = false }: { admin?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [reports, setReports] = useState<AgentProgressReport[]>([]);
  const [summary, setSummary] = useState('');
  const [blockers, setBlockers] = useState('');
  const [counts, setCounts] = useState({ leadsContacted: '', visitsCompleted: '', followUps: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const today = localDate();

  const load = useCallback(async () => {
    setError('');
    try { setReports(await getAgentProgressReports()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load progress reports.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!summary.trim()) { setError('Add a short summary of today’s work.'); return; }
    const values = {
      leadsContacted: Number(counts.leadsContacted || 0),
      visitsCompleted: Number(counts.visitsCompleted || 0),
      followUps: Number(counts.followUps || 0),
    };
    if (Object.values(values).some((value) => !Number.isInteger(value) || value < 0)) {
      setError('Activity counts must be zero or a positive whole number.');
      return;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      const report = await submitAgentProgressReport({ date: today, summary: summary.trim(), ...values, blockers: blockers.trim() });
      setReports((current) => [report, ...current]);
      setSummary(''); setBlockers(''); setCounts({ leadsContacted: '', visitsCompleted: '', followUps: '' });
      setSuccess('Daily progress sent to Admin.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit today’s progress.'); }
    finally { setSaving(false); }
  };

  const review = async (report: AgentProgressReport, status: 'reviewed' | 'needs_follow_up') => {
    const note = reviewNotes[report.id]?.trim() ?? '';
    if (status === 'needs_follow_up' && !note) {
      setError('Add a short note so the Agent knows what follow-up is needed.');
      return;
    }
    try {
      const updated = await reviewAgentProgressReport(report.id, status, note);
      setReports((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSuccess(`Report marked ${status === 'reviewed' ? 'reviewed' : 'for follow-up'}. Agent has been notified.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update the report.'); }
  };

  const field = (label: string, value: string, onChangeText: (text: string) => void, numeric = false) => (
    <View style={{ flex: 1 }}>
      <Text style={[s.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} keyboardType={numeric ? 'number-pad' : 'default'} placeholder={numeric ? '0' : ''} placeholderTextColor={colors.mutedForeground} style={[s.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
    </View>
  );

  return (
    <ScrollView style={[s.root, { backgroundColor: colors.background }]} contentContainerStyle={[s.content, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 16, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={s.back}><Feather name="arrow-left" size={19} color={colors.foreground} /><Text style={{ color: colors.foreground, fontWeight: '700' }}>Back</Text></Pressable>
      <Text style={[s.eyebrow, { color: colors.action }]}>{admin ? 'TEAM OPERATIONS' : 'AGENT PORTAL'}</Text>
      <Text style={[s.title, { color: colors.foreground }]}>{admin ? 'Daily Agent Progress' : 'Daily Progress'}</Text>
      <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{admin ? 'Review submitted activity and send a status back to each Agent.' : `Submit today’s activity (${today}) for Admin review.`}</Text>

      {!admin && !reports.some((report) => report.date === today) && (
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.section, { color: colors.foreground }]}>Today’s activity</Text>
          <Text style={[s.label, { color: colors.mutedForeground }]}>WORK SUMMARY</Text>
          <TextInput value={summary} onChangeText={setSummary} multiline maxLength={2500} placeholder="What did you work on today?" placeholderTextColor={colors.mutedForeground} style={[s.textArea, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <View style={s.countRow}>
            {field('LEADS CONTACTED', counts.leadsContacted, (value) => setCounts((current) => ({ ...current, leadsContacted: value })), true)}
            {field('VISITS COMPLETED', counts.visitsCompleted, (value) => setCounts((current) => ({ ...current, visitsCompleted: value })), true)}
            {field('FOLLOW-UPS', counts.followUps, (value) => setCounts((current) => ({ ...current, followUps: value })), true)}
          </View>
          <Text style={[s.label, { color: colors.mutedForeground }]}>BLOCKERS / SUPPORT NEEDED (OPTIONAL)</Text>
          <TextInput value={blockers} onChangeText={setBlockers} multiline maxLength={1500} placeholder="Anything blocking your work?" placeholderTextColor={colors.mutedForeground} style={[s.textArea, { minHeight: 72, color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Pressable disabled={saving} onPress={() => void submit()} style={[s.button, { backgroundColor: colors.action, opacity: saving ? 0.6 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <><Feather name="send" size={15} color="#fff" /><Text style={s.buttonText}>Submit to Admin</Text></>}
          </Pressable>
        </View>
      )}
      {!admin && reports.some((report) => report.date === today) && <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[s.section, { color: colors.foreground }]}>Today’s report submitted</Text><Text style={{ color: colors.mutedForeground }}>Your activity is in the Admin review queue.</Text></View>}

      {!!success && <Text style={[s.feedback, { color: colors.success }]}>{success}</Text>}
      {!!error && <Text style={[s.feedback, { color: colors.destructive }]}>{error}</Text>}
      <Text style={[s.section, { color: colors.foreground, marginTop: 8 }]}>{admin ? 'Submitted reports' : 'Report history'}</Text>
      {loading ? <ActivityIndicator color={colors.action} /> : reports.length === 0 ? <Text style={{ color: colors.mutedForeground, paddingVertical: 18 }}>No progress reports yet.</Text> : reports.map((report) => (
        <View key={report.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.reportHead}><View style={{ flex: 1 }}><Text style={[s.section, { color: colors.foreground }]}>{admin ? report.agentName : 'Daily report'} · {report.date}</Text><Text style={[s.status, { color: report.status === 'needs_follow_up' ? colors.warning : colors.action }]}>{report.status.replaceAll('_', ' ').toUpperCase()}</Text></View></View>
          <Text style={[s.body, { color: colors.foreground }]}>{report.summary}</Text>
          <Text style={[s.meta, { color: colors.mutedForeground }]}>{report.leadsContacted} leads · {report.visitsCompleted} visits · {report.followUps} follow-ups</Text>
          {report.blockers ? <Text style={[s.meta, { color: colors.mutedForeground, marginTop: 5 }]}>Blockers: {report.blockers}</Text> : null}
          {report.adminNote ? <Text style={[s.meta, { color: colors.action, marginTop: 6 }]}>Admin: {report.adminNote}</Text> : null}
          {admin && report.status === 'submitted' ? <>
            <TextInput value={reviewNotes[report.id] ?? ''} onChangeText={(value) => setReviewNotes((current) => ({ ...current, [report.id]: value }))} placeholder="Optional note; required for follow-up" placeholderTextColor={colors.mutedForeground} style={[s.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
            <View style={s.reviewRow}>
            <Pressable onPress={() => void review(report, 'needs_follow_up')} style={[s.reviewButton, { borderColor: colors.border }]}><Text style={{ color: colors.foreground, fontWeight: '700' }}>Needs follow-up</Text></Pressable>
            <Pressable onPress={() => void review(report, 'reviewed')} style={[s.reviewButton, { backgroundColor: colors.action, borderColor: colors.action }]}><Text style={{ color: '#fff', fontWeight: '700' }}>Mark reviewed</Text></Pressable>
            </View>
          </> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 12 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, lineHeight: 20, marginBottom: 4 },
  card: { borderWidth: 1, borderRadius: 16, padding: 15, gap: 9 },
  section: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10, marginTop: 5 },
  textArea: { borderWidth: 1, borderRadius: 11, padding: 11, minHeight: 95, textAlignVertical: 'top', marginTop: 5 },
  countRow: { flexDirection: 'row', gap: 8 },
  button: { minHeight: 46, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  buttonText: { color: '#fff', fontWeight: '800' },
  feedback: { fontSize: 13, fontWeight: '600' },
  reportHead: { flexDirection: 'row', justifyContent: 'space-between' },
  status: { fontSize: 10, fontWeight: '800', marginTop: 4 },
  body: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 12 },
  reviewRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  reviewButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40, borderWidth: 1, borderRadius: 10 },
});
