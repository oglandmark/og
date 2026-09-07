/**
 * Agent Analytics Screen — real data from leadsStore + listingsStore.
 */
import React, { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { getLeads, Lead } from '@/lib/leadsStore';
import { getMyListings, UserListing, calcListingStats } from '@/lib/listingsStore';
import { getAgentVisits } from '@/lib/agentVisitsStore';

type Period = '7d' | '30d' | '90d' | '6m';

const PERIOD_LABELS: Record<Period, string> = {
  '7d':  '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  '6m':  '6 Months',
};

// Filter leads/listings based on period
function cutoffDate(period: Period): Date {
  const now = Date.now();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 180;
  return new Date(now - days * 86_400_000);
}

function ChangeChip({ val }: { val: number }) {
  const isPos = val >= 0;
  return (
    <View style={[chip.wrap, { backgroundColor: isPos ? '#05966918' : '#b94b4218' }]}>
      <Feather name={isPos ? 'trending-up' : 'trending-down'} size={10} color={isPos ? '#059669' : '#b94b42'} />
      <Text style={[chip.text, { color: isPos ? '#059669' : '#b94b42' }]}>{isPos ? '+' : ''}{val}%</Text>
    </View>
  );
}
const chip = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  text: { fontFamily: 'Inter_600SemiBold', fontSize: 9 },
});

function BarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const H = 72;
  const bars = data.slice(-14);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H + 8, gap: 3 }}>
      {bars.map((v, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: H + 8 }}>
          <View style={{ width: '100%', height: Math.max(4, (v / max) * H), backgroundColor: color, borderRadius: 3, opacity: 0.5 + 0.5 * (v / max) }} />
        </View>
      ))}
    </View>
  );
}

// Build a simple bar chart data array from a list of dated items
function buildChartData(items: { createdAt?: string; postedAt?: string }[], days: number): number[] {
  const bins = Array(Math.min(days, 30)).fill(0);
  const now = Date.now();
  items.forEach((item) => {
    const ts = item.createdAt ?? item.postedAt;
    if (!ts) return;
    const diff = Math.floor((now - new Date(ts).getTime()) / 86_400_000);
    const bin = bins.length - 1 - diff;
    if (bin >= 0 && bin < bins.length) bins[bin]++;
  });
  return bins;
}

// Insight generator from real data
function buildInsights(leads: Lead[], listings: UserListing[]): string[] {
  const insights: string[] = [];
  const newLeads = leads.filter((l) => l.status === 'new').length;
  if (newLeads > 0) insights.push(`${newLeads} new lead${newLeads > 1 ? 's' : ''} need${newLeads === 1 ? 's' : ''} follow-up.`);
  const activeListings = listings.filter((l) => l.listingStatus === 'Active');
  if (activeListings.length === 0) insights.push('Post a listing to start receiving leads from buyers.');
  const topListing = activeListings.sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0];
  if (topListing && (topListing.views ?? 0) > 0) insights.push(`Your top listing has ${topListing.views} views: "${topListing.title}".`);
  const closedRate = leads.length > 0 ? Math.round((leads.filter((l) => l.status === 'closed').length / leads.length) * 100) : 0;
  if (closedRate > 0) insights.push(`Conversion rate: ${closedRate}% of leads closed.`);
  else if (leads.length > 0) insights.push(`Follow up on ${leads.filter((l) => l.status === 'interested').length} interested leads to improve conversion.`);
  if (insights.length === 0) insights.push('Start by posting a listing to track your performance here.');
  return insights;
}

export default function AnalyticsScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const [period, setPeriod]     = useState<Period>('30d');
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [listings, setListings] = useState<UserListing[]>([]);
  const [visits, setVisits]     = useState(0);

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [l, ls, v] = await Promise.all([
          getLeads(),
          getMyListings(user?.id ?? ''),
          getAgentVisits(user?.id ?? ''),
        ]);
        setLeads(l);
        setListings(ls);
        setVisits(v.filter((v2) => v2.status === 'Completed').length);
      })();
    }, [user?.id]),
  );

  const cutoff = cutoffDate(period);
  const periodLeads    = leads.filter((l) => !l.createdAt || new Date(l.createdAt) >= cutoff);
  const periodListings = listings.filter((l) => !l.postedAt || new Date(l.postedAt) >= cutoff);

  const lstats = calcListingStats(listings);
  const totalViews  = lstats.totalViews;
  const totalSaves  = lstats.totalSaves;
  const newLeads    = leads.filter((l) => l.status === 'new').length;
  const closedLeads = leads.filter((l) => l.status === 'closed').length;
  const wonDeals    = closedLeads; // "closed" leads treated as won deals for now

  const chartLeads    = buildChartData(periodLeads, period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 180);
  const chartListings = buildChartData(periodListings, period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 180);

  const topListings = [...listings]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 3);

  const insights = buildInsights(leads, listings);

  const conversionRate = leads.length > 0 ? Math.round((closedLeads / leads.length) * 100) : 0;

  const kpis = [
    { label: 'Active Listings',  value: lstats.active,  icon: 'home'       as const, color: '#102a43', change: 0 },
    { label: 'Total Leads',      value: leads.length,   icon: 'users'      as const, color: '#1a6b3a', change: 0 },
    { label: 'New Leads',        value: newLeads,       icon: 'user-plus'  as const, color: '#c8a45a', change: 0 },
    { label: 'Deals Closed',     value: wonDeals,       icon: 'check-circle'as const,color: '#7c3aed', change: 0 },
    { label: 'Total Views',      value: totalViews,     icon: 'eye'        as const, color: '#1a6b3a', change: 0 },
    { label: 'Saves',            value: totalSaves,     icon: 'bookmark'   as const, color: '#c8a45a', change: 0 },
    { label: 'Visits Done',      value: visits,         icon: 'calendar'   as const, color: '#7c3aed', change: 0 },
    { label: 'Conversion %',     value: conversionRate, icon: 'trending-up'as const, color: '#059669', change: 0 },
  ];

  const funnelRows = [
    { label: 'Listings',  value: lstats.total,                                   color: '#102a43' },
    { label: 'Views',     value: totalViews,                                      color: '#1a6b3a' },
    { label: 'Leads',     value: leads.length,                                   color: '#c8a45a' },
    { label: 'Interested',value: leads.filter((l) => l.status === 'interested').length, color: '#7c3aed' },
    { label: 'Closed',    value: closedLeads,                                    color: '#059669' },
  ];
  const funnelMax = Math.max(...funnelRows.map((r) => r.value), 1);

  return (
    <ScrollView
      style={[st.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <AnimatedReveal>
        <View style={st.header}>
          <Pressable onPress={() => router.back()}
            style={[st.backBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]} hitSlop={8}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[st.eyebrow, { color: colors.mutedForeground }]}>AGENT PORTAL</Text>
            <Text style={[st.title, { color: colors.foreground }]}>Performance Analytics</Text>
          </View>
        </View>
      </AnimatedReveal>

      {/* Period picker */}
      <AnimatedReveal delay={40}>
        <View style={[st.periodRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          {(['7d', '30d', '90d', '6m'] as Period[]).map((p) => (
            <Pressable key={p} onPress={() => setPeriod(p)}
              style={[st.periodBtn, period === p && { backgroundColor: colors.action }]}>
              <Text style={[st.periodBtnText, { color: period === p ? colors.actionForeground : colors.mutedForeground }]}>
                {PERIOD_LABELS[p]}
              </Text>
            </Pressable>
          ))}
        </View>
      </AnimatedReveal>

      {/* KPI grid — 2×4 */}
      <AnimatedReveal delay={70}>
        <View style={st.kpiGrid}>
          {kpis.map((kpi) => (
            <View key={kpi.label} style={[st.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[st.kpiIcon, { backgroundColor: kpi.color + '18' }]}>
                <Feather name={kpi.icon} size={15} color={kpi.color} />
              </View>
              <Text style={[st.kpiValue, { color: colors.foreground }]}>{kpi.value}</Text>
              <Text style={[st.kpiLabel, { color: colors.mutedForeground }]}>{kpi.label}</Text>
              {kpi.label === 'Conversion %' && <ChangeChip val={conversionRate} />}
            </View>
          ))}
        </View>
      </AnimatedReveal>

      {/* Leads chart */}
      <AnimatedReveal delay={100}>
        <View style={[st.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[st.chartTitle, { color: colors.foreground }]}>Lead Trend</Text>
          <Text style={[st.chartSub, { color: colors.mutedForeground }]}>Last {PERIOD_LABELS[period]}</Text>
          <BarChart data={chartLeads} color={colors.action} />
          <View style={st.chartAxis}>
            <Text style={[st.chartAxisText, { color: colors.mutedForeground }]}>Older</Text>
            <Text style={[st.chartAxisText, { color: colors.mutedForeground }]}>Today</Text>
          </View>
        </View>
      </AnimatedReveal>

      {/* Listings chart */}
      {lstats.total > 0 && (
        <AnimatedReveal delay={120}>
          <View style={[st.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[st.chartTitle, { color: colors.foreground }]}>Listings Posted</Text>
            <Text style={[st.chartSub, { color: colors.mutedForeground }]}>Last {PERIOD_LABELS[period]}</Text>
            <BarChart data={chartListings} color="#102a43" />
          </View>
        </AnimatedReveal>
      )}

      {/* Funnel */}
      <AnimatedReveal delay={140}>
        <Text style={[st.sectionLabel, { color: colors.mutedForeground }]}>PIPELINE FUNNEL</Text>
        <View style={[st.funnelCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {funnelRows.map((row, i) => {
            const pct = Math.round((row.value / funnelMax) * 100);
            return (
              <View key={row.label}>
                {i > 0 && <View style={[st.divider, { backgroundColor: colors.border }]} />}
                <View style={st.funnelRow}>
                  <Text style={[st.funnelLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                  <View style={st.funnelBarWrap}>
                    <View style={[st.funnelBar, { width: `${pct}%` as `${number}%`, backgroundColor: row.color + '40' }]}>
                      <View style={[st.funnelBarInner, { backgroundColor: row.color, width: '50%' }]} />
                    </View>
                  </View>
                  <Text style={[st.funnelValue, { color: colors.foreground }]}>{row.value}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </AnimatedReveal>

      {/* Top Listings */}
      {topListings.length > 0 && (
        <AnimatedReveal delay={160}>
          <Text style={[st.sectionLabel, { color: colors.mutedForeground }]}>TOP PERFORMING LISTINGS</Text>
          <View style={[st.listingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {topListings.map((l, i) => (
              <View key={l.id}>
                {i > 0 && <View style={[st.divider, { backgroundColor: colors.border }]} />}
                <View style={st.listingRow}>
                  <View style={[st.rankBadge, { backgroundColor: i === 0 ? '#c8a45a22' : colors.secondary }]}>
                    <Text style={[st.rankText, { color: i === 0 ? '#c8a45a' : colors.mutedForeground }]}>#{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.listingTitle, { color: colors.foreground }]} numberOfLines={1}>{l.title}</Text>
                    <Text style={[st.listingArea, { color: colors.mutedForeground }]}>{l.city}</Text>
                  </View>
                  <View style={st.miniStats}>
                    <View style={st.miniStat}>
                      <Feather name="eye"   size={10} color={colors.mutedForeground} />
                      <Text style={[st.miniStatText, { color: colors.foreground }]}>{l.views ?? 0}</Text>
                    </View>
                    <View style={st.miniStat}>
                      <Feather name="users" size={10} color="#1a6b3a" />
                      <Text style={[st.miniStatText, { color: colors.foreground }]}>{l.leadsCount ?? 0}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </AnimatedReveal>
      )}

      {/* Performance Insights */}
      <AnimatedReveal delay={180}>
        <Text style={[st.sectionLabel, { color: colors.mutedForeground }]}>INSIGHTS</Text>
        <View style={[st.insightsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {insights.map((txt, i) => (
            <View key={i} style={[st.insightRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Feather name="zap" size={13} color={colors.action} />
              <Text style={[st.insightText, { color: colors.foreground }]}>{txt}</Text>
            </View>
          ))}
        </View>
      </AnimatedReveal>

      {/* Lead Breakdown */}
      <AnimatedReveal delay={200}>
        <Text style={[st.sectionLabel, { color: colors.mutedForeground }]}>LEAD STATUS BREAKDOWN</Text>
        <View style={[st.listingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: 'New',        count: leads.filter((l) => l.status === 'new').length,        color: '#1a6b3a' },
            { label: 'Contacted',  count: leads.filter((l) => l.status === 'contacted').length,  color: '#102a43' },
            { label: 'Interested', count: leads.filter((l) => l.status === 'interested').length, color: '#c8a45a' },
            { label: 'Viewing',    count: leads.filter((l) => l.status === 'viewing').length,    color: '#7c3aed' },
            { label: 'Closed',     count: closedLeads,                                           color: '#059669' },
          ].map((row, i) => (
            <View key={row.label}>
              {i > 0 && <View style={[st.divider, { backgroundColor: colors.border }]} />}
              <View style={[st.funnelRow, { paddingVertical: 12 }]}>
                <View style={[st.dot, { backgroundColor: row.color }]} />
                <Text style={[st.funnelLabel, { color: colors.foreground, width: 80 }]}>{row.label}</Text>
                <View style={st.funnelBarWrap}>
                  <View style={[st.funnelBar, {
                    width: leads.length > 0 ? `${Math.round((row.count / leads.length) * 100)}%` as `${number}%` : '0%',
                    backgroundColor: row.color + '40',
                  }]}>
                    <View style={[st.funnelBarInner, { backgroundColor: row.color }]} />
                  </View>
                </View>
                <Text style={[st.funnelValue, { color: colors.foreground }]}>{row.count}</Text>
              </View>
            </View>
          ))}
        </View>
      </AnimatedReveal>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen:          { flex: 1 },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  backBtn:         { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow:         { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title:           { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.3 },
  periodRow:       { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4, marginBottom: 20 },
  periodBtn:       { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  periodBtnText:   { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  kpiGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  kpiCard:         { width: '47.5%', borderRadius: 15, borderWidth: 1, padding: 12, gap: 5 },
  kpiIcon:         { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue:        { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5 },
  kpiLabel:        { fontFamily: 'Inter_400Regular', fontSize: 10 },
  chartCard:       { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 20 },
  chartTitle:      { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 2 },
  chartSub:        { fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 14 },
  chartAxis:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  chartAxisText:   { fontFamily: 'Inter_400Regular', fontSize: 9 },
  sectionLabel:    { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },
  funnelCard:      { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 20 },
  funnelRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  funnelLabel:     { fontFamily: 'Inter_600SemiBold', fontSize: 11, width: 62 },
  funnelBarWrap:   { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#00000010', overflow: 'hidden' },
  funnelBar:       { height: '100%', borderRadius: 4, overflow: 'hidden' },
  funnelBarInner:  { height: '100%', borderRadius: 4, width: '50%' },
  funnelValue:     { fontFamily: 'Inter_700Bold', fontSize: 13, width: 28, textAlign: 'right' },
  divider:         { height: 1 },
  dot:             { width: 8, height: 8, borderRadius: 4 },
  listingsCard:    { borderRadius: 18, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  listingRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rankBadge:       { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rankText:        { fontFamily: 'Inter_700Bold', fontSize: 11 },
  listingTitle:    { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 2 },
  listingArea:     { fontFamily: 'Inter_400Regular', fontSize: 11 },
  miniStats:       { flexDirection: 'row', gap: 10 },
  miniStat:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniStatText:    { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  insightsCard:    { borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  insightRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  insightText:     { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1, lineHeight: 19 },
});
