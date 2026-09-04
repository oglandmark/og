/**
 * DEVELOPER — My Projects
 * Shows the developer's own projects loaded from developerStore.
 * Completely separate from the public curated-projects browsing screen.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert, Platform, Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// BlurView removed — crashes Android GPU
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import {
  DeveloperProject, ProjectStatus, getDevProjects, deleteDevProject,
  formatPKR, statusColor,
} from '@/lib/developerStore';

// ── Status label helper ───────────────────────────────────────────────────────
function statusLabel(status: ProjectStatus, tr: ReturnType<typeof useLanguage>['tr']): string {
  switch (status) {
    case 'Draft':             return tr('statusDraft');
    case 'Live':              return tr('statusLive');
    case 'Pending Review':    return tr('statusPendingReview');
    case 'Approved':          return tr('statusApproved');
    case 'Coming Soon':       return tr('statusComingSoon');
    case 'Under Development': return tr('statusUnderDevelopment');
    case 'Completed':         return tr('statusCompleted');
    case 'Paused':            return tr('statusPaused');
    case 'Archived':          return tr('statusArchived');
    default:                  return status;
  }
}

// ── Project card ──────────────────────────────────────────────────────────────
function ProjectCard({
  project, colors, tr, isRTL, onEdit, onDelete,
}: {
  project: DeveloperProject;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  tr: ReturnType<typeof useLanguage>['tr'];
  isRTL: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const rtl = isRTL ? 'right' as const : 'left' as const;
  const sc = statusColor(project.status);
  const label = statusLabel(project.status, tr);

  const handleMenu = () => {
    Alert.alert(project.name, '', [
      { text: tr('btnEditProject'), onPress: onEdit },
      { text: 'Delete Project', style: 'destructive', onPress: onDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={[card.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />

      {/* ── Header row ───────────────────────────────────── */}
      <View style={card.header}>
        <View style={[card.iconBox, { backgroundColor: colors.action + '18' }]}>
          <Feather name="layers" size={20} color={colors.action} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[card.name, { color: colors.foreground, textAlign: rtl }]} numberOfLines={1}>
            {project.name}
          </Text>
          <View style={card.metaRow}>
            <View style={[card.typePill, { backgroundColor: colors.secondary }]}>
              <Text style={[card.typeText, { color: colors.mutedForeground }]}>{project.type}</Text>
            </View>
            <View style={card.loc}>
              <Feather name="map-pin" size={9} color={colors.mutedForeground} />
              <Text style={[card.locText, { color: colors.mutedForeground }]}>{project.city}, Okara</Text>
            </View>
          </View>
        </View>
        <Pressable onPress={handleMenu} hitSlop={12} style={[card.menuBtn, { backgroundColor: colors.secondary }]}>
          <Feather name="more-vertical" size={15} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* ── Status + price row ───────────────────────────── */}
      <View style={card.statusPriceRow}>
        <View style={[card.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[card.statusText, { color: sc.text }]}>{label}</Text>
        </View>
        {project.startingPrice > 0 && (
          <Text style={[card.price, { color: colors.action }]}>
            {tr('startingFrom')} {formatPKR(project.startingPrice)}
          </Text>
        )}
      </View>

      {/* ── Divider ──────────────────────────────────────── */}
      <View style={[card.divider, { backgroundColor: colors.border }]} />

      {/* ── Unit stats ───────────────────────────────────── */}
      <View style={card.statsRow}>
        {[
          { label: tr('unitsTotal'),    value: project.totalUnits,     color: colors.foreground },
          { label: tr('availableLabel'),value: project.availableUnits, color: '#1a6b3a' },
          { label: tr('reservedLabel'), value: project.reservedUnits,  color: '#c8a45a' },
          { label: tr('soldLabel'),     value: project.soldUnits,      color: '#102a43' },
        ].map((stat) => (
          <View key={stat.label} style={card.stat}>
            <Text style={[card.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={[card.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Divider ──────────────────────────────────────── */}
      <View style={[card.divider, { backgroundColor: colors.border }]} />

      {/* ── Action buttons ───────────────────────────────── */}
      <View style={card.actions}>
        {[
          { label: tr('btnManageInventory'), icon: 'grid'   as const, onPress: () => router.push({ pathname: '/developer/inventory' as Parameters<typeof router.push>[0], params: { projectId: project.id, projectName: project.name } } as Parameters<typeof router.push>[0]) },
          { label: tr('btnManageLeads'),     icon: 'users'  as const, onPress: () => {} },
          { label: tr('btnEditProject'),     icon: 'edit-2' as const, onPress: onEdit },
        ].map((btn) => (
          <Pressable
            key={btn.label}
            onPress={btn.onPress}
            style={({ pressed }) => [card.actionBtn, { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 }]}
          >
            <Feather name={btn.icon} size={13} color={colors.action} />
            <Text style={[card.actionBtnText, { color: colors.action }]}>{btn.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProjectsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tr, isRTL } = useLanguage();
  const rtl = isRTL ? 'right' as const : 'left' as const;

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const [projects, setProjects] = useState<DeveloperProject[]>([]);

  const reload = useCallback(() => {
    void getDevProjects(user?.id ?? '').then(setProjects);
  }, [user?.id]);

  useFocusEffect(reload);

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`Delete "${name}"?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteDevProject(id);
          reload();
        },
      },
    ]);
  };

  const goCreate = () => router.push('/developer/create-project' as Parameters<typeof router.push>[0]);

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: botPad + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────── */}
        <AnimatedReveal>
          <View style={[s.header, { paddingHorizontal: 20 }]}>
            <View>
              <Text style={[s.eyebrow, { color: colors.action }]}>{tr('devCompanyPortal').toUpperCase()}</Text>
              <Text style={[s.title, { color: colors.foreground, textAlign: rtl }]}>{tr('myProjectsTitle')}</Text>
            </View>
            <Pressable
              onPress={goCreate}
              style={[s.createBtn, { backgroundColor: colors.action }]}
              hitSlop={8}
            >
              <Feather name="plus" size={16} color="#ffffff" />
              <Text style={s.createBtnText}>{tr('createProject')}</Text>
            </Pressable>
          </View>
        </AnimatedReveal>

        {/* ── Count bar ─────────────────────────────────── */}
        {projects.length > 0 && (
          <AnimatedReveal delay={60}>
            <View style={[s.countBar, { paddingHorizontal: 20, marginTop: 16 }]}>
              <Text style={[s.countText, { color: colors.mutedForeground }]}>
                {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              </Text>
            </View>
          </AnimatedReveal>
        )}

        {/* ── Project cards / empty state ───────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 16 }}>
          {projects.length === 0 ? (
            <AnimatedReveal delay={80}>
              <View style={[s.emptyWrap, { borderColor: colors.border }]}>
                <View style={[s.emptyIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name="layers" size={40} color={colors.mutedForeground} />
                </View>
                <Text style={[s.emptyTitle, { color: colors.foreground }]}>{tr('noProjectsYet')}</Text>
                <Text style={[s.emptyDesc, { color: colors.mutedForeground }]}>{tr('noProjectsDesc')}</Text>
                <Pressable
                  onPress={goCreate}
                  style={({ pressed }) => [s.emptyBtn, { backgroundColor: colors.action, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Feather name="plus" size={16} color="#ffffff" />
                  <Text style={s.emptyBtnText}>{tr('createFirstProject')}</Text>
                </Pressable>
              </View>
            </AnimatedReveal>
          ) : (
            projects.map((p, i) => (
              <AnimatedReveal key={p.id} delay={80 + i * 60}>
                <ProjectCard
                  project={p}
                  colors={colors}
                  tr={tr}
                  isRTL={isRTL}
                  onEdit={() => router.push({ pathname: '/developer/create-project', params: { id: p.id } } as Parameters<typeof router.push>[0])}
                  onDelete={() => handleDelete(p.id, p.name)}
                />
              </AnimatedReveal>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── FAB ───────────────────────────────────────────── */}
      <Pressable
        onPress={goCreate}
        style={({ pressed }) => [s.fab, { backgroundColor: colors.action, opacity: pressed ? 0.9 : 1, bottom: botPad + 90 }]}
      >
        <Feather name="plus" size={24} color="#ffffff" />
      </Pressable>
    </View>
  );
}

// ── Card styles ───────────────────────────────────────────────────────────────
const card = StyleSheet.create({
  wrap:          { borderWidth: 1, borderRadius: 18, padding: 16, overflow: 'hidden', gap: 0 },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconBox:       { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name:          { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 6 },
  metaRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typePill:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typeText:      { fontFamily: 'Inter_500Medium', fontSize: 9 },
  loc:           { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locText:       { fontFamily: 'Inter_400Regular', fontSize: 9 },
  menuBtn:       { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statusPriceRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  statusBadge:   { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusText:    { fontFamily: 'Inter_700Bold', fontSize: 10 },
  price:         { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  divider:       { height: 1, marginVertical: 12 },
  statsRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 0 },
  stat:          { alignItems: 'center', flex: 1 },
  statValue:     { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },
  statLabel:     { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 2 },
  actions:       { flexDirection: 'row', gap: 8 },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, paddingVertical: 9 },
  actionBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:       { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow:      { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 5 },
  title:        { fontFamily: 'Inter_700Bold', fontSize: 28 },
  createBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  createBtnText:{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ffffff' },
  countBar:     {},
  countText:    { fontFamily: 'Inter_400Regular', fontSize: 12 },
  emptyWrap:    { borderWidth: 1, borderRadius: 20, padding: 36, alignItems: 'center', gap: 12, borderStyle: 'dashed', marginTop: 16 },
  emptyIcon:    { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontFamily: 'Inter_700Bold', fontSize: 18, textAlign: 'center' },
  emptyDesc:    { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 13, marginTop: 8 },
  emptyBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' },
  fab:          { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
});
