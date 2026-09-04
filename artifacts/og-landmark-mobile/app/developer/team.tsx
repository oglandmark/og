/**
 * Developer Portal — Team Management
 * Add, toggle, and manage your sales team members.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, View,
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
  TeamMember, TeamRole, TEAM_ROLES, newMemberId, roleColor,
  getTeamMembers, saveTeamMember, toggleMemberActive, deleteTeamMember,
} from '@/lib/teamStore';
import { getDevLeads } from '@/lib/devLeadsStore';

export default function TeamScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tr } = useLanguage();
  const router  = useRouter();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const [members, setMembers]         = useState<TeamMember[]>([]);
  const [leadCounts, setLeadCounts]   = useState<Record<string, number>>({});
  const [showForm, setShowForm]       = useState(false);
  const [saving, setSaving]           = useState(false);

  // Form state
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole]   = useState<TeamRole>('Sales Rep');

  const reload = useCallback(() => {
    void getTeamMembers(user?.id ?? '').then(setMembers);
    void getDevLeads(user?.id ?? '').then((leads) => {
      const counts: Record<string, number> = {};
      leads.forEach((l) => {
        if (l.assignedTo && l.assignedTo !== 'Self') {
          counts[l.assignedTo] = (counts[l.assignedTo] ?? 0) + 1;
        }
      });
      setLeadCounts(counts);
    });
  }, [user?.id]);

  useFocusEffect(reload);

  const resetForm = () => { setName(''); setPhone(''); setEmail(''); setRole('Sales Rep'); };

  const handleSave = async () => {
    if (!name.trim())  { Alert.alert('', tr('errTeamName'));  return; }
    if (!phone.trim()) { Alert.alert('', tr('errTeamPhone')); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const member: TeamMember = {
      id: newMemberId(), developerId: user?.id ?? '',
      name: name.trim(), phone: phone.trim(), email: email.trim(),
      role, active: true, createdAt: now, updatedAt: now,
    };
    await saveTeamMember(member);
    resetForm();
    setShowForm(false);
    reload();
    setSaving(false);
  };

  const handleToggle = async (id: string) => {
    const updated = await toggleMemberActive(id, user?.id ?? '');
    setMembers(updated);
  };

  const handleDelete = (id: string, memberName: string) => {
    Alert.alert(`Remove ${memberName}?`, 'This will remove them from your team.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await deleteTeamMember(id); reload(); } },
    ]);
  };

  const activeCount   = members.filter((m) => m.active).length;
  const totalLeadsAssigned = Object.values(leadCounts).reduce((s, c) => s + c, 0);

  return (
    <KeyboardAvoidingView
      style={[tm.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad + 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ────────────────────────────────────── */}
        <AnimatedReveal>
          <View style={[tm.header, { paddingTop: topPad + 12, paddingHorizontal: 20 }]}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={[tm.backBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[tm.eyebrow, { color: colors.action }]}>DEVELOPER PORTAL</Text>
              <Text style={[tm.title, { color: colors.foreground }]}>{tr('teamTitle')}</Text>
            </View>
            <Pressable
              onPress={() => { setShowForm(!showForm); resetForm(); }}
              style={[tm.addBtn, { backgroundColor: showForm ? colors.secondary : colors.action }]}
            >
              <Feather name={showForm ? 'x' : 'user-plus'} size={14} color={showForm ? colors.foreground : '#ffffff'} />
              <Text style={[tm.addBtnText, { color: showForm ? colors.foreground : '#ffffff' }]}>
                {showForm ? 'Cancel' : tr('addTeamMemberBtn')}
              </Text>
            </Pressable>
          </View>
          <Text style={[tm.subtitle, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 4, marginBottom: 16 }]}>
            {tr('teamSubtitle')}
          </Text>
        </AnimatedReveal>

        {/* ── Stats banner ──────────────────────────────── */}
        <AnimatedReveal delay={40}>
          <View style={[tm.banner, { backgroundColor: colors.action, marginHorizontal: 20 }]}>
            {[
              { label: 'Total Members',       value: members.length },
              { label: tr('teamActiveLabel'), value: activeCount },
              { label: 'Leads Assigned',      value: totalLeadsAssigned },
            ].map((s, i) => (
              <View key={s.label} style={[tm.bannerItem, i < 2 && { borderRightWidth: 1, borderRightColor: '#ffffff22' }]}>
                <Text style={tm.bannerValue}>{s.value}</Text>
                <Text style={tm.bannerLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </AnimatedReveal>

        {/* ── Add member form ───────────────────────────── */}
        {showForm && (
          <AnimatedReveal delay={50}>
            <View style={[tm.formCard, { backgroundColor: colors.card, borderColor: colors.action + '44', marginHorizontal: 20, marginTop: 16 }]}>
              <Text style={[tm.formTitle, { color: colors.foreground }]}>New Team Member</Text>

              {[
                { label: `${tr('teamMemberName')} *`, value: name, set: setName, placeholder: 'Full name', kbType: 'default' as const },
                { label: `${tr('teamMemberPhone')} *`, value: phone, set: setPhone, placeholder: '030X-XXXXXXX', kbType: 'phone-pad' as const },
                { label: tr('teamMemberEmail'), value: email, set: setEmail, placeholder: 'email@example.com', kbType: 'email-address' as const },
              ].map((f) => (
                <View key={f.label} style={tm.fWrap}>
                  <Text style={[tm.fLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                  <TextInput
                    value={f.value} onChangeText={f.set}
                    placeholder={f.placeholder} keyboardType={f.kbType}
                    placeholderTextColor={colors.mutedForeground + '77'}
                    style={[tm.fInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                  />
                </View>
              ))}

              {/* Role select */}
              <View style={tm.fWrap}>
                <Text style={[tm.fLabel, { color: colors.mutedForeground }]}>{tr('teamMemberRole')}</Text>
                <View style={tm.roleGrid}>
                  {TEAM_ROLES.map((r) => {
                    const rc = roleColor(r);
                    return (
                      <Pressable key={r} onPress={() => setRole(r)}
                        style={[tm.roleChip, {
                          borderColor: role === r ? rc.text : colors.border,
                          backgroundColor: role === r ? rc.bg : colors.secondary,
                        }]}>
                        <Text style={[tm.roleChipText, { color: role === r ? rc.text : colors.mutedForeground }]}>{r}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable onPress={() => { void handleSave(); }} disabled={saving}
                style={[tm.saveBtn, { backgroundColor: colors.action }]}>
                <Feather name="check" size={15} color="#ffffff" />
                <Text style={tm.saveBtnText}>{saving ? 'Saving...' : tr('saveTeamMemberBtn')}</Text>
              </Pressable>
            </View>
          </AnimatedReveal>
        )}

        {/* ── Member list ───────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, gap: 12, marginTop: 20 }}>
          {members.length === 0 && !showForm ? (
            <AnimatedReveal delay={60}>
              <View style={[tm.emptyWrap, { borderColor: colors.border }]}>
                <View style={[tm.emptyIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name="users" size={36} color={colors.mutedForeground} />
                </View>
                <Text style={[tm.emptyTitle, { color: colors.foreground }]}>{tr('noTeamYet')}</Text>
                <Text style={[tm.emptyDesc, { color: colors.mutedForeground }]}>{tr('noTeamDesc')}</Text>
                <Pressable onPress={() => setShowForm(true)} style={[tm.emptyBtn, { backgroundColor: colors.action }]}>
                  <Feather name="user-plus" size={14} color="#ffffff" />
                  <Text style={tm.emptyBtnText}>{tr('addTeamMemberBtn')}</Text>
                </Pressable>
              </View>
            </AnimatedReveal>
          ) : (
            members.map((m, i) => {
              const rc = roleColor(m.role);
              const leadsCount = leadCounts[m.name] ?? 0;
              return (
                <AnimatedReveal key={m.id} delay={60 + i * 40}>
                  <View style={[tm.memberCard, { backgroundColor: colors.card, borderColor: m.active ? colors.border : colors.border + '55', opacity: m.active ? 1 : 0.65 }]}>
                    <View style={tm.memberTop}>
                      {/* Avatar */}
                      <View style={[tm.avatar, { backgroundColor: colors.action }]}>
                        <Text style={tm.avatarText}>{m.name[0]}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text style={[tm.memberName, { color: colors.foreground }]}>{m.name}</Text>
                          <View style={[tm.roleBadge, { backgroundColor: rc.bg }]}>
                            <Text style={[tm.roleBadgeText, { color: rc.text }]}>{m.role}</Text>
                          </View>
                          {!m.active && (
                            <View style={[tm.inactiveBadge, { backgroundColor: colors.secondary }]}>
                              <Text style={[tm.inactiveBadgeText, { color: colors.mutedForeground }]}>{tr('teamInactiveLabel')}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[tm.memberPhone, { color: colors.mutedForeground }]}>{m.phone}</Text>
                        {m.email ? <Text style={[tm.memberEmail, { color: colors.mutedForeground }]}>{m.email}</Text> : null}
                      </View>
                      {/* Leads count badge */}
                      <View style={[tm.leadsBadge, { backgroundColor: colors.action + '18' }]}>
                        <Text style={[tm.leadsCount, { color: colors.action }]}>{leadsCount}</Text>
                        <Text style={[tm.leadsLabel, { color: colors.mutedForeground }]}>{tr('assignedLeadsLabel')}</Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={[tm.memberActions, { borderTopColor: colors.border }]}>
                      <Pressable onPress={() => { void handleToggle(m.id); }}
                        style={[tm.memberActionBtn, { backgroundColor: m.active ? colors.secondary : '#1a6b3a18' }]}>
                        <Feather name={m.active ? 'pause-circle' : 'play-circle'} size={13} color={m.active ? colors.mutedForeground : '#1a6b3a'} />
                        <Text style={[tm.memberActionText, { color: m.active ? colors.mutedForeground : '#1a6b3a' }]}>
                          {m.active ? tr('teamInactiveLabel') : tr('teamActiveLabel')}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => handleDelete(m.id, m.name)}
                        style={[tm.memberActionBtn, { backgroundColor: '#dc262610' }]}>
                        <Feather name="user-x" size={13} color="#dc2626" />
                        <Text style={[tm.memberActionText, { color: '#dc2626' }]}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                </AnimatedReveal>
              );
            })
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const tm = StyleSheet.create({
  screen:          { flex: 1 },
  header:          { flexDirection: 'row', alignItems: 'center' },
  backBtn:         { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow:         { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title:           { fontFamily: 'Inter_700Bold', fontSize: 22 },
  subtitle:        { fontFamily: 'Inter_400Regular', fontSize: 12 },
  addBtn:          { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  addBtnText:      { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  banner:          { borderRadius: 16, flexDirection: 'row', marginBottom: 4 },
  bannerItem:      { flex: 1, alignItems: 'center', paddingVertical: 14 },
  bannerValue:     { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#ffffff', letterSpacing: -0.3 },
  bannerLabel:     { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#ffffff99', marginTop: 1 },
  formCard:        { borderWidth: 1.5, borderRadius: 18, padding: 16, gap: 14 },
  formTitle:       { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 4 },
  fWrap:           { gap: 6 },
  fLabel:          { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.3 },
  fInput:          { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 14 },
  roleGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  roleChip:        { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  roleChipText:    { fontFamily: 'Inter_500Medium', fontSize: 11 },
  saveBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 13 },
  saveBtnText:     { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' },
  emptyWrap:       { borderWidth: 1, borderRadius: 18, padding: 36, alignItems: 'center', gap: 12, borderStyle: 'dashed' },
  emptyIcon:       { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:      { fontFamily: 'Inter_700Bold', fontSize: 17 },
  emptyDesc:       { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
  emptyBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, marginTop: 4 },
  emptyBtnText:    { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' },
  memberCard:      { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  memberTop:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  avatar:          { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText:      { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#ffffff' },
  memberName:      { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 2 },
  memberPhone:     { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  memberEmail:     { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 1 },
  roleBadge:       { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeText:   { fontFamily: 'Inter_700Bold', fontSize: 9 },
  inactiveBadge:   { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  inactiveBadgeText:{ fontFamily: 'Inter_400Regular', fontSize: 9 },
  leadsBadge:      { alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  leadsCount:      { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.5 },
  leadsLabel:      { fontFamily: 'Inter_400Regular', fontSize: 9 },
  memberActions:   { flexDirection: 'row', borderTopWidth: 1, gap: 0 },
  memberActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11 },
  memberActionText:{ fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});
