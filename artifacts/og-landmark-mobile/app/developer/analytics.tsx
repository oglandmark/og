/**
 * Developer Portal — Analytics Screen
 * Conversion funnel + stage breakdown + performance overview.
 */
import React, { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import {
  DevLead, DevLeadStatus, DEV_STAGE_CONFIG, DEV_STAGES,
  getDevLeads, calcDevLeadStats,
} from '@/lib/devLeadsStore';
import { getSiteVisits, SiteVisit } from '@/lib/siteVisitStore';
import { getDevProjects, formatPKR, DeveloperProject } from '@/lib/developerStore';

// ── Funnel bar component ──────────────────────────────────────────────────────
function FunnelBar({
  label, count, total, color, colors,
}: { label: string; count: number; total: number; color: string; colors: ReturnType<typeof import('@/hooks/useColors').useColors> }) {
  const pct = total > 0 ? count / total : 0;
  const ratePct = Math.round(pct * 100);
  return (
    <View style={fb.row}>
      <Text style={[fb.label, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
      <View style={[fb.barBg, { backgroundColor: colors.secondary }]}>
        <View style={[fb.barFill, { width: `${Math.max(pct * 100, 2)}%` as `${number}%`, backgroundColor: color }]} />
      </View>
      <View style={fb.right}>
        <Text style={[fb.count, { color: colors.foreground }]}>{count}</Text>
        <Text style={[fb.pct, { color: colors.mutedForeground }]}>{ratePct}%</Text>
      </View>
    </View>
  );
}
const fb = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label:  { fontFamily: 'Inter_500Medium', fontSize: 11, width: 72 },
  barBg:  { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill:{ height: '100%', borderRadius: 5 },
  right:  { flexDirection: 'row', gap: 4, alignItems: 'baseline', width: 52, justifyContent: 'flex-end' },
  count:  { fontFamily: 'Inter_700Bold', fontSize: 13 },
  pct:    { fontFamily: 'Inter_400Regular', fontSize: 9 },
});

// ── Stage breakdown bar ───────────────────────────────────────────────────────
function StageBar({
  status, count, maxCount, colors,
}: { status: DevLeadStatus; count: number; maxCount: number; colors: ReturnType<typeof import('@/hooks/useColors').useColors> }) {
  const cfg = DEV_STAGE_CONFIG[status];
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <View style={sb.row}>
      <View style={[sb.dot, { backgroundColor: cfg.color }]} />
      <Text style={[sb.label, { color: colors.mutedForeground }]}>{cfg.label}</Text>
      <View style={[sb.barBg, { backgroundColor: colors.secondary }]}>
        <View style={[sb.barFill, { width: `${Math.max(pct, 2)}%` as `${number}%`, backgroundColor: cfg.color + 'aa' }]} />
      </View>
      <Text style={[sb.count, { color: cfg.color }]}>{count}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:    { width: 6, height: 6, borderRadius: 3 },
  label:  { fontFamily: 'Inter_500Medium', fontSize: 10, width: 80 },
  barBg:  { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill:{ height: '100%', borderRadius: 4 },
  count:  { fontFamily: 'Inter_700Bold', fontSize: 12, width: 24, textAlign: 'right' },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tr } = useLanguage();
  const router  = useRouter();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const [leads, setLeads]       = useState<DevLead[]>([]);
  const [visits, setVisits]     = useState<SiteVisit[]>([]);
  const [projects, setProjects] = useState<DeveloperProject[]>([]);

  useFocusEffect(useCallback(() => {
    void getDevLeads(user?.id ?? '').then(setLeads);
    void getSiteVisits(user?.id ?? '').then(setVisits);
    void getDevProjects(user?.id ?? '').then(setProjects);
  }, [user?.id]));

  // ── Computed values ──────────────────────────────────────────────────────
  const stats = calcDevLeadStats(leads);
  const total = stats.total;

  const stageCountMap: Record<DevLeadStatus, number> = {
    new: 0, contacted: 0, interested: 0, site_visit: 0,
    negotiation: 0, booking: 0, won: 0, lost: 0,
  };
  leads.forEach((l) => { stageCountMap[l.status]++; });

  const contactedCount = total - stageCountMap.new - stageCountMap.lost;
  const siteVisitCount = visits.length;
  const wonCount       = stageCountMap.won;
  const convRate       = total > 0 ? Math.round((wonCount / total) * 100) : 0;
  const maxStageCount  = Math.max(...DEV_STAGES.map((s) => stageCountMap[s]), 1);

  // Revenue potential (sum of leads' budget midpoints — simple heuristic)
  const totalRevPot = leads
    .filter((l) => l.status !== 'lost')
    .reduce((sum, l) => {
      const nums = l.budget.replace(/[^0-9–-]/g, ' ').trim().split(/\s+/).map(Number).filter(Boolean);
      if (nums.length >= 2) return sum + ((nums[0] + nums[1]) / 2) * 100_000;
      if (nums.length === 1) return sum + nums[0] * 100_000;
      return sum;
    }, 0);

  const topCards = [
    { label: 'Total Leads',         value: String(total),         icon: 'users'       as const, color: '#102a43' },
    { label: tr('conversionRate'),   value: `${convRate}%`,        icon: 'trending-up' as const, color: '#1a6b3a' },
    { label: tr('funnelVisits'),     value: String(siteVisitCount),icon: 'calendar'    as const, color: '#7c3aed' },
    { label: tr('wonDealsLabel'),    value: String(wonCount),      icon: 'check-circle'as const, color: '#059669' },
  ];

  const funnelRows = [
    { label: tr('funnelLeads'),     count: total,          color: '#102a43' },
    { label: tr('funnelContacted'), count: contactedCount, color: '#c8a45a' },
    { label: tr('funnelVisits'),    count: siteVisitCount, color: '#7c3aed' },
    { label: tr('funnelWon'),       count: wonCount,       color: '#059669' },
  ];

  return (
    <View style={[an.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad + 100 }}
      >
        {/* ── Header ────────────────────────────────────── */}
        <AnimatedReveal>
          <View style={[an.header, { paddingTop: topPad + 12, paddingHorizontal: 20 }]}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={[an.backBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[an.eyebrow, { color: colors.action }]}>DEVELOPER PORTAL</Text>
              <Text style={[an.title, { color: colors.foreground }]}>{tr('analyticsTitle')}</Text>
            </View>
          </View>
          <Text style={[an.subtitle, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 4, marginBottom: 20 }]}>
            {tr('analyticsSubtitle')}
          </Text>
        </AnimatedReveal>

        {total === 0 ? (
          <AnimatedReveal delay={60}>
            <View style={[an.emptyWrap, { borderColor: colors.border, marginHorizontal: 20 }]}>
              <Feather name="bar-chart-2" size={40} color={colors.mutedForeground} />
              <Text style={[an.emptyTitle, { color: colors.foreground }]}>{tr('noAnalyticsData')}</Text>
              <Text style={[an.emptyDesc, { color: colors.mutedForeground }]}>
                Your analytics will appear here as you add leads and manage site visits.
              </Text>
            </View>
          </AnimatedReveal>
        ) : (
          <>
            {/* ── Top stat cards ────────────────────────── */}
            <AnimatedReveal delay={40}>
              <View style={an.cardGrid}>
                {topCards.map((c, i) => (
                  <AnimatedReveal key={c.label} delay={50 + i * 30} style={an.cardWrap}>
                    <View style={[an.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[an.cardIcon, { backgroundColor: c.color + '18' }]}>
                        <Feather name={c.icon} size={16} color={c.color} />
                      </View>
                      <Text style={[an.cardValue, { color: colors.foreground }]}>{c.value}</Text>
                      <Text style={[an.cardLabel, { color: colors.mutedForeground }]}>{c.label}</Text>
                    </View>
                  </AnimatedReveal>
                ))}
              </View>
            </AnimatedReveal>

            {/* ── Revenue potential ─────────────────────── */}
            {totalRevPot > 0 && (
              <AnimatedReveal delay={100}>
                <View style={[an.revCard, { backgroundColor: colors.action, marginHorizontal: 20, marginBottom: 20 }]}>
                  <View style={an.revRow}>
                    <Feather name="trending-up" size={20} color="#ffffff99" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={an.revLabel}>{tr('totalRevenuePot')}</Text>
                      <Text style={an.revValue}>PKR {formatPKR(totalRevPot)}</Text>
                    </View>
                    <View style={an.revBadge}>
                      <Text style={an.revBadgeText}>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</Text>
                    </View>
                  </View>
                </View>
              </AnimatedReveal>
            )}

            {/* ── Conversion funnel ─────────────────────── */}
            <AnimatedReveal delay={120}>
              <View style={[an.section, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 20, marginBottom: 16 }]}>
                <Text style={[an.sectionTitle, { color: colors.mutedForeground }]}>{tr('conversionFunnel')}</Text>
                <View style={{ gap: 12, marginTop: 8 }}>
                  {funnelRows.map((r) => (
                    <FunnelBar key={r.label} label={r.label} count={r.count} total={total} color={r.color} colors={colors} />
                  ))}
                </View>
                {/* Conversion rate footer */}
                <View style={[an.convFooter, { borderTopColor: colors.border, marginTop: 16 }]}>
                  <Text style={[an.convFooterLabel, { color: colors.mutedForeground }]}>{tr('conversionRate')}</Text>
                  <Text style={[an.convFooterValue, { color: '#059669' }]}>{convRate}%</Text>
                </View>
              </View>
            </AnimatedReveal>

            {/* ── Stage breakdown ───────────────────────── */}
            <AnimatedReveal delay={160}>
              <View style={[an.section, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 20, marginBottom: 16 }]}>
                <Text style={[an.sectionTitle, { color: colors.mutedForeground }]}>{tr('stageBreakdown')}</Text>
                <View style={{ gap: 10, marginTop: 8 }}>
                  {DEV_STAGES.map((s) => (
                    <StageBar key={s} status={s} count={stageCountMap[s]} maxCount={maxStageCount} colors={colors} />
                  ))}
                </View>
              </View>
            </AnimatedReveal>

            {/* ── Performance overview ──────────────────── */}
            <AnimatedReveal delay={200}>
              <View style={[an.section, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 20 }]}>
                <Text style={[an.sectionTitle, { color: colors.mutedForeground }]}>{tr('performanceLabel')}</Text>
                <View style={{ gap: 0, marginTop: 8 }}>
                  {[
                    { label: 'Total Leads',    value: total,               icon: 'users'       as const, color: colors.foreground },
                    { label: 'Active Pipeline',value: total - stageCountMap.won - stageCountMap.lost, icon: 'activity' as const, color: '#c8a45a' },
                    { label: tr('wonDealsLabel'), value: stageCountMap.won,  icon: 'check-circle'as const, color: '#059669' },
                    { label: tr('lostDealsLabel'),value: stageCountMap.lost, icon: 'x-circle'   as const, color: '#dc2626' },
                    { label: 'Site Visits',    value: siteVisitCount,       icon: 'calendar'    as const, color: '#7c3aed' },
                    { label: 'Projects',       value: projects.length,      icon: 'layers'      as const, color: '#102a43' },
                  ].map((row, i, arr) => (
                    <View
                      key={row.label}
                      style={[an.perfRow, { borderBottomColor: colors.border, borderBottomWidth: i < arr.length - 1 ? 1 : 0 }]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Feather name={row.icon} size={13} color={row.color} />
                        <Text style={[an.perfLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                      </View>
                      <Text style={[an.perfValue, { color: row.color }]}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </AnimatedReveal>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const an = StyleSheet.create({
  screen:        { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center' },
  backBtn:       { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow:       { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title:         { fontFamily: 'Inter_700Bold', fontSize: 22 },
  subtitle:      { fontFamily: 'Inter_400Regular', fontSize: 12 },
  cardGrid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  cardWrap:      { width: '46.5%' },
  statCard:      { borderRadius: 16, borderWidth: 1, padding: 14, gap: 6 },
  cardIcon:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardValue:     { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.5 },
  cardLabel:     { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
  revCard:       { borderRadius: 16, padding: 16, marginBottom: 0 },
  revRow:        { flexDirection: 'row', alignItems: 'center' },
  revLabel:      { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#ffffffaa', marginBottom: 4 },
  revValue:      { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#ffffff', letterSpacing: -0.5 },
  revBadge:      { backgroundColor: '#ffffff22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  revBadgeText:  { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#ffffff' },
  section:       { borderRadius: 18, borderWidth: 1, padding: 16 },
  sectionTitle:  { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5 },
  convFooter:    { borderTopWidth: 1, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convFooterLabel:{ fontFamily: 'Inter_500Medium', fontSize: 12 },
  convFooterValue:{ fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.5 },
  perfRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  perfLabel:     { fontFamily: 'Inter_400Regular', fontSize: 12 },
  perfValue:     { fontFamily: 'Inter_700Bold', fontSize: 14 },
  emptyWrap:     { borderWidth: 1, borderRadius: 18, padding: 40, alignItems: 'center', gap: 12, borderStyle: 'dashed' },
  emptyTitle:    { fontFamily: 'Inter_700Bold', fontSize: 16 },
  emptyDesc:     { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
});
