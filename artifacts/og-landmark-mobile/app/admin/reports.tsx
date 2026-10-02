import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import { AdminReport, getAdminReports, updateAdminReport } from '@/lib/api';

const FILTERS = ['All', 'Pending', 'Resolved', 'Dismissed'] as const;
type ReportFilter = typeof FILTERS[number];

export default function AdminReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<ReportFilter>('Pending');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getAdminReports(filter === 'All' ? undefined : filter);
      setReports(Array.isArray(rows) ? rows : []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function resolveReport(report: AdminReport, status: 'Resolved' | 'Dismissed') {
    try {
      await updateAdminReport(report.id, status);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this report.');
    }
  }

  const topInset = Platform.OS === 'web' ? Math.max(67, insets.top) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.action, paddingTop: topInset + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="admin-reports-back"
          onPress={() => router.back()}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={20} color={colors.actionForeground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.actionForeground }]}>Property Reports</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => {
            const selected = item === filter;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`admin-report-filter-${item.toLowerCase()}`}
                onPress={() => setFilter(item)}
                style={[
                  styles.filterChip,
                  { backgroundColor: selected ? colors.action : colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={{ color: selected ? colors.actionForeground : colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground }}>{error}</Text>
            <Pressable accessibilityRole="button" testID="admin-reports-retry" onPress={() => { void load(); }}>
              <Text style={{ color: colors.action, fontFamily: 'Inter_600SemiBold', marginTop: 10 }}>Try again</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <ActivityIndicator size="large" color={colors.action} style={{ marginTop: 48 }} />
        ) : reports.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="check-circle" size={28} color={colors.mutedForeground} />
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 10 }}>
              No {filter === 'All' ? '' : filter.toLowerCase() + ' '}reports
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {reports.map((report) => (
              <View key={report.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardTop}>
                  <Text style={[styles.reportTitle, { color: colors.foreground }]}>Report #{report.id}</Text>
                  <Text style={[styles.status, { color: colors.action }]}>{report.status || 'Pending'}</Text>
                </View>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  Property #{report.propertyId}{report.reporterName ? ` · ${report.reporterName}` : ''}
                </Text>
                <Text style={[styles.reason, { color: colors.foreground }]}>{report.reason || 'No reason supplied'}</Text>
                {!!report.description && (
                  <Text style={[styles.description, { color: colors.mutedForeground }]}>{report.description}</Text>
                )}
                {!!report.reportedAt && (
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    {new Date(report.reportedAt).toLocaleDateString()}
                  </Text>
                )}
                {String(report.status).toLowerCase() === 'pending' && (
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      testID={`admin-report-resolve-${report.id}`}
                      onPress={() => { void resolveReport(report, 'Resolved'); }}
                      style={[styles.actionButton, { backgroundColor: colors.action }]}
                    >
                      <Feather name="check" size={15} color={colors.actionForeground} />
                      <Text style={{ color: colors.actionForeground, fontFamily: 'Inter_600SemiBold' }}>Resolve</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      testID={`admin-report-dismiss-${report.id}`}
                      onPress={() => { void resolveReport(report, 'Dismissed'); }}
                      style={[styles.actionButton, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
                    >
                      <Feather name="x" size={15} color={colors.foreground} />
                      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Dismiss</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 14 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  filters: { gap: 8, paddingHorizontal: 16, paddingVertical: 16 },
  filterChip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  list: { paddingHorizontal: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  reportTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  status: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  meta: { fontSize: 12 },
  reason: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 4 },
  description: { fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10 },
  errorCard: { margin: 16, padding: 16, borderWidth: 1, borderRadius: 14 },
  emptyCard: { margin: 16, padding: 28, borderWidth: 1, borderRadius: 14, alignItems: 'center' },
});