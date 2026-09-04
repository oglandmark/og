/**
 * Admin — Mobile App Settings
 * Feature flags, maintenance mode, broadcast push notifications
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView,
  StyleSheet, Switch, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { getMobileSettings, updateMobileSettings, sendBroadcastPush, MobileSettings } from '@/lib/api';

const NAVY = '#102a43';
const GOLD = '#C8A45A';

export default function AdminSettings() {
  const colors = useColors();
  const { top } = useSafeAreaInsets();
  const [settings, setSettings] = useState<MobileSettings | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // Push notification fields
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody,  setPushBody]  = useState('');
  const [pushing,   setPushing]   = useState(false);

  useEffect(() => {
    getMobileSettings()
      .then(s => setSettings(s))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(key: keyof MobileSettings, value: boolean) {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setSaving(true);
    try { await updateMobileSettings({ [key]: value }); }
    catch { Alert.alert('Error', 'Could not save setting.'); setSettings(settings); }
    finally { setSaving(false); }
  }

  async function handleSendPush() {
    if (!pushTitle.trim() || !pushBody.trim()) {
      Alert.alert('Required', 'Enter both title and message body.');
      return;
    }
    Alert.alert(
      'Broadcast Push',
      `Send to all users?\n\nTitle: ${pushTitle}\nMessage: ${pushBody}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: async () => {
            setPushing(true);
            try {
              await sendBroadcastPush(pushTitle.trim(), pushBody.trim());
              setPushTitle(''); setPushBody('');
              Alert.alert('Sent', 'Broadcast notification sent to all users.');
            } catch (error: unknown) {
              console.warn('[push] Admin broadcast failed.', error);
              Alert.alert(
                'Notification not sent',
                error instanceof Error ? error.message : 'Could not send notification. Please try again.',
              );
            }
            finally { setPushing(false); }
          }},
      ]
    );
  }

  const toggles: { key: keyof MobileSettings; label: string; desc: string }[] = [
    { key: 'verificationBadgeEnabled', label: 'Verification Badges',      desc: 'Show verified badges on properties and agents' },
    { key: 'pushNotificationsEnabled', label: 'Push Notifications',        desc: 'Enable push notification delivery to devices' },
    { key: 'darkModeEnabled',          label: 'Dark Mode Option',          desc: 'Allow users to switch to dark theme' },
    { key: 'maintenanceMode',          label: 'Maintenance Mode',          desc: 'Block app access and show maintenance message' },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: NAVY, paddingTop: top + 14 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color="#8a9ab5" />
        </Pressable>
        <Text style={s.headerTitle}>App Settings</Text>
        {saving
          ? <ActivityIndicator size="small" color={GOLD} />
          : <View style={{ width: 24 }} />
        }
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* Feature flags */}
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Feature Flags</Text>
          <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {toggles.map((t, i) => (
              <View key={t.key} style={[s.toggleRow, i < toggles.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.toggleLabel, { color: colors.foreground }]}>{t.label}</Text>
                  <Text style={[s.toggleDesc, { color: colors.mutedForeground }]}>{t.desc}</Text>
                </View>
                <Switch
                  value={!!(settings as any)?.[t.key]}
                  onValueChange={(v) => handleToggle(t.key, v)}
                  trackColor={{ false: colors.border, true: GOLD + 'aa' }}
                  thumbColor={!!(settings as any)?.[t.key] ? GOLD : colors.mutedForeground}
                />
              </View>
            ))}
          </View>

          {/* Maintenance message */}
          {settings?.maintenanceMode && (
            <>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Maintenance Message</Text>
              <TextInput
                style={[s.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                placeholder="We're down for maintenance. Back soon!"
                placeholderTextColor={colors.mutedForeground}
                value={settings.maintenanceMessage ?? ''}
                onChangeText={t => setSettings(s => s ? { ...s, maintenanceMessage: t } : s)}
                onEndEditing={() => settings && updateMobileSettings({ maintenanceMessage: settings.maintenanceMessage }).catch(() => {})}
                multiline
                numberOfLines={3}
              />
            </>
          )}

          {/* Broadcast push notification */}
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Broadcast Notification</Text>
          <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border, padding: 14 }]}>
            <Text style={[s.label, { color: colors.mutedForeground }]}>Title</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. New Properties Available!"
              placeholderTextColor={colors.mutedForeground}
              value={pushTitle}
              onChangeText={setPushTitle}
            />
            <Text style={[s.label, { color: colors.mutedForeground }]}>Message</Text>
            <TextInput
              style={[s.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. Check out our latest listings in Okara District."
              placeholderTextColor={colors.mutedForeground}
              value={pushBody}
              onChangeText={setPushBody}
              multiline
              numberOfLines={3}
            />
            <Pressable
              style={({ pressed }) => [s.sendBtn, { backgroundColor: NAVY, opacity: pressed ? 0.85 : 1 }]}
              onPress={handleSendPush}
              disabled={pushing}
            >
              {pushing
                ? <ActivityIndicator color="#fff" />
                : <><Feather name="bell" size={15} color="#fff" /><Text style={s.sendText}>Send to All Users</Text></>
              }
            </Pressable>
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle:  { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#ffffff' },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 4 },
  section:      { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  toggleRow:    { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  toggleLabel:  { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  toggleDesc:   { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  label:        { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.5, marginBottom: 6 },
  input:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 12 },
  textArea:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 12, minHeight: 72, textAlignVertical: 'top' },
  sendBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 13 },
  sendText:     { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' },
});
