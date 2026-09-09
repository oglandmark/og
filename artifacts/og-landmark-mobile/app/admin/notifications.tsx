import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import {
  createAdminAnnouncement,
  getAdminAnnouncements,
  sendAdminAnnouncement,
  type AdminAnnouncement,
} from '@/lib/api';

const NAVY = '#102a43';
const GOLD = '#C8A45A';

export default function AdminNotifications() {
  const colors = useColors();
  const { top } = useSafeAreaInsets();
  const [items, setItems] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<AdminAnnouncement['type']>('general');
  const [priority, setPriority] = useState<AdminAnnouncement['priority']>('NORMAL');
  const [role, setRole] = useState('');
  const [city, setCity] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [expiry, setExpiry] = useState('');

  const load = useCallback(() => {
    void getAdminAnnouncements().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const submit = async (sendNow: boolean) => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Required', 'Enter an announcement title and message.');
      return;
    }
    setSaving(true);
    try {
      const created = await createAdminAnnouncement({
        title: title.trim(),
        message: message.trim(),
        type,
        priority,
        audience: { role: role.trim(), city: city.trim() },
        scheduleAt: scheduleAt.trim() || null,
        expiresAt: expiry.trim() || null,
        sendNow,
      });
      setItems(current => [created, ...current]);
      setTitle(''); setMessage(''); setScheduleAt(''); setExpiry('');
      Alert.alert(sendNow ? 'Announcement sent' : 'Draft saved', sendNow ? 'Eligible users will see it in their notification center.' : 'You can send it later from the campaign history.');
    } catch (error: unknown) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: NAVY, paddingTop: top + 14 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Feather name="arrow-left" size={20} color="#8a9ab5" /></Pressable>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.eyebrow}>ADMIN TOOLS</Text>
          <Text style={styles.headerTitle}>Notifications & Announcements</Text>
        </View>
        <Feather name="send" size={18} color={GOLD} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Create announcement</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Title</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="e.g. OG Landmark Summer Property Week" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Message</Text>
          <TextInput value={message} onChangeText={setMessage} multiline numberOfLines={4} placeholder="Write the full announcement content…" placeholderTextColor={colors.mutedForeground} style={[styles.textArea, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Type</Text>
          <View style={styles.choiceRow}>
            {(['general', 'important', 'system', 'promotional'] as const).map(value => (
              <Pressable key={value} onPress={() => setType(value)} style={[styles.choice, { borderColor: colors.border }, type === value && { backgroundColor: colors.action, borderColor: colors.action }]}>
                <Text style={[styles.choiceText, { color: type === value ? colors.actionForeground : colors.mutedForeground }]}>{value[0].toUpperCase() + value.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Priority</Text>
          <View style={styles.choiceRow}>
            {(['NORMAL', 'HIGH', 'URGENT'] as const).map(value => (
              <Pressable key={value} onPress={() => setPriority(value)} style={[styles.choice, { borderColor: colors.border }, priority === value && { backgroundColor: colors.action, borderColor: colors.action }]}>
                <Text style={[styles.choiceText, { color: priority === value ? colors.actionForeground : colors.mutedForeground }]}>{value}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Audience (optional)</Text>
          <View style={styles.twoFields}>
            <TextInput value={role} onChangeText={setRole} placeholder="Role: buyer / agent" placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.half, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
            <TextInput value={city} onChangeText={setCity} placeholder="City: Depalpur" placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.half, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          </View>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Schedule / expiry (ISO date-time, optional)</Text>
          <TextInput value={scheduleAt} onChangeText={setScheduleAt} placeholder="2026-09-15T10:00:00+05:00" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <TextInput value={expiry} onChangeText={setExpiry} placeholder="Expiry: 2026-09-30T23:59:00+05:00" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />

          <View style={[styles.preview, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.previewLabel, { color: colors.action }]}>NOTIFICATION PREVIEW</Text>
            <Text style={[styles.previewTitle, { color: colors.foreground }]}>{title || 'Announcement title'}</Text>
            <Text style={[styles.previewBody, { color: colors.mutedForeground }]}>{message || 'Your announcement message will appear here.'}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable disabled={saving} onPress={() => { void submit(false); }} style={[styles.secondaryButton, { borderColor: colors.border }]}>
              <Text style={[styles.secondaryText, { color: colors.foreground }]}>Save Draft</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={() => { void submit(true); }} style={[styles.primaryButton, { backgroundColor: NAVY }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <><Feather name="send" size={14} color="#fff" /><Text style={styles.primaryText}>Send Now</Text></>}
            </Pressable>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Campaign history</Text>
        {loading ? <ActivityIndicator color={colors.action} /> : items.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No announcements created yet.</Text>
        ) : items.map(item => (
          <View key={item.id} style={[styles.history, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.historyTitle, { color: colors.foreground }]}>{item.title}</Text>
              <Text style={[styles.historyMeta, { color: colors.mutedForeground }]}>{item.status} · {item.recipientCount || 0} recipients · {new Date(item.createdAt).toLocaleDateString('en-PK')}</Text>
            </View>
            {item.status !== 'sent' ? <Pressable onPress={() => { void sendAdminAnnouncement(item.id).then(updated => setItems(current => current.map(entry => entry.id === updated.id ? updated : entry))).catch(() => Alert.alert('Could not send', 'Please try again.')); }} style={[styles.sendSmall, { backgroundColor: colors.action }]}><Feather name="send" size={13} color={colors.actionForeground} /></Pressable> : <Feather name="check-circle" size={18} color={colors.action} />}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 18 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#8a9ab5', letterSpacing: 1.2 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#fff', marginTop: 2 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginTop: 8, marginBottom: 10 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginBottom: 6, marginTop: 5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 10 },
  textArea: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 92, textAlignVertical: 'top', fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 10 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  choice: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  choiceText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  twoFields: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  preview: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 5, marginBottom: 14 },
  previewLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  previewTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 7 },
  previewBody: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  secondaryButton: { flex: 1, borderWidth: 1, borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  primaryButton: { flex: 1, borderRadius: 11, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  primaryText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#fff' },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 12, paddingVertical: 18 },
  history: { borderRadius: 13, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 },
  historyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  historyMeta: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 },
  sendSmall: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});