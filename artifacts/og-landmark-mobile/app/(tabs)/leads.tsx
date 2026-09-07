import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Linking, Platform, Pressable, ScrollView,
  StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { BrandMark } from '@/components/BrandMark';
import { type Lead, type LeadStatus, getLeads, updateLeadStatus, updateLeadNotes } from '@/lib/leadsStore';
import {
  DevLead, DevLeadStatus,
  DEV_STAGE_CONFIG, DEV_STAGES, DEV_LEAD_SOURCES,
  calcDevLeadStats, getDevLeads, updateDevLeadStatus, updateDevLeadNotes, deleteDevLead,
} from '@/lib/devLeadsStore';

// ── Agent CRM config ──────────────────────────────────────────────────────────
const statusConfig: Record<LeadStatus, { color: string; label: string }> = {
  new:        { color: '#059669', label: 'New' },
  contacted:  { color: '#102a43', label: 'Contacted' },
  interested: { color: '#c8a45a', label: 'Interested' },
  viewing:    { color: '#7c3aed', label: 'Viewing' },
  closed:     { color: '#6b7280', label: 'Closed' },
};
const ALL_STATUSES: LeadStatus[] = ['new', 'contacted', 'interested', 'viewing', 'closed'];

function dialNumber(phone: string) {
  Linking.openURL('tel:' + phone.replace(/[^0-9]/g, '')).catch(() =>
    Alert.alert('Cannot open dialer', 'Please dial ' + phone + ' manually.')
  );
}
function openWhatsApp(phone: string) {
  const cleaned = phone.replace(/[^0-9]/g, '');
  const intl = cleaned.startsWith('0') ? '92' + cleaned.slice(1) : cleaned;
  Linking.openURL('https://wa.me/' + intl).catch(() =>
    Alert.alert('WhatsApp not installed', 'Please contact via phone: ' + phone)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  DEVELOPER CRM
// ─────────────────────────────────────────────────────────────────────────────
function DeveloperCRM() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tr, isRTL } = useLanguage();
  const router = useRouter();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);
  const rtl = isRTL ? 'right' as const : 'left' as const;

  const [leads, setLeads]         = useState<DevLead[]>([]);
  const [filter, setFilter]       = useState<'all' | DevLeadStatus>('all');
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [noteEditId, setNoteEditId] = useState<string | null>(null);
  const [noteText, setNoteText]   = useState('');

  useFocusEffect(useCallback(() => {
    void getDevLeads(user?.id ?? '').then(setLeads);
  }, [user?.id]));

  const handleUpdateStage = async (id: string, status: DevLeadStatus) => {
    const updated = await updateDevLeadStatus(id, status, user?.id ?? '');
    setLeads(updated);
  };

  const saveNote = async (id: string) => {
    const updated = await updateDevLeadNotes(id, noteText, user?.id ?? '');
    setLeads(updated);
    setNoteEditId(null);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`Delete lead "${name}"?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteDevLead(id);
          setLeads((prev) => prev.filter((l) => l.id !== id));
        },
      },
    ]);
  };

  const stats = calcDevLeadStats(leads);
  const filtered = filter === 'all' ? leads : leads.filter((l) => l.status === filter);
  const filterTabs: { key: 'all' | DevLeadStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: tr('devLeadStageNew') },
    { key: 'contacted', label: tr('devLeadStageContacted') },
    { key: 'interested', label: tr('devLeadStageInterested') },
    { key: 'site_visit', label: tr('devLeadStageSiteVisit') },
    { key: 'negotiation', label: tr('devLeadStageNegotiation') },
    { key: 'booking', label: tr('devLeadStageBooking') },
    { key: 'won', label: tr('devLeadStageWon') },
    { key: 'lost', label: tr('devLeadStageLost') },
  ];

  return (
    <View style={[d.screen, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: botPad + 96 }}>

        {/* ── Header ───────────────────────────────────── */}
        <AnimatedReveal>
          <View style={[d.header, { paddingTop: topPad + 12, paddingHorizontal: 20 }]}>
            <BrandMark />
            <Pressable
              onPress={() => router.push('/developer/add-dev-lead' as Parameters<typeof router.push>[0])}
              style={[d.addBtn, { backgroundColor: colors.action }]}
            >
              <Feather name="plus" size={14} color="#ffffff" />
              <Text style={d.addBtnText}>{tr('addDevLeadBtn')}</Text>
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 20, marginTop: 16, marginBottom: 12 }}>
            <Text style={[d.title, { color: colors.foreground, textAlign: rtl }]}>{tr('devLeadsTitle')}</Text>
            <Text style={[d.subtitle, { color: colors.mutedForeground, textAlign: rtl }]}>{tr('devLeadsSubtitle')}</Text>
          </View>
        </AnimatedReveal>

        {/* ── Summary strip ─────────────────────────────── */}
        <AnimatedReveal delay={50}>
          <View style={[d.strip, { backgroundColor: colors.action, marginHorizontal: 20 }]}>
            {[
              { icon: 'users'       as const, label: 'Total',             value: stats.total },
              { icon: 'bell'        as const, label: tr('devLeadStageNew'), value: stats.newCount },
              { icon: 'check-circle'as const, label: tr('devLeadWon'),     value: stats.wonCount },
              { icon: 'x-circle'   as const,  label: tr('devLeadLost'),    value: stats.lostCount },
            ].map((s, i) => (
              <View key={s.label} style={[d.stripItem, i < 3 && { borderRightWidth: 1, borderRightColor: '#ffffff22' }]}>
                <Feather name={s.icon} size={12} color="#ffffffbb" style={{ marginBottom: 3 }} />
                <Text style={d.stripValue}>{s.value}</Text>
                <Text style={d.stripLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </AnimatedReveal>

        {/* ── Stage filter tabs ─────────────────────────── */}
        <AnimatedReveal delay={60}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={d.tabsRow}>
            {filterTabs.map((t) => {
              const active = filter === t.key;
              const stageColor = t.key !== 'all' ? DEV_STAGE_CONFIG[t.key].color : colors.action;
              return (
                <Pressable key={t.key} onPress={() => setFilter(t.key)}
                  style={[d.tab, {
                    borderColor: active ? stageColor : colors.border,
                    backgroundColor: active ? stageColor + '1a' : 'transparent',
                  }]}>
                  <Text style={[d.tabText, { color: active ? stageColor : colors.mutedForeground }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </AnimatedReveal>

        {/* ── Lead cards ────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, gap: 12, marginTop: 4 }}>
          {filtered.length === 0 ? (
            <AnimatedReveal delay={80}>
              <View style={[d.emptyWrap, { borderColor: colors.border }]}>
                <Feather name="users" size={36} color={colors.mutedForeground} />
                <Text style={[d.emptyTitle, { color: colors.foreground }]}>No Leads</Text>
                <Text style={[d.emptyDesc, { color: colors.mutedForeground }]}>
                  {filter === 'all' ? 'Add your first project lead.' : 'No leads in this stage.'}
                </Text>
              </View>
            </AnimatedReveal>
          ) : (
            filtered.map((lead, i) => {
              const isExpanded  = expanded === lead.id;
              const sc          = DEV_STAGE_CONFIG[lead.status];
              const isNoteEdit  = noteEditId === lead.id;
              return (
                <AnimatedReveal key={lead.id} delay={80 + i * 40}>
                  <Pressable
                    onPress={() => setExpanded(isExpanded ? null : lead.id)}
                    style={[d.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    {/* Collapsed top row */}
                    <View style={d.cardTop}>
                      <View style={[d.avatar, { backgroundColor: colors.action }]}>
                        <Text style={d.avatarText}>{lead.name[0]}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={d.nameRow}>
                          <Text style={[d.leadName, { color: colors.foreground }]} numberOfLines={1}>{lead.name}</Text>
                          <View style={[d.stageBadge, { backgroundColor: sc.color + '1a' }]}>
                            <View style={[d.stageDot, { backgroundColor: sc.color }]} />
                            <Text style={[d.stageText, { color: sc.color }]}>{sc.label}</Text>
                          </View>
                        </View>
                        <Text style={[d.projectRow, { color: colors.action, textAlign: rtl }]} numberOfLines={1}>
                          {lead.interestedProject}{lead.interestedUnit ? ` · ${lead.interestedUnit}` : ''}
                        </Text>
                        <View style={d.metaRow}>
                          {lead.budget ? (
                            <View style={[d.metaChip, { backgroundColor: colors.secondary }]}>
                              <Text style={[d.metaChipText, { color: colors.mutedForeground }]}>PKR {lead.budget}</Text>
                            </View>
                          ) : null}
                          {lead.source ? (
                            <View style={[d.metaChip, { backgroundColor: colors.action + '12' }]}>
                              <Text style={[d.metaChipText, { color: colors.action }]}>{lead.source}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                    </View>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <View style={[d.detail, { borderTopColor: colors.border }]}>

                        {/* Info chips */}
                        <View style={d.infoRow}>
                          {lead.phone ? (
                            <View style={[d.infoChip, { backgroundColor: colors.secondary }]}>
                              <Feather name="phone" size={10} color={colors.mutedForeground} />
                              <Text style={[d.infoChipText, { color: colors.mutedForeground }]}>{lead.phone}</Text>
                            </View>
                          ) : null}
                          {lead.assignedTo ? (
                            <View style={[d.infoChip, { backgroundColor: colors.secondary }]}>
                              <Feather name="user" size={10} color={colors.mutedForeground} />
                              <Text style={[d.infoChipText, { color: colors.mutedForeground }]}>{lead.assignedTo}</Text>
                            </View>
                          ) : null}
                          {lead.nextFollowUp ? (
                            <View style={[d.infoChip, { backgroundColor: '#c8a45a18' }]}>
                              <Feather name="calendar" size={10} color="#c8a45a" />
                              <Text style={[d.infoChipText, { color: '#c8a45a' }]}>{lead.nextFollowUp}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Notes */}
                        {isNoteEdit ? (
                          <View style={[d.noteBox, { backgroundColor: colors.secondary, borderColor: colors.action + '44' }]}>
                            <Text style={[d.noteLabel, { color: colors.mutedForeground }]}>NOTES</Text>
                            <TextInput
                              value={noteText}
                              onChangeText={setNoteText}
                              multiline autoFocus
                              placeholder="Add a note..."
                              placeholderTextColor={colors.mutedForeground}
                              style={[d.noteInput, { color: colors.foreground }]}
                            />
                            <View style={d.noteActions}>
                              <Pressable onPress={() => setNoteEditId(null)} style={[d.noteCancelBtn, { borderColor: colors.border }]}>
                                <Text style={[d.noteCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
                              </Pressable>
                              <Pressable onPress={() => { void saveNote(lead.id); }} style={[d.noteSaveBtn, { backgroundColor: colors.action }]}>
                                <Text style={d.noteSaveText}>Save</Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : lead.notes ? (
                          <Pressable
                            onPress={() => { setNoteText(lead.notes); setNoteEditId(lead.id); }}
                            style={[d.noteRead, { backgroundColor: colors.secondary }]}
                          >
                            <Text style={[d.noteLabel, { color: colors.mutedForeground }]}>NOTES</Text>
                            <Text style={[d.noteText, { color: colors.foreground }]}>{lead.notes}</Text>
                            <Text style={[d.editHint, { color: colors.action }]}>Tap to edit</Text>
                          </Pressable>
                        ) : null}

                        {/* Action buttons */}
                        <View style={d.actions}>
                          <Pressable onPress={() => dialNumber(lead.phone)} style={[d.actionBtn, { backgroundColor: colors.action }]}>
                            <Feather name="phone" size={12} color="#ffffff" />
                            <Text style={[d.actionBtnText, { color: '#ffffff' }]}>Call</Text>
                          </Pressable>
                          <Pressable onPress={() => openWhatsApp(lead.phone)} style={[d.actionBtn, { backgroundColor: '#25d36618' }]}>
                            <Feather name="message-circle" size={12} color="#25d366" />
                            <Text style={[d.actionBtnText, { color: '#25d366' }]}>WhatsApp</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => { setNoteText(lead.notes); setNoteEditId(lead.id); }}
                            style={[d.actionBtn, { backgroundColor: colors.secondary }]}
                          >
                            <Feather name="edit-3" size={12} color={colors.mutedForeground} />
                            <Text style={[d.actionBtnText, { color: colors.mutedForeground }]}>Note</Text>
                          </Pressable>
                        </View>

                        {/* Stage pipeline */}
                        <Text style={[d.stageLabel, { color: colors.mutedForeground }]}>{tr('devLeadUpdateStage')}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                          {DEV_STAGES.map((s) => {
                            const active = lead.status === s;
                            const cfg = DEV_STAGE_CONFIG[s];
                            return (
                              <Pressable
                                key={s}
                                onPress={() => { void handleUpdateStage(lead.id, s); }}
                                style={[d.stageChip, {
                                  borderColor: active ? cfg.color : colors.border,
                                  backgroundColor: active ? cfg.color + '1a' : 'transparent',
                                }]}
                              >
                                {active && <View style={[d.stageChipDot, { backgroundColor: cfg.color }]} />}
                                <Text style={[d.stageChipText, { color: active ? cfg.color : colors.mutedForeground }]}>
                                  {cfg.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>

                        {/* Delete */}
                        <Pressable
                          onPress={() => handleDelete(lead.id, lead.name)}
                          style={[d.deleteBtn, { borderColor: '#dc262633' }]}
                        >
                          <Feather name="trash-2" size={12} color="#dc2626" />
                          <Text style={[d.deleteBtnText, { color: '#dc2626' }]}>Delete Lead</Text>
                        </Pressable>
                      </View>
                    )}
                  </Pressable>
                </AnimatedReveal>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── FAB ───────────────────────────────────────── */}
      <Pressable
        onPress={() => router.push('/developer/add-dev-lead' as Parameters<typeof router.push>[0])}
        style={[d.fab, { backgroundColor: colors.action, bottom: botPad + 90 }]}
      >
        <Feather name="plus" size={24} color="#ffffff" />
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function LeadsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tr, isRTL } = useLanguage();
  const { role } = useAuth();

  // ── Developer branch ─────────────────────────────────────────────────────
  if (role === 'developer') {
    return <DeveloperCRM />;
  }

  // ── Agent CRM (unchanged) ────────────────────────────────────────────────
  const [filter, setFilter]           = useState<'all' | LeadStatus>('all');
  const [expanded, setExpanded]       = useState<number | null>(null);
  const [leads, setLeads]             = useState<Lead[]>([]);
  const [noteEditId, setNoteEditId]   = useState<number | null>(null);
  const [noteText, setNoteText]       = useState('');

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);
  const rtl = isRTL ? 'right' as const : 'left' as const;

  useEffect(() => { getLeads().then(setLeads); }, []);

  const handleUpdateStatus = async (id: number, status: LeadStatus) => {
    setLeads(await updateLeadStatus(id, status));
  };
  const saveNote = async (id: number) => {
    setLeads(await updateLeadNotes(id, noteText));
    setNoteEditId(null);
  };
  const openNote = (lead: Lead) => { setNoteText(lead.notes); setNoteEditId(lead.id); };

  const filterTabs: { key: 'all' | LeadStatus; label: string }[] = [
    { key: 'all', label: tr('allLeads') },
    { key: 'new', label: tr('leadNew') },
    { key: 'interested', label: tr('leadInterested') },
    { key: 'contacted', label: tr('leadContacted') },
    { key: 'viewing', label: tr('leadViewing') },
    { key: 'closed', label: tr('leadClosed') },
  ];
  const filtered   = filter === 'all' ? leads : leads.filter((l) => l.status === filter);
  const newCount   = leads.filter((l) => l.status === 'new').length;
  const totalCount = leads.length;
  const closedCount= leads.filter((l) => l.status === 'closed').length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: botPad + 96 }}>
        <AnimatedReveal>
          <View style={[styles.header, { paddingTop: topPad + 12, paddingHorizontal: 20, paddingBottom: 8 }]}>
            <BrandMark />
            <Pressable
              onPress={() => setFilter(filter === 'new' ? 'all' : 'new')}
              style={({ pressed }) => [styles.newBadge, { backgroundColor: newCount > 0 ? colors.action : colors.secondary, opacity: pressed ? 0.75 : 1 }]}
            >
              <Feather name="bell" size={10} color={newCount > 0 ? colors.actionForeground : colors.mutedForeground} />
              {newCount > 0 ? (
                <Text style={[styles.newBadgeText, { color: colors.actionForeground }]}>{newCount} {tr('newLeadsLabel')}</Text>
              ) : (
                <Text style={[styles.newBadgeText, { color: colors.mutedForeground }]}>{tr('leadsTitle')}</Text>
              )}
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 20, marginBottom: 12, marginTop: 16 }}>
            <Text style={[styles.title, { color: colors.foreground, textAlign: rtl }]}>{tr('leadsTitle')}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: rtl }]}>{tr('leadsSubtitle')}</Text>
          </View>
        </AnimatedReveal>

        <AnimatedReveal delay={50}>
          <View style={[styles.summaryStrip, { marginHorizontal: 20, backgroundColor: colors.action }]}>
            {[
              { icon: 'users' as const, label: 'Total Leads', value: String(totalCount) },
              { icon: 'bell' as const, label: 'New', value: String(newCount) },
              { icon: 'check-circle' as const, label: 'Closed', value: String(closedCount) },
            ].map((s, i) => (
              <View key={s.label} style={[styles.summaryItem, i < 2 && { borderRightWidth: 1, borderRightColor: '#ffffff22' }]}>
                <Feather name={s.icon} size={14} color="#ffffffbb" style={{ marginBottom: 4 }} />
                <Text style={styles.summaryValue}>{s.value}</Text>
                <Text style={styles.summaryLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </AnimatedReveal>

        <AnimatedReveal delay={60}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {filterTabs.map((t) => (
              <Pressable key={t.key} onPress={() => setFilter(t.key)}
                style={[styles.tabChip, { borderColor: filter === t.key ? colors.action : colors.border, backgroundColor: filter === t.key ? colors.action : 'transparent' }]}>
                <Text style={[styles.tabChipText, { color: filter === t.key ? colors.actionForeground : colors.mutedForeground }]}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </AnimatedReveal>

        <View style={{ paddingHorizontal: 20, gap: 12, marginTop: 6 }}>
          {filtered.length === 0 ? (
            <AnimatedReveal delay={80}>
              <View style={[styles.emptyState, { borderColor: colors.border }]}>
                <Feather name="users" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Leads</Text>
                <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>No leads in this category yet.</Text>
              </View>
            </AnimatedReveal>
          ) : filtered.map((lead, i) => {
            const isExpanded  = expanded === lead.id;
            const sc          = statusConfig[lead.status];
            const isNoteEditing = noteEditId === lead.id;
            return (
              <AnimatedReveal key={lead.id} delay={80 + i * 50}>
                <Pressable onPress={() => setExpanded(isExpanded ? null : lead.id)}
                  style={[styles.leadCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.leadTop}>
                    <View style={[styles.leadAvatar, { backgroundColor: colors.action }]}>
                      <Text style={styles.leadAvatarText}>{lead.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.nameRow, isRTL && { flexDirection: 'row-reverse' }]}>
                        <Text style={[styles.leadName, { color: colors.foreground }]}>{lead.name}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: sc.color + '1a' }]}>
                          <View style={[styles.statusDot, { backgroundColor: sc.color }]} />
                          <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                        </View>
                      </View>
                      <Text style={[styles.leadProp, { color: colors.mutedForeground, textAlign: rtl }]}>{lead.property}</Text>
                      <Text style={[styles.leadTime, { color: colors.mutedForeground, textAlign: rtl }]}>{lead.time}</Text>
                    </View>
                    <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                  </View>
                  {isExpanded && (
                    <View style={[styles.leadDetail, { borderTopColor: colors.border }]}>
                      <View style={styles.infoRow}>
                        {[{ icon: 'map-pin' as const, val: lead.area }, { icon: 'dollar-sign' as const, val: lead.budget }, { icon: 'phone' as const, val: lead.phone }].map(({ icon, val }) => (
                          <View key={icon} style={[styles.infoChip, { backgroundColor: colors.secondary }]}>
                            <Feather name={icon} size={11} color={colors.mutedForeground} />
                            <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>{val}</Text>
                          </View>
                        ))}
                      </View>
                      {isNoteEditing ? (
                        <View style={[styles.noteEditBox, { backgroundColor: colors.secondary, borderColor: colors.action + '44' }]}>
                          <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>{tr('leadsNotes')}</Text>
                          <TextInput style={[styles.noteInput, { color: colors.foreground }]} value={noteText} onChangeText={setNoteText} multiline autoFocus placeholder="Add a note..." placeholderTextColor={colors.mutedForeground} />
                          <View style={styles.noteActions}>
                            <Pressable onPress={() => setNoteEditId(null)} style={[styles.noteCancelBtn, { borderColor: colors.border }]}><Text style={[styles.noteCancelText, { color: colors.mutedForeground }]}>Cancel</Text></Pressable>
                            <Pressable onPress={() => { void saveNote(lead.id); }} style={[styles.noteSaveBtn, { backgroundColor: colors.action }]}><Text style={[styles.noteSaveText, { color: colors.actionForeground }]}>Save Note</Text></Pressable>
                          </View>
                        </View>
                      ) : lead.notes ? (
                        <Pressable onPress={() => openNote(lead)} style={[styles.notesBox, { backgroundColor: colors.secondary }]}>
                          <Text style={[styles.notesLabel, { color: colors.mutedForeground, textAlign: rtl }]}>{tr('leadsNotes')}</Text>
                          <Text style={[styles.notesText, { color: colors.foreground, textAlign: rtl }]}>{lead.notes}</Text>
                          <Text style={[styles.editNoteHint, { color: colors.action }]}>Tap to edit</Text>
                        </Pressable>
                      ) : null}
                      <View style={[styles.actions, isRTL && { flexDirection: 'row-reverse' }]}>
                        <Pressable onPress={() => dialNumber(lead.phone)} style={[styles.actionBtn, { backgroundColor: colors.action }]}><Feather name="phone" size={13} color={colors.actionForeground} /><Text style={[styles.actionBtnText, { color: colors.actionForeground }]}>{tr('actionCall')}</Text></Pressable>
                        <Pressable onPress={() => openWhatsApp(lead.phone)} style={[styles.actionBtn, { backgroundColor: '#25d36618' }]}><Feather name="message-circle" size={13} color="#25d366" /><Text style={[styles.actionBtnText, { color: '#25d366' }]}>WhatsApp</Text></Pressable>
                        <Pressable onPress={() => openNote(lead)} style={[styles.actionBtn, { backgroundColor: colors.secondary }]}><Feather name="edit-3" size={13} color={colors.mutedForeground} /><Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>{tr('actionNote')}</Text></Pressable>
                      </View>
                      <Text style={[styles.updateLabel, { color: colors.mutedForeground, textAlign: rtl }]}>{tr('updateStatus')}</Text>
                      <View style={styles.statusRow}>
                        {ALL_STATUSES.map((s) => {
                          const isActive = lead.status === s;
                          const cfg = statusConfig[s];
                          return (
                            <Pressable key={s} onPress={() => { void handleUpdateStatus(lead.id, s); }}
                              style={[styles.statusChip, { borderColor: isActive ? cfg.color : colors.border, backgroundColor: isActive ? cfg.color + '1a' : 'transparent' }]}>
                              {isActive && <View style={[styles.statusChipDot, { backgroundColor: cfg.color }]} />}
                              <Text style={[styles.statusChipText, { color: isActive ? cfg.color : colors.mutedForeground }]}>{cfg.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </Pressable>
              </AnimatedReveal>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STYLES — Developer CRM
// ─────────────────────────────────────────────────────────────────────────────
const d = StyleSheet.create({
  screen:       { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 0 },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 },
  addBtnText:   { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ffffff' },
  title:        { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.3, marginBottom: 4 },
  subtitle:     { fontFamily: 'Inter_400Regular', fontSize: 12 },
  strip:        { borderRadius: 16, flexDirection: 'row', marginBottom: 16, marginTop: 4 },
  stripItem:    { flex: 1, alignItems: 'center', paddingVertical: 14 },
  stripValue:   { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#ffffff', letterSpacing: -0.3 },
  stripLabel:   { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#ffffff99', marginTop: 1 },
  tabsRow:      { paddingHorizontal: 20, paddingBottom: 14, gap: 8, flexDirection: 'row' },
  tab:          { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 7 },
  tabText:      { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  emptyWrap:    { borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', padding: 36, alignItems: 'center', gap: 10, marginTop: 20 },
  emptyTitle:   { fontFamily: 'Inter_700Bold', fontSize: 16 },
  emptyDesc:    { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' },
  card:         { borderRadius: 18, borderWidth: 1, padding: 16 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:       { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#ffffff' },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 },
  leadName:     { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  stageBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  stageDot:     { width: 5, height: 5, borderRadius: 3 },
  stageText:    { fontFamily: 'Inter_700Bold', fontSize: 9 },
  projectRow:   { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginBottom: 6 },
  metaRow:      { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaChip:     { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  metaChipText: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  detail:       { borderTopWidth: 1, marginTop: 14, paddingTop: 14, gap: 12 },
  infoRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  infoChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  infoChipText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  noteBox:      { borderRadius: 12, padding: 12, borderWidth: 1 },
  noteRead:     { borderRadius: 12, padding: 12 },
  noteLabel:    { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2, marginBottom: 4 },
  noteInput:    { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, minHeight: 70, marginTop: 8, marginBottom: 10 },
  noteText:     { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 4 },
  editHint:     { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  noteActions:  { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  noteCancelBtn:{ borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  noteCancelText:{ fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  noteSaveBtn:  { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  noteSaveText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ffffff' },
  actions:      { flexDirection: 'row', gap: 8 },
  actionBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, paddingVertical: 10 },
  actionBtnText:{ fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  stageLabel:   { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2 },
  stageChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 6 },
  stageChipDot: { width: 5, height: 5, borderRadius: 3 },
  stageChipText:{ fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  deleteBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 10 },
  deleteBtnText:{ fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  fab:          { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
});

// ─────────────────────────────────────────────────────────────────────────────
//  STYLES — Agent CRM (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:       { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  newBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  title:        { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.3, marginBottom: 4 },
  subtitle:     { fontFamily: 'Inter_400Regular', fontSize: 12 },
  summaryStrip: { borderRadius: 16, flexDirection: 'row', marginBottom: 16, marginTop: 4 },
  summaryItem:  { flex: 1, alignItems: 'center', paddingVertical: 14 },
  summaryValue: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#ffffff', letterSpacing: -0.3 },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#ffffff99', marginTop: 1 },
  tabsRow:      { paddingHorizontal: 20, paddingBottom: 14, gap: 8, flexDirection: 'row' },
  tabChip:      { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 8 },
  tabChipText:  { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  emptyState:   { borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', padding: 36, alignItems: 'center', gap: 10, marginTop: 20 },
  emptyTitle:   { fontFamily: 'Inter_700Bold', fontSize: 16 },
  emptyDesc:    { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' },
  leadCard:     { borderRadius: 18, borderWidth: 1, padding: 16 },
  leadTop:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  leadAvatar:   { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  leadAvatarText:{ fontFamily: 'Inter_700Bold', fontSize: 16, color: '#ffffff' },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 },
  leadName:     { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot:    { width: 5, height: 5, borderRadius: 3 },
  statusText:   { fontFamily: 'Inter_700Bold', fontSize: 9 },
  leadProp:     { fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 2 },
  leadTime:     { fontFamily: 'Inter_400Regular', fontSize: 10 },
  leadDetail:   { borderTopWidth: 1, marginTop: 14, paddingTop: 14, gap: 12 },
  infoRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  infoChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  infoChipText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  notesBox:     { borderRadius: 12, padding: 12 },
  notesLabel:   { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2, marginBottom: 4 },
  notesText:    { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 4 },
  editNoteHint: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  noteEditBox:  { borderRadius: 12, padding: 12, borderWidth: 1 },
  noteInput:    { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, minHeight: 70, marginTop: 8, marginBottom: 10 },
  noteActions:  { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  noteCancelBtn:{ borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  noteCancelText:{ fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  noteSaveBtn:  { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  noteSaveText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ffffff' },
  actions:      { flexDirection: 'row', gap: 8 },
  actionBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, paddingVertical: 10 },
  actionBtnText:{ fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  updateLabel:  { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2 },
  statusRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  statusChip:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 6 },
  statusChipDot:{ width: 5, height: 5, borderRadius: 3 },
  statusChipText:{ fontFamily: 'Inter_600SemiBold', fontSize: 10 },
});
