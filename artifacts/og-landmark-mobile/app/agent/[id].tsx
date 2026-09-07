/**
 * Agent Professional Profile — public buyer-facing view of a verified agent.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert, Image, Linking, Modal, Platform, Pressable,
  ScrollView, Share, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { apiAgentToSample, SampleAgent } from '@/lib/agentsData';
import { getAgents } from '@/lib/api';
import { addInquiry } from '@/lib/inquiriesStore';
import { getMyListings, UserListing } from '@/lib/listingsStore';
import { PropertyCard } from '@/components/PropertyCard';
import { properties } from '@/lib/properties';
import VisitSchedulerModal from '@/components/VisitSchedulerModal';

// ── Contact Modal ─────────────────────────────────────────────────────────────

function ContactModal({
  visible, onClose, agent, colors, insets,
}: {
  visible: boolean; onClose: () => void; agent: AgentProfile;
  colors: ReturnType<typeof useColors>; insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const [message, setMessage] = useState('');
  const [inquiryType, setInquiryType] = useState('Property Information');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);

  const types = ['Buying', 'Renting', 'Property Information', 'Schedule Visit', 'Make an Offer'];

  const handleSend = async () => {
    if (!message.trim()) {
      Alert.alert('Message Required', 'Please enter a message.');
      return;
    }
    setSending(true);
    try {
      await addInquiry({
        propertyId:    0,
        propertyTitle: `Agent Inquiry — ${agent.displayName}`,
        propertyType:  inquiryType,
        propertyCity:  agent.areas[0] ?? 'Okara',
        propertyPrice: 0,
        agentName:     agent.displayName,
        message:       `Inquiry Type: ${inquiryType}\n\n${message.trim()}`,
      });
      setSent(true);
    } catch {
      Alert.alert('Error', 'Could not send inquiry. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => { setSent(false); setMessage(''); onClose(); };

  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <View style={cm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={[cm.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[cm.handle, { backgroundColor: colors.border }]} />
          {sent ? (
            <View style={cm.successWrap}>
              <View style={[cm.successIcon, { backgroundColor: '#1a6b3a18' }]}>
                <Feather name="check-circle" size={36} color="#1a6b3a" />
              </View>
              <Text style={[cm.successTitle, { color: colors.foreground }]}>Inquiry Sent!</Text>
              <Text style={[cm.successDesc, { color: colors.mutedForeground }]}>
                {agent.displayName} will respond to your inquiry shortly. Check Profile → My Inquiries for status updates.
              </Text>
              <Pressable onPress={handleClose} style={[cm.doneBtn, { backgroundColor: colors.action }]}>
                <Text style={[cm.doneBtnText, { color: colors.actionForeground }]}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={cm.header}>
                <Text style={[cm.title, { color: colors.foreground }]}>Contact Agent</Text>
                <Pressable onPress={handleClose} style={[cm.closeBtn, { backgroundColor: colors.secondary }]}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <Text style={[cm.label, { color: colors.mutedForeground }]}>INQUIRY TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
                {types.map((t) => (
                  <Pressable key={t} onPress={() => setInquiryType(t)}
                    style={[cm.typeChip, inquiryType === t
                      ? { backgroundColor: colors.action }
                      : { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}>
                    <Text style={[cm.typeChipText, { color: inquiryType === t ? colors.actionForeground : colors.mutedForeground }]}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={[cm.label, { color: colors.mutedForeground }]}>MESSAGE</Text>
              <TextInput value={message} onChangeText={setMessage} multiline numberOfLines={4}
                placeholder="Tell the agent what you're looking for…"
                placeholderTextColor={colors.mutedForeground}
                style={[cm.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]} />
              <View style={cm.actions}>
                <Pressable onPress={() => Linking.openURL(`https://wa.me/92${agent.phone.replace(/^0/, '')}`)
                } style={[cm.altBtn, { borderColor: '#25d366', backgroundColor: '#25d36612' }]}>
                  <Feather name="message-circle" size={15} color="#25d366" />
                  <Text style={[cm.altBtnText, { color: '#25d366' }]}>WhatsApp</Text>
                </Pressable>
                <Pressable onPress={handleSend} disabled={sending}
                  style={[cm.sendBtn, { backgroundColor: colors.action, opacity: sending ? 0.7 : 1 }]}>
                  <Text style={[cm.sendBtnText, { color: colors.actionForeground }]}>{sending ? 'Sending…' : 'Send Inquiry'}</Text>
                  <Feather name="send" size={14} color={colors.actionForeground} />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0d1d2baa' },
  sheet:      { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 10, paddingHorizontal: 18 },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title:      { fontFamily: 'Inter_700Bold', fontSize: 20 },
  closeBtn:   { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  label:      { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1, marginBottom: 8 },
  typeChip:   { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  typeChipText:{ fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  input:      { borderWidth: 1, borderRadius: 14, padding: 13, fontFamily: 'Inter_400Regular', fontSize: 13, minHeight: 100, textAlignVertical: 'top', marginBottom: 16 },
  actions:    { flexDirection: 'row', gap: 10, marginBottom: 4 },
  altBtn:     { flex: 0.7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 14 },
  altBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  sendBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, paddingVertical: 14 },
  sendBtnText:{ fontFamily: 'Inter_700Bold', fontSize: 13 },
  successWrap:  { alignItems: 'center', paddingVertical: 28, gap: 12, paddingHorizontal: 8 },
  successIcon:  { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  successDesc:  { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  doneBtn:      { borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14, marginTop: 8 },
  doneBtnText:  { fontFamily: 'Inter_700Bold', fontSize: 14 },
});

// ── Agent profile type (unified for sample + real agents) ────────────────────

type AgentProfile = {
  id: string;
  displayName: string;
  initials: string;
  profileImage?: SampleAgent['profileImage'];
  agency: string;
  verified: boolean;
  years: number;
  listings: number;
  areas: string[];
  color: string;
  phone: string;
  specialties: string[];
  about: string;
  isSample: boolean;
};

function toProfile(a: SampleAgent): AgentProfile {
  return { ...a, displayName: a.displayName, isSample: false };
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AgentProfileScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  const [contactOpen,   setContactOpen]   = useState(false);
  const [visitOpen,     setVisitOpen]     = useState(false);
  const [agentListings, setAgentListings] = useState<UserListing[]>([]);
  const [activeTab,     setActiveTab]     = useState<'For Sale' | 'For Rent' | 'Featured'>('For Sale');
  const [managedAgent, setManagedAgent] = useState<SampleAgent | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setAgentLoading(true);
    getAgents()
      .then((records) => {
        if (!mounted) return;
        const record = records.find((item) => String(item.id) === String(id));
        setManagedAgent(record ? apiAgentToSample(record) : null);
      })
      .catch(() => { if (mounted) setManagedAgent(null); })
      .finally(() => { if (mounted) setAgentLoading(false); });
    return () => { mounted = false; };
  }, [id]);

  // Resolve from the admin-managed directory first, then support the logged-in
  // agent's private profile route as before.
  const agent: AgentProfile | null = managedAgent
    ? toProfile(managedAgent)
    : user?.role === 'agent'
    ? {
        id: user.id,
        displayName: user.name ?? 'Agent',
        initials: (user.name ?? 'A').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
        agency: user.agencyName ?? 'Agency',
        verified: user.verificationStatus === 'verified',
        years: Number(user.yearsExperience ?? 0),
        listings: 0,
        areas: user.areasServed ?? [],
        color: '#102a43',
        phone: user.phone ?? '',
        specialties: user.specializations ?? [],
        about: '',
        isSample: false,
      }
    : null;

  useEffect(() => {
    (async () => {
      if (!agent) return;
      // Load listings posted by this agent (matched by name or userId)
      const all = await getMyListings(user?.id ?? id ?? '');
      setAgentListings(all.filter((l) => l.listingStatus === 'Active'));
    })();
  }, [id]);

  if (agentLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Loading agent profile…</Text>
      </View>
    );
  }

  if (!agent) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Feather name="user-x" size={36} color={colors.mutedForeground} style={{ marginBottom: 14 }} />
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Agent profile not found.</Text>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.action }]}>
          <Text style={[styles.backBtnText, { color: colors.actionForeground }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const saleListings   = agentListings.filter((l) => l.status === 'For Sale');
  const rentListings   = agentListings.filter((l) => l.status === 'For Rent');
  const matchedProps   = properties.filter((p) => p.agent === agent.displayName || p.agent === agent.agency);

  return (
    <>
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}>

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: colors.action }]}>
        {/* back */}
        <Pressable onPress={() => router.back()} style={[styles.backCircle, { top: topInset + 10 }]}>
          <Feather name="arrow-left" size={20} color="#ffffff" />
        </Pressable>

        {/* share */}
        <Pressable onPress={() => Share.share({ message: `${agent.displayName} — ${agent.agency}\nVerified Agent on OG Landmark`, title: agent.displayName })}
          style={[styles.shareCircle, { top: topInset + 10 }]}>
          <Feather name="share-2" size={18} color="#ffffff" />
        </Pressable>

        {/* avatar */}
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: agent.color }]}>
            {agent.profileImage ? (
              <Image source={agent.profileImage} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{agent.initials}</Text>
            )}
          </View>
          {agent.verified && (
            <View style={styles.verifiedDot}>
              <Feather name="check" size={11} color="#ffffff" />
            </View>
          )}
        </View>

        <Text style={styles.agentName}>{agent.displayName}</Text>
        <Text style={styles.agentAgency}>{agent.agency}</Text>

        {agent.verified && (
          <View style={styles.verifiedBadge}>
            <Feather name="check-circle" size={12} color="#c8a45a" />
            <Text style={styles.verifiedText}>Verified Agent</Text>
          </View>
        )}
        {agent.isSample && (
          <View style={styles.sampleBadge}>
            <Text style={styles.sampleText}>SAMPLE DATA</Text>
          </View>
        )}
      </View>

      {/* ── ACTION BUTTONS ─────────────────────────────────────────────── */}
      <View style={[styles.actionsRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {[
          { icon: 'phone',    label: 'Call',     color: '#1a6b3a', onPress: () => Linking.openURL(`tel:${agent.phone}`) },
          { icon: 'message-circle', label: 'WhatsApp', color: '#25d366', onPress: () => Linking.openURL(`https://wa.me/92${agent.phone.replace(/^0/, '')}`) },
          { icon: 'calendar', label: 'Schedule', color: '#c8a45a', onPress: () => setVisitOpen(true) },
          { icon: 'send',     label: 'Enquire',  color: '#102a43', onPress: () => setContactOpen(true) },
        ].map((a) => (
          <Pressable key={a.label} onPress={a.onPress} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.8 : 1 }]}>
            <View style={[styles.actionIcon, { backgroundColor: a.color + '18', borderColor: a.color + '44' }]}>
              <Feather name={a.icon as any} size={18} color={a.color} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── PERFORMANCE STATS ─────────────────────────────────────────── */}
      <View style={[styles.statsCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        {[
          { value: String(agent.years),   label: 'Years\nExperience' },
          { value: String(agent.listings), label: 'Active\nListings' },
          { value: agent.areas.length > 0 ? String(agent.areas.length) : '—', label: 'Areas\nServed' },
          { value: '< 1hr', label: 'Response\nTime' },
        ].map((s, i, arr) => (
          <View key={s.label} style={[styles.statItem, i < arr.length - 1 ? { borderRightWidth: 1, borderRightColor: colors.border } : {}]}>
            <Text style={[styles.statVal, { color: i === 3 ? '#1a6b3a' : colors.foreground }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── ABOUT ─────────────────────────────────────────────────────── */}
      {agent.about ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
          <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>{agent.about}</Text>
        </View>
      ) : null}

      {/* ── SPECIALTIES ───────────────────────────────────────────────── */}
      {agent.specialties.length > 0 && (
        <View style={[styles.section, { paddingTop: agent.about ? 0 : 18 }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Specialties</Text>
          <View style={styles.tagRow}>
            {agent.specialties.map((s) => (
              <View key={s} style={[styles.tag, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                <Feather name="tag" size={10} color={colors.primary} />
                <Text style={[styles.tagText, { color: colors.accentForeground }]}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── AREAS SERVED ──────────────────────────────────────────────── */}
      {agent.areas.length > 0 && (
        <View style={[styles.areaCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.areaHeader}>
            <Feather name="map-pin" size={14} color={colors.primary} />
            <Text style={[styles.areaTitle, { color: colors.foreground }]}>Areas Served</Text>
          </View>
          <View style={styles.tagRow}>
            {agent.areas.map((a) => (
              <View key={a} style={[styles.areaChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.areaChipText, { color: colors.foreground }]}>{a}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── VERIFICATION INFO ─────────────────────────────────────────── */}
      {agent.verified && (
        <View style={[styles.verCard, { backgroundColor: '#1a6b3a08', borderColor: '#1a6b3a20' }]}>
          <View style={styles.verHeader}>
            <Feather name="shield" size={16} color="#1a6b3a" />
            <Text style={[styles.verTitle, { color: '#1a6b3a' }]}>Why is this agent verified?</Text>
          </View>
          {['Identity verified', 'Contact information verified', 'Agency information reviewed', 'Professional credentials reviewed', 'Listings quality checked'].map((c) => (
            <View key={c} style={styles.verItem}>
              <Feather name="check-circle" size={12} color="#1a6b3a" />
              <Text style={[styles.verItemText, { color: colors.foreground }]}>{c}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── CLIENT REVIEWS ────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Client Reviews</Text>
        {[
          { name: 'Tariq Mehmood', rating: 5, date: 'Mar 2025', text: 'Excellent service. Helped me find the right property in Okara within my budget. Very professional and responsive.' },
          { name: 'Amna Siddiqui', rating: 5, date: 'Jan 2025', text: 'Very knowledgeable about local property prices. Handled all the paperwork smoothly. Highly recommended.' },
          { name: 'Zulfiqar Bhatti', rating: 4, date: 'Nov 2024', text: 'Good experience overall. Arranged multiple viewings and was patient with our requirements.' },
        ].map((rev, i) => (
          <View key={i} style={[styles.reviewCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <View style={styles.reviewHeader}>
              <View style={[styles.reviewAvatar, { backgroundColor: colors.action + '18' }]}>
                <Text style={[styles.reviewInitial, { color: colors.action }]}>{rev.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.reviewName, { color: colors.foreground }]}>{rev.name}</Text>
                <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>{rev.date}</Text>
              </View>
              <View style={styles.starRow}>
                {Array.from({ length: 5 }).map((_, s) => (
                  <Feather key={s} name="star" size={10} color={s < rev.rating ? '#c8a45a' : colors.border} />
                ))}
              </View>
            </View>
            <Text style={[styles.reviewText, { color: colors.mutedForeground }]}>{rev.text}</Text>
          </View>
        ))}
        <View style={[styles.reviewSample, { borderColor: colors.border }]}>
          <Feather name="info" size={11} color={colors.mutedForeground} />
          <Text style={[styles.reviewSampleText, { color: colors.mutedForeground }]}>Sample reviews — live reviews will appear as verified clients submit feedback.</Text>
        </View>
      </View>

      {/* ── LISTINGS ──────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Agent Listings</Text>

        {/* tab bar */}
        <View style={[styles.tabBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          {(['For Sale', 'For Rent', 'Featured'] as const).map((t) => (
            <Pressable key={t} onPress={() => setActiveTab(t)}
              style={[styles.tabItem, activeTab === t ? { backgroundColor: colors.action, borderRadius: 10 } : {}]}>
              <Text style={[styles.tabText, { color: activeTab === t ? colors.actionForeground : colors.mutedForeground }]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {/* listings from static properties matched by agent name */}
        {matchedProps.length > 0 ? (
          matchedProps
            .filter((p) => {
              if (activeTab === 'For Sale')  return p.status === 'For Sale';
              if (activeTab === 'For Rent')  return p.status === 'For Rent';
              return p.featured;
            })
            .map((p) => <PropertyCard key={p.id} property={p} />)
        ) : (
          <View style={[styles.emptyListings, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="home" size={28} color={colors.mutedForeground} style={{ marginBottom: 10 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No listings yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              This agent's active listings will appear here once available.
            </Text>
          </View>
        )}
      </View>

      {/* ── CONTACT CTA ───────────────────────────────────────────────── */}
      <View style={styles.footerCTA}>
        <Pressable onPress={() => Linking.openURL(`tel:${agent.phone}`)}
          style={({ pressed }) => [styles.callBtn, { borderColor: colors.action, opacity: pressed ? 0.8 : 1 }]}>
          <Feather name="phone" size={16} color={colors.action} />
          <Text style={[styles.callBtnText, { color: colors.action }]}>Call Agent</Text>
        </Pressable>
        <Pressable onPress={() => setContactOpen(true)}
          style={({ pressed }) => [styles.enquireBtn, { backgroundColor: colors.action, opacity: pressed ? 0.85 : 1 }]}>
          <Text style={[styles.enquireBtnText, { color: colors.actionForeground }]}>Send Inquiry</Text>
          <Feather name="arrow-up-right" size={16} color={colors.actionForeground} />
        </Pressable>
      </View>

    </ScrollView>

    <ContactModal
      visible={contactOpen}
      onClose={() => setContactOpen(false)}
      agent={agent}
      colors={colors}
      insets={insets}
    />
    <VisitSchedulerModal
      visible={visitOpen}
      onClose={() => setVisitOpen(false)}
      providerType="agent"
      providerId={agent.id}
      projectTitle={`Viewing with ${agent.displayName}`}
      contactPerson={agent.displayName}
      contactPhone={agent.phone}
      location={agent.areas[0] ?? 'Okara'}
      buyerId={user?.id}
    />
    </>
  );
}

const styles = StyleSheet.create({
  screen:         { flex: 1 },
  notFoundText:   { fontFamily: 'Inter_400Regular', fontSize: 15, marginBottom: 20 },
  backBtn:        { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  backBtnText:    { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#ffffff' },
  // Header
  header:         { paddingHorizontal: 18, paddingBottom: 28, paddingTop: 50, alignItems: 'center' },
  backCircle:     { position: 'absolute', left: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  shareCircle:    { position: 'absolute', right: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarWrap:     { position: 'relative', marginBottom: 12, marginTop: 8 },
  avatar:         { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarImage:    { width: '100%', height: '100%', borderRadius: 25 },
  avatarInitials: { fontFamily: 'Inter_700Bold', fontSize: 32, color: '#ffffff' },
  verifiedDot:    { position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#1a6b3a', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },
  agentName:      { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#ffffff', textAlign: 'center', letterSpacing: -0.3 },
  agentAgency:    { fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  verifiedBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, backgroundColor: 'rgba(200,164,90,0.2)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  verifiedText:   { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#c8a45a' },
  sampleBadge:    { marginTop: 8, backgroundColor: 'rgba(200,164,90,0.3)', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  sampleText:     { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1, color: '#c8a45a' },
  // Actions
  actionsRow:     { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 14 },
  actionBtn:      { flex: 1, alignItems: 'center', gap: 6 },
  actionIcon:     { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionLabel:    { fontFamily: 'Inter_400Regular', fontSize: 11 },
  // Stats
  statsCard:      { flexDirection: 'row', margin: 18, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  statItem:       { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statVal:        { fontFamily: 'Inter_700Bold', fontSize: 22 },
  statLabel:      { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', marginTop: 3, lineHeight: 14 },
  // Sections
  section:        { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  sectionTitle:   { fontFamily: 'Inter_700Bold', fontSize: 17, marginBottom: 12, letterSpacing: -0.2 },
  aboutText:      { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  // Specialties
  tagRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:            { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  tagText:        { fontFamily: 'Inter_400Regular', fontSize: 12 },
  accentForeground:{ color: '#6f531d' },
  // Areas
  areaCard:       { marginHorizontal: 18, marginTop: 14, borderWidth: 1, borderRadius: 14, padding: 14 },
  areaHeader:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  areaTitle:      { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  areaChip:       { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  areaChipText:   { fontFamily: 'Inter_400Regular', fontSize: 12 },
  // Verification
  verCard:        { marginHorizontal: 18, marginTop: 14, borderWidth: 1, borderRadius: 14, padding: 16 },
  verHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  verTitle:       { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  verItem:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  verItemText:    { fontFamily: 'Inter_400Regular', fontSize: 12 },
  // Listings
  tabBar:         { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 4, marginBottom: 14 },
  tabItem:        { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabText:        { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  emptyListings:  { borderWidth: 1, borderRadius: 14, padding: 28, alignItems: 'center', marginTop: 4 },
  emptyTitle:     { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 6 },
  emptyDesc:      { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 17 },
  // Reviews
  reviewCard:     { borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 10 },
  reviewHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar:   { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  reviewInitial:  { fontFamily: 'Inter_700Bold', fontSize: 14 },
  reviewName:     { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  reviewDate:     { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 1 },
  starRow:        { flexDirection: 'row', gap: 2 },
  reviewText:     { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  reviewSample:   { flexDirection: 'row', gap: 6, alignItems: 'center', borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  reviewSampleText:{ fontFamily: 'Inter_400Regular', fontSize: 10, flex: 1 },
  // Footer
  footerCTA:      { flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingTop: 18 },
  callBtn:        { flex: 0.7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: 14, paddingVertical: 14 },
  callBtnText:    { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  enquireBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, paddingVertical: 14 },
  enquireBtnText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});
