import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import { getAnnouncement, type AdminAnnouncement } from '@/lib/api';

export default function AnnouncementDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [announcement, setAnnouncement] = useState<AdminAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getAnnouncement(Number(id))
      .then(setAnnouncement)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'This announcement is no longer available.'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Back">
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Announcement</Text>
        <View style={{ width: 38 }} />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.action} size="large" /></View>
      ) : error || !announcement ? (
        <View style={styles.center}>
          <Feather name="file-text" size={32} color={colors.action} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Announcement unavailable</Text>
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error || 'This announcement is no longer available.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
          {announcement.imageUrl ? <Image source={{ uri: announcement.imageUrl }} style={styles.hero} resizeMode="cover" /> : null}
          <Text style={[styles.eyebrow, { color: colors.action }]}>{announcement.type.toUpperCase()} · {announcement.priority}</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{announcement.title}</Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {new Date(announcement.sentAt || announcement.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <View style={[styles.bodyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.body, { color: colors.foreground }]}>{announcement.message}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 14 },
  iconButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  hero: { width: '100%', height: 190, borderRadius: 18, marginBottom: 20 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 30, lineHeight: 37, marginTop: 8 },
  date: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 8 },
  bodyCard: { borderWidth: 1, borderRadius: 16, padding: 18, marginTop: 22 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 24 },
  errorTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, marginTop: 14 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});