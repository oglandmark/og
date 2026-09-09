import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import { getNotificationPreferences, updateNotificationPreferences, type NotificationPreferences } from '@/lib/api';
import { cities } from '@/lib/cities';

const options: Array<{ key: keyof NotificationPreferences; title: string; description: string }> = [
  { key: 'properties', title: 'Property alerts', description: 'New listings and saved-search matches' },
  { key: 'projects', title: 'New projects', description: 'Residential and commercial project updates' },
  { key: 'announcements', title: 'Announcements', description: 'Important OG Landmark news and updates' },
  { key: 'promotional', title: 'Promotional', description: 'Offers, campaigns and market opportunities' },
  { key: 'account', title: 'Account & security', description: 'Listing approvals and security activity' },
  { key: 'system', title: 'System', description: 'Maintenance and product updates' },
];

export default function NotificationPreferencesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    getNotificationPreferences().then(setPreferences).catch(() => setPreferences({
      properties: true, projects: true, announcements: true, promotional: true, account: true, system: true, frequency: 'immediate',
    }));
  }, []);

  const toggle = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;
    setPreferences(current => current ? { ...current, [key]: value } : current);
    setSaving(String(key));
    try { await updateNotificationPreferences({ [key]: value }); }
    finally { setSaving(null); }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.action }]}>PREFERENCES</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        </View>
        {saving ? <ActivityIndicator size="small" color={colors.action} /> : <View style={{ width: 20 }} />}
      </View>
      {!preferences ? <ActivityIndicator color={colors.action} size="large" style={{ marginTop: 50 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.intro, { color: colors.mutedForeground }]}>
            Choose the updates you want from OG Landmark. Account and security alerts may remain mandatory.
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {options.map((option, index) => (
              <View key={option.key} style={[styles.row, index < options.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                <View style={[styles.rowIcon, { backgroundColor: colors.action + '15' }]}>
                  <Feather name={option.key === 'properties' ? 'home' : option.key === 'projects' ? 'layers' : option.key === 'account' ? 'shield' : option.key === 'system' ? 'settings' : 'bell'} size={16} color={colors.action} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>{option.title}</Text>
                  <Text style={[styles.rowDescription, { color: colors.mutedForeground }]}>{option.description}</Text>
                </View>
                {saving === option.key ? <ActivityIndicator size="small" color={colors.action} /> : (
                  <Switch
                    value={Boolean(preferences[option.key])}
                    onValueChange={(value) => { void toggle(option.key, value); }}
                    trackColor={{ false: colors.border, true: colors.action + '88' }}
                    thumbColor={preferences[option.key] ? colors.action : colors.mutedForeground}
                  />
                )}
              </View>
            ))}
          </View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Cities of interest</Text>
          <Text style={[styles.smallHint, { color: colors.mutedForeground }]}>Optional: only target property and project alerts for selected cities.</Text>
          <View style={styles.cityGrid}>
            {cities.map((city) => {
              const selected = preferences.cities?.includes(city) ?? false;
              return (
                <Pressable
                  key={city}
                  onPress={async () => {
                    const next = selected
                      ? (preferences.cities || []).filter(item => item !== city)
                      : [...(preferences.cities || []), city];
                    setPreferences(current => current ? { ...current, cities: next } : current);
                    setSaving('cities');
                    try { await updateNotificationPreferences({ cities: next }); } finally { setSaving(null); }
                  }}
                  style={[styles.cityChip, { borderColor: colors.border }, selected && { backgroundColor: colors.action, borderColor: colors.action }]}
                >
                  <Text style={[styles.cityText, { color: selected ? colors.actionForeground : colors.mutedForeground }]}>{city}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Delivery frequency</Text>
          <View style={[styles.frequency, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(['immediate', 'daily', 'weekly'] as const).map((frequency) => (
              <Pressable
                key={frequency}
                onPress={async () => {
                  setPreferences(current => current ? { ...current, frequency } : current);
                  setSaving('frequency');
                  try { await updateNotificationPreferences({ frequency }); } finally { setSaving(null); }
                }}
                style={[styles.frequencyItem, preferences.frequency === frequency && { backgroundColor: colors.action }]}
              >
                <Text style={[styles.frequencyText, { color: preferences.frequency === frequency ? colors.actionForeground : colors.mutedForeground }]}>
                  {frequency[0].toUpperCase() + frequency.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => router.push('/notifications' as any)} style={[styles.historyButton, { borderColor: colors.border }]}>
            <Feather name="inbox" size={16} color={colors.action} />
            <Text style={[styles.historyText, { color: colors.action }]}>Open notification history</Text>
            <Feather name="arrow-right" size={15} color={colors.action} />
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.4 },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 25, marginTop: 1 },
  intro: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  rowIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  rowDescription: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 24, marginBottom: 9 },
  smallHint: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: -3, marginBottom: 9 },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  cityChip: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  cityText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  frequency: { borderRadius: 14, borderWidth: 1, padding: 5, flexDirection: 'row', gap: 4 },
  frequencyItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  frequencyText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  historyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 13, marginTop: 24 },
  historyText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});