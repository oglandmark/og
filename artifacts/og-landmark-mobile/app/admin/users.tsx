/**
 * Admin — User Management
 * View users, change roles, suspend, delete
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Platform, Pressable,
  RefreshControl, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import {
  getAdminUsers,
  updateUserRole,
  setAgentCoverUploadAccess,
  deleteAdminUser,
  ApiUser,
} from '@/lib/api';

const NAVY = '#0B1F3A';
const GOLD = '#C8A45A';

const ROLE_COLORS: Record<string, string> = {
  Admin:     '#7c3aed', Agent: '#1e40af', Seller: '#0e7490',
  Developer: '#0e7490', Buyer: '#15803d',
};

const ROLES = ['Buyer', 'Seller', 'Agent', 'Developer', 'Admin'];

export default function AdminUsers() {
  const colors = useColors();
  const { top } = useSafeAreaInsets();
  const [users,      setUsers]      = useState<ApiUser[]>([]);
  const [filtered,   setFiltered]   = useState<ApiUser[]>([]);
  const [query,      setQuery]      = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'agents'>('all');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await getAdminUsers({
        limit: 500,
        role: roleFilter === 'agents' ? 'Agent' : undefined,
      });
      setUsers(data);
      setFiltered(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load users. Check the API connection and try again.');
    }
    finally { setLoading(false); setRefreshing(false); }
  }, [roleFilter]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    if (!query.trim()) { setFiltered(users); return; }
    const q = query.toLowerCase();
    setFiltered(users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    ));
  }, [query, users]);

  function replaceUser(updated: ApiUser) {
    if (roleFilter === 'agents' && updated.role.toLowerCase() !== 'agent') {
      setUsers(prev => prev.filter(u => u.id !== updated.id));
      setFiltered(prev => prev.filter(u => u.id !== updated.id));
      return;
    }
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    setFiltered(prev => prev.map(u => u.id === updated.id ? updated : u));
  }

  function handleChangeRole(user: ApiUser) {
    Alert.alert(
      'Change Role',
      `Current role: ${user.role}\nSelect new role for ${user.name}`,
      [
        ...ROLES.filter(r => r !== user.role).map(r => ({
          text: r,
          onPress: async () => {
            try {
              replaceUser(await updateUserRole(user.id, r));
            } catch { Alert.alert('Error', 'Could not update role.'); }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  function handleAgentCoverAccess(user: ApiUser) {
    const enabled = user.agentCoverUploadEnabled !== true;
    Alert.alert(
      enabled ? 'Enable Agent cover uploads?' : 'Disable Agent cover uploads?',
      `${enabled ? 'Allow' : 'Stop'} ${user.name} from adding or removing an Agent cover photo?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: enabled ? 'Enable' : 'Disable',
          style: enabled ? 'default' : 'destructive',
          onPress: async () => {
            try {
              replaceUser(await setAgentCoverUploadAccess(user.id, enabled));
            } catch (cause) {
              Alert.alert(
                'Error',
                cause instanceof Error ? cause.message : 'Could not update Agent cover access.',
              );
            }
          },
        },
      ],
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
          {item.role.toLowerCase() === 'agent' ? (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: item.agentCoverUploadEnabled === true }}
              onPress={() => handleAgentCoverAccess(item)}
              style={[
                s.coverAccessButton,
                {
                  backgroundColor: item.agentCoverUploadEnabled === true ? colors.action + '18' : colors.secondary,
                  borderColor: item.agentCoverUploadEnabled === true ? colors.action + '55' : colors.border,
                },
              ]}
            >
              <Feather
                name={item.agentCoverUploadEnabled === true ? 'check-circle' : 'image'}
                size={12}
                color={item.agentCoverUploadEnabled === true ? colors.action : colors.mutedForeground}
              />
              <Text
                style={[
                  s.coverAccessText,
                  { color: item.agentCoverUploadEnabled === true ? colors.action : colors.mutedForeground },
                ]}
              >
                {item.agentCoverUploadEnabled === true ? 'Cover uploads enabled' : 'Enable cover uploads'}
              </Text>
            </Pressable>
          ) : null}
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
      <View style={[s.header, { backgroundColor: NAVY, paddingTop: top + (Platform.OS === 'web' ? 67 : 0) + 14 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color="#8a9ab5" />
        </Pressable>
        <Text style={s.headerTitle}>{roleFilter === 'agents' ? 'Agents' : 'Users'} ({filtered.length})</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[s.filterRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {([
          { key: 'all', label: 'All users' },
          { key: 'agents', label: 'Agents' },
        ] as const).map(option => {
          const selected = roleFilter === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`admin-user-filter-${option.key}`}
              onPress={() => setRoleFilter(option.key)}
              style={[
                s.filterButton,
                { backgroundColor: selected ? colors.action : colors.secondary, borderColor: selected ? colors.action : colors.border },
              ]}
            >
              <Text style={[s.filterText, { color: selected ? colors.actionForeground : colors.mutedForeground }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
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
      ) : error ? (
        <View style={s.errorCard}>
          <Text style={[s.errorText, { color: colors.foreground }]}>{error}</Text>
          <Pressable onPress={() => { void load(); }} style={[s.retryButton, { backgroundColor: colors.action }]}>
            <Text style={{ color: colors.actionForeground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Retry</Text>
          </Pressable>
        </View>
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
  filterRow:   { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1 },
  filterButton:{ minHeight: 34, paddingHorizontal: 13, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  filterText:  { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, paddingVertical: 0 },
  card:        { borderRadius: 14, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:      { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontFamily: 'Inter_700Bold', fontSize: 18 },
  name:        { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  email:       { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  roleBadge:   { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 5 },
  roleText:    { fontFamily: 'Inter_700Bold', fontSize: 10 },
  coverAccessButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, marginTop: 7 },
  coverAccessText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  actions:     { flexDirection: 'row', gap: 6 },
  actBtn:      { width: 34, height: 34, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  empty:       { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText:   { fontFamily: 'Inter_400Regular', fontSize: 14 },
  errorCard:   { margin: 20, padding: 16, borderRadius: 12, alignItems: 'center', gap: 12 },
  errorText:   { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' },
  retryButton: { borderRadius: 9, paddingHorizontal: 16, paddingVertical: 10 },
});
