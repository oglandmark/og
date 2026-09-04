/**
 * Developer Portal — Site Visit Management
 * Developers can Accept / Reject / Reschedule / Complete visit requests.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert, Platform, Pressable, ScrollView,
  StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import {
  SiteVisit, VisitStatus, getSiteVisits, saveSiteVisit,
  updateVisitStatus, visitStatusColor, isUpcoming, formatVisitDate, newVisitId,
} from '@/lib/siteVisitStore';
import { getDevProjects } from '@/lib/developerStore';

export default function SiteVisitsScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const { tr, isRTL } = useLanguage();
  const router  = useRouter();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);
  const rtl = isRTL ? 'right' as const : 'left' as const;

  const [visits, setVisits]       = useState<SiteVisit[]>([]);
  const [filter, setFilter]       = useState<'all' | VisitStatus>('all');
  const [projectNames, setProjectNames] = useState<string[]>([]);

  // Add visit form state
  const [showForm, setShowForm]     = useState(false);
  const [formName, setFormName]     = useState('');
  const [formPhone, setFormPhone]   = useState('');
  const [formProject, setFormProject] = useState('');
  const [formDate, setFormDate]     = useState('');
  const [formTime, setFormTime]     = useState('');
  const [formCount, setFormCount]   = useState('1');
  const [formMsg, setFormMsg]       = useState('');
  const [saving, setSaving]         = useState(false);

  useFocusEffect(useCallback(() => {
    void getSiteVisits(user?.id ?? '').then(setVisits);
    void getDevProjects(user?.id ?? '').then((p) => setProjectNames(p.map((x) => x.name)));
  }, [user?.id]));

  const reload = () => void getSiteVisits(user?.id ?? '').then(setVisits);

  const handleAction = async (visit: SiteVisit, action: 'confirm' | 'reject' | 'complete' | 'reschedule') => {
    if (action === 'reschedule') {
      Alert.prompt(
        'Reschedule Visit',
        'Enter new date (e.g. 2026-09-01):',
        async (newDate) => {
          if (!newDate?.trim()) return;
          await updateVisitStatus(visit.id, 'Rescheduled', user?.id ?? '', newDate.trim(), visit.time);
          reload();
        },
        'plain-text',
        visit.date,
      );
      return;
    }
    const statusMap: Record<'confirm' | 'reject' | 'complete', VisitStatus> = {
      confirm:  'Confirmed',
      reject:   'Cancelled',
      complete: 'Completed',
    };
    const msgMap = {
      confirm:  tr('visitConfirmMsg'),
      reject:   tr('visitRejectMsg'),
      complete: tr('visitCompleteMsg'),
      reschedule: '',
    };
    await updateVisitStatus(visit.id, statusMap[action], user?.id ?? '');
    if (msgMap[action]) Alert.alert('', msgMap[action]);
    reload();
  };

  const handleSaveVisit = async () => {
    if (!formName.trim() || !formPhone.trim()) {
      Alert.alert('', 'Visitor name and phone are required.');
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const visit: SiteVisit = {
      id: newVisitId(), developerId: user?.id ?? '',
      projectName: formProject || (projectNames[0] ?? 'My Project'),
      visitorName: formName.trim(), visitorPhone: formPhone.trim(),
      visitorCount: Number(formCount) || 1,
      message: formMsg.trim(),
      date: formDate.trim() || new Date().toISOString().split('T')[0],
      time: formTime.trim() || '10:00 AM',
      status: 'Requested', createdAt: now, updatedAt: now,
    };
    await saveSiteVisit(visit);
    setShowForm(false); setFormName(''); setFormPhone(''); setFormDate(''); setFormTime(''); setFormMsg('');
    reload();
    setSaving(false);
  };

  const statusFilters: { key: 'all' | VisitStatus; label: string }[] = [
    { key: 'all',         label: 'All' },
    { key: 'Requested',   label: tr('visitStatusRequested') },
    { key: 'Confirmed',   label: tr('visitStatusConfirmed') },
    { key: 'Rescheduled', label: tr('visitStatusRescheduled') },
    { key: 'Completed',   label: tr('visitStatusCompleted') },
    { key: 'Cancelled',   label: tr('visitStatusCancelled') },
  ];

  const filtered   = filter === 'all' ? visits : visits.filter((v) => v.status === filter);
  const upcoming   = filtered.filter(isUpcoming);
  const past       = filtered.filter((v) => !isUpcoming(v));
  const totalUpcoming = visits.filter(isUpcoming).length;

  const renderVisitCard = (visit: SiteVisit, i: number) => {
    const sc = visitStatusColor(visit.status);
    const dateLabel = formatVisitDate(visit.date);
    const canConfirm    = visit.status === 'Requested' || visit.status === 'Rescheduled';
    const canReschedule = visit.status === 'Requested' || visit.status === 'Confirmed';
    const canComplete   = visit.status === 'Confirmed' || visit.status === 'Rescheduled';
    const canReject     = visit.status === 'Requested' || visit.status === 'Confirmed' || visit.status === 'Rescheduled';

    return (
      <AnimatedReveal key={visit.id} delay={80 + i * 50}>
        <View style={[sv.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Top row */}
          <View style={sv.cardTop}>
            <View style={[sv.avatar, { backgroundColor: colors.action }]}>
              <Text style={sv.avatarText}>{visit.visitorName[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[sv.visitorName, { color: colors.foreground, textAlign: rtl }]}>{visit.visitorName}</Text>
              <Text style={[sv.projectName, { color: colors.action, textAlign: rtl }]}>{visit.projectName}</Text>
              <View style={sv.metaRow}>
                <View style={[sv.metaChip, { backgroundColor: colors.secondary }]}>
                  <Feather name="calendar" size={10} color={colors.mutedForeground} />
                  <Text style={[sv.metaText, { color: colors.mutedForeground }]}>{dateLabel}</Text>
                </View>
                <View style={[sv.metaChip, { backgroundColor: colors.secondary }]}>
                  <Feather name="clock" size={10} color={colors.mutedForeground} />
                  <Text style={[sv.metaText, { color: colors.mutedForeground }]}>{visit.time}</Text>
                </View>
                <View style={[sv.metaChip, { backgroundColor: colors.secondary }]}>
                  <Feather name="users" size={10} color={colors.mutedForeground} />
                  <Text style={[sv.metaText, { color: colors.mutedForeground }]}>{visit.visitorCount}</Text>
                </View>
              </View>
            </View>
            <View style={[sv.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[sv.statusText, { color: sc.text }]}>{visit.status}</Text>
            </View>
          </View>

          {/* Message */}
          {!!visit.message && (
            <View style={[sv.msgBox, { backgroundColor: colors.secondary, marginTop: 12 }]}>
              <Text style={[sv.msgLabel, { color: colors.mutedForeground }]}>MESSAGE</Text>
              <Text style={[sv.msgText, { color: colors.foreground }]}>{visit.message}</Text>
            </View>
          )}

          {/* Action buttons */}
          {(canConfirm || canComplete || canReschedule || canReject) && (
            <View style={[sv.actions, { marginTop: 12 }]}>
              {canConfirm && (
                <Pressable onPress={() => { void handleAction(visit, 'confirm'); }}
                  style={[sv.actionBtn, { backgroundColor: '#1a6b3a18' }]}>
                  <Feather name="check" size={12} color="#1a6b3a" />
                  <Text style={[sv.actionBtnText, { color: '#1a6b3a' }]}>{tr('visitActionConfirm')}</Text>
                </Pressable>
              )}
              {canReschedule && (
                <Pressable onPress={() => { void handleAction(visit, 'reschedule'); }}
                  style={[sv.actionBtn, { backgroundColor: '#0891b218' }]}>
                  <Feather name="calendar" size={12} color="#0891b2" />
                  <Text style={[sv.actionBtnText, { color: '#0891b2' }]}>{tr('visitActionReschedule')}</Text>
                </Pressable>
              )}
              {canComplete && (
                <Pressable onPress={() => { void handleAction(visit, 'complete'); }}
                  style={[sv.actionBtn, { backgroundColor: '#c8a45a18' }]}>
                  <Feather name="check-circle" size={12} color="#c8a45a" />
                  <Text style={[sv.actionBtnText, { color: '#c8a45a' }]}>{tr('visitActionComplete')}</Text>
                </Pressable>
              )}
              {canReject && (
                <Pressable onPress={() => { void handleAction(visit, 'reject'); }}
                  style={[sv.actionBtn, { backgroundColor: '#dc262618' }]}>
                  <Feather name="x" size={12} color="#dc2626" />
                  <Text style={[sv.actionBtnText, { color: '#dc2626' }]}>{tr('visitActionReject')}</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </AnimatedReveal>
    );
  };

  return (
    <View style={[sv.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad + 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ────────────────────────────────────── */}
        <AnimatedReveal>
          <View style={[sv.header, { paddingTop: topPad + 12, paddingHorizontal: 20, paddingBottom: 4 }]}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={[sv.backBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[sv.eyebrow, { color: colors.action }]}>DEVELOPER PORTAL</Text>
              <Text style={[sv.title, { color: colors.foreground }]}>{tr('siteVisitsTitle')}</Text>
            </View>
            <Pressable onPress={() => setShowForm(!showForm)}
              style={[sv.addBtn, { backgroundColor: showForm ? colors.secondary : colors.action }]}>
              <Feather name={showForm ? 'x' : 'plus'} size={14} color={showForm ? colors.foreground : '#ffffff'} />
              <Text style={[sv.addBtnText, { color: showForm ? colors.foreground : '#ffffff' }]}>
                {showForm ? 'Cancel' : tr('addSiteVisitBtn')}
              </Text>
            </Pressable>
          </View>
          <Text style={[sv.subtitle, { color: colors.mutedForeground, paddingHorizontal: 20, marginBottom: 16, marginTop: 4 }]}>
            {tr('siteVisitsSubtitle')}
          </Text>
        </AnimatedReveal>

        {/* ── Stats banner ──────────────────────────────── */}
        <AnimatedReveal delay={40}>
          <View style={[sv.statsBanner, { backgroundColor: colors.action, marginHorizontal: 20 }]}>
            {[
              { label: 'Total',    value: visits.length },
              { label: tr('upcomingVisitsLabel').replace('UPCOMING','Upcoming'), value: totalUpcoming },
              { label: tr('visitStatusCompleted'), value: visits.filter((v) => v.status === 'Completed').length },
            ].map((s, i) => (
              <View key={s.label} style={[sv.statItem, i < 2 && { borderRightWidth: 1, borderRightColor: '#ffffff22' }]}>
                <Text style={sv.statValue}>{s.value}</Text>
                <Text style={sv.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </AnimatedReveal>

        {/* ── Add visit form ────────────────────────────── */}
        {showForm && (
          <AnimatedReveal delay={60}>
            <View style={[sv.formCard, { backgroundColor: colors.card, borderColor: colors.action + '44', marginHorizontal: 20, marginTop: 16 }]}>
              <Text style={[sv.formTitle, { color: colors.foreground }]}>Add Manual Visit</Text>

              {/* Project select */}
              {projectNames.length > 0 && (
                <View style={sv.fWrap}>
                  <Text style={[sv.fLabel, { color: colors.mutedForeground }]}>{tr('visitProject')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {projectNames.map((pn) => (
                      <Pressable key={pn} onPress={() => setFormProject(pn)}
                        style={[sv.chip, { borderColor: formProject === pn ? colors.action : colors.border, backgroundColor: formProject === pn ? colors.action + '15' : colors.secondary }]}>
                        <Text style={[sv.chipText, { color: formProject === pn ? colors.action : colors.mutedForeground }]}>{pn}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {[
                { label: 'Visitor Name *', value: formName, set: setFormName, placeholder: 'Muhammad Imran' },
                { label: 'Phone *', value: formPhone, set: setFormPhone, placeholder: '030X-XXXXXXX' },
                { label: 'Date (YYYY-MM-DD)', value: formDate, set: setFormDate, placeholder: new Date().toISOString().split('T')[0] },
                { label: 'Time', value: formTime, set: setFormTime, placeholder: '10:00 AM' },
                { label: 'No. of Visitors', value: formCount, set: setFormCount, placeholder: '1' },
              ].map((field) => (
                <View key={field.label} style={sv.fWrap}>
                  <Text style={[sv.fLabel, { color: colors.mutedForeground }]}>{field.label}</Text>
                  <TextInput
                    value={field.value} onChangeText={field.set}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.mutedForeground + '77'}
                    style={[sv.fInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                  />
                </View>
              ))}

              <View style={sv.fWrap}>
                <Text style={[sv.fLabel, { color: colors.mutedForeground }]}>Message</Text>
                <TextInput
                  value={formMsg} onChangeText={setFormMsg}
                  multiline numberOfLines={3}
                  placeholder="What are they interested in?"
                  placeholderTextColor={colors.mutedForeground + '77'}
                  style={[sv.fInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground, height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                />
              </View>

              <Pressable onPress={() => { void handleSaveVisit(); }} disabled={saving}
                style={[sv.saveBtn, { backgroundColor: colors.action }]}>
                <Text style={sv.saveBtnText}>{saving ? 'Saving...' : 'Save Visit'}</Text>
              </Pressable>
            </View>
          </AnimatedReveal>
        )}

        {/* ── Filter tabs ───────────────────────────────── */}
        <AnimatedReveal delay={80}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[sv.tabsRow, { marginTop: 16 }]}>
            {statusFilters.map((f) => {
              const active = filter === f.key;
              return (
                <Pressable key={f.key} onPress={() => setFilter(f.key)}
                  style={[sv.tab, { borderColor: active ? colors.action : colors.border, backgroundColor: active ? colors.action + '1a' : 'transparent' }]}>
                  <Text style={[sv.tabText, { color: active ? colors.action : colors.mutedForeground }]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </AnimatedReveal>

        {/* ── Upcoming visits ───────────────────────────── */}
        {upcoming.length > 0 && (
          <>
            <AnimatedReveal delay={90}>
              <Text style={[sv.sectionLabel, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 20, marginBottom: 12 }]}>
                {tr('upcomingVisitsLabel')}
              </Text>
            </AnimatedReveal>
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              {upcoming.map((v, i) => renderVisitCard(v, i))}
            </View>
          </>
        )}

        {/* ── Past visits ───────────────────────────────── */}
        {past.length > 0 && (
          <>
            <AnimatedReveal delay={90}>
              <Text style={[sv.sectionLabel, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 24, marginBottom: 12 }]}>
                {tr('pastVisitsLabel')}
              </Text>
            </AnimatedReveal>
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              {past.map((v, i) => renderVisitCard(v, upcoming.length + i))}
            </View>
          </>
        )}

        {/* ── Empty state ───────────────────────────────── */}
        {filtered.length === 0 && (
          <AnimatedReveal delay={80}>
            <View style={[sv.emptyWrap, { borderColor: colors.border, marginHorizontal: 20, marginTop: 32 }]}>
              <Feather name="calendar" size={36} color={colors.mutedForeground} />
              <Text style={[sv.emptyTitle, { color: colors.foreground }]}>{tr('noVisitsYet')}</Text>
              <Text style={[sv.emptyDesc, { color: colors.mutedForeground }]}>{tr('noVisitsDesc')}</Text>
            </View>
          </AnimatedReveal>
        )}
      </ScrollView>
    </View>
  );
}

const sv = StyleSheet.create({
  screen:      { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow:     { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title:       { fontFamily: 'Inter_700Bold', fontSize: 22 },
  subtitle:    { fontFamily: 'Inter_400Regular', fontSize: 12 },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  addBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  statsBanner: { borderRadius: 16, flexDirection: 'row', marginBottom: 4 },
  statItem:    { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statValue:   { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#ffffff', letterSpacing: -0.3 },
  statLabel:   { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#ffffff99', marginTop: 1 },
  formCard:    { borderWidth: 1.5, borderRadius: 18, padding: 16, gap: 14 },
  formTitle:   { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 4 },
  fWrap:       { gap: 6 },
  fLabel:      { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.3 },
  fInput:      { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 14 },
  chip:        { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  chipText:    { fontFamily: 'Inter_500Medium', fontSize: 12 },
  saveBtn:     { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' },
  tabsRow:     { paddingHorizontal: 20, paddingBottom: 4, gap: 8, flexDirection: 'row' },
  tab:         { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 7 },
  tabText:     { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  sectionLabel:{ fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5 },
  card:        { borderWidth: 1, borderRadius: 18, padding: 16 },
  cardTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar:      { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#ffffff' },
  visitorName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 3 },
  projectName: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginBottom: 7 },
  metaRow:     { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  metaText:    { fontFamily: 'Inter_400Regular', fontSize: 10 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  statusText:  { fontFamily: 'Inter_700Bold', fontSize: 9 },
  msgBox:      { borderRadius: 10, padding: 10 },
  msgLabel:    { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1.2, marginBottom: 3 },
  msgText:     { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  actions:     { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  actionBtnText:{ fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  emptyWrap:   { borderWidth: 1, borderRadius: 18, padding: 32, alignItems: 'center', gap: 10, borderStyle: 'dashed' },
  emptyTitle:  { fontFamily: 'Inter_700Bold', fontSize: 16 },
  emptyDesc:   { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' },
});
