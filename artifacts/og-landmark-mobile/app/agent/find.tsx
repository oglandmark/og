import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView,
  StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { GlassCard } from '@/components/GlassCard';
import { useColors } from '@/hooks/useColors';
import { apiAgentToSample, SampleAgent } from '@/lib/agentsData';
import { getAgents } from '@/lib/api';

// ── Filter data ────────────────────────────────────────────────────────────────

const ALL_SPECIALTIES = [
  'All', 'Residential', 'Agricultural Land', 'Plots',
  'Commercial', 'Industrial', 'Investment', 'Rentals',
];

type ExpBucket = 'All' | 'Under 5 yrs' | '5–10 yrs' | '10+ yrs';
const EXP_BUCKETS: ExpBucket[] = ['All', 'Under 5 yrs', '5–10 yrs', '10+ yrs'];

function matchesExp(years: number, bucket: ExpBucket): boolean {
  if (bucket === 'All') return true;
  if (bucket === 'Under 5 yrs') return years < 5;
  if (bucket === '5–10 yrs') return years >= 5 && years <= 10;
  return years > 10;
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function FindAgentScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('All');
  const [location, setLocation] = useState('All');
  const [expBucket, setExpBucket] = useState<ExpBucket>('All');
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [agents, setAgents] = useState<SampleAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadAgents = () => {
    setLoading(true);
    setLoadError('');
    getAgents()
      .then((records) => setAgents(records.map(apiAgentToSample)))
      .catch((error: unknown) => {
        setAgents([]);
        setLoadError(error instanceof Error ? error.message : 'Could not load agents.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAgents(); }, []);

  const allLocations = useMemo(() => Array.from(
    new Set(agents.flatMap((agent) => agent.areas)),
  ).sort(), [agents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (verifiedOnly && !a.verified) return false;
      if (specialty !== 'All' && !a.specialties.includes(specialty)) return false;
      if (location !== 'All' && !a.areas.includes(location)) return false;
      if (!matchesExp(a.years, expBucket)) return false;
      if (!q) return true;
      const haystack = `${a.displayName} ${a.agency} ${a.areas.join(' ')} ${a.specialties.join(' ')}`.toLowerCase();
      return q.split(/\s+/).every((token) => haystack.includes(token));
    });
  }, [agents, query, specialty, location, expBucket, verifiedOnly]);

  const hasFilters = specialty !== 'All' || location !== 'All' || expBucket !== 'All';

  const resetFilters = () => {
    setQuery('');
    setSpecialty('All');
    setLocation('All');
    setExpBucket('All');
    setVerifiedOnly(true);
  };

  return (
    <ScrollView
      style={[st.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: insets.bottom + 96, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Header ── */}
      <AnimatedReveal>
        <View style={st.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={[st.backBtn, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[st.eyebrow, { color: colors.primary }]}>OKARA DISTRICT</Text>
            <Text style={[st.title, { color: colors.foreground }]}>Verified Agents</Text>
          </View>
          {hasFilters && (
            <Pressable onPress={resetFilters} hitSlop={8} style={[st.resetBtn, { borderColor: colors.border, backgroundColor: colors.glassCard }]}>
              <Text style={[st.resetText, { color: colors.action }]}>Reset</Text>
            </Pressable>
          )}
        </View>
      </AnimatedReveal>

      {/* ── Search ── */}
      <AnimatedReveal delay={60} distance={10}>
        <GlassCard style={st.searchCard} contentStyle={st.searchContent}>
          <Feather name="search" size={17} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, agency or area…"
            placeholderTextColor={colors.mutedForeground}
            style={[st.searchInput, { color: colors.foreground }]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Feather name="x-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </GlassCard>
      </AnimatedReveal>

      {/* ── Verified toggle ── */}
      <AnimatedReveal delay={90} distance={8}>
        <Pressable
          onPress={() => setVerifiedOnly(!verifiedOnly)}
          style={({ pressed }) => [
            st.verifiedToggle,
            {
              backgroundColor: verifiedOnly ? '#1a6b3a12' : colors.glassCard,
              borderColor: verifiedOnly ? '#1a6b3a55' : colors.glassBorder,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={[st.verifiedDot, { backgroundColor: verifiedOnly ? '#1a6b3a' : colors.mutedForeground }]}>
            {verifiedOnly && <Feather name="check" size={9} color="#ffffff" />}
          </View>
          <Feather name="check-circle" size={14} color={verifiedOnly ? '#1a6b3a' : colors.mutedForeground} />
          <Text style={[st.verifiedToggleText, { color: verifiedOnly ? '#1a6b3a' : colors.mutedForeground }]}>
            Verified agents only
          </Text>
        </Pressable>
      </AnimatedReveal>

      {/* ── Specialty chips ── */}
      <AnimatedReveal delay={110} distance={8}>
        <Text style={[st.filterLabel, { color: colors.mutedForeground }]}>SPECIALTY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipRow}>
          {ALL_SPECIALTIES.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSpecialty(s)}
              style={({ pressed }) => [
                st.chip,
                {
                  backgroundColor: specialty === s ? colors.action : colors.glassCard,
                  borderColor: specialty === s ? colors.action : colors.glassBorder,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <Text style={[st.chipText, { color: specialty === s ? colors.actionForeground : colors.foreground }]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </AnimatedReveal>

      {/* ── Location chips ── */}
      <AnimatedReveal delay={130} distance={8}>
        <Text style={[st.filterLabel, { color: colors.mutedForeground }]}>AREA SERVED</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipRow}>
          {['All', ...allLocations].map((loc) => (
            <Pressable
              key={loc}
              onPress={() => setLocation(loc)}
              style={({ pressed }) => [
                st.chip,
                {
                  backgroundColor: location === loc ? colors.primary : colors.glassCard,
                  borderColor: location === loc ? colors.primary : colors.glassBorder,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              {location === loc && loc !== 'All' && <Feather name="map-pin" size={10} color="#ffffff" />}
              <Text style={[st.chipText, { color: location === loc ? '#ffffff' : colors.foreground }]}>{loc}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </AnimatedReveal>

      {/* ── Experience chips ── */}
      <AnimatedReveal delay={150} distance={8}>
        <Text style={[st.filterLabel, { color: colors.mutedForeground }]}>EXPERIENCE</Text>
        <View style={st.expRow}>
          {EXP_BUCKETS.map((b) => (
            <Pressable
              key={b}
              onPress={() => setExpBucket(b)}
              style={({ pressed }) => [
                st.expChip,
                {
                  backgroundColor: expBucket === b ? colors.accent : colors.glassCard,
                  borderColor: expBucket === b ? colors.primary : colors.glassBorder,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <Text style={[st.expChipText, { color: expBucket === b ? colors.primary : colors.mutedForeground }]}>{b}</Text>
            </Pressable>
          ))}
        </View>
      </AnimatedReveal>

      {/* ── Result count ── */}
      <AnimatedReveal delay={170} distance={6}>
        <View style={st.resultRow}>
          <Text style={[st.resultCount, { color: colors.foreground }]}>
            {filtered.length} {filtered.length === 1 ? 'agent' : 'agents'} found
          </Text>
          {hasFilters && (
            <Pressable onPress={resetFilters} hitSlop={8}>
              <Text style={[st.clearText, { color: colors.action }]}>Clear filters</Text>
            </Pressable>
          )}
        </View>
      </AnimatedReveal>

      {/* ── Agent cards ── */}
      {loading ? (
        <GlassCard style={st.empty} contentStyle={st.emptyContent}>
          <ActivityIndicator size="small" color={colors.action} />
          <Text style={[st.emptyText, { color: colors.mutedForeground }]}>Loading agents…</Text>
        </GlassCard>
      ) : loadError ? (
        <GlassCard style={st.empty} contentStyle={st.emptyContent}>
          <View style={[st.emptyIcon, { backgroundColor: colors.accent }]}>
            <Feather name="wifi-off" size={24} color={colors.accentForeground} />
          </View>
          <Text style={[st.emptyTitle, { color: colors.foreground }]}>Could not load agents</Text>
          <Text style={[st.emptyText, { color: colors.mutedForeground }]}>{loadError}</Text>
          <Pressable onPress={loadAgents} style={[st.emptyBtn, { backgroundColor: colors.action }]}>
            <Text style={[st.emptyBtnText, { color: colors.actionForeground }]}>Try again</Text>
          </Pressable>
        </GlassCard>
      ) : filtered.length > 0 ? (
        filtered.map((agent, index) => (
          <AnimatedReveal key={agent.id} delay={200 + index * 55} distance={14}>
            <AgentListCard agent={agent} colors={colors} onPress={() => router.push(`/agent/${agent.id}` as any)} />
          </AnimatedReveal>
        ))
      ) : (
        <AnimatedReveal delay={200} distance={12}>
          <GlassCard style={st.empty} contentStyle={st.emptyContent}>
            <View style={[st.emptyIcon, { backgroundColor: colors.accent }]}>
              <Feather name="users" size={24} color={colors.accentForeground} />
            </View>
            <Text style={[st.emptyTitle, { color: colors.foreground }]}>No agents match</Text>
            <Text style={[st.emptyText, { color: colors.mutedForeground }]}>
              Try a different specialty, location, or experience level.
            </Text>
            <Pressable onPress={resetFilters} style={[st.emptyBtn, { backgroundColor: colors.action }]}>
              <Text style={[st.emptyBtnText, { color: colors.actionForeground }]}>Clear all filters</Text>
            </Pressable>
          </GlassCard>
        </AnimatedReveal>
      )}
    </ScrollView>
  );
}

// ── Agent list card ────────────────────────────────────────────────────────────

function AgentListCard({
  agent,
  colors,
  onPress,
}: {
  agent: SampleAgent;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable onPress={onPress} scaleTo={0.985} style={[lc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Top row: avatar + name + verified */}
      <View style={lc.topRow}>
        <View style={[lc.avatar, { backgroundColor: agent.color }]}>
            {agent.profileImage ? (
              <Image source={agent.profileImage} style={lc.avatarImage} />
            ) : (
              <Text style={lc.initials}>{agent.initials}</Text>
            )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={lc.nameRow}>
            <Text style={[lc.name, { color: colors.foreground }]} numberOfLines={1}>
              {agent.displayName}
            </Text>
            {agent.verified && (
              <View style={[lc.verifiedBadge, { backgroundColor: '#1a6b3a12', borderColor: '#1a6b3a33' }]}>
                <Feather name="check-circle" size={9} color="#1a6b3a" />
                <Text style={[lc.verifiedText, { color: '#1a6b3a' }]}>VERIFIED</Text>
              </View>
            )}
          </View>
          <Text style={[lc.agency, { color: colors.mutedForeground }]} numberOfLines={1}>{agent.agency}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={[lc.statsRow, { borderColor: colors.border }]}>
        <View style={lc.stat}>
          <Text style={[lc.statVal, { color: colors.foreground }]}>{agent.years}</Text>
          <Text style={[lc.statLabel, { color: colors.mutedForeground }]}>Yrs Exp</Text>
        </View>
        <View style={[lc.statDiv, { backgroundColor: colors.border }]} />
        <View style={lc.stat}>
          <Text style={[lc.statVal, { color: colors.foreground }]}>{agent.listings}</Text>
          <Text style={[lc.statLabel, { color: colors.mutedForeground }]}>Listings</Text>
        </View>
        <View style={[lc.statDiv, { backgroundColor: colors.border }]} />
        <View style={lc.stat}>
          <Text style={[lc.statVal, { color: colors.foreground }]}>{agent.areas.length}</Text>
          <Text style={[lc.statLabel, { color: colors.mutedForeground }]}>Areas</Text>
        </View>
      </View>

      {/* Specialties */}
      <View style={lc.tagsRow}>
        {agent.specialties.map((sp) => (
          <View key={sp} style={[lc.tag, { backgroundColor: colors.accent, borderColor: colors.border }]}>
            <Text style={[lc.tagText, { color: colors.accentForeground }]}>{sp}</Text>
          </View>
        ))}
      </View>

      {/* Areas served */}
      <View style={lc.areasRow}>
        <Feather name="map-pin" size={11} color={colors.mutedForeground} />
        <Text style={[lc.areasText, { color: colors.mutedForeground }]}>
          {agent.areas.join(' · ')}
        </Text>
      </View>

      {/* About snippet */}
      <Text style={[lc.about, { color: colors.mutedForeground }]} numberOfLines={2}>
        {agent.about}
      </Text>

      {/* CTA row */}
      <View style={[lc.ctaRow, { borderColor: colors.border }]}>
        <Pressable
          onPress={(e) => { e.stopPropagation(); Linking.openURL(`tel:${agent.phone}`); }}
          style={[lc.callBtn, { backgroundColor: '#1a6b3a12', borderColor: '#1a6b3a33' }]}
          hitSlop={6}
        >
          <Feather name="phone" size={13} color="#1a6b3a" />
          <Text style={[lc.callBtnText, { color: '#1a6b3a' }]}>Call</Text>
        </Pressable>
        <Pressable
          onPress={(e) => { e.stopPropagation(); Linking.openURL(`https://wa.me/92${agent.phone.replace(/^0/, '')}`); }}
          style={[lc.callBtn, { backgroundColor: '#25d36612', borderColor: '#25d36633' }]}
          hitSlop={6}
        >
          <Feather name="message-circle" size={13} color="#25d366" />
          <Text style={[lc.callBtnText, { color: '#25d366' }]}>WhatsApp</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <View style={lc.profileCta}>
          <Text style={[lc.profileCtaText, { color: colors.action }]}>View Profile</Text>
          <Feather name="arrow-right" size={13} color={colors.action} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  screen:             { flex: 1 },
  headerRow:          { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  backBtn:            { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow:            { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.4, marginBottom: 2 },
  title:              { fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 28 },
  resetBtn:           { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  resetText:          { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  searchCard:         { marginBottom: 14 },
  searchContent:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  searchInput:        { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, padding: 0 },
  verifiedToggle:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 18 },
  verifiedDot:        { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  verifiedToggleText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flex: 1 },
  filterLabel:        { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, marginBottom: 10 },
  chipRow:            { gap: 8, paddingBottom: 16 },
  chip:               { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipText:           { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  expRow:             { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  expChip:            { borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  expChipText:        { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  resultRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  resultCount:        { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  clearText:          { fontFamily: 'Inter_500Medium', fontSize: 12 },
  empty:              { marginTop: 8 },
  emptyContent:       { alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 20 },
  emptyIcon:          { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:         { fontFamily: 'Inter_700Bold', fontSize: 17 },
  emptyText:          { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyBtn:           { borderRadius: 13, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 },
  emptyBtnText:       { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});

const lc = StyleSheet.create({
  card:         { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 14, gap: 14 },
  topRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  avatar:       { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarImage:  { width: '100%', height: '100%', borderRadius: 16 },
  initials:     { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#ffffff' },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name:         { fontFamily: 'Inter_700Bold', fontSize: 16 },
  agency:       { fontFamily: 'Inter_400Regular', fontSize: 12 },
  verifiedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedText: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.6 },
  statsRow:     { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 12 },
  stat:         { flex: 1, alignItems: 'center', gap: 2 },
  statVal:      { fontFamily: 'Inter_700Bold', fontSize: 18 },
  statLabel:    { fontFamily: 'Inter_400Regular', fontSize: 10 },
  statDiv:      { width: 1, marginVertical: 4 },
  tagsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:          { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  tagText:      { fontFamily: 'Inter_500Medium', fontSize: 11 },
  areasRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  areasText:    { fontFamily: 'Inter_400Regular', fontSize: 12, flex: 1 },
  about:        { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  ctaRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingTop: 14 },
  callBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  callBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  profileCta:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  profileCtaText:{ fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
