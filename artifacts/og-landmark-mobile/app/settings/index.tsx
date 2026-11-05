import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { deleteMyAccount } from '@/lib/api';
import { clearLocalAccountData } from '@/lib/accountCleanup';
import { getNotificationPermissionState, registerPushTokenForUser, type NotificationPermissionState } from '@/lib/pushNotifications';

type SettingItem = { icon: keyof typeof Feather.glyphMap; title: string; detail: string; route?: string; action?: 'signout' | 'delete' | 'coming' | 'notifications' };

export default function SettingsHomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn, logout } = useAuth();
  const [permission, setPermission] = useState<NotificationPermissionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const [notificationExpanded, setNotificationExpanded] = useState(false);

  const refreshPermission = useCallback(async () => {
    try { setPermission(await getNotificationPermissionState()); }
    catch { setPermission(null); }
  }, []);
  useEffect(() => {
    if (isLoggedIn) void refreshPermission();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && isLoggedIn) void refreshPermission();
    });
    return () => subscription.remove();
  }, [isLoggedIn, refreshPermission]);

  const permissionLabel = !permission ? 'Checking notification access'
    : permission.status === 'granted' ? 'Enabled for this device'
      : permission.status === 'unsupported' ? 'Unavailable in this build'
        : permission.status === 'denied' && !permission.canAskAgain ? 'Blocked in device settings'
          : 'Off · Tap to enable';

  const enableNotifications = async () => {
    if (!user?.id || busy || permission?.status === 'unsupported') return;
    setNotice('');
    if (permission?.status === 'denied' && !permission.canAskAgain) {
      if (Platform.OS === 'web') setNotice('Notifications are blocked in this browser. Update your browser settings.');
      else {
        try { await Linking.openSettings(); }
        catch { setNotice('Could not open device settings. Please enable notifications there.'); }
      }
      return;
    }
    setBusy(true);
    try {
      const result = await registerPushTokenForUser(String(user.id));
      setNotice(result.status === 'registered' ? 'Notifications enabled for approvals and announcements.'
        : result.status === 'denied' ? 'Notifications remain off. You can try again here.'
          : result.status === 'unsupported' ? 'Push notifications are unavailable in this build.'
            : 'Could not register notifications for this account.');
      await refreshPermission();
    } catch {
      setNotice('Could not enable notifications right now. Please try again.');
    } finally { setBusy(false); }
  };

  const removeAccount = async () => {
    if (!user?.id || deleting) return;
    setDeleting(true);
    try {
      await deleteMyAccount(user.id);
      await clearLocalAccountData();
      await logout();
      router.replace('/(auth)/login' as any);
    } catch (error) {
      Alert.alert('Could not delete account', error instanceof Error ? error.message : 'Please check your connection and try again.');
    } finally { setDeleting(false); }
  };
  const confirmDelete = () => Alert.alert(
    'Delete account?',
    'This permanently deletes your account and removes its saved data. This action cannot be undone.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete Account', style: 'destructive', onPress: () => { void removeAccount(); } }],
  );

  const publicItems: SettingItem[] = [
    { icon: 'globe', title: 'Language', detail: 'English / اردو', route: '/settings/language' },
    { icon: 'help-circle', title: 'Help & Support', detail: 'FAQs, contact us', route: '/settings/help' },
    { icon: 'info', title: 'About OG Landmark', detail: 'Our platform and principles', route: '/settings/legal?section=about' },
    { icon: 'shield', title: 'Privacy & Security', detail: 'How we protect your account', route: '/settings/legal?section=security' },
    { icon: 'file-text', title: 'Terms & Privacy', detail: 'Terms of use and privacy policy', route: '/settings/legal?section=legal' },
  ];
  const privateItems: SettingItem[] = [
    { icon: 'user', title: 'Personal Information', detail: 'Name, address, bio', route: '/settings/account' },
    { icon: 'smartphone', title: 'Phone & Email', detail: user?.phone || user?.email || 'Update contact details', route: '/settings/account' },
    { icon: 'lock', title: 'Change Password', detail: 'Update your password', action: 'coming' },
    { icon: 'bell', title: 'Notifications', detail: permissionLabel, action: 'notifications' },
    { icon: 'dollar-sign', title: 'Currency', detail: 'PKR · Pakistani Rupee', action: 'coming' },
    { icon: 'map-pin', title: 'Location', detail: 'Okara District, Punjab', action: 'coming' },
  ];

  const renderItem = (item: SettingItem, index: number) => (
    <Pressable
      key={item.title}
      testID={`settings-${item.title.toLowerCase().replaceAll(' ', '-')}`}
      onPress={() => {
        if (item.action === 'notifications') {
          setNotificationExpanded(value => !value);
          setNotice('');
        } else if (item.action === 'coming') Alert.alert(item.title, 'This feature is coming soon.');
        else if (item.route) router.push(item.route as any);
        else if (item.action === 'signout') void logout();
        else if (item.action === 'delete') confirmDelete();
      }}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.82 : 1 }, index === 0 && styles.firstRow]}
    >
      <View style={[styles.icon, { backgroundColor: colors.action + '14' }]}><Feather name={item.icon} size={17} color={colors.action} /></View>
      <View style={styles.copy}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{item.title}</Text>
        <Text style={[styles.detail, { color: colors.mutedForeground }]}>{item.detail}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );

  return (
      <View style={[styles.root, { backgroundColor: colors.surfaceTint }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 35 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable testID="settings-back" accessibilityLabel="Back to profile" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: colors.action }]}>OG LANDMARK</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
          </View>
          <View style={[styles.mark, { backgroundColor: colors.selectionBackground }]}>
            <Feather name="sliders" size={17} color={colors.action} />
          </View>
        </View>

        {isLoggedIn ? (
          <>
            <View style={[styles.identity, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.identityMark, { backgroundColor: colors.selectionBackground }]}><Feather name="user" size={18} color={colors.action} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.identityName, { color: colors.foreground }]}>{user?.name || 'Your account'}</Text>
                <Text style={[styles.identityEmail, { color: colors.mutedForeground }]}>{user?.email || user?.phone || 'Manage your OG Landmark account'}</Text>
              </View>
              <Pressable accessibilityLabel="Edit account details" onPress={() => router.push('/settings/account' as any)}><Feather name="edit-2" size={16} color={colors.action} /></Pressable>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>ACCOUNT</Text>
            <View style={styles.group}>{privateItems.map(renderItem)}</View>
            {notificationExpanded ? (
              <View style={[styles.notificationPanel, { backgroundColor: colors.selectionBackground, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Notification access</Text>
                  <Text style={[styles.detail, { color: colors.mutedForeground }]}>{permissionLabel}. Get property approvals and OG Landmark announcements.</Text>
                </View>
                {notice ? <Text style={[styles.notice, { color: colors.action }]}>{notice}</Text> : null}
                {permission?.status !== 'granted' ? (
                  <Pressable testID="settings-enable-notifications" disabled={busy} onPress={() => void enableNotifications()} style={[styles.notificationButton, { backgroundColor: colors.action, opacity: busy ? 0.55 : 1 }]}>
                    <Feather name={permission?.status === 'denied' && !permission.canAskAgain ? 'settings' : 'bell'} size={14} color={colors.actionForeground} />
                    <Text style={[styles.notificationButtonText, { color: colors.actionForeground }]}>{busy ? 'Updating…' : permission?.status === 'denied' && !permission.canAskAgain ? 'Open Device Settings' : 'Enable Notifications'}</Text>
                  </Pressable>
                ) : null}
                <Pressable testID="settings-manage-notifications" onPress={() => router.push('/settings/notifications' as any)} style={[styles.preferenceButton, { borderColor: colors.border }]}>
                  <Feather name="sliders" size={14} color={colors.action} />
                  <Text style={[styles.preferenceText, { color: colors.action }]}>Manage alert preferences</Text>
                  <Feather name="arrow-right" size={14} color={colors.action} />
                </Pressable>
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.guestNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="lock" size={17} color={colors.action} />
            <Text style={[styles.guestCopy, { color: colors.foreground }]}>Sign in to manage account details and notification preferences.</Text>
            <Pressable onPress={() => router.push('/(auth)/login' as any)}><Text style={[styles.signInLink, { color: colors.action }]}>Sign in</Text></Pressable>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>PREFERENCES & SUPPORT</Text>
        <View style={styles.group}>{publicItems.map(renderItem)}</View>
        {isLoggedIn ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>ACCOUNT ACTIONS</Text>
            <View style={styles.group}>
              {renderItem({ icon: 'log-out', title: 'Sign Out', detail: 'Log out of your account', action: 'signout' }, 0)}
              <Pressable testID="settings-delete-account" onPress={confirmDelete} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.icon, { backgroundColor: colors.destructive + '14' }]}><Feather name="trash-2" size={17} color={colors.destructive} /></View>
                <View style={styles.copy}><Text style={[styles.rowTitle, { color: colors.destructive }]}>{deleting ? 'Deleting Account…' : 'Delete Account'}</Text><Text style={[styles.detail, { color: colors.mutedForeground }]}>Permanently remove your account and saved data</Text></View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </>
        ) : null}
        <Text style={[styles.footer, { color: colors.mutedForeground }]}>OG Landmark · Property, made personal.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  back: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.6 },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 27, marginTop: 1 },
  mark: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  identity: { borderRadius: 19, borderWidth: 1, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  identityMark: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  identityName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  identityEmail: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  sectionTitle: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 1.1, marginTop: 23, marginBottom: 10 },
  group: { gap: 8 },
  row: { minHeight: 72, borderWidth: 1, borderRadius: 17, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  firstRow: {},
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  rowTitle: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  detail: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 4 },
  notice: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, marginTop: 10 },
  notificationPanel: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 12, marginTop: 9 },
  notificationButton: { minHeight: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  notificationButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  preferenceButton: { minHeight: 44, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  preferenceText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  guestNote: { borderWidth: 1, borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  guestCopy: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  signInLink: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  footer: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', marginTop: 28 },
});
