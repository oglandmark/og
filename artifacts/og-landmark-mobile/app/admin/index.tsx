/**
 * Admin Dashboard — stats overview + quick actions
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import {
  getAdminStats, AdminStats,
  getAdminProperties, ApiProperty,
  approveProperty, rejectProperty, deleteAdminProperty, sendBroadcastPush,
} from '@/lib/api';

const NAVY = '#102a43';
const GOLD = '#C8A45A';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const colors = useColors();
  const { top } = useSafeAreaInsets();

  const [stats,      setStats]      = useState<AdminStats | null>(null);
  const [pending,    setPending]    = useState<ApiProperty[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        getAdminStats(),
        getAdminProperties({ status: 'Pending' }),
      ]);
      setStats(s);
      setPending(p.slice(0, 5));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleLogout() {
    Alert.alert('Log Out', 'Log out of Admin Panel?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);
  }

  async function handleApprove(prop: ApiProperty) {
    try {
      await approveProperty(prop.id);
      try {
        await sendBroadcastPush(
          'New Property Listed',
          `${prop.title} is now available in ${prop.city}.`,
          { type: 'property', propertyId: prop.id },
        );
      } catch (error: unknown) {
        console.warn('[push] Property approval broadcast failed.', error);
        Alert.alert(
          'Approved, but notification failed',
          'The property was approved, but its notification could not be sent. You can retry from Broadcast Notification.',
        );
      }
      setPending(p => p.filter(x => x.id !== prop.id));
      setStats(s => s ? { ...s, pendingApprovals: (s.pendingApprovals ?? 1) - 1, activeListings: (s.activeListings ?? 0) + 1 } : s);
    } catch { Alert.alert('Error', 'Could not approve property.'); }
  }

  async function handleReject(id: number) {
    Alert.prompt
      ? Alert.prompt('Rejection Reason', 'Enter reason (optional)', async (reason) => {
          try {
            await rejectProperty(id, reason);
            setPending(p => p.filter(x => x.id !== id));
          } catch { Alert.alert('Error', 'Could not reject property.'); }
        }, 'plain-text', '', 'default')
      : Alert.alert('Reject Property', 'Reject this listing?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reject', style: 'destructive', onPress: async () => {
            try { await rejectProperty(id); setPending(p => p.filter(x => x.id !== id)); }
            catch { Alert.alert('Error', 'Could not reject property.'); }
          }},
        ]);
  }

  const statCards = stats ? [
    { label: 'Total Properties', value: stats.totalProperties,      icon: 'home'      as const, color: '#1e40af' },
    { label: 'Pending Approvals', value: stats.pendingApprovals ?? 0, icon: 'clock'    as const, color: '#b45309' },
    { label: 'Active Listings',  value: stats.activeListings ?? 0,  icon: 'check-circle' as const, color: '#15803d' },
    { label: 'Total Users',      value: stats.totalUsers,           icon: 'users'     as const, color: '#7c3aed' },
    { label: 'Total Inquiries',  value: stats.totalInquiries ?? 0,  icon: 'mail'      as const, color: '#0e7490' },
    { label: 'Reports',          value: stats.pendingReports ?? 0,  icon: 'alert-circle' as const, color: '#dc2626' },
  ] : [];

  const navItems = [
    { label: 'Properties',  icon: 'home'     as const, route: '/admin/properties' as const },
    { label: 'Users',       icon: 'users'    as const, route: '/admin/users'      as const },
    { label: 'Settings',    icon: 'settings' as const, route: '/admin/settings'   as const },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: NAVY, paddingTop: top + 14 }]}>
        <View>
          <Text style={s.greeting}>Admin Panel</Text>
          <Text style={s.adminName}>{user?.name ?? 'Administrator'}</Text>
        </View>
        <Pressable onPress={handleLogout} style={s.logoutBtn} hitSlop={8}>
          <Feather name="log-out" size={18} color="#8a9ab5" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GOLD} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {loading ? (
          <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Stat cards */}
            <View style={s.statsGrid}>
              {statCards.map((c) => (
                <View key={c.label} style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[s.statIcon, { backgroundColor: c.color + '18' }]}>
                    <Feather name={c.icon} size={18} color={c.color} />
                  </View>
                  <Text style={[s.statValue, { color: colors.foreground }]}>{c.value}</Text>
                  <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{c.label}</Text>
                </View>
              ))}
            </View>

            {/* Nav shortcuts */}
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Manage</Text>
            <View style={s.navRow}>
              {navItems.map((n) => (
                <Pressable
                  key={n.label}
                  style={({ pressed }) => [s.navCard, { backgroundColor: NAVY, opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => router.push(n.route as any)}
                >
                  <Feather name={n.icon} size={22} color={GOLD} />
                  <Text style={s.navLabel}>{n.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Pending approvals quick list */}
            {pending.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>
                  Pending Approvals ({pending.length})
                </Text>
                {pending.map((p) => (
                  <View key={p.id} style={[s.pendingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.pendingTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {p.title}
                      </Text>
                      <Text style={[s.pendingMeta, { color: colors.mutedForeground }]}>
                        {p.type} · {p.city} · PKR {(p.price / 1_000_000).toFixed(1)}M
                      </Text>
                    </View>
                    <View style={s.pendingActions}>
                      <Pressable
                        style={[s.approveBtn, { backgroundColor: '#15803d' }]}
                        onPress={() => handleApprove(p)}
                      >
                        <Feather name="check" size={14} color="#fff" />
                      </Pressable>
                      <Pressable
                        style={[s.approveBtn, { backgroundColor: '#dc2626' }]}
                        onPress={() => handleReject(p.id)}
                      >
                        <Feather name="x" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  </View>
                ))}
                <Pressable
                  style={[s.viewAll, { borderColor: colors.border }]}
                  onPress={() => router.push('/admin/properties' as any)}
                >
                  <Text style={[s.viewAllText, { color: GOLD }]}>View All Properties →</Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  greeting:     { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8a9ab5', letterSpacing: 1, textTransform: 'uppercase' },
  adminName:    { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#ffffff', marginTop: 2 },
  logoutBtn:    { width: 36, height: 36, borderRadius: 10, backgroundColor: '#ffffff0f', alignItems: 'center', justifyContent: 'center' },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 },
  statCard:     { width: '47%', borderRadius: 14, borderWidth: 1, padding: 14 },
  statIcon:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue:    { fontFamily: 'Inter_700Bold', fontSize: 24, marginBottom: 2 },
  statLabel:    { fontFamily: 'Inter_400Regular', fontSize: 11 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, paddingHorizontal: 16, marginBottom: 10, marginTop: 6 },
  navRow:       { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  navCard:      { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center', gap: 8 },
  navLabel:     { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ffffff' },
  pendingCard:  { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendingTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pendingMeta:  { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  pendingActions:{ flexDirection: 'row', gap: 6 },
  approveBtn:   { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  viewAll:      { margin: 16, borderRadius: 12, borderWidth: 1, padding: 13, alignItems: 'center' },
  viewAllText:  { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
