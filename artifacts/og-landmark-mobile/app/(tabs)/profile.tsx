import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, AppState, Image, Linking, Modal, Platform, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useFocusEffect, useRouter } from 'expo-router';
// BlurView removed — crashes Android GPU
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BrandMark } from '@/components/BrandMark';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSaved } from '@/context/SavedContext';
import { getMyListings } from '@/lib/listingsStore';
import { getLeads } from '@/lib/leadsStore';
import { getProfilePhoto } from '@/lib/profilePhotoStore';
import { getMobileSettings } from '@/lib/api';
import { getInquiries, deleteInquiry, formatInquiryPrice, type Inquiry } from '@/lib/inquiriesStore';
import { getVisitHistory, removeVisit, clearVisitHistory, type VisitRecord } from '@/lib/visitHistoryStore';
import { getSavedSearches, deleteSavedSearch, type SavedSearch } from '@/lib/savedSearchesStore';
import { getSiteVisitsByBuyer, visitStatusColor as siteVisitStatusColor } from '@/lib/siteVisitStore';
import { getAgentVisitsByBuyer, visitStatusColor as agentVisitStatusColor } from '@/lib/agentVisitsStore';
import { deleteMyAccount } from '@/lib/api';
import { clearLocalAccountData } from '@/lib/accountCleanup';
import {
  getNotificationPermissionState,
  registerPushTokenForUser,
  type NotificationPermissionState,
} from '@/lib/pushNotifications';

// ── Role helpers ───────────────────────────────────────────────────────────────

const roleLabels = (tr: (k: Parameters<ReturnType<typeof useLanguage>['tr']>[0]) => string): Record<string, string> => ({
  buyer:     tr('buyerAccount'),
  agent:     tr('agentAccount'),
  developer: tr('developerAccount'),
  admin:     'Admin',
});
const roleIcons: Record<string, keyof typeof Feather.glyphMap> = {
  buyer: 'home', agent: 'briefcase', developer: 'layers',
};

// ── Slide-up sheet ─────────────────────────────────────────────────────────────

function SlideSheet({
  visible, onClose, title, subtitle, children, colors, insets,
}: {
  visible: boolean; onClose: () => void; title: string; subtitle?: string;
  children: React.ReactNode; colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const translateY = useSharedValue(600);
  const opacity    = useSharedValue(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withSpring(0, { damping: 24, stiffness: 240 });
      opacity.value    = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(600, { duration: 220 });
      opacity.value    = withTiming(0, { duration: 180 });
      const t = setTimeout(() => setMounted(false), 240);
      return () => clearTimeout(t);
    }
  }, [visible, translateY, opacity]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const bgStyle    = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!mounted) return null;
  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={sh.root}>
        <Animated.View style={[StyleSheet.absoluteFill, sh.backdrop, bgStyle]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[sh.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16, borderColor: colors.border }, sheetStyle]}>
          <View style={[sh.handle, { backgroundColor: colors.border }]} />
          <View style={sh.sheetHeader}>
            <View>
              <Text style={[sh.sheetTitle, { color: colors.foreground }]}>{title}</Text>
              {subtitle ? <Text style={[sh.sheetSub, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} style={[sh.closeBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const sh = StyleSheet.create({
  root:        { flex: 1, justifyContent: 'flex-end' },
  backdrop:    { backgroundColor: '#0d1d2baa' },
  sheet:       { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, maxHeight: '88%' },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 0 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  sheetTitle:  { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.3 },
  sheetSub:    { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  closeBtn:    { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});

// ── Status badge helper ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Inquiry['status'] }) {
  const map: Record<Inquiry['status'], { label: string; bg: string; fg: string }> = {
    sent:    { label: 'Inquiry Sent',    bg: '#1a6b3a15', fg: '#1a6b3a' },
    replied: { label: 'Agent Replied',   bg: '#1a43b315', fg: '#1a43b3' },
    closed:  { label: 'Closed',          bg: '#64748b15', fg: '#64748b' },
  };
  const cfg = map[status];
  return (
    <View style={[ib.badge, { backgroundColor: cfg.bg }]}>
      <Feather name={status === 'replied' ? 'message-circle' : status === 'sent' ? 'send' : 'check'} size={9} color={cfg.fg} />
      <Text style={[ib.label, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}
const ib = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, alignSelf: 'flex-start' },
  label: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.3 },
});

// ── Inquiries Modal ────────────────────────────────────────────────────────────

function InquiriesModal({
  visible, onClose, inquiries, onDelete, colors, insets,
}: {
  visible: boolean; onClose: () => void; inquiries: Inquiry[];
  onDelete: (id: string) => void;
  colors: ReturnType<typeof useColors>; insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const router = useRouter();

  return (
    <SlideSheet visible={visible} onClose={onClose} title="My Inquiries"
      subtitle={`${inquiries.length} inquiry${inquiries.length !== 1 ? 'ies' : 'y'} total`}
      colors={colors} insets={insets}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
        {inquiries.length === 0 ? (
          <View style={im.empty}>
            <View style={[im.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="message-circle" size={26} color={colors.mutedForeground} />
            </View>
            <Text style={[im.emptyTitle, { color: colors.foreground }]}>No inquiries yet</Text>
            <Text style={[im.emptyDesc, { color: colors.mutedForeground }]}>
              When you tap "Arrange a viewing" on a property, your inquiry will appear here.
            </Text>
            <Pressable onPress={() => { onClose(); router.push('/explore'); }}
              style={[im.exploreBtn, { backgroundColor: colors.action }]}>
              <Text style={[im.exploreBtnText, { color: colors.actionForeground }]}>Browse Properties</Text>
              <Feather name="arrow-right" size={14} color={colors.actionForeground} />
            </Pressable>
          </View>
        ) : inquiries.map((inq) => {
          const isExpanded = expanded === inq.id;
          const date = new Date(inq.sentAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
          return (
            <Pressable key={inq.id} onPress={() => setExpanded(isExpanded ? null : inq.id)}
              style={[im.card, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              {/* Header row */}
              <View style={im.cardTop}>
                <View style={[im.propIcon, { backgroundColor: colors.action + '18' }]}>
                  <Feather name={inq.propertyType === 'Plot' ? 'map-pin' : inq.propertyType === 'Agriculture Land' ? 'map' : 'home'} size={16} color={colors.action} />
                </View>
                <View style={im.cardInfo}>
                  <Text style={[im.propTitle, { color: colors.foreground }]} numberOfLines={1}>{inq.propertyTitle}</Text>
                  <Text style={[im.propMeta, { color: colors.mutedForeground }]}>
                    {inq.propertyCity} · {formatInquiryPrice(inq.propertyPrice)}
                  </Text>
                </View>
                <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.mutedForeground} />
              </View>

              {/* Badges row */}
              <View style={im.badgeRow}>
                <StatusBadge status={inq.status} />
                <Text style={[im.dateText, { color: colors.mutedForeground }]}>{date}</Text>
              </View>

              {/* Expanded content */}
              {isExpanded && (
                <View style={[im.expandedContent, { borderTopColor: colors.border }]}>
                  {/* Your message */}
                  <Text style={[im.msgLabel, { color: colors.mutedForeground }]}>YOUR INQUIRY</Text>
                  <View style={[im.msgBubble, { backgroundColor: colors.action + '12', borderColor: colors.action + '22' }]}>
                    <Text style={[im.msgText, { color: colors.foreground }]}>{inq.message}</Text>
                  </View>

                  {/* Agent reply */}
                  {inq.reply && (
                    <>
                      <Text style={[im.msgLabel, { color: '#1a43b3' }, { marginTop: 10 }]}>AGENT REPLY</Text>
                      <View style={[im.msgBubble, { backgroundColor: '#1a43b312', borderColor: '#1a43b322' }]}>
                        <Text style={[im.msgText, { color: colors.foreground }]}>{inq.reply}</Text>
                        <Text style={[im.replyAgent, { color: colors.mutedForeground }]}>— {inq.agentName}</Text>
                      </View>
                    </>
                  )}

                  {/* Actions */}
                  <View style={im.actionRow}>
                    <Pressable onPress={() => Linking.openURL('tel:03042569000')}
                      style={[im.actionBtn, { backgroundColor: colors.action }]}>
                      <Feather name="phone" size={13} color={colors.actionForeground} />
                      <Text style={[im.actionBtnText, { color: colors.actionForeground }]}>Call Agent</Text>
                    </Pressable>
                    <Pressable onPress={() => Alert.alert('Delete Inquiry', 'Remove this inquiry from your list?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => { onDelete(inq.id); setExpanded(null); } },
                    ])} style={[im.actionBtn, im.actionBtnDelete, { borderColor: '#dc262644', backgroundColor: '#dc262610' }]}>
                      <Feather name="trash-2" size={13} color="#dc2626" />
                      <Text style={[im.actionBtnText, { color: '#dc2626' }]}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </SlideSheet>
  );
}

const im = StyleSheet.create({
  empty:          { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyIcon:      { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle:     { fontFamily: 'Inter_700Bold', fontSize: 16 },
  emptyDesc:      { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
  exploreBtn:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  exploreBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  card:           { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  cardTop:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  propIcon:       { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo:       { flex: 1 },
  propTitle:      { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 2 },
  propMeta:       { fontFamily: 'Inter_400Regular', fontSize: 10 },
  badgeRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateText:       { fontFamily: 'Inter_400Regular', fontSize: 10 },
  expandedContent:{ borderTopWidth: 1, paddingTop: 12, gap: 6 },
  msgLabel:       { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  msgBubble:      { borderWidth: 1, borderRadius: 10, padding: 10 },
  msgText:        { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  replyAgent:     { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 6 },
  actionRow:      { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 10 },
  actionBtnDelete:{ borderWidth: 1 },
  actionBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});

// ── Visit History Modal ────────────────────────────────────────────────────────

function VisitHistoryModal({
  visible, onClose, history, onRemove, onClearAll, colors, insets,
}: {
  visible: boolean; onClose: () => void; history: VisitRecord[];
  onRemove: (id: number) => void; onClearAll: () => void;
  colors: ReturnType<typeof useColors>; insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const router = useRouter();
  const typeIcon = (type: string): keyof typeof Feather.glyphMap =>
    type === 'Plot' ? 'map-pin' : type.includes('gric') ? 'map' : type === 'Shop' || type === 'Office' ? 'briefcase' : 'home';

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7)   return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
  }

  return (
    <SlideSheet visible={visible} onClose={onClose} title="Viewed Properties"
      subtitle={history.length > 0 ? `${history.length} properties viewed` : undefined}
      colors={colors} insets={insets}>
      {history.length > 0 && (
        <Pressable onPress={() => Alert.alert('Clear History', 'Remove all viewed properties?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear All', style: 'destructive', onPress: () => { onClearAll(); } },
        ])} style={vh.clearBtn}>
          <Text style={[vh.clearBtnText, { color: colors.mutedForeground }]}>Clear all history</Text>
        </Pressable>
      )}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
        {history.length === 0 ? (
          <View style={vh.empty}>
            <View style={[vh.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="eye" size={26} color={colors.mutedForeground} />
            </View>
            <Text style={[vh.emptyTitle, { color: colors.foreground }]}>No properties viewed yet</Text>
            <Text style={[vh.emptyDesc, { color: colors.mutedForeground }]}>
              Properties you open will appear here so you can easily find them again.
            </Text>
            <Pressable onPress={() => { onClose(); router.push('/explore'); }}
              style={[vh.exploreBtn, { backgroundColor: colors.action }]}>
              <Text style={[vh.exploreBtnText, { color: colors.actionForeground }]}>Start Browsing</Text>
              <Feather name="arrow-right" size={14} color={colors.actionForeground} />
            </Pressable>
          </View>
        ) : history.map((v) => (
          <Pressable key={v.propertyId}
            onPress={() => { onClose(); router.push(`/property/${v.propertyId}`); }}
            style={({ pressed }) => [vh.card, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
            {/* Icon */}
            <View style={[vh.iconWrap, { backgroundColor: colors.action + '18' }]}>
              <Feather name={typeIcon(v.propertyType)} size={17} color={colors.action} />
            </View>
            {/* Info */}
            <View style={vh.info}>
              <Text style={[vh.propTitle, { color: colors.foreground }]} numberOfLines={1}>{v.propertyTitle}</Text>
              <View style={vh.metaRow}>
                <Text style={[vh.metaText, { color: colors.mutedForeground }]}>
                  {v.propertyCity} · {formatInquiryPrice(v.propertyPrice)}
                </Text>
              </View>
              <View style={vh.statusRow}>
                <View style={[vh.typeBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[vh.typeText, { color: colors.mutedForeground }]}>{v.propertyType}</Text>
                </View>
                <Text style={[vh.timeText, { color: colors.mutedForeground }]}>{relativeTime(v.viewedAt)}</Text>
              </View>
            </View>
            {/* Remove */}
            <Pressable onPress={(e) => { e.stopPropagation(); onRemove(v.propertyId); }}
              hitSlop={10} style={vh.removeBtn}>
              <Feather name="x" size={13} color={colors.mutedForeground} />
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
    </SlideSheet>
  );
}

const vh = StyleSheet.create({
  clearBtn:       { alignSelf: 'flex-end', paddingHorizontal: 20, paddingBottom: 8 },
  clearBtnText:   { fontFamily: 'Inter_400Regular', fontSize: 11, textDecorationLine: 'underline' },
  empty:          { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyIcon:      { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle:     { fontFamily: 'Inter_700Bold', fontSize: 16 },
  emptyDesc:      { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
  exploreBtn:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  exploreBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  card:           { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12 },
  iconWrap:       { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  info:           { flex: 1, gap: 3 },
  propTitle:      { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  metaRow:        { flexDirection: 'row', alignItems: 'center' },
  metaText:       { fontFamily: 'Inter_400Regular', fontSize: 11 },
  statusRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  typeBadge:      { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  typeText:       { fontFamily: 'Inter_500Medium', fontSize: 9 },
  timeText:       { fontFamily: 'Inter_400Regular', fontSize: 10 },
  removeBtn:      { padding: 6 },
});

// ── Saved Searches Modal ───────────────────────────────────────────────────────

function SavedSearchesModal({
  visible, onClose, searches, onDelete, colors, insets,
}: {
  visible: boolean; onClose: () => void; searches: SavedSearch[];
  onDelete: (id: string) => void;
  colors: ReturnType<typeof useColors>; insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const router = useRouter();

  return (
    <SlideSheet visible={visible} onClose={onClose} title="Saved Searches"
      subtitle={searches.length > 0 ? `${searches.length} search${searches.length !== 1 ? 'es' : ''} saved` : undefined}
      colors={colors} insets={insets}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
        {searches.length === 0 ? (
          <View style={ss.empty}>
            <View style={[ss.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="bookmark" size={26} color={colors.mutedForeground} />
            </View>
            <Text style={[ss.emptyTitle, { color: colors.foreground }]}>No saved searches</Text>
            <Text style={[ss.emptyDesc, { color: colors.mutedForeground }]}>
              Search for properties and tap "Save this search" to keep it here for quick access later.
            </Text>
            {/* How to save tip */}
            <View style={[ss.tipCard, { backgroundColor: colors.action + '0e', borderColor: colors.action + '22' }]}>
              <Feather name="info" size={14} color={colors.action} />
              <Text style={[ss.tipText, { color: colors.action }]}>
                Search in the Explore tab → filter → tap the bookmark icon to save
              </Text>
            </View>
            <Pressable onPress={() => { onClose(); router.push('/explore'); }}
              style={[ss.exploreBtn, { backgroundColor: colors.action }]}>
              <Text style={[ss.exploreBtnText, { color: colors.actionForeground }]}>Open Search</Text>
              <Feather name="search" size={14} color={colors.actionForeground} />
            </Pressable>
          </View>
        ) : searches.map((s) => {
          const date = new Date(s.savedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
          const filterCount = Object.values(s.filters).filter(Boolean).length;
          return (
            <View key={s.id} style={[ss.card, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={ss.cardLeft}>
                <View style={[ss.searchIcon, { backgroundColor: colors.action + '18' }]}>
                  <Feather name="search" size={14} color={colors.action} />
                </View>
                <View style={ss.cardInfo}>
                  <Text style={[ss.label, { color: colors.foreground }]} numberOfLines={1}>{s.label}</Text>
                  <Text style={[ss.meta, { color: colors.mutedForeground }]}>
                    {filterCount > 0 ? `${filterCount} filter${filterCount !== 1 ? 's' : ''} · ` : ''}{date}
                  </Text>
                </View>
              </View>
              <View style={ss.actions}>
                <Pressable onPress={() => {
                  onClose();
                  router.push({ pathname: '/explore', params: { search: s.query, ...s.filters } });
                }} style={[ss.searchAgainBtn, { backgroundColor: colors.action }]}>
                  <Text style={[ss.searchAgainText, { color: colors.actionForeground }]}>Search</Text>
                </Pressable>
                <Pressable onPress={() => Alert.alert('Delete Search', `Remove "${s.label}"?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onDelete(s.id) },
                ])} hitSlop={8} style={[ss.deleteBtn, { backgroundColor: '#dc262612' }]}>
                  <Feather name="trash-2" size={13} color="#dc2626" />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SlideSheet>
  );
}

const ss = StyleSheet.create({
  empty:          { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyIcon:      { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle:     { fontFamily: 'Inter_700Bold', fontSize: 16 },
  emptyDesc:      { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },
  tipCard:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 4 },
  tipText:        { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, flex: 1 },
  exploreBtn:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  exploreBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  card:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 14, borderWidth: 1, padding: 13 },
  cardLeft:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchIcon:     { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardInfo:       { flex: 1 },
  label:          { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 2 },
  meta:           { fontFamily: 'Inter_400Regular', fontSize: 10 },
  actions:        { flexDirection: 'row', gap: 7, alignItems: 'center' },
  searchAgainBtn: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  searchAgainText:{ fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  deleteBtn:      { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});

// ── My Visits ─────────────────────────────────────────────────────────────────

type MyVisitEntry = {
  id: string;
  kind: 'developer' | 'agent';
  title: string;
  location: string;
  contactName: string;
  contactPhone: string;
  date: string;       // ISO YYYY-MM-DD
  time: string;
  visitorCount: number;
  status: string;
  rescheduleDate?: string;
  rescheduleTime?: string;
  createdAt: string;
};

function visitStatusCfg(status: string): { label: string; bg: string; fg: string; icon: keyof typeof Feather.glyphMap } {
  switch (status) {
    case 'Confirmed':   return { label: 'Confirmed',   bg: '#1a6b3a15', fg: '#1a6b3a', icon: 'check-circle' };
    case 'Rescheduled': return { label: 'Rescheduled', bg: '#0891b215', fg: '#0891b2', icon: 'refresh-cw' };
    case 'Completed':   return { label: 'Completed',   bg: '#10293815', fg: '#102938', icon: 'check' };
    case 'Cancelled':   return { label: 'Cancelled',   bg: '#dc262615', fg: '#dc2626', icon: 'x-circle' };
    default:            return { label: 'Requested',   bg: '#c8a45a15', fg: '#c8a45a', icon: 'clock' };
  }
}

function formatVisitDateLocal(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' });
}

function MyVisitsModal({
  visible, onClose, visits, colors, insets,
}: {
  visible: boolean; onClose: () => void; visits: MyVisitEntry[];
  colors: ReturnType<typeof useColors>; insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <SlideSheet visible={visible} onClose={onClose} title="My Visits"
      subtitle={visits.length > 0 ? `${visits.length} visit request${visits.length !== 1 ? 's' : ''}` : undefined}
      colors={colors} insets={insets}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
        {visits.length === 0 ? (
          <View style={mv.empty}>
            <View style={[mv.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="calendar" size={26} color={colors.mutedForeground} />
            </View>
            <Text style={[mv.emptyTitle, { color: colors.foreground }]}>No visits scheduled</Text>
            <Text style={[mv.emptyDesc, { color: colors.mutedForeground }]}>
              Tap "Schedule Visit" on any project or agent page to book a property viewing.
            </Text>
            <Pressable onPress={() => { onClose(); router.push('/explore'); }}
              style={[mv.exploreBtn, { backgroundColor: colors.action }]}>
              <Text style={[mv.exploreBtnText, { color: colors.actionForeground }]}>Browse Properties</Text>
              <Feather name="arrow-right" size={14} color={colors.actionForeground} />
            </Pressable>
          </View>
        ) : visits.map((v) => {
          const cfg = visitStatusCfg(v.status);
          const isExpanded = expanded === v.id;
          const isConfirmed = v.status === 'Confirmed' || v.status === 'Rescheduled';
          const effectiveDate = v.status === 'Rescheduled' && v.rescheduleDate ? v.rescheduleDate : v.date;
          const effectiveTime = v.status === 'Rescheduled' && v.rescheduleTime ? v.rescheduleTime : v.time;

          return (
            <Pressable key={v.id} onPress={() => setExpanded(isExpanded ? null : v.id)}
              style={[mv.card, { backgroundColor: colors.secondary, borderColor: isConfirmed ? cfg.fg + '44' : colors.border }]}>
              {/* Header */}
              <View style={mv.cardTop}>
                <View style={[mv.iconWrap, { backgroundColor: cfg.bg }]}>
                  <Feather name={cfg.icon} size={18} color={cfg.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[mv.titleText, { color: colors.foreground }]} numberOfLines={1}>{v.title}</Text>
                  <Text style={[mv.locationText, { color: colors.mutedForeground }]}>{v.location}</Text>
                </View>
                <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.mutedForeground} />
              </View>

              {/* Status + date row */}
              <View style={mv.badgeRow}>
                <View style={[mv.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[mv.statusText, { color: cfg.fg }]}>{cfg.label}</Text>
                </View>
                <View style={mv.datePill}>
                  <Feather name="calendar" size={10} color={colors.mutedForeground} />
                  <Text style={[mv.datePillText, { color: colors.mutedForeground }]}>{formatVisitDateLocal(effectiveDate)}</Text>
                  <Feather name="clock" size={10} color={colors.mutedForeground} />
                  <Text style={[mv.datePillText, { color: colors.mutedForeground }]}>{effectiveTime}</Text>
                </View>
              </View>

              {/* Expanded detail */}
              {isExpanded && (
                <View style={[mv.expanded, { borderTopColor: colors.border }]}>
                  <View style={mv.detailRow}>
                    <Feather name="users" size={12} color={colors.mutedForeground} />
                    <Text style={[mv.detailText, { color: colors.foreground }]}>{v.visitorCount} visitor{v.visitorCount !== 1 ? 's' : ''}</Text>
                  </View>
                  {isConfirmed && v.contactName ? (
                    <>
                      <View style={[mv.confirmedBanner, { backgroundColor: cfg.fg + '10', borderColor: cfg.fg + '30' }]}>
                        <Feather name="check-circle" size={14} color={cfg.fg} />
                        <Text style={[mv.confirmedText, { color: cfg.fg }]}>Visit {v.status} — contact details below</Text>
                      </View>
                      <View style={mv.detailRow}>
                        <Feather name="user-check" size={12} color={colors.mutedForeground} />
                        <Text style={[mv.detailText, { color: colors.foreground }]}>{v.contactName}</Text>
                      </View>
                      {v.contactPhone ? (
                        <Pressable style={mv.detailRow} onPress={() => Linking.openURL(`tel:${v.contactPhone}`)}>
                          <Feather name="phone" size={12} color={colors.action} />
                          <Text style={[mv.detailText, { color: colors.action }]}>{v.contactPhone}</Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : null}
                  {v.status === 'Cancelled' && (
                    <Text style={[mv.detailText, { color: colors.mutedForeground, fontStyle: 'italic' }]}>
                      This visit request was cancelled.
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </SlideSheet>
  );
}

const mv = StyleSheet.create({
  empty:          { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyIcon:      { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle:     { fontFamily: 'Inter_700Bold', fontSize: 16 },
  emptyDesc:      { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
  exploreBtn:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  exploreBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  card:           { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  cardTop:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap:       { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  titleText:      { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 2 },
  locationText:   { fontFamily: 'Inter_400Regular', fontSize: 10 },
  badgeRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge:    { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
  statusText:     { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.3 },
  datePill:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  datePillText:   { fontFamily: 'Inter_400Regular', fontSize: 10 },
  expanded:       { borderTopWidth: 1, paddingTop: 10, gap: 7 },
  confirmedBanner:{ flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 10, padding: 10 },
  confirmedText:  { fontFamily: 'Inter_600SemiBold', fontSize: 11, flex: 1 },
  detailRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText:     { fontFamily: 'Inter_400Regular', fontSize: 12 },
});

// ── Stat ────────────────────────────────────────────────────────────────────────

function Stat({ v, l, onPress, colors }: { v: string; l: string; onPress?: () => void; colors: ReturnType<typeof useColors> }) {
  if (!onPress) return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{v}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{l}</Text>
    </View>
  );
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.stat, { opacity: pressed ? 0.76 : 1 }]}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{v}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{l}</Text>
      <Feather name="chevron-up" size={10} color={colors.action} style={{ marginTop: 2 }} />
    </Pressable>
  );
}

// ── Activity Tile (logged-in quick access) ─────────────────────────────────────

function ActivityTile({
  icon, label, value, caption, onPress, colors, accentColor,
}: {
  icon: keyof typeof Feather.glyphMap; label: string;
  value: string; caption?: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>; accentColor?: string;
}) {
  const col = accentColor ?? colors.action;
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => [at.tile, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.87 : 1 }]}>
      <View style={[at.iconWrap, { backgroundColor: col + '14' }]}>
        <Feather name={icon} size={19} color={col} />
      </View>
      <Text style={[at.value, { color: colors.foreground }]}>{value}</Text>
      {caption ? <Text style={[at.caption, { color: col }]}>{caption}</Text> : null}
      <Text style={[at.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Feather name="chevron-right" size={11} color={col} style={at.arrow} />
    </Pressable>
  );
}
const at = StyleSheet.create({
  tile:     { flex: 1, minWidth: 90, borderRadius: 18, borderWidth: 1, padding: 14, alignItems: 'center', gap: 2, overflow: 'hidden' },
  iconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  value:    { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.4 },
  caption:  { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.9 },
  label:    { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', lineHeight: 13 },
  arrow:    { position: 'absolute', top: 12, right: 12 },
});

// ── Row link (shortcut / setting row) ─────────────────────────────────────────

function RowLink({
  icon, label, sublabel, badge, onPress, colors, iconColor, destructive, testID,
}: {
  icon: keyof typeof Feather.glyphMap; label: string; sublabel?: string;
  badge?: string; onPress?: () => void;
  colors: ReturnType<typeof useColors>;
  iconColor?: string; destructive?: boolean; testID?: string;
}) {
  const col = destructive ? '#dc2626' : iconColor ?? colors.action;
  return (
    <Pressable onPress={onPress} testID={testID}
      style={({ pressed }) => [rl.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.83 : 1 }]}>
      <View style={[rl.iconBox, { backgroundColor: col + '14' }]}>
        <Feather name={icon} size={17} color={col} />
      </View>
      <View style={rl.copy}>
        <Text style={[rl.label, { color: destructive ? col : colors.foreground }]}>{label}</Text>
        {sublabel ? <Text style={[rl.sub, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
      </View>
      {badge ? (
        <View style={[rl.badge, { backgroundColor: col + '18' }]}>
          <Text style={[rl.badgeText, { color: col }]}>{badge}</Text>
        </View>
      ) : null}
      {!destructive && <Feather name="chevron-right" size={15} color={colors.mutedForeground} />}
    </Pressable>
  );
}
const rl = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: 16, borderWidth: 1 },
  iconBox:   { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy:      { flex: 1 },
  label:     { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  sub:       { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 1 },
  badge:     { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
});

function NotificationSettingsPanel({
  colors,
  permission,
  busy,
  message,
  onAction,
}: {
  colors: ReturnType<typeof useColors>;
  permission: NotificationPermissionState | null;
  busy: boolean;
  message: string | null;
  onAction: () => void;
}) {
  const isBlocked = permission?.status === 'denied' && !permission.canAskAgain;
  const isUnsupported = permission?.status === 'unsupported';
  const statusLabel = permission === null
    ? 'Checking permission…'
    : permission.status === 'granted'
      ? 'Enabled'
      : isUnsupported
        ? 'Unavailable in this build'
        : isBlocked
          ? 'Blocked'
          : 'Not enabled';

  const actionLabel = isBlocked
    ? Platform.OS === 'android' ? 'Open Android Settings' : 'Open Device Settings'
    : 'Enable Notifications';

  return (
    <View style={[notificationPanel.container, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <View style={notificationPanel.statusRow}>
        <View style={{ flex: 1 }}>
          <Text style={[notificationPanel.title, { color: colors.foreground }]}>Notification access</Text>
          <Text style={[notificationPanel.description, { color: colors.mutedForeground }]}>
            Get property approvals and OG Landmark announcements.
          </Text>
        </View>
        <View style={[notificationPanel.statusPill, { backgroundColor: permission?.granted ? colors.action + '18' : colors.muted }]}>
          <Text style={[notificationPanel.statusText, { color: permission?.granted ? colors.action : colors.mutedForeground }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {message ? (
        <Text style={[notificationPanel.message, { color: message.startsWith('Notifications enabled') ? colors.action : colors.destructive }]}>
          {message}
        </Text>
      ) : null}

      {!isUnsupported && permission?.status !== 'granted' ? (
        <Pressable
          onPress={onAction}
          disabled={busy}
          style={({ pressed }) => [
            notificationPanel.action,
            { backgroundColor: colors.action, opacity: busy ? 0.55 : pressed ? 0.82 : 1 },
          ]}
        >
          <Feather name={isBlocked ? 'settings' : 'bell'} size={14} color={colors.actionForeground} />
          <Text style={[notificationPanel.actionText, { color: colors.actionForeground }]}>
            {busy ? 'Updating…' : actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const notificationPanel = StyleSheet.create({
  container:    { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12, marginTop: -2 },
  statusRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:        { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  description:  { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 3 },
  statusPill:   { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  statusText:   { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  message:      { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  action:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, paddingVertical: 11 },
  actionText:   { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});

// ── Profile Completion Card ────────────────────────────────────────────────────

function ProfileCompletionCard({
  user, photoUri, colors, router,
}: {
  user: any; photoUri: string | null;
  colors: ReturnType<typeof useColors>; router: ReturnType<typeof useRouter>;
}) {
  const steps = [
    { label: 'Add profile photo', done: !!photoUri },
    { label: 'Verify phone number', done: !!(user?.phone) },
    { label: 'Add email address', done: !!(user?.email) },
    { label: 'Complete personal info', done: !!(user?.name && user.name.trim().length > 2) },
  ];
  const done  = steps.filter((s) => s.done).length;
  const pct   = Math.round((done / steps.length) * 100);
  if (pct === 100) return null;

  return (
    <AnimatedReveal delay={110}>
      <Pressable onPress={() => router.push('/settings/account' as any)}
        style={[pc.card, { backgroundColor: colors.card, borderColor: colors.action + '33' }]}>
        {/* Header */}
        <View style={pc.header}>
          <View style={[pc.headerIcon, { backgroundColor: colors.action + '15' }]}>
            <Feather name="user-check" size={16} color={colors.action} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[pc.title, { color: colors.foreground }]}>Complete Your Profile</Text>
            <Text style={[pc.sub, { color: colors.mutedForeground }]}>{done} of {steps.length} steps done · {pct}%</Text>
          </View>
          <Feather name="chevron-right" size={15} color={colors.action} />
        </View>
        {/* Progress bar */}
        <View style={[pc.track, { backgroundColor: colors.secondary }]}>
          <View style={[pc.fill, { width: `${pct}%` as any, backgroundColor: colors.action }]} />
        </View>
        {/* Steps */}
        <View style={pc.steps}>
          {steps.map((s) => (
            <View key={s.label} style={pc.step}>
              <Feather name={s.done ? 'check-circle' : 'circle'} size={13}
                color={s.done ? '#1a6b3a' : colors.mutedForeground} />
              <Text style={[pc.stepText, { color: s.done ? '#1a6b3a' : colors.mutedForeground,
                textDecorationLine: s.done ? 'line-through' : 'none' }]}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      </Pressable>
    </AnimatedReveal>
  );
}
const pc = StyleSheet.create({
  card:      { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12, marginBottom: 4 },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon:{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title:     { fontFamily: 'Inter_700Bold', fontSize: 14 },
  sub:       { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 1 },
  track:     { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill:      { height: 5, borderRadius: 3 },
  steps:     { gap: 8 },
  step:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepText:  { fontFamily: 'Inter_400Regular', fontSize: 12 },
});

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) {
  return <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>;
}

// ── Guest screen ───────────────────────────────────────────────────────────────

function GuestScreen({
  colors, router, topInset, tabBarHeight,
}: {
  colors: ReturnType<typeof useColors>; router: ReturnType<typeof useRouter>;
  topInset: number; tabBarHeight: number;
}) {
  const LOCKED_ITEMS: { icon: keyof typeof Feather.glyphMap; label: string; sub: string }[] = [
    { icon: 'heart',          label: 'Saved Properties',  sub: 'Your shortlisted properties' },
    { icon: 'search',         label: 'Saved Searches',    sub: 'Quick-access search filters' },
    { icon: 'bell',           label: 'Search Alerts',     sub: 'Get notified on new matches' },
    { icon: 'calendar',       label: 'Scheduled Visits',  sub: 'Track your booked viewings' },
    { icon: 'message-circle', label: 'My Inquiries',      sub: 'Your property inquiries' },
    { icon: 'eye',            label: 'Recently Viewed',   sub: 'Properties you have opened' },
  ];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: tabBarHeight, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <AnimatedReveal>
        <View style={styles.header}>
          <BrandMark />
        </View>
      </AnimatedReveal>

      {/* Welcome card */}
      <AnimatedReveal delay={60}>
        <View style={[gst.welcomeCard, { backgroundColor: colors.action }]}>
          <View style={gst.welcomeAvatar}>
            <Feather name="user" size={28} color={colors.action} />
          </View>
          <Text style={gst.welcomeGreeting}>Welcome 👋</Text>
          <Text style={gst.welcomeName}>Guest</Text>
          <Text style={gst.welcomeSub}>Sign in to access your profile, saved searches, visits, and more.</Text>
          {/* CTAs */}
          <Pressable onPress={() => router.push('/(auth)/login' as any)}
            style={({ pressed }) => [gst.loginBtn, { opacity: pressed ? 0.87 : 1 }]}>
            <Text style={gst.loginBtnText}>Sign In</Text>
            <Feather name="arrow-right" size={15} color={colors.action} />
          </Pressable>
          <Pressable onPress={() => router.push('/(auth)/signup' as any)}
            style={({ pressed }) => [gst.registerBtn, { opacity: pressed ? 0.87 : 1 }]}>
            <Text style={gst.registerBtnText}>Create Account</Text>
          </Pressable>
        </View>
      </AnimatedReveal>

      {/* Locked activity items */}
      <AnimatedReveal delay={130}>
        <SectionHeader title="Your Activity" colors={colors} />
        <View style={styles.menuGroup}>
          {LOCKED_ITEMS.map((item) => (
            <Pressable key={item.label} onPress={() => router.push('/(auth)/login' as any)}
              style={[rl.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[rl.iconBox, { backgroundColor: colors.secondary }]}>
                <Feather name={item.icon} size={17} color={colors.mutedForeground} />
              </View>
              <View style={rl.copy}>
                <Text style={[rl.label, { color: colors.foreground }]}>{item.label}</Text>
                <Text style={[rl.sub, { color: colors.mutedForeground }]}>{item.sub}</Text>
              </View>
              <View style={[gst.lockPill, { backgroundColor: colors.secondary }]}>
                <Feather name="lock" size={10} color={colors.mutedForeground} />
                <Text style={[gst.lockText, { color: colors.mutedForeground }]}>Sign In</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </AnimatedReveal>

      {/* Public settings */}
      <AnimatedReveal delay={220}>
        <SectionHeader title="Settings" colors={colors} />
        <View style={styles.menuGroup}>
          <RowLink icon="globe" label="Language" sublabel="English / اردو"
            onPress={() => router.push('/settings/language' as any)} colors={colors} iconColor={colors.action} />
          <RowLink icon="help-circle" label="Help & Support" sublabel="FAQs, contact us"
            onPress={() => router.push('/settings/help' as any)} colors={colors} iconColor={colors.action} />
          <RowLink icon="info" label="About OG Landmark" sublabel="Version 1.0"
            onPress={() => router.push('/settings/legal?section=about' as any)} colors={colors} iconColor={colors.action} />
          <RowLink icon="shield" label="Privacy & Security" sublabel="How we protect your account"
            onPress={() => router.push('/settings/legal?section=security' as any)} colors={colors} iconColor={colors.action} />
          <RowLink icon="file-text" label="Terms & Privacy" sublabel="Legal information"
            onPress={() => router.push('/settings/legal?section=legal' as any)} colors={colors} iconColor={colors.action} />
        </View>
      </AnimatedReveal>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>OG Landmark v1.0 · Guest Mode</Text>
    </ScrollView>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { user, role, isLoggedIn, logout } = useAuth();
  const { tr }  = useLanguage();
  const { savedIds } = useSaved();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [profileContent, setProfileContent] = useState<any>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState | null>(null);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  useEffect(() => {
    getMobileSettings().then((settings) => setProfileContent(settings.content?.screens?.profile)).catch(() => undefined);
  }, []);

  const refreshNotificationPermission = useCallback(async () => {
    try {
      setNotificationPermission(await getNotificationPermissionState());
    } catch {
      setNotificationPermission(null);
      setNotificationMessage('Could not check notification access right now.');
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    void refreshNotificationPermission();
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refreshNotificationPermission();
    });
    return () => appStateSubscription.remove();
  }, [isLoggedIn, refreshNotificationPermission]);

  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  // ── Generic state ──────────────────────────────────────────────────────────
  const [listingsCount,   setListingsCount]   = useState(0);
  const [agentLeadsCount, setAgentLeadsCount] = useState(0);
  const [photoUri,        setPhotoUri]        = useState<string | null>(null);

  // ── Buyer-specific state ───────────────────────────────────────────────────
  const [inquiries,       setInquiries]       = useState<Inquiry[]>([]);
  const [visitHistory,    setVisitHistory]    = useState<VisitRecord[]>([]);
  const [savedSearches,   setSavedSearches]   = useState<SavedSearch[]>([]);
  const [myVisits,        setMyVisits]        = useState<MyVisitEntry[]>([]);

  // Modal open states
  const [inquiriesOpen,   setInquiriesOpen]   = useState(false);
  const [historyOpen,     setHistoryOpen]     = useState(false);
  const [searchesOpen,    setSearchesOpen]    = useState(false);
  const [visitsOpen,      setVisitsOpen]      = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isLoggedIn) {
        setPhotoUri(null);
        setListingsCount(0);
        setAgentLeadsCount(0);
        setInquiries([]);
        setSavedSearches([]);
        setMyVisits([]);
        return;
      }

      void refreshNotificationPermission();
      void getProfilePhoto()
        .then(setPhotoUri)
        .catch(() => setPhotoUri(null));

      if (role === 'agent') {
        void Promise.all([getMyListings(user?.id ?? ''), getLeads()])
          .then(([myL, leads]) => {
            setListingsCount(myL.length);
            setAgentLeadsCount(leads.length);
          })
          .catch(() => {
            setListingsCount(0);
            setAgentLeadsCount(0);
          });
      }

      if (role === 'buyer' || role === null) {
        void getInquiries().then(setInquiries).catch(() => setInquiries([]));
        void getVisitHistory().then(setVisitHistory).catch(() => setVisitHistory([]));
        void getSavedSearches().then(setSavedSearches).catch(() => setSavedSearches([]));
        if (user?.id) {
          void Promise.all([
            getSiteVisitsByBuyer(user.id),
            getAgentVisitsByBuyer(user.id),
          ]).then(([siteVisits, agentVisits]) => {
            const combined: MyVisitEntry[] = [
              ...siteVisits.map((v) => ({
                id:           v.id,
                kind:         'developer' as const,
                title:        v.projectName,
                location:     v.projectLocation ?? 'Okara District',
                contactName:  v.contactName ?? '',
                contactPhone: v.contactPhone ?? '',
                date:         v.date,
                time:         v.time,
                visitorCount: v.visitorCount,
                status:       v.status,
                rescheduleDate: v.rescheduleDate,
                rescheduleTime: v.rescheduleTime,
                createdAt:    v.createdAt,
              })),
              ...agentVisits.map((v) => ({
                id:           v.id,
                kind:         'agent' as const,
                title:        v.propertyTitle,
                location:     v.propertyCity,
                contactName:  v.contactName ?? '',
                contactPhone: v.contactPhone ?? '',
                date:         v.date,
                time:         v.time,
                visitorCount: v.visitorCount ?? 1,
                status:       v.status,
                createdAt:    v.createdAt,
              })),
            ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setMyVisits(combined);
          }).catch(() => setMyVisits([]));
        } else {
          setMyVisits([]);
        }
      }
    }, [isLoggedIn, refreshNotificationPermission, role, user?.id]),
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleDeleteInquiry = async (id: string) => {
    await deleteInquiry(id);
    setInquiries((prev) => prev.filter((i) => i.id !== id));
  };
  const handleRemoveVisit = async (propertyId: number) => {
    await removeVisit(propertyId);
    setVisitHistory((prev) => prev.filter((v) => v.propertyId !== propertyId));
  };
  const handleClearHistory = async () => {
    await clearVisitHistory();
    setVisitHistory([]);
  };
  const handleDeleteSearch = async (id: string) => {
    await deleteSavedSearch(id);
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  };

  // Profile actions are private. Guests must sign in before opening activity,
  // saved content, settings, or any other account-only destination.
  const requireSignIn = (action: () => void) => {
    if (!isLoggedIn) {
      router.push('/(auth)/login');
      return;
    }
    action();
  };

  const confirmDeleteAccount = async () => {
    if (!user?.id || deletingAccount) return;
    setDeletingAccount(true);
    try {
      await deleteMyAccount(user.id);
      await clearLocalAccountData();
      await logout();
      router.replace('/(auth)/login');
    } catch (err: unknown) {
      Alert.alert(
        'Could not delete account',
        err instanceof Error ? err.message : 'Please check your connection and try again.',
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!user?.id || deletingAccount) return;
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and removes its saved data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => { void confirmDeleteAccount(); },
        },
      ],
    );
  };

  const notificationSummary = notificationPermission === null
    ? 'Checking notification access…'
    : notificationPermission.status === 'granted'
      ? 'Enabled for approvals and announcements'
      : notificationPermission.status === 'unsupported'
        ? 'Unavailable in this build'
        : notificationPermission.status === 'denied' && !notificationPermission.canAskAgain
          ? Platform.OS === 'android' ? 'Blocked · Open Android Settings' : 'Blocked · Update device settings'
          : 'Off · Tap to enable';

  const handleNotificationAction = async () => {
    if (notificationBusy || !user?.id) return;
    setNotificationMessage(null);

    if (notificationPermission?.status === 'denied' && !notificationPermission.canAskAgain) {
      if (Platform.OS === 'web') {
        setNotificationMessage('Notifications are blocked in this browser. Update your browser settings.');
        return;
      }
      try {
        await Linking.openSettings();
      } catch {
        setNotificationMessage('Could not open device settings. Please enable notifications there.');
      }
      return;
    }

    setNotificationBusy(true);
    try {
      const result = await registerPushTokenForUser(String(user.id));
      if (result.status === 'registered') {
        setNotificationMessage('Notifications enabled for approvals and announcements.');
      } else if (result.status === 'denied') {
        setNotificationMessage(
          result.canAskAgain
            ? 'Notifications are still off. Tap Enable Notifications to try again.'
            : 'Notifications are blocked. Open device settings to enable them.',
        );
      } else if (result.status === 'unsupported') {
        setNotificationMessage('Push notifications are unavailable in this build.');
      } else {
        setNotificationMessage('Could not register notifications for this account.');
      }
      await refreshNotificationPermission();
    } catch {
      setNotificationMessage('Could not enable notifications right now. Please try again.');
      await refreshNotificationPermission();
    } finally {
      setNotificationBusy(false);
    }
  };

  // ── Guest: show dedicated screen with no activity counts ─────────────────
  if (!isLoggedIn) {
    return <GuestScreen colors={colors} router={router} topInset={topInset} tabBarHeight={tabBarHeight} />;
  }

  // ── Profile card values (logged-in only) ─────────────────────────────────
  const initials    = user?.name ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() : 'OG';
  const displayName = user?.companyName ?? user?.agencyName ?? user?.name ?? '';
  const userEmail   = user?.email ?? '';
  const userPhone   = user?.phone ?? '';
  const memberSince = user?.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })
    : '';
  const isVerified  = user?.verificationStatus === 'verified';
  const isPending   = user?.verificationStatus === 'pending';

  // ── Common settings for all roles ────────────────────────────────────────
  const commonSettings = [
    { icon: 'user'         as const, label: 'Personal Information', sub: 'Name, address, bio',           route: '/settings/account' },
    { icon: 'smartphone'   as const, label: 'Phone & Email',        sub: userPhone || userEmail || 'Update contact details', route: '/settings/account' },
    { icon: 'lock'         as const, label: 'Change Password',      sub: 'Update your password',          route: null },
    { icon: 'bell'         as const, label: 'Notifications',        sub: 'Alerts, emails, push',          route: null },
    { icon: 'shield'       as const, label: 'Privacy & Security',   sub: 'How we protect your account',  route: '/settings/legal?section=security' },
    { icon: 'globe'        as const, label: 'Language',             sub: 'English / اردو',                route: '/settings/language' },
    { icon: 'dollar-sign'  as const, label: 'Currency',             sub: 'PKR · Pakistani Rupee',         route: null },
    { icon: 'map-pin'      as const, label: 'Location',             sub: 'Okara District, Punjab',        route: null },
    { icon: 'help-circle'  as const, label: 'Help & Support',       sub: 'FAQs, contact us',              route: '/settings/help' },
    { icon: 'file-text'    as const, label: 'Terms & Privacy',      sub: 'Terms of use and privacy policy', route: '/settings/legal?section=legal' },
    { icon: 'info'         as const, label: 'About OG Landmark',    sub: 'Our platform and principles',    route: '/settings/legal?section=about' },
  ];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: tabBarHeight, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <AnimatedReveal>
        <View style={styles.header}>
          <View>
            <BrandMark />
            <Text style={[styles.profileSubtitle, { color: colors.mutedForeground }]}>{profileContent?.subtitle || 'Manage your account and preferences'}</Text>
          </View>
          <Pressable onPress={() => router.push('/settings/account' as any)}
            style={[styles.iconButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="settings" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </AnimatedReveal>

      {/* ── Profile card ───────────────────────────────────────────────── */}
      <AnimatedReveal delay={50}>
        <View style={[styles.profileCard, { backgroundColor: colors.action }]}>
          {/* Avatar */}
          <View style={styles.avatar}>
            {photoUri
              ? <Image source={{ uri: photoUri }} style={styles.avatarPhoto} />
              : <Text style={styles.avatarText}>{initials}</Text>}
          </View>
          {/* Info */}
          <View style={styles.profileCopy}>
            <Text style={styles.pcGreeting}>{tr('profileHi')} 👋</Text>
            <Text style={styles.pcName} numberOfLines={1}>{displayName}</Text>
            <View style={styles.pcMeta}>
              <View style={[styles.rolePill, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                <Feather name={role ? roleIcons[role] : 'user'} size={9} color="#ffffff" />
                <Text style={styles.rolePillText}>{role ? roleLabels(tr)[role] : 'User'}</Text>
              </View>
              {isVerified && (
                <View style={[styles.rolePill, { backgroundColor: '#05966930' }]}>
                  <Feather name="check-circle" size={9} color="#34d399" />
                  <Text style={[styles.rolePillText, { color: '#34d399' }]}>Verified</Text>
                </View>
              )}
              {isPending && (
                <View style={[styles.rolePill, { backgroundColor: '#f59e0b28' }]}>
                  <Feather name="clock" size={9} color="#fbbf24" />
                  <Text style={[styles.rolePillText, { color: '#fbbf24' }]}>Pending</Text>
                </View>
              )}
            </View>
            {memberSince ? (
              <Text style={styles.pcSince}>Member since {memberSince}</Text>
            ) : null}
          </View>
          {/* Edit */}
          <Pressable onPress={() => router.push('/settings/account' as any)}
            style={({ pressed }) => [styles.editBtn, { opacity: pressed ? 0.8 : 1 }]}>
            <Feather name="edit-2" size={13} color={colors.action} />
            <Text style={[styles.editBtnText, { color: colors.action }]}>Edit</Text>
          </Pressable>
        </View>
      </AnimatedReveal>

      {/* ── Profile completion ─────────────────────────────────────────── */}
      <ProfileCompletionCard user={user} photoUri={photoUri} colors={colors} router={router} />

      {/* ── BUYER ──────────────────────────────────────────────────────── */}
      {role === 'buyer' && (
        <>
          {/* Activity stats strip */}
          <AnimatedReveal delay={120}>
            <SectionHeader title="Your Activity" colors={colors} />
            <View style={[styles.statsStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Stat v={String(savedIds.length)}    l="Saved"     onPress={() => router.push('/(tabs)/saved')} colors={colors} />
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <Stat v={String(inquiries.length)}   l="Inquiries" onPress={() => setInquiriesOpen(true)} colors={colors} />
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <Stat v={String(myVisits.length)}    l="Visits"    onPress={() => setVisitsOpen(true)} colors={colors} />
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <Stat v={String(visitHistory.length)} l="Viewed"   onPress={() => setHistoryOpen(true)} colors={colors} />
            </View>
          </AnimatedReveal>

          {/* Quick access tiles */}
          <AnimatedReveal delay={160}>
            <SectionHeader title="Quick Access" colors={colors} />
            <View style={styles.tilesRow}>
              <ActivityTile icon="message-circle" label="Inquiries"
                value={String(inquiries.length)}
                caption={inquiries.filter((i) => i.status === 'replied').length > 0
                  ? `${inquiries.filter((i) => i.status === 'replied').length} REPLIED` : undefined}
                onPress={() => setInquiriesOpen(true)} colors={colors} accentColor={colors.action} />
              <ActivityTile icon="calendar" label="Visits"
                value={String(myVisits.length)}
                caption={myVisits.filter((v) => v.status === 'Confirmed').length > 0
                  ? `${myVisits.filter((v) => v.status === 'Confirmed').length} CONFIRMED` : undefined}
                onPress={() => setVisitsOpen(true)} colors={colors} accentColor="#1a6b3a" />
              <ActivityTile icon="bookmark" label="Searches"
                value={String(savedSearches.length)} caption="SAVED"
                onPress={() => setSearchesOpen(true)} colors={colors} accentColor="#c8a45a" />
            </View>
          </AnimatedReveal>

          {/* Shortcuts */}
          <AnimatedReveal delay={200}>
            <View style={styles.menuGroup}>
              <RowLink icon="heart" label="Saved Properties"
                sublabel={savedIds.length > 0 ? `${savedIds.length} propert${savedIds.length !== 1 ? 'ies' : 'y'} shortlisted` : 'Your favourites'}
                onPress={() => router.push('/(tabs)/saved')} colors={colors} iconColor="#e71616" />
              {profileContent?.showRecentlyViewed !== false && <RowLink icon="eye" label="Recently Viewed"
                sublabel={visitHistory.length > 0 ? `${visitHistory.length} properties opened` : 'Properties you have opened'}
                onPress={() => setHistoryOpen(true)} colors={colors} iconColor={colors.action} />}
              {profileContent?.showSavedSearches !== false && <RowLink icon="search" label="Saved Searches"
                sublabel={savedSearches.length > 0 ? `${savedSearches.length} searches saved` : 'Quick-access search filters'}
                onPress={() => setSearchesOpen(true)} colors={colors} iconColor="#c8a45a" />}
              <RowLink icon="tool" label="Tools & Calculators"
                sublabel="Area calc · Price estimator · ROI"
                onPress={() => router.push('/tools' as any)} colors={colors} iconColor={colors.action} />
            </View>
          </AnimatedReveal>
        </>
      )}

      {/* ── AGENT ──────────────────────────────────────────────────────── */}
      {role === 'agent' && (
        <>
          <AnimatedReveal delay={120}>
            <SectionHeader title="Agent Activity" colors={colors} />
            <View style={[styles.statsStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Stat v={String(listingsCount)}   l="Listings" onPress={() => router.push('/(tabs)/listings' as any)} colors={colors} />
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <Stat v={String(agentLeadsCount)} l="Leads"    onPress={() => router.push('/(tabs)/leads' as any)} colors={colors} />
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <Stat v={String(inquiries.length)} l="Inquiries" onPress={() => setInquiriesOpen(true)} colors={colors} />
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <Stat v={String(myVisits.length)} l="Visits"  onPress={() => setVisitsOpen(true)} colors={colors} />
            </View>
          </AnimatedReveal>

          <AnimatedReveal delay={160}>
            <SectionHeader title="Quick Access" colors={colors} />
            <View style={styles.menuGroup}>
              <RowLink icon="home" label="My Listings"
                sublabel={`${listingsCount} active listing${listingsCount !== 1 ? 's' : ''}`}
                onPress={() => router.push('/(tabs)/listings' as any)} colors={colors} iconColor={colors.action} />
              <RowLink icon="users" label="Leads"
                sublabel={`${agentLeadsCount} lead${agentLeadsCount !== 1 ? 's' : ''}`}
                onPress={() => router.push('/(tabs)/leads' as any)} colors={colors} iconColor="#1a6b3a" />
              <RowLink icon="message-circle" label="Inquiries"
                sublabel={`${inquiries.length} inquiry${inquiries.length !== 1 ? 'ies' : 'y'}`}
                onPress={() => setInquiriesOpen(true)} colors={colors} iconColor="#c8a45a" />
              <RowLink icon="calendar" label="Scheduled Visits"
                sublabel={`${myVisits.length} visit${myVisits.length !== 1 ? 's' : ''} booked`}
                onPress={() => setVisitsOpen(true)} colors={colors} iconColor="#0891b2" />
              <RowLink icon="tool" label="Tools & Calculators"
                sublabel="Area calc · Price estimator · ROI"
                onPress={() => router.push('/tools' as any)} colors={colors} iconColor={colors.action} />
            </View>
          </AnimatedReveal>
        </>
      )}

      {/* ── DEVELOPER ──────────────────────────────────────────────────── */}
      {role === 'developer' && (
        <>
          <AnimatedReveal delay={120}>
            <SectionHeader title="Developer Activity" colors={colors} />
            <View style={[styles.statsStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Stat v={String(listingsCount)} l="Projects" colors={colors} />
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <Stat v={String(agentLeadsCount)} l="Leads" colors={colors} />
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <Stat v="—" l="Units" colors={colors} />
            </View>
          </AnimatedReveal>

          <AnimatedReveal delay={160}>
            <SectionHeader title="Quick Access" colors={colors} />
            <View style={styles.menuGroup}>
              <RowLink icon="layers" label="My Projects"
                sublabel="Manage your developments"
                onPress={() => router.push('/(tabs)/projects' as any)} colors={colors} iconColor={colors.action} />
              <RowLink icon="users" label="Leads & Enquiries"
                sublabel={`${agentLeadsCount} lead${agentLeadsCount !== 1 ? 's' : ''}`}
                onPress={() => router.push('/(tabs)/leads' as any)} colors={colors} iconColor="#1a6b3a" />
              <RowLink icon="bar-chart-2" label="Project Analytics"
                sublabel="Views, inquiries, performance"
                onPress={() => router.push('/settings/analytics' as any)} colors={colors} iconColor="#c8a45a" />
              <RowLink icon="tool" label="Tools & Calculators"
                sublabel="Area calc · Price estimator · ROI"
                onPress={() => router.push('/tools' as any)} colors={colors} iconColor={colors.action} />
            </View>
          </AnimatedReveal>
        </>
      )}

      {/* ── Settings & Support ─────────────────────────────────────────── */}
      <AnimatedReveal delay={260}>
        <SectionHeader title="Settings & Support" colors={colors} />
        <View style={styles.menuGroup}>
          {commonSettings.map((item) => item.label === 'Notifications' ? (
            <React.Fragment key={item.label}>
              <RowLink
                icon={item.icon}
                label={item.label}
                sublabel={notificationSummary}
                onPress={() => {
                  setNotificationSettingsOpen((open) => !open);
                  setNotificationMessage(null);
                }}
                colors={colors}
                iconColor={colors.action}
                testID="profile-notifications-setting"
              />
              {notificationSettingsOpen ? (
                <NotificationSettingsPanel
                  colors={colors}
                  permission={notificationPermission}
                  busy={notificationBusy}
                  message={notificationMessage}
                  onAction={() => { void handleNotificationAction(); }}
                />
              ) : null}
            </React.Fragment>
          ) : (
            <RowLink
              key={item.label}
              icon={item.icon}
              label={item.label}
              sublabel={item.sub}
              onPress={item.route
                ? () => router.push(item.route as any)
                : () => Alert.alert(item.label, 'This feature is coming soon.')}
              colors={colors}
              iconColor={colors.action}
            />
          ))}
        </View>
      </AnimatedReveal>

      {/* ── Logout ─────────────────────────────────────────────────────── */}
      <AnimatedReveal delay={340}>
        <View style={styles.menuGroup}>
          <RowLink icon="log-out" label="Sign Out" sublabel="Log out of your account"
            onPress={() => { void logout(); }} colors={colors} destructive />
        </View>
        <Text style={[styles.version, { color: colors.mutedForeground }]}>{tr('version')}</Text>
      </AnimatedReveal>

      {/* ── Account deletion ─────────────────────────────────────────────── */}
      <AnimatedReveal delay={380}>
        <SectionHeader title="Danger Zone" colors={colors} />
        <View style={styles.menuGroup}>
          <RowLink
            icon="trash-2"
            label={deletingAccount ? 'Deleting Account…' : 'Delete Account'}
            sublabel="Permanently remove your account and saved data"
            onPress={handleDeleteAccount}
            colors={colors}
            destructive
            testID="profile-delete-account"
          />
        </View>
      </AnimatedReveal>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <InquiriesModal visible={inquiriesOpen} onClose={() => setInquiriesOpen(false)}
        inquiries={inquiries} onDelete={handleDeleteInquiry} colors={colors} insets={insets} />
      <MyVisitsModal visible={visitsOpen} onClose={() => setVisitsOpen(false)}
        visits={myVisits} colors={colors} insets={insets} />
      <VisitHistoryModal visible={historyOpen} onClose={() => setHistoryOpen(false)}
        history={visitHistory} onRemove={handleRemoveVisit} onClearAll={handleClearHistory} colors={colors} insets={insets} />
      <SavedSearchesModal visible={searchesOpen} onClose={() => setSearchesOpen(false)}
        searches={savedSearches} onDelete={handleDeleteSearch} colors={colors} insets={insets} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const gst = StyleSheet.create({
  welcomeCard:   { borderRadius: 24, padding: 22, alignItems: 'center', gap: 6, marginBottom: 8 },
  welcomeAvatar: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  welcomeGreeting:{ fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  welcomeName:   { fontFamily: 'Inter_700Bold', fontSize: 28, color: '#ffffff', letterSpacing: -0.5 },
  welcomeSub:    { fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 19, paddingHorizontal: 10, marginTop: 4 },
  loginBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#c8a45a', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 14, width: '100%', justifyContent: 'center' },
  loginBtnText:  { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#102a43' },
  registerBtn:   { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13, width: '100%', alignItems: 'center' },
  registerBtnText:{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#ffffff' },
  lockPill:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  lockText:      { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
});

const styles = StyleSheet.create({
  screen:        { flex: 1 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  profileSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 3 },
  iconButton:    { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // Profile card
  profileCard:   { borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 10 },
  avatar:        { width: 60, height: 60, borderRadius: 20, backgroundColor: '#c8a45a', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarPhoto:   { width: 60, height: 60, borderRadius: 20 },
  avatarText:    { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#102a43' },
  profileCopy:   { flex: 1 },
  pcGreeting:    { fontFamily: 'Inter_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  pcName:        { fontFamily: 'Inter_700Bold', fontSize: 19, color: '#ffffff', letterSpacing: -0.3, marginBottom: 6 },
  pcMeta:        { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rolePill:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  rolePillText:  { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#ffffff', letterSpacing: 0.4 },
  pcSince:       { fontFamily: 'Inter_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 5 },
  editBtn:       { flexDirection: 'column', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  editBtnText:   { fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  // Stats strip
  statsStrip:    { borderRadius: 18, flexDirection: 'row', borderWidth: 1, marginBottom: 4 },
  stat:          { flex: 1, paddingVertical: 16, alignItems: 'center', gap: 2 },
  statValue:     { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.3 },
  statLabel:     { fontFamily: 'Inter_400Regular', fontSize: 10 },
  statDiv:       { width: 1 },
  // Tiles
  tilesRow:      { flexDirection: 'row', gap: 9, marginBottom: 6 },
  // Section title
  sectionTitle:  { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 24, marginBottom: 12 },
  // Menu group
  menuGroup:     { gap: 8, marginBottom: 4 },
  // Version
  version:       { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', marginTop: 16, marginBottom: 8 },
});
