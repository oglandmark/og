/**
 * Agent — Visit Management
 * Today / Upcoming / Completed / Cancelled views.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert, Linking, Platform, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import {
  AgentVisit, VisitStatus,
  deleteAgentVisit, formatVisitDate, getAgentVisits,
  isTodayVisit, isUpcomingVisit, updateVisitStatus, visitStatusColor,
} from '@/lib/agentVisitsStore';

type TabKey = 'Today' | 'Upcoming' | 'Completed' | 'Cancelled';
const TABS: TabKey[] = ['Today', 'Upcoming', 'Completed', 'Cancelled'];

function filterVisits(visits: AgentVisit[], tab: TabKey): AgentVisit[] {
  switch (tab) {
    case 'Today':     return visits.filter(isTodayVisit).sort((a, b) => a.time.localeCompare(b.time));
    case 'Upcoming':  return visits.filter((v) => isUpcomingVisit(v) && !isTodayVisit(v)).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    case 'Completed': return visits.filter((v) => v.status === 'Completed').sort((a, b) => b.date.localeCompare(a.date));
    case 'Cancelled': return visits.filter((v) => v.status === 'Cancelled' || v.status === 'No Show').sort((a, b) => b.date.localeCompare(a.date));
  }
}

function VisitCard({
  visit, colors, onStatusChange, onDelete,
}: {
  visit: AgentVisit;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  onStatusChange: (id: string, status: VisitStatus) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const sc = visitStatusColor(visit.status);
  const dateLabel = formatVisitDate(visit.date);
  const isActive = visit.status === 'Confirmed' || visit.status === 'Requested';

  const call = () => {
    const num = visit.clientPhone.replace(/\D/g, '');
    Linking.openURL(`tel:${num}`).catch(() => Alert.alert('Cannot open dialer'));
  };
  const whatsapp = () => {
    const num = visit.clientPhone.replace(/\D/g, '').replace(/^0/, '92');
    const msg = encodeURIComponent(`Hi ${visit.clientName}, I'm your OG Landmark agent. Your visit for *${visit.propertyTitle}* is scheduled for ${dateLabel} at ${visit.time}.`);
    Linking.openURL(`https://wa.me/${num}?text=${msg}`).catch(() => Alert.alert('WhatsApp not available'));
  };

  return (
    <View style={[vc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Top row */}
      <View style={vc.top}>
        <View style={[vc.timeBox, { backgroundColor: colors.action + '15' }]}>
          <Text style={[vc.timeLabel, { color: colors.action }]}>{visit.time}</Text>
          <Text style={[vc.dateLabel, { color: colors.action + 'aa' }]}>{dateLabel}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <View style={[vc.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[vc.statusText, { color: sc.text }]}>{visit.status}</Text>
            </View>
          </View>
          <Text style={[vc.propertyTitle, { color: colors.foreground }]} numberOfLines={2}>
            {visit.propertyTitle}
          </Text>
          <View style={vc.locRow}>
            <Feather name="map-pin" size={10} color={colors.mutedForeground} />
            <Text style={[vc.locText, { color: colors.mutedForeground }]}>{visit.propertyCity}</Text>
          </View>
        </View>
      </View>

      {/* Client row */}
      <View style={[vc.clientRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={[vc.clientAvatar, { backgroundColor: colors.action }]}>
          <Text style={vc.clientAvatarText}>{visit.clientName[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[vc.clientName, { color: colors.foreground }]}>{visit.clientName}</Text>
          <Text style={[vc.clientPhone, { color: colors.mutedForeground }]}>{visit.clientPhone}</Text>
        </View>
        <Pressable onPress={call} style={[vc.contactBtn, { backgroundColor: colors.action + '18' }]} hitSlop={8}>
          <Feather name="phone" size={14} color={colors.action} />
        </Pressable>
        <Pressable onPress={whatsapp} style={[vc.contactBtn, { backgroundColor: '#25d36618' }]} hitSlop={8}>
          <Feather name="message-circle" size={14} color="#25d366" />
        </Pressable>
      </View>

      {/* Notes */}
      {visit.notes ? (
        <View style={[vc.notesWrap, { borderColor: colors.border }]}>
          <Feather name="file-text" size={11} color={colors.mutedForeground} />
          <Text style={[vc.notesText, { color: colors.mutedForeground }]} numberOfLines={2}>{visit.notes}</Text>
        </View>
      ) : null}

      {/* Actions */}
      {isActive && (
        <View style={[vc.actions, { borderTopColor: colors.border }]}>
          {visit.status === 'Requested' && (
            <Pressable onPress={() => onStatusChange(visit.id, 'Confirmed')}
              style={[vc.actionBtn, { backgroundColor: '#1a6b3a18' }]}>
              <Feather name="check" size={13} color="#1a6b3a" />
              <Text style={[vc.actionBtnText, { color: '#1a6b3a' }]}>Confirm</Text>
            </Pressable>
          )}
          {visit.status === 'Confirmed' && (
            <Pressable onPress={() => onStatusChange(visit.id, 'Completed')}
              style={[vc.actionBtn, { backgroundColor: '#102a4318' }]}>
              <Feather name="check-circle" size={13} color="#102a43" />
              <Text style={[vc.actionBtnText, { color: '#102a43' }]}>Complete</Text>
            </Pressable>
          )}
          <Pressable onPress={() => onStatusChange(visit.id, 'Rescheduled')}
            style={[vc.actionBtn, { backgroundColor: '#7c3aed18' }]}>
            <Feather name="clock" size={13} color="#7c3aed" />
            <Text style={[vc.actionBtnText, { color: '#7c3aed' }]}>Reschedule</Text>
          </Pressable>
          <Pressable onPress={() => onStatusChange(visit.id, 'Cancelled')}
            style={[vc.actionBtn, { backgroundColor: '#b94b4218' }]}>
            <Feather name="x" size={13} color="#b94b42" />
            <Text style={[vc.actionBtnText, { color: '#b94b42' }]}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => onDelete(visit.id, visit.clientName)}
            style={[vc.actionBtn, { backgroundColor: '#dc262610' }]}>
            <Feather name="trash-2" size={13} color="#dc2626" />
            <Text style={[vc.actionBtnText, { color: '#dc2626' }]}>Delete</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const vc = StyleSheet.create({
  card:           { borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 0 },
  top:            { flexDirection: 'row', padding: 14 },
  timeBox:        { alignItems: 'center', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, minWidth: 58 },
  timeLabel:      { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.5 },
  dateLabel:      { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 2 },
  statusBadge:    { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  statusText:     { fontFamily: 'Inter_700Bold', fontSize: 9 },
  propertyTitle:  { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, marginBottom: 4 },
  locRow:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locText:        { fontFamily: 'Inter_400Regular', fontSize: 10 },
  clientRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 1 },
  clientAvatar:   { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  clientAvatarText:{ fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' },
  clientName:     { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 1 },
  clientPhone:    { fontFamily: 'Inter_400Regular', fontSize: 10 },
  contactBtn:     { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  notesWrap:      { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4, alignItems: 'flex-start', borderTopWidth: 0 },
  notesText:      { fontFamily: 'Inter_400Regular', fontSize: 11, flex: 1, lineHeight: 16 },
  actions:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderTopWidth: 1 },
  actionBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});

// ── Add Visit Modal ───────────────────────────────────────────────────────────
function AddVisitForm({
  agentId, colors, onSave, onCancel,
}: { agentId: string; colors: ReturnType<typeof import('@/hooks/useColors').useColors>; onSave: () => void; onCancel: () => void }) {
  const [clientName, setClientName]     = useState('');
  const [clientPhone, setClientPhone]   = useState('');
  const [property, setProperty]         = useState('');
  const [city, setCity]                 = useState('Okara');
  const [date, setDate]                 = useState('');
  const [time, setTime]                 = useState('10:00');
  const [notes, setNotes]               = useState('');
  const [saving, setSaving]             = useState(false);

  const { saveAgentVisit, newVisitId } = require('@/lib/agentVisitsStore');

  const save = async () => {
    if (!clientName.trim())  { Alert.alert('', 'Client name is required'); return; }
    if (!clientPhone.trim()) { Alert.alert('', 'Phone number is required'); return; }
    if (!property.trim())    { Alert.alert('', 'Property title is required'); return; }
    if (!date.trim())        { Alert.alert('', 'Date is required (YYYY-MM-DD)'); return; }
    setSaving(true);
    const now = new Date().toISOString();
    await saveAgentVisit({ id: newVisitId(), agentId, clientName: clientName.trim(), clientPhone: clientPhone.trim(), propertyTitle: property.trim(), propertyCity: city.trim(), date: date.trim(), time, status: 'Requested', notes: notes.trim(), createdAt: now, updatedAt: now });
    setSaving(false);
    onSave();
  };

  const InputField = ({ label, value, onChangeText, placeholder, kbType }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; kbType?: 'default' | 'phone-pad' }) => (
    <View style={{ gap: 5, marginBottom: 12 }}>
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.mutedForeground }}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={kbType ?? 'default'}
        placeholderTextColor={colors.mutedForeground + '66'}
        style={{ borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontFamily: 'Inter_400Regular', fontSize: 14, borderColor: colors.border, backgroundColor: colors.secondary, color: colors.foreground }} />
    </View>
  );

  return (
    <View style={[af.wrap, { backgroundColor: colors.card, borderColor: colors.action + '44' }]}>
      <Text style={[af.title, { color: colors.foreground }]}>Schedule New Visit</Text>
      <InputField label="Client Name *" value={clientName} onChangeText={setClientName} placeholder="e.g. Muhammad Ali" />
      <InputField label="Phone *" value={clientPhone} onChangeText={setClientPhone} placeholder="0301-1234567" kbType="phone-pad" />
      <InputField label="Property Title *" value={property} onChangeText={setProperty} placeholder="e.g. 5 Marla House – Okara City" />
      <InputField label="City" value={city} onChangeText={setCity} placeholder="Okara" />
      <InputField label="Date (YYYY-MM-DD) *" value={date} onChangeText={setDate} placeholder={new Date().toISOString().slice(0, 10)} />
      <InputField label="Time (HH:MM)" value={time} onChangeText={setTime} placeholder="10:00" />
      <InputField label="Notes" value={notes} onChangeText={setNotes} placeholder="Anything the client mentioned..." />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={onCancel} style={[af.cancelBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
          <Text style={[af.cancelText, { color: colors.foreground }]}>Cancel</Text>
        </Pressable>
        <Pressable onPress={() => { void save(); }} disabled={saving} style={[af.saveBtn, { backgroundColor: colors.action }]}>
          <Feather name="calendar" size={14} color="#ffffff" />
          <Text style={af.saveText}>{saving ? 'Saving…' : 'Schedule Visit'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const af = StyleSheet.create({
  wrap:       { borderWidth: 1.5, borderRadius: 18, padding: 16, marginBottom: 20 },
  title:      { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 14 },
  cancelBtn:  { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 13 },
  cancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  saveBtn:    { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 13 },
  saveText:   { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AgentVisitsScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const router  = useRouter();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const [visits, setVisits]     = useState<AgentVisit[]>([]);
  const [tab, setTab]           = useState<TabKey>('Today');
  const [showForm, setShowForm] = useState(false);

  const reload = useCallback(() => {
    void getAgentVisits(user?.id ?? '').then(setVisits);
  }, [user?.id]);

  useFocusEffect(reload);

  const handleStatusChange = async (id: string, status: VisitStatus) => {
    const updated = await updateVisitStatus(id, status);
    setVisits(updated.filter((v) => v.agentId === user?.id));
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`Delete visit with ${name}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteAgentVisit(id); reload(); } },
    ]);
  };

  const filtered = filterVisits(visits, tab);

  const todayCount    = visits.filter(isTodayVisit).length;
  const upcomingCount = visits.filter((v) => isUpcomingVisit(v) && !isTodayVisit(v)).length;
  const tabCounts: Record<TabKey, number> = {
    Today:     todayCount,
    Upcoming:  upcomingCount,
    Completed: visits.filter((v) => v.status === 'Completed').length,
    Cancelled: visits.filter((v) => v.status === 'Cancelled' || v.status === 'No Show').length,
  };

  return (
    <View style={[sc.screen, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad + 100 }}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <AnimatedReveal>
          <View style={[sc.header, { paddingTop: topPad + 12, paddingHorizontal: 20 }]}>
            <Pressable onPress={() => router.back()} hitSlop={12}
              style={[sc.backBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[sc.eyebrow, { color: colors.action }]}>AGENT PORTAL</Text>
              <Text style={[sc.title, { color: colors.foreground }]}>Visit Management</Text>
            </View>
            <Pressable onPress={() => setShowForm(!showForm)}
              style={[sc.addBtn, { backgroundColor: showForm ? colors.secondary : colors.action }]}>
              <Feather name={showForm ? 'x' : 'plus'} size={14} color={showForm ? colors.foreground : '#ffffff'} />
              <Text style={[sc.addBtnText, { color: showForm ? colors.foreground : '#ffffff' }]}>
                {showForm ? 'Cancel' : 'Schedule'}
              </Text>
            </Pressable>
          </View>
        </AnimatedReveal>

        {/* Stats banner */}
        <AnimatedReveal delay={40}>
          <View style={[sc.banner, { backgroundColor: colors.action, marginHorizontal: 20, marginTop: 16 }]}>
            {[
              { label: 'Today',    value: todayCount },
              { label: 'Upcoming', value: upcomingCount },
              { label: 'Total',    value: visits.length },
            ].map((s, i) => (
              <View key={s.label} style={[sc.bannerItem, i < 2 && { borderRightWidth: 1, borderRightColor: '#ffffff22' }]}>
                <Text style={sc.bannerValue}>{s.value}</Text>
                <Text style={sc.bannerLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </AnimatedReveal>

        {/* Add form */}
        {showForm && (
          <AnimatedReveal delay={50}>
            <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
              <AddVisitForm agentId={user?.id ?? ''} colors={colors}
                onSave={() => { setShowForm(false); reload(); }}
                onCancel={() => setShowForm(false)} />
            </View>
          </AnimatedReveal>
        )}

        {/* Tabs */}
        <AnimatedReveal delay={60}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 14 }}>
            {TABS.map((t) => (
              <Pressable key={t} onPress={() => setTab(t)}
                style={[sc.tabPill, { backgroundColor: tab === t ? colors.action : colors.secondary, borderColor: tab === t ? colors.action : colors.border }]}>
                <Text style={[sc.tabText, { color: tab === t ? '#ffffff' : colors.mutedForeground }]}>{t}</Text>
                {tabCounts[t] > 0 && (
                  <View style={[sc.tabBadge, { backgroundColor: tab === t ? '#ffffff33' : colors.border }]}>
                    <Text style={[sc.tabBadgeText, { color: tab === t ? '#ffffff' : colors.mutedForeground }]}>{tabCounts[t]}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </AnimatedReveal>

        {/* Visit cards */}
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {filtered.length === 0 ? (
            <AnimatedReveal delay={80}>
              <View style={[sc.empty, { borderColor: colors.border }]}>
                <Feather name="calendar" size={36} color={colors.mutedForeground} />
                <Text style={[sc.emptyTitle, { color: colors.foreground }]}>No {tab} Visits</Text>
                <Text style={[sc.emptyDesc, { color: colors.mutedForeground }]}>
                  {tab === 'Today'
                    ? "No visits scheduled for today. Schedule one above."
                    : `Your ${tab.toLowerCase()} visits will appear here.`}
                </Text>
                {tab === 'Today' || tab === 'Upcoming' ? (
                  <Pressable onPress={() => setShowForm(true)}
                    style={[sc.emptyBtn, { backgroundColor: colors.action }]}>
                    <Feather name="plus" size={14} color="#ffffff" />
                    <Text style={sc.emptyBtnText}>Schedule Visit</Text>
                  </Pressable>
                ) : null}
              </View>
            </AnimatedReveal>
          ) : (
            filtered.map((v, i) => (
              <AnimatedReveal key={v.id} delay={80 + i * 40}>
                <VisitCard visit={v} colors={colors} onStatusChange={(id, status) => { void handleStatusChange(id, status); }} onDelete={handleDelete} />
              </AnimatedReveal>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const sc = StyleSheet.create({
  screen:        { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center' },
  backBtn:       { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow:       { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title:         { fontFamily: 'Inter_700Bold', fontSize: 22 },
  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  addBtnText:    { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  banner:        { borderRadius: 16, flexDirection: 'row' },
  bannerItem:    { flex: 1, alignItems: 'center', paddingVertical: 14 },
  bannerValue:   { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#ffffff', letterSpacing: -0.3 },
  bannerLabel:   { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#ffffff99', marginTop: 1 },
  tabPill:       { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  tabText:       { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  tabBadge:      { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 },
  tabBadgeText:  { fontFamily: 'Inter_700Bold', fontSize: 9 },
  empty:         { borderWidth: 1, borderRadius: 18, padding: 36, alignItems: 'center', gap: 10, borderStyle: 'dashed' },
  emptyTitle:    { fontFamily: 'Inter_700Bold', fontSize: 16 },
  emptyDesc:     { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 260 },
  emptyBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, marginTop: 4 },
  emptyBtnText:  { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#ffffff' },
});
