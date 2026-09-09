import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useFocusEffect, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { getNotificationUnreadCount } from '@/lib/api';

export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const colors = useColors();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    void getNotificationUnreadCount().then(setUnread).catch(() => undefined);
  }, []);

  useFocusEffect(useCallback(() => {
    refresh();
    return undefined;
  }, [refresh]));

  useEffect(() => {
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
      testID="notification-bell"
      onPress={() => router.push('/notifications' as any)}
      style={({ pressed }) => [
        styles.button,
        { width: compact ? 36 : 42, height: compact ? 36 : 42, backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Feather name="bell" size={compact ? 17 : 19} color={colors.action} />
      {unread > 0 ? (
        <View style={[styles.count, { backgroundColor: colors.action }]}>
          <Text style={styles.countText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  count: { position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  countText: { color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 9, lineHeight: 11 },
});