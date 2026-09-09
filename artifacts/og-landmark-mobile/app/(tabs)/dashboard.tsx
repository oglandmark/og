import React, { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// BlurView removed — crashes Android GPU
import { useColors } from '@/hooks/useColors';
import { useMobileContent } from '@/hooks/useMobileContent';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { BrandMark } from '@/components/BrandMark';
import { getMyListings, calcListingStats } from '@/lib/listingsStore';
import { getLeads, Lead } from '@/lib/leadsStore';
import { getAgentVisits, isTodayVisit } from '@/lib/agentVisitsStore';
import {
  getDevProjects, calcDevStats, formatPKR, statusColor,
  DevStats, DeveloperProject,
} from '@/lib/developerStore';
import { getDevLeads, calcDevLeadStats } from '@/lib/devLeadsStore';
import { getSiteVisits, isUpcoming } from '@/lib/siteVisitStore';
import type { MobileContent } from '@/lib/api';

// ── Lead status display map ───────────────────────────────────────────────────
const LEAD_STATUS_MAP: Record<string, { label: string; color: string }> = {
  new:        { label: 'New',       color: '#1a6b3a' },
  contacted:  { label: 'Contacted', color: '#102a43' },
  interested: { label: 'Interested',color: '#c8a45a' },
  viewing:    { label: 'Viewing',   color: '#7c3aed' },
  closed:     { label: 'Closed',   color: '#888888' },
};

// ─────────────────────────────────────────────────────────────────────────────
//  DEVELOPER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function DeveloperDashboard({
  colors, router, insets, user, logout, tr, isRTL, portalCopy,
}: {
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  router: ReturnType<typeof useRouter>;
  insets: ReturnType<typeof useSafeAreaInsets>;
  user: ReturnType<typeof useAuth>['user'];
  logout: ReturnType<typeof useAuth>['logout'];
  tr: ReturnType<typeof useLanguage>['tr'];
  isRTL: boolean;
  portalCopy?: MobileContent['screens']['portals'];
}) {
  const rtl = isRTL ? 'right' as const : 'left' as const;
  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const [projects, setProjects]     = useState<DeveloperProject[]>([]);
  const [stats, setStats]           = useState<DevStats>({
    totalProjects: 0, activeProjects: 0, totalInventory: 0,
    availableUnits: 0, reservedUnits: 0, soldUnits: 0,
    totalListedValue: 0, reservedValue: 0, soldValue: 0,
  });
  const [devLeadStats, setDevLeadStats] = useState({ total: 0, newCount: 0, wonCount: 0, lostCount: 0 });
  const [visitCount, setVisitCount]     = useState(0);

  useFocusEffect(useCallback(() => {
    void getDevProjects(user?.id ?? '').then((p) => { setProjects(p); setStats(calcDevStats(p)); });
    void getDevLeads(user?.id ?? '').then((l) => setDevLeadStats(calcDevLeadStats(l)));
    void getSiteVisits(user?.id ?? '').then((v) => setVisitCount(v.filter(isUpcoming).length));
  }, [user?.id]));

  const isVerified = user?.verificationStatus === 'verified';
  const isPending  = user?.verificationStatus === 'pending';
  const firstName  = user?.name?.split(' ')[0] ?? '';
  const portal = portalCopy?.developer;

  const kpiCards = [
    { key: 'totalProjects', label: portal?.kpiLabels?.totalProjects || tr('totalProjects'), value: String(stats.totalProjects), icon: 'layers' as const, color: '#102a43' },
    { key: 'activeProjects', label: portal?.kpiLabels?.activeProjects || tr('activeProjects'), value: String(stats.activeProjects), icon: 'activity' as const, color: '#1a6b3a' },
    { key: 'availableUnits', label: portal?.kpiLabels?.availableUnits || tr('availableUnits'), value: String(stats.availableUnits), icon: 'grid' as const, color: '#c8a45a' },
    { key: 'reservedUnits', label: portal?.kpiLabels?.reservedUnits || tr('reservedUnits'), value: String(stats.reservedUnits), icon: 'lock' as const, color: '#6b3a1a' },
    { key: 'newLeads', label: portal?.kpiLabels?.newLeads || tr('devNewLeads'), value: String(devLeadStats.newCount), icon: 'users' as const, color: '#102a43' },
    { key: 'siteVisits', label: portal?.kpiLabels?.siteVisits || tr('devSiteVisits'), value: String(visitCount), icon: 'calendar' as const, color: '#1a6b3a' },
  ].filter((card) => portal?.statVisibility?.[card.key] !== false);

  const financialCards = [
    { key: 'totalListed', label: portal?.financialLabels?.totalListed || tr('totalListedValue'), value: stats.totalListedValue > 0 ? `PKR ${formatPKR(stats.totalListedValue)}` : '—', icon: 'trending-up' as const, color: '#102a43' },
    { key: 'reserved', label: portal?.financialLabels?.reserved || tr('reservedValue'), value: stats.reservedValue > 0 ? `PKR ${formatPKR(stats.reservedValue)}` : '—', icon: 'lock' as const, color: '#c8a45a' },
    { key: 'sold', label: portal?.financialLabels?.sold || tr('soldValue'), value: stats.soldValue > 0 ? `PKR ${formatPKR(stats.soldValue)}` : '—', icon: 'check-circle' as const, color: '#1a6b3a' },
  ];

  const quickActions = [
    { key: 'createProject', label: portal?.actionLabels?.createProject || tr('createProject'), icon: 'plus-circle' as const, onPress: () => router.push('/developer/create-project' as Parameters<typeof router.push>[0]) },
    { key: 'myProjects', label: portal?.actionLabels?.myProjects || tr('myProjects'), icon: 'layers' as const, onPress: () => router.push('/(tabs)/projects' as Parameters<typeof router.push>[0]) },
    { key: 'projectLeads', label: portal?.actionLabels?.projectLeads || tr('projectLeads'), icon: 'users' as const, onPress: () => router.push('/(tabs)/leads' as Parameters<typeof router.push>[0]) },
    { key: 'paymentPlans', label: portal?.actionLabels?.paymentPlans || tr('createPaymentPlan'), icon: 'credit-card' as const, onPress: () => router.push('/developer/payment-plans' as Parameters<typeof router.push>[0]) },
    { key: 'siteVisits', label: portal?.actionLabels?.siteVisits || tr('siteVisitsTitle'), icon: 'calendar' as const, onPress: () => router.push('/developer/site-visits' as Parameters<typeof router.push>[0]) },
    { key: 'analytics', label: portal?.actionLabels?.analytics || tr('analyticsTitle'), icon: 'bar-chart-2' as const, onPress: () => router.push('/developer/analytics' as Parameters<typeof router.push>[0]) },
    { key: 'team', label: portal?.actionLabels?.team || tr('teamTitle'), icon: 'user-check' as const, onPress: () => router.push('/developer/team' as Parameters<typeof router.push>[0]) },
    { key: 'documents', label: portal?.actionLabels?.documents || tr('documentsTitle'), icon: 'folder' as const, onPress: () => router.push('/developer/documents' as Parameters<typeof router.push>[0]) },
  ].filter((action) => portal?.actionVisibility?.[action.key] !== false);

  const recentProjects = projects.slice(0, 3);

  return (
    <ScrollView
      style={[ds.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: botPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <AnimatedReveal>
        <View style={[ds.topBar, { paddingHorizontal: 20 }]}>
          <BrandMark />
          <Pressable onPress={() => { void logout(); }} style={[ds.iconBtn, { backgroundColor: colors.secondary }]} hitSlop={8}>
            <Feather name="log-out" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </AnimatedReveal>

      {/* ── Company header ────────────────────────────────────────── */}
      <AnimatedReveal delay={60}>
        <View style={[ds.companyCard, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 20, marginTop: 16 }]}>
          <View style={[ds.companyIcon, { backgroundColor: colors.action + '18' }]}>
            <Feather name="layers" size={22} color={colors.action} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ds.companyName, { color: colors.foreground, textAlign: rtl }]} numberOfLines={1}>
              {user?.companyName ?? portal?.companyFallback ?? 'My Company'}
            </Text>
            <View style={ds.badgeRow}>
              {isVerified ? (
                <View style={[ds.badge, { backgroundColor: '#1a6b3a18' }]}>
                  <Feather name="shield" size={9} color="#1a6b3a" />
                  <Text style={[ds.badgeText, { color: '#1a6b3a' }]}>{tr('verifiedBadge')}</Text>
                </View>
              ) : isPending ? (
                <View style={[ds.badge, { backgroundColor: '#c8a45a18' }]}>
                  <Feather name="clock" size={9} color="#c8a45a" />
                  <Text style={[ds.badgeText, { color: '#c8a45a' }]}>{tr('pendingBadge')}</Text>
                </View>
              ) : (
                <View style={[ds.badge, { backgroundColor: colors.secondary }]}>
                  <Feather name="alert-circle" size={9} color={colors.mutedForeground} />
                  <Text style={[ds.badgeText, { color: colors.mutedForeground }]}>{tr('unverifiedBadge')}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
            <Text style={[ds.portalLabel, { color: colors.mutedForeground }]}>{portal?.title || tr('devCompanyPortal')}</Text>
            <Text style={[ds.greeting2, { color: colors.foreground }]}>{tr('hiGreeting')}, {firstName}</Text>
          </View>
        </View>
      </AnimatedReveal>

      {/* ── KPI cards ─────────────────────────────────────────────── */}
      {portal?.showOverview !== false && <AnimatedReveal delay={100}>
        <Text style={[ds.sectionLabel, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 28, marginBottom: 14, textAlign: rtl }]}>
          {portal?.overviewTitle || tr('devKpiOverview')}
        </Text>
        <View style={ds.kpiGrid}>
          {kpiCards.map((k, i) => (
            <AnimatedReveal key={k.label} delay={120 + i * 35} style={ds.kpiWrap}>
              <View style={[ds.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
                <View style={[ds.kpiIcon, { backgroundColor: k.color + '18' }]}>
                  <Feather name={k.icon} size={15} color={k.color} />
                </View>
                <Text style={[ds.kpiValue, { color: colors.foreground }]}>{k.value}</Text>
                <Text style={[ds.kpiLabel, { color: colors.mutedForeground, textAlign: rtl }]}>{k.label}</Text>
              </View>
            </AnimatedReveal>
          ))}
        </View>
      </AnimatedReveal>}

      {/* ── Inventory snapshot (4 pill chips) ────────────────────── */}
      {portal?.showInventory !== false && <AnimatedReveal delay={250}>
        <Text style={[ds.sectionLabel, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 26, marginBottom: 12, textAlign: rtl }]}>
          {portal?.inventoryTitle || tr('inventorySnapshot')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
            {[
            { label: `${portal?.inventoryLabels?.total || tr('unitsTotal')}: ${stats.totalInventory}`, color: colors.foreground, bg: colors.secondary },
            { label: `${portal?.inventoryLabels?.available || tr('availableLabel')}: ${stats.availableUnits}`, color: '#1a6b3a', bg: '#1a6b3a18' },
            { label: `${portal?.inventoryLabels?.reserved || tr('reservedLabel')}: ${stats.reservedUnits}`, color: '#c8a45a', bg: '#c8a45a18' },
            { label: `${portal?.inventoryLabels?.sold || tr('soldLabel')}: ${stats.soldUnits}`, color: colors.mutedForeground, bg: colors.secondary },
          ].map((chip) => (
            <View key={chip.label} style={[ds.chip, { backgroundColor: chip.bg }]}>
              <Text style={[ds.chipText, { color: chip.color }]}>{chip.label}</Text>
            </View>
          ))}
        </ScrollView>
      </AnimatedReveal>}

      {/* ── Financial overview ────────────────────────────────────── */}
      {portal?.showFinancial !== false && <AnimatedReveal delay={300}>
        <Text style={[ds.sectionLabel, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 26, marginBottom: 12, textAlign: rtl }]}>
          {portal?.financialTitle || tr('financialOverview')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {financialCards.map((f) => (
            <View key={f.label} style={[ds.finCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
              <View style={[ds.finIcon, { backgroundColor: f.color + '18' }]}>
                <Feather name={f.icon} size={16} color={f.color} />
              </View>
              <Text style={[ds.finValue, { color: colors.foreground }]}>{f.value}</Text>
              <Text style={[ds.finLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
            </View>
          ))}
        </ScrollView>
      </AnimatedReveal>}

      {/* ── Promote banner ────────────────────────────────────────── */}
      {portal?.showPromotion !== false && <AnimatedReveal delay={330}>
        <Pressable
          onPress={() => router.push('/developer/promote' as Parameters<typeof router.push>[0])}
          style={({ pressed }) => [ds.promoteBanner, { backgroundColor: colors.action, opacity: pressed ? 0.88 : 1, marginHorizontal: 20, marginTop: 22 }]}
        >
          <View style={ds.promoteBannerLeft}>
            <View style={ds.promoteBannerIconWrap}>
              <Feather name="zap" size={20} color="#c8a45a" />
            </View>
            <View>
              <Text style={ds.promoteBannerTitle}>{portal?.promotionLabel || tr('promoteBannerLabel')}</Text>
              <Text style={ds.promoteBannerDesc}>{portal?.promotionDescription || tr('promoteBannerDesc')}</Text>
            </View>
          </View>
          <Feather name="arrow-right" size={18} color="#ffffff99" />
        </Pressable>
      </AnimatedReveal>}

      {/* ── Quick actions ─────────────────────────────────────────── */}
      {portal?.showQuickActions !== false && <AnimatedReveal delay={350}>
        <Text style={[ds.sectionLabel, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 22, marginBottom: 14, textAlign: rtl }]}>
          {portal?.quickActionsTitle || tr('sectionQuickActions')}
        </Text>
        <View style={ds.kpiGrid}>
          {quickActions.map((a, i) => (
            <AnimatedReveal key={a.label} delay={370 + i * 30} style={ds.kpiWrap}>
              <Pressable
                onPress={a.onPress}
                style={({ pressed }) => [ds.actionCard, { backgroundColor: colors.action, opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={ds.actionIcon}>
                  <Feather name={a.icon} size={18} color="#ffffff" />
                </View>
                <Text style={[ds.actionLabel, { textAlign: rtl }]}>{a.label}</Text>
              </Pressable>
            </AnimatedReveal>
          ))}
        </View>
      </AnimatedReveal>}

      {/* ── Recent projects ───────────────────────────────────────── */}
      {portal?.showRecentProjects !== false && <AnimatedReveal delay={460}>
        <View style={[ds.sectionHeader, { paddingHorizontal: 20, marginTop: 28 }]}>
          <Text style={[ds.sectionLabel, { color: colors.mutedForeground, textAlign: rtl }]}>
            {portal?.recentProjectsTitle || tr('sectionRecentProjects')}
          </Text>
          <Pressable onPress={() => router.push('/(tabs)/projects' as Parameters<typeof router.push>[0])}>
            <Text style={[ds.viewAll, { color: colors.action }]}>{portal?.viewAllProjects || tr('viewAllProjects')}</Text>
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 20, marginTop: 12, gap: 10 }}>
          {recentProjects.length === 0 ? (
            <AnimatedReveal delay={480}>
              <Pressable
                onPress={() => router.push('/developer/create-project' as Parameters<typeof router.push>[0])}
                style={[ds.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Feather name="layers" size={28} color={colors.mutedForeground} style={{ marginBottom: 10 }} />
                <Text style={[ds.emptyTitle, { color: colors.foreground }]}>{portal?.noProjectsTitle || tr('noProjectsYet')}</Text>
                <Text style={[ds.emptyDesc, { color: colors.mutedForeground }]}>{portal?.noProjectsDescription || tr('noProjectsDesc')}</Text>
                <View style={[ds.emptyBtn, { backgroundColor: colors.action }]}>
                  <Feather name="plus" size={14} color="#ffffff" />
                  <Text style={ds.emptyBtnText}>{portal?.createFirstProject || tr('createFirstProject')}</Text>
                </View>
              </Pressable>
            </AnimatedReveal>
          ) : (
            recentProjects.map((p, i) => {
              const sc = statusColor(p.status);
              return (
                <AnimatedReveal key={p.id} delay={480 + i * 50}>
                  <Pressable
                    onPress={() => router.push('/(tabs)/projects' as Parameters<typeof router.push>[0])}
                    style={[ds.projectCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={[ds.projectIconBox, { backgroundColor: colors.action + '18' }]}>
                      <Feather name="layers" size={20} color={colors.action} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[ds.projectName, { color: colors.foreground, textAlign: rtl }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={[ds.projectType, { color: colors.mutedForeground, textAlign: rtl }]}>
                        {p.type} · {p.city}
                      </Text>
                    </View>
                    <View style={[ds.statusPill, { backgroundColor: sc.bg }]}>
                      <Text style={[ds.statusPillText, { color: sc.text }]}>{p.status}</Text>
                    </View>
                  </Pressable>
                </AnimatedReveal>
              );
            })
          )}
        </View>
      </AnimatedReveal>}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const colors  = useColors();
  const content = useMobileContent();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user, role, logout } = useAuth();
  const { tr, isRTL } = useLanguage();

  const isAgent     = role === 'agent';
  const isDeveloper = role === 'developer';
  const topPad  = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad  = insets.bottom + (Platform.OS === 'web' ? 34 : 0);
  const rtl     = isRTL ? 'right' as const : 'left' as const;
  const isPending = user?.verificationStatus === 'pending';
  const portalCopy = content?.screens?.portals;
  const agentPortal = portalCopy?.agent;

  // Agent-specific state
  const [activeListingsCount, setActiveListingsCount] = useState(0);
  const [totalViews, setTotalViews]                   = useState(0);
  const [newLeadsCount, setNewLeadsCount]             = useState(0);
  const [totalLeadsCount, setTotalLeadsCount]         = useState(0);
  const [todayVisits, setTodayVisits]                 = useState(0);
  const [upcomingVisits, setUpcomingVisits]           = useState(0);
  const [recentLeads, setRecentLeads]                 = useState<Lead[]>([]);
  const [dashboardLoading, setDashboardLoading]       = useState(false);
  const [dashboardError, setDashboardError]           = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!isAgent) return;
      void (async () => {
        setDashboardLoading(true);
        setDashboardError('');
        try {
          const [myListings, leads, visits] = await Promise.all([
            getMyListings(user?.id ?? ''),
            getLeads(),
            getAgentVisits(user?.id ?? ''),
          ]);
          const lstats = calcListingStats(myListings);
          setActiveListingsCount(lstats.active);
          setTotalViews(lstats.totalViews);
          setNewLeadsCount(leads.filter((l) => l.status === 'new').length);
          setTotalLeadsCount(leads.length);
          setTodayVisits(visits.filter(isTodayVisit).length);
          setUpcomingVisits(visits.filter((v) => !isTodayVisit(v) && (v.status === 'Confirmed' || v.status === 'Requested')).length);
          setRecentLeads(leads.slice(0, 4));
        } catch {
          setDashboardError('We could not refresh your portal data. Please try again.');
        } finally {
          setDashboardLoading(false);
        }
      })();
    }, [isAgent, user?.id]),
  );

  // ── Developer dashboard ──────────────────────────────────────────
  if (isDeveloper) {
    return (
      <DeveloperDashboard
        colors={colors}
        router={router}
        insets={insets}
        user={user}
        logout={logout}
        tr={tr}
        isRTL={isRTL}
        portalCopy={portalCopy}
      />
    );
  }

  // ── Agent / other dashboard ──────────────────────────────────────
  const agentStats = [
    { key: 'activeListings', label: agentPortal?.statLabels?.activeListings || tr('activeListings'), value: String(activeListingsCount), icon: 'home' as const, color: '#102a43', route: '/(tabs)/listings' },
    { key: 'totalViews', label: agentPortal?.statLabels?.totalViews || tr('totalViews'), value: String(totalViews), icon: 'eye' as const, color: '#1a6b3a', route: '/settings/analytics' },
    { key: 'newLeads', label: agentPortal?.statLabels?.newLeads || tr('newLeads'), value: String(newLeadsCount), icon: 'users' as const, color: '#c8a45a', route: '/(tabs)/leads' },
    { key: 'totalLeads', label: agentPortal?.statLabels?.totalLeads || agentPortal?.totalLeadsLabel || 'Total Leads', value: String(totalLeadsCount), icon: 'user-check' as const, color: '#1a6b3a', route: '/(tabs)/leads' },
    { key: 'todayVisits', label: agentPortal?.statLabels?.todayVisits || agentPortal?.todayVisitsLabel || "Today's Visits", value: String(todayVisits), icon: 'calendar' as const, color: '#7c3aed', route: '/agent/visits' },
    { key: 'upcomingVisits', label: agentPortal?.statLabels?.upcomingVisits || agentPortal?.upcomingVisitsLabel || 'Upcoming Visits', value: String(upcomingVisits), icon: 'clock' as const, color: '#b94b42', route: '/agent/visits' },
  ].filter((card) => agentPortal?.statVisibility?.[card.key] !== false);
  const agentActions = [
    { key: 'postProperty', label: agentPortal?.actionLabels?.postProperty || 'Post Property', icon: 'plus-circle' as const, route: '/(tabs)/post-ad' },
    { key: 'myListings', label: agentPortal?.actionLabels?.myListings || 'My Listings', icon: 'home' as const, route: '/(tabs)/listings' },
    { key: 'leads', label: agentPortal?.actionLabels?.leads || 'CRM / Leads', icon: 'users' as const, route: '/(tabs)/leads' },
    { key: 'addLead', label: agentPortal?.actionLabels?.addLead || 'Add Lead', icon: 'user-plus' as const, route: '/agent/add-lead' },
    { key: 'visits', label: agentPortal?.actionLabels?.visits || 'Schedule Visit', icon: 'calendar' as const, route: '/agent/visits' },
    { key: 'messages', label: agentPortal?.actionLabels?.messages || 'Messages', icon: 'message-circle' as const, route: '/(tabs)/messages' },
  ].filter((action) => agentPortal?.actionVisibility?.[action.key] !== false);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: botPad + 96 }}
      showsVerticalScrollIndicator={false}
    >
      <AnimatedReveal>
        <View style={[styles.header, { paddingHorizontal: 20 }]}>
          <BrandMark />
          <Pressable onPress={() => { void logout(); }} style={[styles.headerBtn, { backgroundColor: colors.secondary }]} hitSlop={8}>
            <Feather name="log-out" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <Text style={[styles.greeting, { color: colors.mutedForeground, textAlign: rtl }]}>{agentPortal?.title || tr('agentPortal')}</Text>
          <Text style={[styles.userName, { color: colors.foreground, textAlign: rtl }]}>
            {tr('hiGreeting')}, {user?.name?.split(' ')[0] ?? ''}
          </Text>
          {user?.agencyName && (
            <Text style={[styles.agencyName, { color: colors.primary, textAlign: rtl }]}>{user.agencyName}</Text>
          )}
        </View>
      </AnimatedReveal>

      {dashboardError && (
        <View style={[styles.verifyBanner, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '30', marginHorizontal: 20, marginTop: 16 }]}>
          <Feather name="wifi-off" size={18} color={colors.destructive} />
          <Text style={[styles.verifyDesc, { color: colors.destructive, flex: 1 }]}>{dashboardError}</Text>
        </View>
      )}

      {isPending && (
        <AnimatedReveal delay={80}>
          <View style={[styles.verifyBanner, { backgroundColor: colors.accent, borderColor: colors.primary + '44', marginHorizontal: 20, marginTop: 16 }]}>
            <View style={[styles.verifyIconWrap, { backgroundColor: colors.primary + '22' }]}>
              <Feather name="clock" size={18} color={colors.accentForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.verifyTitle, { color: colors.accentForeground, textAlign: rtl }]}>{agentPortal?.pendingTitle || tr('verificationPending')}</Text>
              <Text style={[styles.verifyDesc, { color: colors.accentForeground + 'cc', textAlign: rtl }]}>{agentPortal?.pendingSubtitle || tr('verificationPendingDesc')}</Text>
            </View>
          </View>
        </AnimatedReveal>
      )}

      {/* KPI Grid — 6 cards, clickable */}
      {agentPortal?.showOverview !== false && <AnimatedReveal delay={100}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 28, marginBottom: 14, textAlign: rtl }]}>
          {agentPortal?.overviewTitle || tr('sectionOverview')}
        </Text>
        <View style={styles.statsGrid}>
          {agentStats.map((s, i) => (
            <AnimatedReveal key={s.label} delay={120 + i * 30} style={styles.statCardWrap}>
              <Pressable
                onPress={() => router.push(s.route as Parameters<typeof router.push>[0])}
                style={({ pressed }) => [styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
                <View style={[styles.statIconWrap, { backgroundColor: s.color + '18' }]}>
                  <Feather name={s.icon} size={18} color={s.color} />
                </View>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{dashboardLoading ? '—' : s.value}</Text>
                <Text style={[styles.statLabel2, { color: colors.mutedForeground, textAlign: rtl }]}>{s.label}</Text>
              </Pressable>
            </AnimatedReveal>
          ))}
        </View>
      </AnimatedReveal>}

      {/* Quick Actions — 6 cards */}
      {agentPortal?.showQuickActions !== false && <AnimatedReveal delay={200}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 28, marginBottom: 14, textAlign: rtl }]}>
          {agentPortal?.quickActionsTitle || tr('sectionQuickActions')}
        </Text>
        <View style={styles.actionsGrid}>
          {agentActions.map((a, i) => (
            <AnimatedReveal key={a.label} delay={220 + i * 30} style={styles.statCardWrap}>
              <Pressable
                onPress={() => router.push(a.route as Parameters<typeof router.push>[0])}
                style={({ pressed }) => [styles.actionCard, { backgroundColor: colors.action, opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: '#ffffff22' }]}>
                  <Feather name={a.icon} size={20} color="#ffffff" />
                </View>
                <Text style={[styles.actionLabel, { textAlign: rtl }]}>{a.label}</Text>
              </Pressable>
            </AnimatedReveal>
          ))}
        </View>
      </AnimatedReveal>}

      {/* Recent Leads — real from store */}
      {agentPortal?.showRecentLeads !== false && <AnimatedReveal delay={280}>
        <View style={[styles.sectionHeader, { paddingHorizontal: 20, marginTop: 28 }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign: rtl }]}>{agentPortal?.recentLeadsTitle || tr('sectionRecentLeads')}</Text>
          <Pressable onPress={() => router.push('/(tabs)/leads')}>
            <Text style={[styles.viewAll, { color: colors.action }]}>{agentPortal?.viewAllLeads || tr('viewAllLeads')}</Text>
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 20, marginTop: 12, gap: 10 }}>
          {recentLeads.length === 0 ? (
            <AnimatedReveal delay={300}>
              <View style={[styles.leadCard, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', paddingVertical: 24 }]}>
                <Feather name="users" size={28} color={colors.mutedForeground} />
                <Text style={[styles.leadName, { color: colors.mutedForeground, marginTop: 8 }]}>{agentPortal?.noLeadsTitle || 'No leads yet'}</Text>
                <Text style={[styles.leadProp, { color: colors.mutedForeground, textAlign: 'center' }]}>{agentPortal?.noLeadsSubtitle || 'Your new inquiries will appear here'}</Text>
              </View>
            </AnimatedReveal>
          ) : (
            recentLeads.map((lead, i) => {
              const lsm = LEAD_STATUS_MAP[lead.status] ?? { label: lead.status, color: '#888' };
              return (
                <AnimatedReveal key={lead.id} delay={300 + i * 50}>
                  <Pressable
                    onPress={() => router.push('/(tabs)/leads')}
                    style={[styles.leadCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={[styles.leadAvatar, { backgroundColor: colors.action }]}>
                      <Text style={styles.leadAvatarText}>{lead.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.leadName, { color: colors.foreground, textAlign: rtl }]}>{lead.name}</Text>
                      <Text style={[styles.leadProp, { color: colors.mutedForeground, textAlign: rtl }]} numberOfLines={1}>{lead.property}</Text>
                      <Text style={[styles.leadTime, { color: colors.mutedForeground, textAlign: rtl }]}>{lead.time}</Text>
                    </View>
                    <View style={[styles.leadStatus, { backgroundColor: lsm.color + '18' }]}>
                      <Text style={[styles.leadStatusText, { color: lsm.color }]}>{lsm.label}</Text>
                    </View>
                  </Pressable>
                </AnimatedReveal>
              );
            })
          )}
        </View>
      </AnimatedReveal>}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STYLES — Developer Dashboard
// ─────────────────────────────────────────────────────────────────────────────
const ds = StyleSheet.create({
  screen:        { flex: 1 },
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn:       { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  companyCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14 },
  companyIcon:   { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  companyName:   { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 5 },
  badgeRow:      { flexDirection: 'row' },
  badge:         { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:     { fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  portalLabel:   { fontFamily: 'Inter_400Regular', fontSize: 9, marginBottom: 2 },
  greeting2:     { fontFamily: 'Inter_700Bold', fontSize: 14 },
  sectionLabel:  { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewAll:       { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  kpiGrid:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  kpiWrap:       { width: '46.5%' },
  kpiCard:       { borderRadius: 16, borderWidth: 1, padding: 12, overflow: 'hidden', gap: 6 },
  kpiIcon:       { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue:      { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5 },
  kpiLabel:      { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
  chip:          { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText:      { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  finCard:       { borderWidth: 1, borderRadius: 16, padding: 16, width: 140, overflow: 'hidden', gap: 8 },
  finIcon:       { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  finValue:      { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },
  finLabel:      { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
  actionCard:    { borderRadius: 16, padding: 16, gap: 10 },
  actionIcon:    { width: 40, height: 40, borderRadius: 12, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' },
  actionLabel:   { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ffffff', lineHeight: 17 },
  promoteBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18 },
  promoteBannerLeft:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  promoteBannerIconWrap:{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#ffffff18', alignItems: 'center', justifyContent: 'center' },
  promoteBannerTitle:   { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#ffffff', marginBottom: 3 },
  promoteBannerDesc:    { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#ffffffaa' },
  emptyCard:     { borderWidth: 1, borderRadius: 18, padding: 28, alignItems: 'center', gap: 8, borderStyle: 'dashed' },
  emptyTitle:    { fontFamily: 'Inter_700Bold', fontSize: 15, textAlign: 'center' },
  emptyDesc:     { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  emptyBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
  emptyBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#ffffff' },
  projectCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  projectIconBox:{ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  projectName:   { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 4 },
  projectType:   { fontFamily: 'Inter_400Regular', fontSize: 11 },
  statusPill:    { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  statusPillText:{ fontFamily: 'Inter_600SemiBold', fontSize: 9 },
});

// ─────────────────────────────────────────────────────────────────────────────
//  STYLES — Agent Dashboard (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:       { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn:    { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  greeting:     { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 4 },
  userName:     { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.3 },
  agencyName:   { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 4 },
  verifyBanner: { borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  verifyIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  verifyTitle:  { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 3 },
  verifyDesc:   { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewAll:      { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  statCardWrap: { width: '46.5%' },
  statCard:     { borderRadius: 16, borderWidth: 1, padding: 14, overflow: 'hidden', gap: 8 },
  statIconWrap: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statValue:    { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.5 },
  statLabel2:   { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15 },
  actionsGrid:  { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  actionCard:   { borderRadius: 16, padding: 16, gap: 10 },
  actionIconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actionLabel:  { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ffffff', lineHeight: 17 },
  leadCard:     { borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  leadAvatar:   { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  leadAvatarText:{ fontFamily: 'Inter_700Bold', fontSize: 15, color: '#ffffff' },
  leadName:     { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 2 },
  leadProp:     { fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 2 },
  leadTime:     { fontFamily: 'Inter_400Regular', fontSize: 10 },
  leadStatus:   { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  leadStatusText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
});
