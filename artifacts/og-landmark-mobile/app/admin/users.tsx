/**
 * Admin — User Management
 * View users, change roles, suspend, delete
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable,
  RefreshControl, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { getAdminUsers, updateUserRole, deleteAdminUser, ApiUser } from '@/lib/api';

const NAVY = '#102a43';
const GOLD = '#C8A45A';

const ROLE_COLORS: Record<string, string> = {
  Admin:     '#7c3aed', Agent: '#1e40af', Seller: '#0e7490',
  Developer: '#0e7490', Buyer: '#15803d',
};

const ROLES = ['Buyer', 'Seller', 'Agent', 'Admin'];

export default function AdminUsers() {
  const colors = useColors();
  const { top } = useSafeAreaInsets();
  const [users,      setUsers]      = useState<ApiUser[]>([]);
  const [filtered,   setFiltered]   = useState<ApiUser[]>([]);
  const [query,      setQuery]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getAdminUsers({ limit: 100 });
      setUsers(data);
      setFiltered(data);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!query.trim()) { setFiltered(users); return; }
    const q = query.toLowerCase();
    setFiltered(users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    ));
  }, [query, users]);

  function handleChangeRole(user: ApiUser) {
    Alert.alert(
      'Change Role',
      `Current role: ${user.role}\nSelect new role for ${user.name}`,
      [
        ...ROLES.filter(r => r !== user.role).map(r => ({
          text: r,
          onPress: async () => {
            try {
              await updateUserRole(user.id, r);
              const updated = { ...user, role: r };
              setUsers(prev => prev.map(u => u.id === user.id ? updated : u));
              setFiltered(prev => prev.map(u => u.id === user.id ? updated : u));
            } catch { Alert.alert('Error', 'Could not update role.'); }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  function handleDelete(user: ApiUser) {
    Alert.alert(
      'Delete User',
      `Permanently delete ${user.name}?\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await deleteAdminUser(user.id);
              setUsers(p => p.filter(u => u.id !== user.id));
              setFiltered(p => p.filter(u => u.id !== user.id));
            } catch { Alert.alert('Error', 'Could not delete user.'); }
          }},
      ]
    );
  }

  const renderItem = ({ item }: { item: ApiUser }) => {
    const roleColor = ROLE_COLORS[item.role] ?? '#6b7280';
    return (
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.avatar, { backgroundColor: roleColor + '22' }]}>
          <Text style={[s.avatarText, { color: roleColor }]}>
            {(item.name?.[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.name, { color: colors.foreground }]}>{item.name}</Text>
          <Text style={[s.email, { color: colors.mutedForeground }]} numberOfLines={1}>{item.email}</Text>
          <View style={[s.roleBadge, { backgroundColor: roleColor + '18' }]}>
            <Text style={[s.roleText, { color: roleColor }]}>{item.role}</Text>
          </View>
        </View>
        <View style={s.actions}>
          <Pressable
            style={[s.actBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
            onPress={() => handleChangeRole(item)}
            hitSlop={6}
          >
            <Feather name="edit-2" size={13} color={GOLD} />
          </Pressable>
          <Pressable
            style={[s.actBtn, { borderColor: '#dc262630', backgroundColor: '#dc262610' }]}
            onPress={() => handleDelete(item)}
            hitSlop={6}
          >
            <Feather name="trash-2" size={13} color="#dc2626" />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: NAVY, paddingTop: top + 14 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color="#8a9ab5" />
        </Pressable>
        <Text style={s.headerTitle}>Users ({filtered.length})</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search */}
      <View style={[s.searchWrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[s.searchInput, { color: colors.foreground }]}
          placeholder="Search by name, email, role…"
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GOLD} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No users found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#ffffff' },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, paddingVertical: 0 },
  card:        { borderRadius: 14, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:      { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontFamily: 'Inter_700Bold', fontSize: 18 },
  name:        { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  email:       { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  roleBadge:   { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 5 },
  roleText:    { fontFamily: 'Inter_700Bold', fontSize: 10 },
  actions:     { flexDirection: 'row', gap: 6 },
  actBtn:      { width: 34, height: 34, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  empty:       { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText:   { fontFamily: 'Inter_400Regular', fontSize: 14 },
});
