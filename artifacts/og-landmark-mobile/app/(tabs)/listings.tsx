import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import React, { useCallback, useState } from 'react';
import {
  Alert, Linking, Platform, Pressable,
  ScrollView, Share, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  ListingStatus, UserListing,
  calcListingStats, deleteUserListing, getMyListings, resubmitUserListing, updateListingStatus,
} from '@/lib/listingsStore';

// ─── helpers ──────────────────────────────────────────────────────────────────

const formatPrice = (p: number) =>
  p >= 10_000_000
    ? `${(p / 10_000_000).toFixed(1)} Cr`
    : p >= 100_000
    ? `${(p / 100_000).toFixed(0)} Lakh`
    : `Rs ${p.toLocaleString()}`;

type FilterTab = 'All' | 'Active' | 'Pending' | 'Draft' | 'Paused' | 'Sold' | 'Rented';
const FILTER_TABS: FilterTab[] = ['All', 'Active', 'Pending', 'Draft', 'Paused', 'Sold', 'Rented'];

const STATUS_BADGE: Record<ListingStatus, { bg: string; text: string }> = {
  Active:  { bg: '#1a6b3a18', text: '#1a6b3a' },
  Pending: { bg: '#c8a45a18', text: '#c8a45a' },
  Draft:   { bg: '#88888818', text: '#888888' },
  Paused:  { bg: '#7c3aed18', text: '#7c3aed' },
  Sold:    { bg: '#102a4318', text: '#102a43' },
  Rented:  { bg: '#b94b4218', text: '#b94b42' },
};

// ─── main screen ──────────────────────────────────────────────────────────────

export default function ListingsScreen() {
  const colors   = useColors();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { isRTL, tr } = useLanguage();
  const { user, isLoggedIn } = useAuth();

  const [activeTab, setActiveTab]     = useState<FilterTab>('All');
  const [myListings, setMyListings]   = useState<UserListing[]>([]);

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const reload = useCallback(() => {
    if (!isLoggedIn || !user) return;
    void getMyListings(user.id).then(setMyListings);
  }, [isLoggedIn, user]);

  useFocusEffect(reload);

  const filtered =
    activeTab === 'All'
      ? myListings
      : myListings.filter((l) => l.listingStatus === activeTab);

  const stats = calcListingStats(myListings);

  const handleStatusChange = (id: string, status: ListingStatus, confirmMsg?: string) => {
    const doIt = async () => {
      const updated = await updateListingStatus(id, status);
      setMyListings(updated.filter((l) => l.postedBy === user?.id));
    };
    if (confirmMsg) {
      Alert.alert('Confirm', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: () => { void doIt(); } },
      ]);
    } else {
      void doIt();
    }
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert(`Delete listing?`, `"${title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const updated = await deleteUserListing(id);
          setMyListings(updated.filter((l) => l.postedBy === user?.id));
        },
      },
    ]);
  };

  const handleResubmit = async (id: string) => {
    try {
      const updated = await resubmitUserListing(id);
      setMyListings(updated.filter((l) => l.postedBy === user?.id));
      Alert.alert('Submitted for review', 'Your listing is back in the admin review queue.');
    } catch (error) {
      Alert.alert('Could not resubmit', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  if (!isLoggedIn) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Feather name="lock" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground, marginTop: 16 }]}>{tr('listingsEyebrow')}</Text>
        <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{tr('listingsSubtitle')}</Text>
        <Pressable onPress={() => router.push('/(auth)/login')}
          style={[styles.emptyBtn, { backgroundColor: colors.action, marginTop: 16 }]}>
          <Text style={[styles.emptyBtnText, { color: colors.actionForeground }]}>{tr('signInBtn')}</Text>
        </Pressable>
      </View>
    );
  }

  const tabLabels: Record<FilterTab, string> = {
    All: tr('tabAll'), Active: tr('tabActive'), Pending: tr('tabPending'),
    Draft: tr('tabDraft'), Paused: 'Paused', Sold: 'Sold', Rented: 'Rented',
  };

  const tabCounts: Partial<Record<FilterTab, number>> = {
    Active: stats.active, Pending: stats.pending, Paused: stats.paused,
    Sold: stats.sold, Rented: stats.rented,
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: botPad + 96 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <AnimatedReveal>
        <View style={[styles.header, { paddingHorizontal: 20 }, isRTL && { flexDirection: 'row-reverse' }]}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{tr('listingsEyebrow')}</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{tr('listingsTitle')}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/post-ad')}
            style={[styles.addBtn, { backgroundColor: colors.action }]}
          >
            <Feather name="plus" size={16} color={colors.actionForeground} />
            <Text style={[styles.addBtnText, { color: colors.actionForeground }]}>{tr('addBtn')}</Text>
          </Pressable>
        </View>
      </AnimatedReveal>

      {/* Summary strip */}
      <AnimatedReveal delay={60}>
        <View style={[styles.summaryStrip, { marginHorizontal: 20, backgroundColor: colors.action }]}>
          {[
            { label: tr('totalLabel'),  value: String(stats.total) },
            { label: tr('activeLabel'), value: String(stats.active) },
            { label: tr('viewsLabel'),  value: stats.totalViews > 0 ? String(stats.totalViews) : '—' },
            { label: tr('leadsLabel'),  value: stats.totalLeads > 0 ? String(stats.totalLeads) : '—' },
          ].map((s, i) => (
            <View key={s.label} style={[styles.summaryItem, i < 3 && { borderRightWidth: 1, borderRightColor: '#ffffff22' }]}>
              <Text style={styles.summaryValue}>{s.value}</Text>
              <Text style={styles.summaryLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </AnimatedReveal>

      {/* Filter Tabs */}
      <AnimatedReveal delay={80}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabsRow, { paddingHorizontal: 20 }]}>
          {FILTER_TABS.map((t) => (
            <Pressable key={t} onPress={() => setActiveTab(t)}
              style={[styles.tabPill, {
                backgroundColor: activeTab === t ? colors.action : colors.secondary,
                borderColor: activeTab === t ? colors.action : colors.border,
              }]}>
              <Text style={[styles.tabPillText, { color: activeTab === t ? colors.actionForeground : colors.mutedForeground }]}>
                {tabLabels[t]}
              </Text>
              {tabCounts[t] != null && tabCounts[t]! > 0 && (
                <View style={[lc.tabBadge, { backgroundColor: activeTab === t ? '#ffffff33' : colors.border }]}>
                  <Text style={[lc.tabBadgeText, { color: activeTab === t ? '#ffffff' : colors.mutedForeground }]}>
                    {tabCounts[t]}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </AnimatedReveal>

      {/* Listings */}
      <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 12 }}>
        {filtered.length === 0 ? (
          <AnimatedReveal delay={100}>
            <View style={[styles.emptyState, { borderColor: colors.border }]}>
              <Feather name="home" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{tr('listingsEmpty')}</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                {activeTab === 'All' ? tr('listingsEmptyAllDesc') : tr('listingsEmptyDesc')}
              </Text>
              <Pressable onPress={() => router.push('/(tabs)/post-ad')}
                style={[styles.emptyBtn, { backgroundColor: colors.action }]}>
                <Text style={[styles.emptyBtnText, { color: colors.actionForeground }]}>{tr('addPropertyBtn')}</Text>
              </Pressable>
            </View>
          </AnimatedReveal>
        ) : (
          filtered.map((listing, i) => (
            <AnimatedReveal key={listing.id} delay={100 + i * 60}>
              <ListingCard
                listing={listing} index={i} colors={colors} isRTL={isRTL}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onResubmit={handleResubmit}
              />
            </AnimatedReveal>
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ─── listing card ─────────────────────────────────────────────────────────────

function ListingCard({
  listing, colors, isRTL, onStatusChange, onDelete, onResubmit,
}: {
  listing: UserListing;
  index: number;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  onStatusChange: (id: string, status: ListingStatus, msg?: string) => void;
  onDelete: (id: string, title: string) => void;
  onResubmit: (id: string) => void;
}) {
  const sc    = STATUS_BADGE[listing.listingStatus] ?? STATUS_BADGE.Pending;
  const addr  = listing.neighborhood ? `${listing.neighborhood}, ${listing.city}` : listing.city;
  const isLive = listing.listingStatus === 'Active';

  const share = () => {
    void Share.share({
      message: `${listing.title}\n${addr}\nPrice: ${formatPrice(listing.price)}\n\nPosted on OG Landmark – oglandmark.com`,
    });
  };

  const whatsapp = () => {
    const msg = encodeURIComponent(`*${listing.title}*\n📍 ${addr}\n💰 ${formatPrice(listing.price)}\n\nFor more details: oglandmark.com`);
    Linking.openURL(`https://wa.me/?text=${msg}`).catch(() => Alert.alert('WhatsApp not available'));
  };

  const moreActions = () => {
    const opts: { text: string; onPress: () => void; style?: 'destructive' | 'cancel' }[] = [];
    if (listing.reviewStatus === 'Rejected' || listing.reviewStatus === 'Changes Requested') {
      opts.push({ text: 'Resubmit for Review', onPress: () => onResubmit(listing.id) });
    }
    if (listing.listingStatus === 'Active') {
      opts.push({ text: 'Pause Listing', onPress: () => onStatusChange(listing.id, 'Paused', 'Pause this listing? It will no longer be visible to buyers.') });
      opts.push({ text: 'Mark as Sold', onPress: () => onStatusChange(listing.id, 'Sold', 'Mark this property as sold? This will update your dashboard stats.') });
      opts.push({ text: 'Mark as Rented', onPress: () => onStatusChange(listing.id, 'Rented', 'Mark this property as rented?') });
    }
    if (listing.listingStatus === 'Paused') {
      opts.push({ text: 'Activate Listing', onPress: () => onStatusChange(listing.id, 'Active') });
    }
    if (listing.listingStatus === 'Draft') {
      opts.push({ text: 'Submit for Review', onPress: () => onStatusChange(listing.id, 'Pending') });
    }
    opts.push({ text: 'Share via WhatsApp', onPress: whatsapp });
    opts.push({ text: 'Delete Listing', style: 'destructive', onPress: () => onDelete(listing.id, listing.title) });
    opts.push({ text: 'Cancel', style: 'cancel', onPress: () => {} });
    Alert.alert(listing.title, 'Choose an action', opts);
  };

  return (
    <View style={[lc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Top */}
      <View style={[lc.top, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={[lc.statusRow, isRTL && { flexDirection: 'row-reverse' }]}>
            {/* Listing status badge */}
            <View style={[lc.statusBadge, { backgroundColor: sc.bg }]}>
              <View style={[lc.dot, { backgroundColor: sc.text }]} />
              <Text style={[lc.statusText, { color: sc.text }]}>{listing.listingStatus}</Text>
            </View>
            {/* Purpose badge */}
            <View style={[lc.purposeBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[lc.purposeText, { color: colors.mutedForeground }]}>{listing.status}</Text>
            </View>
          </View>
          {listing.reviewReason && (listing.reviewStatus === 'Rejected' || listing.reviewStatus === 'Changes Requested') && (
            <View style={[lc.reviewNote, { backgroundColor: '#f59e0b14', borderColor: '#f59e0b55' }]}>
              <Feather name="alert-circle" size={13} color="#a16207" />
              <Text style={[lc.reviewNoteText, { color: '#854d0e' }]} numberOfLines={3}>{listing.reviewReason}</Text>
            </View>
          )}
          <Text style={[lc.listingTitle, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
            {listing.title}
          </Text>
          <Text style={[lc.price, { color: colors.primary }]}>{formatPrice(listing.price)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="map-pin" size={10} color={colors.mutedForeground} />
            <Text style={[lc.addr, { color: colors.mutedForeground }]}>{addr}</Text>
          </View>
        </View>
        <Pressable onPress={moreActions} hitSlop={12}
          style={[lc.moreBtn, { backgroundColor: colors.secondary }]}>
          <Feather name="more-vertical" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Divider */}
      <View style={[lc.divider, { backgroundColor: colors.border }]} />

      {/* Stats */}
      <View style={[lc.metaRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <StatItem icon="eye"   value={String(listing.views ?? 0)}      label="Views" colors={colors} />
        <StatItem icon="bookmark" value={String(listing.saves ?? 0)}   label="Saves" colors={colors} />
        <StatItem icon="users" value={String(listing.leadsCount ?? 0)} label="Leads" colors={colors} />
        {listing.area > 0 && (
          <StatItem icon="maximize" value={`${listing.area}${listing.areaUnit}`} label="Area" colors={colors} />
        )}
      </View>

      {/* Actions */}
      <View style={[lc.actions, isRTL && { flexDirection: 'row-reverse' }]}>
        {/* Promote */}
        <Pressable
          style={[lc.actionPill, { borderColor: colors.action + '44', backgroundColor: colors.action + '0d', flex: 1 }]}
          onPress={() => Alert.alert('Promote', 'Share your listing to reach more buyers.', [
            { text: 'Share via WhatsApp', onPress: whatsapp },
            { text: 'Share Link', onPress: share },
            { text: 'Cancel', style: 'cancel' },
          ])}
        >
          <Feather name="trending-up" size={13} color={colors.action} />
          <Text style={[lc.actionText, { color: colors.action }]}>Promote</Text>
        </Pressable>

        {/* Pause/Activate toggle */}
        {(listing.listingStatus === 'Active' || listing.listingStatus === 'Paused') && (
          <Pressable
            style={[lc.actionPill, { borderColor: colors.border, flex: 1 }]}
            onPress={() =>
              onStatusChange(
                listing.id,
                isLive ? 'Paused' : 'Active',
                isLive ? 'Pause this listing?' : undefined,
              )
            }
          >
            <Feather name={isLive ? 'pause' : 'play'} size={13} color={colors.mutedForeground} />
            <Text style={[lc.actionText, { color: colors.mutedForeground }]}>{isLive ? 'Pause' : 'Activate'}</Text>
          </Pressable>
        )}

        {/* Share */}
        <Pressable
          style={[lc.actionPill, { borderColor: colors.border }]}
          onPress={share}
        >
          <Feather name="share-2" size={13} color={colors.mutedForeground} />
          <Text style={[lc.actionText, { color: colors.mutedForeground }]}>Share</Text>
        </Pressable>

        {/* Delete */}
        <Pressable
          style={[lc.actionPill, { borderColor: '#dc262622', backgroundColor: '#dc262608' }]}
          onPress={() => onDelete(listing.id, listing.title)}
        >
          <Feather name="trash-2" size={13} color="#dc2626" />
        </Pressable>
      </View>
    </View>
  );
}

function StatItem({ icon, value, label, colors }: { icon: keyof typeof Feather.glyphMap; value: string; label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={lc.statItem}>
      <Feather name={icon} size={11} color={colors.primary} />
      <Text style={[lc.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[lc.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ─── styles ────────────────────────────────────────────────────────────────────

const lc = StyleSheet.create({
  card:         { borderRadius: 18, borderWidth: 1, padding: 14 },
  top:          { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  statusRow:    { flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  reviewNote:   { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderWidth: 1, borderRadius: 9, padding: 8, marginBottom: 7 },
  reviewNoteText:{ flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  statusBadge:  { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:          { width: 5, height: 5, borderRadius: 3 },
  statusText:   { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  purposeBadge: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  purposeText:  { fontFamily: 'Inter_400Regular', fontSize: 10 },
  listingTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, marginBottom: 4 },
  price:        { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 2 },
  addr:         { fontFamily: 'Inter_400Regular', fontSize: 11 },
  moreBtn:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  divider:      { height: 1, marginVertical: 12 },
  metaRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 12 },
  statItem:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue:    { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  statLabel:    { fontFamily: 'Inter_400Regular', fontSize: 10 },
  actions:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  actionText:   { fontFamily: 'Inter_500Medium', fontSize: 11 },
  tabBadge:     { borderRadius: 7, paddingHorizontal: 5, paddingVertical: 2 },
  tabBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9 },
});

const styles = StyleSheet.create({
  screen:       { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 20 },
  eyebrow:      { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 4 },
  title:        { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.4 },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13 },
  addBtnText:   { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  summaryStrip: { borderRadius: 16, flexDirection: 'row', marginBottom: 20 },
  summaryItem:  { flex: 1, alignItems: 'center', paddingVertical: 14 },
  summaryValue: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#ffffff', letterSpacing: -0.3 },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#ffffff99', marginTop: 2 },
  tabsRow:      { gap: 8, paddingBottom: 4 },
  tabPill:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  tabPillText:  { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  emptyState:   { borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', padding: 36, alignItems: 'center', gap: 10, marginTop: 20 },
  emptyTitle:   { fontFamily: 'Inter_700Bold', fontSize: 16 },
  emptyDesc:    { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' },
  emptyBtn:     { marginTop: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
