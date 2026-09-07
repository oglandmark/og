/**
 * Developer Public Profile — buyer-facing view of a developer/builder.
 * Shows company info, verification status, and projects tabs.
 */
import React, { useEffect, useState } from 'react';
import {
  Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { DeveloperProject, formatPKR, getDevProjectById, getDevProjects, statusColor } from '@/lib/developerStore';

// ── Sample developer for demo static projects ─────────────────────────────────

const DEMO_DEV = {
  companyName: 'OG Landmark Developers',
  companyType: 'Housing Society Developer',
  about: 'OG Landmark Developers is a leading real estate development company serving Okara District and surrounding areas. With a commitment to quality, transparency, and community-centred development, OG Landmark brings premium residential and commercial projects to the heart of Punjab.',
  establishedYear: '2014',
  completedProjects: 3,
  activeProjects: 2,
  businessAreas: ['Okara City', 'Depalpur', 'Renala Khurd', 'Haveli Lakha'],
  website: '',
  phone: '03042569000',
};

// ── Project mini-card ─────────────────────────────────────────────────────────

function ProjectMiniCard({
  project, colors, onPress,
}: {
  project: DeveloperProject;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  const sc = statusColor(project.status);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pc.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.92 : 1 }]}>
      <View style={pc.top}>
        <View style={{ flex: 1 }}>
          <Text style={[pc.name, { color: colors.foreground }]} numberOfLines={1}>{project.name}</Text>
          <Text style={[pc.type, { color: colors.mutedForeground }]}>{project.type} · {project.city}</Text>
        </View>
        <View style={[pc.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[pc.statusText, { color: sc.text }]}>{project.status}</Text>
        </View>
      </View>
      <View style={[pc.divider, { backgroundColor: colors.border }]} />
      <View style={pc.meta}>
        {project.startingPrice > 0 && (
          <View style={pc.metaItem}>
            <Feather name="tag" size={11} color={colors.primary} />
            <Text style={[pc.metaText, { color: colors.mutedForeground }]}>From PKR {formatPKR(project.startingPrice)}</Text>
          </View>
        )}
        {project.availableUnits > 0 && (
          <View style={pc.metaItem}>
            <Feather name="home" size={11} color={colors.primary} />
            <Text style={[pc.metaText, { color: colors.mutedForeground }]}>{project.availableUnits} units available</Text>
          </View>
        )}
        {project.city ? (
          <View style={pc.metaItem}>
            <Feather name="map-pin" size={11} color={colors.primary} />
            <Text style={[pc.metaText, { color: colors.mutedForeground }]}>{project.city}</Text>
          </View>
        ) : null}
      </View>
      <View style={pc.viewRow}>
        <Text style={[pc.viewText, { color: colors.action }]}>View Project</Text>
        <Feather name="arrow-right" size={12} color={colors.action} />
      </View>
    </Pressable>
  );
}

const pc = StyleSheet.create({
  card:       { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  top:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  name:       { fontFamily: 'Inter_700Bold', fontSize: 14 },
  type:       { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  statusBadge:{ borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 9 },
  divider:    { height: 1, marginVertical: 10 },
  meta:       { gap: 7, marginBottom: 10 },
  metaItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText:   { fontFamily: 'Inter_400Regular', fontSize: 11 },
  viewRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  viewText:   { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DeveloperProfileScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  const [projects, setProjects] = useState<DeveloperProject[]>([]);
  const [activeTab, setActiveTab] = useState<'Ongoing' | 'Upcoming' | 'Completed'>('Ongoing');

  const isDemo = id === 'demo';

  // Use logged-in developer info if the ID matches, otherwise fall back to demo
  const isOwnProfile = user?.role === 'developer' && user.id === id;
  const devInfo = isOwnProfile
    ? {
        companyName: user.companyName ?? user.name ?? 'Developer',
        companyType: user.companyType ?? 'Developer',
        about: '',
        establishedYear: user.establishedYear ?? '',
        completedProjects: 0,
        activeProjects: 0,
        businessAreas: user.businessAreas ?? [],
        website: user.website ?? '',
        phone: user.phone ?? '',
      }
    : DEMO_DEV;

  useEffect(() => {
    if (isDemo) return;
    (async () => {
      const p = await getDevProjects(id ?? '');
      setProjects(p);
    })();
  }, [id]);

  // Tab filtering
  const ongoingStatuses = ['Live', 'Approved', 'Under Development', 'Coming Soon'];
  const upcomingStatuses = ['Pending Review', 'Draft'];
  const completedStatuses = ['Completed'];

  const tabProjects = projects.filter((p) => {
    if (activeTab === 'Ongoing')   return ongoingStatuses.includes(p.status);
    if (activeTab === 'Upcoming')  return upcomingStatuses.includes(p.status);
    return completedStatuses.includes(p.status);
  });

  const initials = devInfo.companyName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const activeCount  = isOwnProfile ? projects.filter((p) => ongoingStatuses.includes(p.status)).length : devInfo.activeProjects;
  const completedCount = isOwnProfile ? projects.filter((p) => completedStatuses.includes(p.status)).length : devInfo.completedProjects;

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}>

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: colors.action }]}>
        <Pressable onPress={() => router.back()} style={[styles.backCircle, { top: topInset + 10 }]}>
          <Feather name="arrow-left" size={20} color="#ffffff" />
        </Pressable>
        <Pressable onPress={() => Share.share({ message: `${devInfo.companyName} — Verified Developer on OG Landmark`, title: devInfo.companyName })}
          style={[styles.shareCircle, { top: topInset + 10 }]}>
          <Feather name="share-2" size={18} color="#ffffff" />
        </Pressable>

        {/* logo / initials */}
        <View style={[styles.logoWrap, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoInitials}>{initials}</Text>
        </View>

        <View style={styles.verifiedRow}>
          <Feather name="check-circle" size={13} color="#c8a45a" />
          <Text style={styles.verifiedText}>Verified Developer</Text>
        </View>
        <Text style={styles.devName}>{devInfo.companyName}</Text>
        <Text style={styles.devType}>{devInfo.companyType}</Text>

        {isDemo && (
          <View style={styles.sampleBadge}>
            <Text style={styles.sampleText}>SAMPLE DATA</Text>
          </View>
        )}
      </View>

      {/* ── STATS ROW ────────────────────────────────────────────────── */}
      <View style={[styles.statsCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        {[
          { value: devInfo.establishedYear || '—', label: 'Established' },
          { value: String(activeCount), label: 'Active\nProjects' },
          { value: String(completedCount), label: 'Completed\nProjects' },
        ].map((s, i, arr) => (
          <View key={s.label} style={[styles.statItem, i < arr.length - 1 ? { borderRightWidth: 1, borderRightColor: colors.border } : {}]}>
            <Text style={[styles.statVal, { color: colors.foreground }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── ABOUT ───────────────────────────────────────────────────── */}
      {devInfo.about ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
          <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>{devInfo.about}</Text>
        </View>
      ) : null}

      {/* ── AREAS SERVED ─────────────────────────────────────────────── */}
      {devInfo.businessAreas.length > 0 && (
        <View style={[styles.areaCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.areaHeader}>
            <Feather name="map-pin" size={14} color={colors.primary} />
            <Text style={[styles.areaTitle, { color: colors.foreground }]}>Areas Served</Text>
          </View>
          <View style={styles.tagRow}>
            {devInfo.businessAreas.map((a: string) => (
              <View key={a} style={[styles.areaChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.areaChipText, { color: colors.foreground }]}>{a}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── CONTACT ACTIONS ──────────────────────────────────────────── */}
      <View style={styles.contactRow}>
        <Pressable onPress={() => Linking.openURL(`tel:${devInfo.phone}`)}
          style={({ pressed }) => [styles.contactBtn, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
          <Feather name="phone" size={15} color={colors.action} />
          <Text style={[styles.contactBtnText, { color: colors.action }]}>Call Office</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(`https://wa.me/92${devInfo.phone.replace(/^0/, '')}`)}
          style={({ pressed }) => [styles.contactBtn, { backgroundColor: '#25d36615', borderColor: '#25d36640', opacity: pressed ? 0.8 : 1 }]}>
          <Feather name="message-circle" size={15} color="#25d366" />
          <Text style={[styles.contactBtnText, { color: '#25d366' }]}>WhatsApp</Text>
        </Pressable>
        {devInfo.website ? (
          <Pressable onPress={() => Linking.openURL(devInfo.website)}
            style={({ pressed }) => [styles.contactBtn, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
            <Feather name="globe" size={15} color={colors.mutedForeground} />
            <Text style={[styles.contactBtnText, { color: colors.mutedForeground }]}>Website</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ── VERIFICATION CARD ─────────────────────────────────────────── */}
      <View style={[styles.verCard, { backgroundColor: '#1a6b3a08', borderColor: '#1a6b3a20' }]}>
        <View style={styles.verHeader}>
          <Feather name="shield" size={16} color="#1a6b3a" />
          <Text style={[styles.verTitle, { color: '#1a6b3a' }]}>Why is this developer verified?</Text>
        </View>
        {[
          'Company information reviewed',
          'Developer identity verified',
          'Project documentation reviewed',
          'Legal & NOC status checked',
        ].map((c) => (
          <View key={c} style={styles.verItem}>
            <Feather name="check-circle" size={12} color="#1a6b3a" />
            <Text style={[styles.verItemText, { color: colors.foreground }]}>{c}</Text>
          </View>
        ))}
      </View>

      {/* ── PROJECTS TABS ────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Developer Projects</Text>

        <View style={[styles.tabBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          {(['Ongoing', 'Upcoming', 'Completed'] as const).map((t) => (
            <Pressable key={t} onPress={() => setActiveTab(t)}
              style={[styles.tabItem, activeTab === t ? { backgroundColor: colors.action, borderRadius: 10 } : {}]}>
              <Text style={[styles.tabText, { color: activeTab === t ? colors.actionForeground : colors.mutedForeground }]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {isDemo ? (
          <View style={[styles.demoProjects, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="layers" size={28} color={colors.mutedForeground} style={{ marginBottom: 10 }} />
            <Text style={[styles.demoTitle, { color: colors.foreground }]}>Projects by {devInfo.companyName}</Text>
            <Text style={[styles.demoDesc, { color: colors.mutedForeground }]}>
              Live project listings will appear here when the developer's profile is connected to the backend.
            </Text>
          </View>
        ) : tabProjects.length > 0 ? (
          tabProjects.map((p) => (
            <ProjectMiniCard key={p.id} project={p} colors={colors} onPress={() => router.push(`/project/${p.id}`)} />
          ))
        ) : (
          <View style={[styles.demoProjects, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="layers" size={28} color={colors.mutedForeground} style={{ marginBottom: 10 }} />
            <Text style={[styles.demoTitle, { color: colors.foreground }]}>No {activeTab} projects</Text>
            <Text style={[styles.demoDesc, { color: colors.mutedForeground }]}>
              {activeTab === 'Ongoing'
                ? 'Active projects will appear here once published.'
                : activeTab === 'Upcoming'
                ? 'Upcoming projects will appear here once created.'
                : 'Completed projects will appear here.'}
            </Text>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1 },
  // Header
  header:      { paddingHorizontal: 18, paddingBottom: 28, paddingTop: 50, alignItems: 'center' },
  backCircle:  { position: 'absolute', left: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  shareCircle: { position: 'absolute', right: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  logoWrap:    { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)', marginBottom: 12, marginTop: 8 },
  logoInitials:{ fontFamily: 'Inter_700Bold', fontSize: 32, color: '#1c2024' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  verifiedText:{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#c8a45a' },
  devName:     { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#ffffff', textAlign: 'center', letterSpacing: -0.3 },
  devType:     { fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  sampleBadge: { marginTop: 10, backgroundColor: 'rgba(200,164,90,0.3)', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  sampleText:  { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1, color: '#c8a45a' },
  // Stats
  statsCard:   { flexDirection: 'row', margin: 18, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  statItem:    { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statVal:     { fontFamily: 'Inter_700Bold', fontSize: 20 },
  statLabel:   { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', marginTop: 3, lineHeight: 14 },
  // Sections
  section:     { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  sectionTitle:{ fontFamily: 'Inter_700Bold', fontSize: 17, marginBottom: 12 },
  aboutText:   { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  // Areas
  areaCard:    { marginHorizontal: 18, marginTop: 14, borderWidth: 1, borderRadius: 14, padding: 14 },
  areaHeader:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  areaTitle:   { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  tagRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  areaChip:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  areaChipText:{ fontFamily: 'Inter_400Regular', fontSize: 12 },
  // Contact
  contactRow:  { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 14 },
  contactBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 12 },
  contactBtnText:{ fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  // Verification
  verCard:     { marginHorizontal: 18, marginTop: 14, borderWidth: 1, borderRadius: 14, padding: 16 },
  verHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  verTitle:    { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  verItem:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  verItemText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  // Tabs
  tabBar:      { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 4, marginBottom: 14 },
  tabItem:     { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabText:     { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  // Empty/demo
  demoProjects:{ borderWidth: 1, borderRadius: 14, padding: 28, alignItems: 'center' },
  demoTitle:   { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 6 },
  demoDesc:    { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
