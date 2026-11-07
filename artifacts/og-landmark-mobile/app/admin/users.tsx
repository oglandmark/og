/**
 * Admin — User Management
 * View users, change roles, suspend, delete
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable,
  StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { BrandedRefreshControl } from '@/components/BrandedRefreshControl';
import brandColors from '@/constants/colors';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import {
  createAdminUser,
  getAdminUsers,
  updateAdminUser,
  updateUserRole,
  setAgentCoverUploadAccess,
  deleteAdminUser,
  ApiUser,
} from '@/lib/api';

const NAVY = brandColors.light.action;
const GOLD = brandColors.light.gold;

const ROLE_COLORS: Record<string, string> = {
  Admin: '#7c3aed', Agent: '#1e40af', Developer: '#0e7490', User: '#15803d',
};

const ROLES = ['User', 'Agent', 'Developer', 'Admin'];

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
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '', agencyName: '', companyName: '', password: '', role: 'User', status: 'Active' });

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

  function openEditor(user?: ApiUser) {
    setEditingUser(user ?? null);
    setForm({
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      city: user?.city ?? '',
      agencyName: user?.agencyName ?? '',
      companyName: user?.companyName ?? '',
      password: '',
      role: user?.role ?? 'User',
      status: user?.status === 'Suspended' ? 'Suspended' : 'Active',
    });
    setEditorOpen(true);
  }

  async function saveUser() {
    if (!form.name.trim() || !form.email.trim() || (!editingUser && form.password.length < 8)) {
      Alert.alert('Required fields', 'Enter a name, valid email, and a password of at least 8 characters for a new account.');
      return;
    }
    setSavingUser(true);
    try {
      if (editingUser) {
        let updated = await updateAdminUser(editingUser.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          agencyName: form.agencyName.trim(),
          companyName: form.companyName.trim(),
          status: form.status,
          ...(form.password ? { password: form.password } : {}),
        });
        if (form.role !== editingUser.role) updated = await updateUserRole(updated.id, form.role);
        replaceUser(updated);
      } else {
        const created = await createAdminUser({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          agencyName: form.agencyName.trim(),
          companyName: form.companyName.trim(),
          password: form.password,
          role: form.role as 'User' | 'Agent' | 'Developer' | 'Admin',
        });
        setUsers((current) => [created, ...current]);
        setFiltered((current) => [created, ...current]);
      }
      setEditorOpen(false);
    } catch (cause) {
      Alert.alert('Could not save account', cause instanceof Error ? cause.message : 'Please check the details and try again.');
    } finally {
      setSavingUser(false);
    }
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
          <Text style={[s.email, { color: item.status === 'Suspended' ? colors.destructive : colors.success, marginTop: 5, fontWeight: '700' }]}>
            {item.status === 'Suspended' ? 'Suspended' : 'Active'}
          </Text>
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
            onPress={() => openEditor(item)}
            hitSlop={6}
            accessibilityLabel={`Edit ${item.name}`}
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
        <Pressable onPress={() => openEditor()} accessibilityRole="button" accessibilityLabel="Add user" style={[s.addButton, { backgroundColor: colors.action }]}>
          <Feather name="user-plus" size={17} color={colors.actionForeground} />
          <Text style={{ color: colors.actionForeground, fontWeight: '700', fontSize: 12 }}>Add</Text>
        </Pressable>
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
          refreshControl={<BrandedRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No users found</Text>
            </View>
          }
        />
      )}
      <Modal visible={editorOpen} transparent animationType="slide" onRequestClose={() => { if (!savingUser) setEditorOpen(false); }}>
        <View style={s.modalBackdrop}>
          <View style={[s.editorSheet, { backgroundColor: colors.background }]}>
            <View style={s.editorHeader}>
              <View>
                <Text style={[s.headerTitle, { color: colors.foreground }]}>{editingUser ? 'Edit account' : 'Create account'}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>Manage account access and details</Text>
              </View>
              <Pressable onPress={() => setEditorOpen(false)} disabled={savingUser} accessibilityLabel="Close editor">
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <KeyboardAwareScrollViewCompat contentContainerStyle={s.formContent} bottomOffset={28} keyboardShouldPersistTaps="handled">
              {([
                ['Full name', 'name'],
                ['Email address', 'email'],
                ['Phone', 'phone'],
                ['City', 'city'],
                ['Agency', 'agencyName'],
                ['Company', 'companyName'],
                ['Password (leave blank to keep current)', 'password'],
              ] as const).map(([label, key]) => (
                <View key={key}>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <TextInput
                    value={form[key]}
                    onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))}
                    placeholder={label}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType={key === 'email' ? 'email-address' : 'default'}
                    autoCapitalize={key === 'email' ? 'none' : 'sentences'}
                    secureTextEntry={key === 'password'}
                    style={[s.fieldInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
                  />
                </View>
              ))}
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>ROLE</Text>
              <View style={s.optionRow}>
                {ROLES.map((role) => <Pressable key={role} onPress={() => setForm((current) => ({ ...current, role }))} style={[s.option, { borderColor: form.role === role ? colors.action : colors.border, backgroundColor: form.role === role ? colors.action : colors.card }]}><Text style={{ color: form.role === role ? colors.actionForeground : colors.foreground, fontWeight: '700', fontSize: 12 }}>{role}</Text></Pressable>)}
              </View>
              {editingUser ? <>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>ACCOUNT STATUS</Text>
                <View style={s.optionRow}>
                  {(['Active', 'Suspended'] as const).map((status) => <Pressable key={status} onPress={() => setForm((current) => ({ ...current, status }))} style={[s.option, { borderColor: form.status === status ? colors.action : colors.border, backgroundColor: form.status === status ? colors.action : colors.card }]}><Text style={{ color: form.status === status ? colors.actionForeground : colors.foreground, fontWeight: '700', fontSize: 12 }}>{status}</Text></Pressable>)}
                </View>
              </> : null}
              <Pressable onPress={() => void saveUser()} disabled={savingUser} style={[s.saveButton, { backgroundColor: colors.action, opacity: savingUser ? 0.6 : 1 }]}>
                {savingUser ? <ActivityIndicator color={colors.actionForeground} /> : <Text style={{ color: colors.actionForeground, fontWeight: '800' }}>{editingUser ? 'Save account' : 'Create account'}</Text>}
              </Pressable>
            </KeyboardAwareScrollViewCompat>
          </View>
        </View>
      </Modal>
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
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, minHeight: 36, borderRadius: 10 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5,14,24,0.72)', justifyContent: 'flex-end' },
  editorSheet: { maxHeight: '92%', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 20 },
  editorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14 },
  formContent: { paddingHorizontal: 20, paddingBottom: 30, gap: 12 },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 5 },
  fieldInput: { minHeight: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  saveButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginTop: 4 },
});
