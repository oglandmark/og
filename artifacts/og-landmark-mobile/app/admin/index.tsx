/**
 * Admin Dashboard — stats overview + quick actions
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import {
  getAdminStats, AdminStats,
  getAdminProperties, ApiProperty,
  approveProperty, rejectProperty, deleteAdminProperty,
} from '@/lib/api';

const NAVY = '#0B1F3A';
const GOLD = '#C8A45A';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const colors = useColors();
  const { top } = useSafeAreaInsets();

  const [stats,      setStats]      = useState<AdminStats | null>(null);
  const [pending,    setPending]    = useState<ApiProperty[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectingProperty, setRejectingProperty] = useState<ApiProperty | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

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
      setPending(p => p.filter(x => x.id !== prop.id));
      setStats(s => s ? { ...s, pendingApprovals: (s.pendingApprovals ?? 1) - 1, activeListings: (s.activeListings ?? 0) + 1 } : s);
    } catch { Alert.alert('Error', 'Could not approve property.'); }
  }

  function beginReject(property: ApiProperty) {
    setRejectingProperty(property);
    setRejectReason('');
  }

  async function submitReject() {
    const property = rejectingProperty;
    const reason = rejectReason.trim();
    if (!property) return;
    if (!reason) {
      Alert.alert('Reason required', 'Please explain why this listing is being rejected.');
      return;
    }
    setRejecting(true);
    try {
      await rejectProperty(property.id, reason);
      setPending((items) => items.filter((item) => item.id !== property.id));
      setStats((current) => current ? { ...current, pendingApprovals: Math.max(0, (current.pendingApprovals ?? 1) - 1) } : current);
      setRejectingProperty(null);
      setRejectReason('');
    } catch (error) {
      Alert.alert('Could not reject property', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setRejecting(false);
    }
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
    { label: 'Reports',     icon: 'alert-circle' as const, route: '/admin/reports' as const },
    { label: 'Banners',     icon: 'image' as const, route: '/admin/banners' as const },
    { label: 'Notifications', icon: 'bell'   as const, route: '/admin/notifications' as const },
    { label: 'Settings',    icon: 'settings' as const, route: '/admin/settings'   as const },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: NAVY, paddingTop: top + (Platform.OS === 'web' ? 67 : 0) + 14 }]}>
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
                        onPress={() => beginReject(p)}
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

      <Modal
        visible={!!rejectingProperty}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!rejecting) setRejectingProperty(null); }}
      >
        <View style={s.modalBackdrop}>
          <View style={[s.rejectSheet, { backgroundColor: colors.background }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Reject Listing</Text>
            <Text style={[s.modalSub, { color: colors.mutedForeground }]} numberOfLines={2}>
              {rejectingProperty?.title}
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Explain what needs to be corrected…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[s.rejectInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              editable={!rejecting}
            />
            <View style={s.modalActions}>
              <Pressable
                onPress={() => setRejectingProperty(null)}
                disabled={rejecting}
                style={[s.modalCancel, { borderColor: colors.border, opacity: rejecting ? 0.5 : 1 }]}
              >
                <Text style={[s.modalCancelText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitReject}
                disabled={rejecting}
                style={[s.modalReject, { opacity: rejecting ? 0.6 : 1 }]}
              >
                {rejecting ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="x" size={15} color="#fff" />}
                <Text style={s.modalRejectText}>{rejecting ? 'Rejecting…' : 'Reject Listing'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  navRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  navCard:      { flexBasis: '47%', flexGrow: 1, minWidth: 145, borderRadius: 14, padding: 16, alignItems: 'center', gap: 8 },
  navLabel:     { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ffffff' },
  pendingCard:  { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendingTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pendingMeta:  { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  pendingActions:{ flexDirection: 'row', gap: 6 },
  approveBtn:   { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  viewAll:      { margin: 16, borderRadius: 12, borderWidth: 1, padding: 13, alignItems: 'center' },
  viewAllText:  { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5,14,24,0.72)', justifyContent: 'center', padding: 20 },
  rejectSheet: { borderRadius: 18, padding: 18 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  modalSub: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  rejectInput: { minHeight: 110, borderWidth: 1, borderRadius: 11, padding: 12, marginTop: 16, fontFamily: 'Inter_400Regular', fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, paddingVertical: 8, minHeight: 36 },
  modalCancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  modalReject: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, paddingVertical: 8, minHeight: 40, backgroundColor: '#dc2626' },
  modalRejectText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
});
