import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationCategory,
} from '@/lib/api';

const filters: Array<{ key: NotificationCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'properties', label: 'Properties' },
  { key: 'projects', label: 'Projects' },
  { key: 'announcements', label: 'Announcements' },
];

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (hours < 48) return 'Yesterday';
  return new Date(value).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

function notificationIcon(item: AppNotification): keyof typeof Feather.glyphMap {
  if (item.category === 'properties') return 'home';
  if (item.category === 'projects') return 'layers';
  if (item.category === 'announcements' || item.category === 'promotional') return 'speaker';
  if (item.category === 'account') return 'shield';
  return 'bell';
}

export default function NotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<NotificationCategory | 'all'>('all');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (nextPage = 1, replace = true) => {
    if (nextPage === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const result = await getNotifications(undefined, { page: nextPage, category: filter });
      setItems((previous) => replace ? result.items : [...previous, ...result.items]);
      setPage(result.page);
      setHasMore(result.hasMore);
      setUnreadCount(result.unreadCount);
    } catch {
      if (replace) setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => {
    void load(1, true);
    return undefined;
  }, [load]));

  const openNotification = async (item: AppNotification) => {
    if (!item.isRead && !item.read) {
      await markNotificationRead(item.notificationId || item.id).catch(() => undefined);
      setUnreadCount((value) => Math.max(0, value - 1));
      setItems((current) => current.map((entry) => entry.notificationId === item.notificationId
        ? { ...entry, isRead: true, read: true } : entry));
    }
    if (item.propertyId || (item.entityType === 'property' && item.entityId)) {
      router.push({ pathname: '/property/[id]', params: { id: String(item.propertyId || item.entityId) } });
    } else if (item.projectId || (item.entityType === 'project' && item.entityId)) {
      router.push({ pathname: '/project/[id]', params: { id: String(item.projectId || item.entityId) } });
    } else if (item.announcementId || item.entityType === 'announcement') {
      router.push({ pathname: '/announcements/[id]', params: { id: String(item.announcementId || item.entityId) } });
    }
  };

  const handleFilter = (next: NotificationCategory | 'all') => {
    setFilter(next);
    setItems([]);
    setPage(1);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background }]}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={[styles.eyebrow, { color: colors.action }]}>OG LANDMARK</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark all notifications as read"
          onPress={async () => {
            await markAllNotificationsRead(filter).catch(() => undefined);
            setItems((current) => current.map(item => ({ ...item, isRead: true, read: true })));
            setUnreadCount(0);
          }}
          style={[styles.markAll, { borderColor: colors.border }]}
        >
          <Feather name="check-circle" size={17} color={colors.action} />
        </Pressable>
      </View>

      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {filters.map((entry) => (
          <Pressable
            key={entry.key}
            onPress={() => handleFilter(entry.key)}
            style={[styles.filter, filter === entry.key && { backgroundColor: colors.action }]}
          >
            <Text style={[styles.filterText, { color: filter === entry.key ? colors.actionForeground : colors.mutedForeground }]}>
              {entry.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {unreadCount > 0 ? (
        <Text style={[styles.unreadSummary, { color: colors.action }]}>{unreadCount} unread update{unreadCount === 1 ? '' : 's'}</Text>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.action} size="large" />
          <Text style={[styles.centerText, { color: colors.mutedForeground }]}>Loading your updates…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.notificationId || String(item.id)}
          contentContainerStyle={[styles.list, items.length === 0 && styles.emptyList, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(1, true); }} tintColor={colors.action} />}
          onEndReached={() => {
            if (hasMore && !loadingMore) void load(page + 1, false);
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={(
            <View style={styles.center}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="bell-off" size={26} color={colors.action} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No notifications yet</Text>
              <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
                New property listings, projects and important updates will appear here.
              </Text>
            </View>
          )}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.action} style={{ marginVertical: 14 }} /> : null}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { void openNotification(item); }}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: item.isRead || item.read ? colors.card : colors.secondary, borderColor: colors.border, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <View style={[styles.cardIcon, { backgroundColor: colors.action + '18' }]}>
                <Feather name={notificationIcon(item)} size={18} color={colors.action} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeading}>
                  <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: item.isRead || item.read ? 'Inter_500Medium' : 'Inter_700Bold' }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {!item.isRead && !item.read ? <View style={[styles.dot, { backgroundColor: colors.action }]} /> : null}
                </View>
                <Text style={[styles.cardMessage, { color: colors.mutedForeground }]} numberOfLines={3}>{item.body || item.message}</Text>
                <View style={styles.cardFooter}>
                  <Text style={[styles.time, { color: colors.mutedForeground }]}>{relativeTime(item.createdAt)}</Text>
                  <Text style={[styles.viewAction, { color: colors.action }]}>View <Feather name="arrow-up-right" size={11} color={colors.action} /></Text>
                  <Pressable
                    accessibilityLabel="Delete notification"
                    hitSlop={8}
                    onPress={() => { void deleteNotification(item.notificationId || item.id).then(() => setItems(current => current.filter(entry => entry.notificationId !== item.notificationId))).catch(() => undefined); }}
                  >
                    <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 14, gap: 12 },
  iconButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.4 },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 25, marginTop: 1 },
  markAll: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1 },
  filter: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  filterText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  unreadSummary: { fontFamily: 'Inter_600SemiBold', fontSize: 11, paddingHorizontal: 18, paddingTop: 14 },
  list: { padding: 16, gap: 10 },
  emptyList: { flexGrow: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: 'row', gap: 12 },
  cardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  cardTitle: { flex: 1, fontSize: 14, lineHeight: 19 },
  cardMessage: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 5 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  time: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 10 },
  viewAction: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, flex: 1 },
  centerText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10 },
  emptyIcon: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 16 },
});