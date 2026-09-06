/**
 * Premium Project Detail — works for both static demo projects and developer-created projects.
 * Feels like a premium project microsite, not a standard property detail page.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Dimensions, Image, Linking, Modal, Platform, Pressable,
  ScrollView, Share, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { projects as staticProjects } from '@/lib/projects';
import {
  DeveloperProject, formatPKR,
  getDevProjectById, statusColor,
} from '@/lib/developerStore';
import { getBlocks, getUnits, InventoryBlock, InventoryUnit, unitStatusColor } from '@/lib/inventoryStore';
import { getPaymentPlans, PaymentPlan, fmtPKR } from '@/lib/paymentPlanStore';
import { addInquiry } from '@/lib/inquiriesStore';
import { PinnedMapCard } from '@/components/LocationPicker';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import VisitSchedulerModal from '@/components/VisitSchedulerModal';
const { width: SW } = Dimensions.get('window');

// ── Development milestone derivation ─────────────────────────────────────────

const MILESTONES = [
  'Land Acquisition & Planning',
  'Foundation & Infrastructure',
  'Building Construction',
  'Interior & Finishing',
  'Possession Ready',
];

function milestonesComplete(status: string): number {
  switch (status) {
    case 'Pre-Launch':            return 1;
    case 'Under Construction':    return 2;
    case 'Construction Ongoing':  return 2;
    case 'Near Completion':       return 3;
    case 'Ready for Possession':  return 4;
    case 'Completed':             return 5;
    default:                      return 0;
  }
}

function progressPct(status: string): number {
  return Math.round((milestonesComplete(status) / MILESTONES.length) * 100);
}

// ── Amenity icons ─────────────────────────────────────────────────────────────

const AMENITY_ICON: Record<string, string> = {
  Mosque: 'moon', Park: 'wind', Playground: 'smile', School: 'book',
  'Hospital / Clinic': 'activity', 'Shopping Area': 'shopping-bag',
  'Community Hall': 'users', 'Boundary Wall': 'shield', 'Security Guards': 'user-check',
  'CCTV Surveillance': 'camera', 'Main Boulevard': 'map', 'Underground Utilities': 'zap',
  'Gas Connection': 'thermometer', 'Water Supply': 'droplet', 'Sewage System': 'server',
  'Street Lights': 'sun', 'Wide Roads': 'navigation', 'Generator Backup': 'battery-charging',
  'Swimming Pool': 'wind', 'Gym / Fitness': 'activity', 'Sports Complex': 'award',
  Graveyard: 'anchor', 'Gated Entry': 'lock', 'Green Belts': 'leaf',
};

// ── Project Inquiry Modal ─────────────────────────────────────────────────────

function ProjectInquiryModal({
  visible, onClose, projectName, developer, colors, insets,
}: {
  visible: boolean; onClose: () => void; projectName: string;
  developer: string; colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [budget, setBudget]   = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSend = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Required', 'Please enter your name and phone number.');
      return;
    }
    setSending(true);
    try {
      await addInquiry({
        propertyId:    0,
        propertyTitle: projectName,
        propertyType:  'Project',
        propertyCity:  'Okara District',
        propertyPrice: 0,
        agentName:     developer,
        message:       `Name: ${name.trim()}\nPhone: ${phone.trim()}${budget.trim() ? `\nBudget: ${budget.trim()}` : ''}\n\n${message.trim() || 'I am interested in this project. Please contact me with more details.'}`,
      });
      setSent(true);
    } catch {
      Alert.alert('Error', 'Could not send inquiry. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const reset = () => { setSent(false); setName(''); setPhone(''); setBudget(''); setMessage(''); };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={iqm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[iqm.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[iqm.handle, { backgroundColor: colors.border }]} />
          {sent ? (
            <View style={iqm.successWrap}>
              <View style={[iqm.successIcon, { backgroundColor: '#1a6b3a18' }]}>
                <Feather name="check-circle" size={36} color="#1a6b3a" />
              </View>
              <Text style={[iqm.successTitle, { color: colors.foreground }]}>Inquiry Sent!</Text>
              <Text style={[iqm.successDesc, { color: colors.mutedForeground }]}>
                Your inquiry has been submitted. The developer will contact you within 24 hours. You can view it in Profile → My Inquiries.
              </Text>
              <Pressable onPress={() => { reset(); onClose(); }}
                style={[iqm.successBtn, { backgroundColor: colors.action }]}>
                <Text style={[iqm.successBtnText, { color: colors.actionForeground }]}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={iqm.header}>
                <View style={{ flex: 1 }}>
                  <Text style={[iqm.title, { color: colors.foreground }]}>Project Inquiry</Text>
                  <Text style={[iqm.sub, { color: colors.mutedForeground }]} numberOfLines={1}>{projectName}</Text>
                </View>
                <Pressable onPress={onClose} style={[iqm.closeBtn, { backgroundColor: colors.secondary }]}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[iqm.label, { color: colors.mutedForeground }]}>YOUR NAME *</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.mutedForeground}
                  style={[iqm.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]} />
                <Text style={[iqm.label, { color: colors.mutedForeground }]}>PHONE *</Text>
                <TextInput value={phone} onChangeText={setPhone} placeholder="03XX-XXXXXXX" keyboardType="phone-pad" placeholderTextColor={colors.mutedForeground}
                  style={[iqm.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]} />
                <Text style={[iqm.label, { color: colors.mutedForeground }]}>BUDGET (OPTIONAL)</Text>
                <TextInput value={budget} onChangeText={setBudget} placeholder="e.g. PKR 50 Lakh" placeholderTextColor={colors.mutedForeground}
                  style={[iqm.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]} />
                <Text style={[iqm.label, { color: colors.mutedForeground }]}>MESSAGE (OPTIONAL)</Text>
                <TextInput value={message} onChangeText={setMessage} multiline numberOfLines={3}
                  placeholder="Any specific requirements or questions…"
                  placeholderTextColor={colors.mutedForeground}
                  style={[iqm.input, iqm.multiline, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]} />
                <Pressable onPress={handleSend} disabled={sending}
                  style={[iqm.sendBtn, { backgroundColor: colors.action, opacity: sending ? 0.7 : 1 }]}>
                  <Text style={[iqm.sendBtnText, { color: colors.actionForeground }]}>{sending ? 'Sending…' : 'Submit Inquiry'}</Text>
                  <Feather name="send" size={15} color={colors.actionForeground} />
                </Pressable>
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const iqm = StyleSheet.create({
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0d1d2baa' },
  sheet:        { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 10, paddingHorizontal: 18, maxHeight: '90%' },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  header:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  title:        { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.3 },
  sub:          { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  closeBtn:     { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  label:        { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1, marginBottom: 7, marginTop: 4 },
  input:        { borderWidth: 1, borderRadius: 12, padding: 13, fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 14 },
  multiline:    { minHeight: 80, textAlignVertical: 'top' },
  sendBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15, marginTop: 4, marginBottom: 8 },
  sendBtnText:  { fontFamily: 'Inter_700Bold', fontSize: 14 },
  successWrap:  { alignItems: 'center', paddingVertical: 24, gap: 12, paddingHorizontal: 8 },
  successIcon:  { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  successDesc:  { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20, color: '#64748b' },
  successBtn:   { borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14, marginTop: 8 },
  successBtnText:{ fontFamily: 'Inter_700Bold', fontSize: 14 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProjectDetailScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  // ── Data ───────────────────────────────────────────────────────────────────
  const staticProject = staticProjects.find((p) => p.id === id) ?? null;
  const [devProject,   setDevProject]   = useState<DeveloperProject | null>(null);
  const [units,        setUnits]        = useState<InventoryUnit[]>([]);
  const [blocks,       setBlocks]       = useState<InventoryBlock[]>([]);
  const [payPlan,      setPayPlan]      = useState<PaymentPlan | null>(null);
  const [loading,      setLoading]      = useState(!staticProject);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [galleryOpen,   setGalleryOpen]   = useState(false);
  const [galleryIndex,  setGalleryIndex]  = useState(0);
  const [inquiryOpen,   setInquiryOpen]   = useState(false);
  const [visitOpen,     setVisitOpen]     = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [unitFilter,    setUnitFilter]    = useState<string>('All');

  useEffect(() => {
    if (staticProject) return; // static project — no async load needed
    (async () => {
      const dp = await getDevProjectById(id ?? '');
      if (dp) {
        setDevProject(dp);
        const [b, u, allPlans] = await Promise.all([
          getBlocks(dp.id),
          getUnits(dp.id),
          getPaymentPlans(dp.developerId),
        ]);
        setBlocks(b);
        setUnits(u);
        const projectPlans = allPlans.filter((pl) => pl.projectId === dp.id);
        setPayPlan(projectPlans[0] ?? null);
      }
      setLoading(false);
    })();
  }, [id]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const name        = devProject?.name        ?? staticProject?.name ?? '—';
  const type        = devProject?.type        ?? staticProject?.category ?? 'Project';
  const developer   = devProject
    ? (user?.role === 'developer' && user.id === devProject.developerId ? (user.companyName ?? user.name) : devProject.name)
    : (staticProject?.developer ?? 'OG Landmark Developers');
  const developerId = devProject?.developerId ?? 'demo';
  const location    = devProject
    ? [devProject.city, devProject.district].filter(Boolean).join(', ')
    : (staticProject?.location ?? '');
  const priceText   = devProject
    ? (devProject.startingPrice > 0 ? `Starting from PKR ${formatPKR(devProject.startingPrice)}` : 'Price on request')
    : (staticProject?.priceRange ?? '—');
  const totalUnits  = devProject?.totalUnits    ?? staticProject?.units.length ?? 0;
  const availUnits  = devProject?.availableUnits ?? 0;
  const description = devProject?.fullDescription || devProject?.shortDescription || staticProject?.description || '';
  const heroImage: any = devProject?.coverImageUri
    ? { uri: devProject.coverImageUri }
    : (staticProject?.image ?? require('@/assets/images/property-1.jpg'));
  const photos: any[] = [
    ...(devProject?.coverImageUri ? [{ uri: devProject.coverImageUri }] : [heroImage]),
    ...(devProject?.photos ?? []).map((uri) => ({ uri })),
  ];
  const amenities  = devProject?.amenities ?? [];
  const hasMap     = !!(devProject?.latitude && devProject?.longitude);
  const devStatus  = devProject?.developmentStatus ?? '';
  const isDemoProject = !devProject;

  // ── Unit filter ────────────────────────────────────────────────────────────
  const unitTypes = ['All', ...Array.from(new Set(units.map((u) => u.type)))];
  const filteredUnits = unitFilter === 'All' ? units : units.filter((u) => u.type === unitFilter);

  const handleShare = async () => {
    await Share.share({
      message: `${name} — ${location}\n${priceText}\n\nPremium Real Estate by OG Landmark`,
      title: name,
    });
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading project…</Text>
      </View>
    );
  }

  return (
    <>
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <Image source={heroImage} style={styles.heroImage} resizeMode="cover" />
        {/* gradient overlay */}
        <View style={styles.heroGradient} />

        {/* gallery tap — rendered BEFORE top controls so buttons stay on top */}
        <Pressable style={[StyleSheet.absoluteFill, { zIndex: 1 }]} onPress={() => setGalleryOpen(true)} />

        {/* top controls — zIndex above gallery tap */}
        <View style={[styles.heroTopRow, { top: topInset + 8, zIndex: 10 }]}>
          <Pressable onPress={() => router.back()} style={styles.heroRound} hitSlop={10}>
            <Feather name="arrow-left" size={20} color="#ffffff" />
          </Pressable>
          <View style={styles.heroTopRight}>
            <Pressable onPress={() => setSaved(!saved)} style={styles.heroRound} hitSlop={10}>
              <Feather name="heart" size={19} color={saved ? '#e85c5c' : '#ffffff'} />
            </Pressable>
            <Pressable onPress={handleShare} style={styles.heroRound} hitSlop={10}>
              <Feather name="share-2" size={19} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        {/* bottom identity */}
        <View style={styles.heroBottom}>
          {isDemoProject && (
            <View style={styles.sampleBadge}>
              <Text style={styles.sampleText}>SAMPLE DATA</Text>
            </View>
          )}
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{type}</Text>
          </View>
          <Text style={styles.heroName}>{name}</Text>
          <View style={styles.heroDevRow}>
            <Feather name="check-circle" size={12} color="#c8a45a" />
            <Text style={styles.heroDevText}>Verified Developer · {developer}</Text>
          </View>
          <View style={styles.heroLocRow}>
            <Feather name="map-pin" size={12} color="rgba(255,255,255,0.8)" />
            <Text style={styles.heroLocText}>{location}</Text>
          </View>
        </View>

        {/* photo count */}
        {photos.length > 1 && (
          <View style={styles.photoCount}>
            <Feather name="camera" size={12} color="#ffffff" />
            <Text style={styles.photoCountText}>{photos.length}</Text>
          </View>
        )}
      </View>

      {/* ── PRICE + CTA ROW ─────────────────────────────────────────────── */}
      <View style={[styles.ctaBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>STARTING FROM</Text>
          <Text style={[styles.priceText, { color: colors.foreground }]} numberOfLines={1}>{priceText.replace('Starting from ', '')}</Text>
        </View>
        <Pressable onPress={() => setInquiryOpen(true)}
          style={({ pressed }) => [styles.enquireBtn, { backgroundColor: colors.action, opacity: pressed ? 0.85 : 1 }]}>
          <Text style={[styles.enquireBtnText, { color: colors.actionForeground }]}>Enquire Now</Text>
        </Pressable>
      </View>

      {/* ── QUICK ACTIONS ────────────────────────────────────────────────── */}
      <View style={[styles.quickActions, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
        {[
          { icon: 'phone-call', label: 'Call Office', onPress: () => Linking.openURL(`tel:${devProject?.projectOfficePhone ?? '03042569000'}`) },
          { icon: 'message-circle', label: 'WhatsApp', onPress: () => Linking.openURL(`https://wa.me/9203042569000`) },
          { icon: 'calendar', label: 'Visit', onPress: () => setVisitOpen(true), highlight: true },
          { icon: 'map-pin', label: 'Directions', onPress: () => {
            const lat = devProject?.latitude ?? 30.8136;
            const lng = devProject?.longitude ?? 73.4519;
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
          }},
          { icon: 'share-2', label: 'Share', onPress: handleShare },
        ].map((a: any) => (
          <Pressable key={a.label} onPress={a.onPress} style={styles.quickAction}>
            <View style={[styles.quickIcon, {
              backgroundColor: a.highlight ? colors.action : colors.card,
              borderColor: a.highlight ? colors.action : colors.border,
            }]}>
              <Feather name={a.icon as any} size={16} color={a.highlight ? colors.actionForeground : colors.action} />
            </View>
            <Text style={[styles.quickLabel, { color: a.highlight ? colors.action : colors.mutedForeground, fontFamily: a.highlight ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
      <AnimatedReveal>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Project Overview</Text>
          {description ? (
            <Text style={[styles.desc, { color: colors.mutedForeground }]}>{description}</Text>
          ) : null}

          <View style={[styles.statsGrid, { borderColor: colors.border }]}>
            {[
              { label: 'Total Units', value: totalUnits > 0 ? String(totalUnits) : '—' },
              { label: 'Available', value: devProject ? (availUnits > 0 ? String(availUnits) : '—') : '—' },
              { label: 'Project Area', value: devProject?.totalArea || '—' },
              { label: 'Completion', value: devProject?.expectedCompletion || (isDemoProject ? 'TBD' : '—') },
            ].map((s, i) => (
              <View key={s.label} style={[styles.statCell, i % 2 === 0 ? { borderRightWidth: 1, borderRightColor: colors.border } : {}, i < 2 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {}]}>
                <Text style={[styles.statVal, { color: colors.foreground }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Status + legal badges */}
          {devProject && (
            <View style={styles.badgesRow}>
              {devProject.status ? (
                <View style={[styles.statusChip, { backgroundColor: statusColor(devProject.status).bg }]}>
                  <Text style={[styles.statusChipText, { color: statusColor(devProject.status).text }]}>{devProject.status}</Text>
                </View>
              ) : null}
              {devProject.nocStatus === 'Approved' && (
                <View style={[styles.statusChip, { backgroundColor: '#1a6b3a15' }]}>
                  <Feather name="check-circle" size={10} color="#1a6b3a" />
                  <Text style={[styles.statusChipText, { color: '#1a6b3a' }]}>NOC Approved</Text>
                </View>
              )}
              {devProject.approvedBy.length > 0 && (
                <View style={[styles.statusChip, { backgroundColor: colors.accent }]}>
                  <Feather name="award" size={10} color={colors.accentForeground} />
                  <Text style={[styles.statusChipText, { color: colors.accentForeground }]}>{devProject.approvedBy.join(' · ')}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </AnimatedReveal>

      {/* ── DEVELOPED BY ─────────────────────────────────────────────────── */}
      <AnimatedReveal delay={40}>
        <View style={[styles.devCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionEyebrow, { color: colors.primary }]}>DEVELOPED BY</Text>
          <View style={styles.devCardRow}>
            <View style={[styles.devAvatar, { backgroundColor: colors.action }]}>
              <Text style={styles.devAvatarText}>
                {developer.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.devNameRow}>
                <Text style={[styles.devName, { color: colors.foreground }]}>{developer}</Text>
                <View style={[styles.verifiedBadge, { backgroundColor: '#1a6b3a15' }]}>
                  <Feather name="check-circle" size={10} color="#1a6b3a" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
              {devProject?.type && <Text style={[styles.devType, { color: colors.mutedForeground }]}>{devProject.type}</Text>}
            </View>
          </View>
          <Pressable onPress={() => router.push(`/dev-profile/${developerId}`)}
            style={({ pressed }) => [styles.viewDevBtn, { borderColor: colors.action, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={[styles.viewDevText, { color: colors.action }]}>View Developer Profile</Text>
            <Feather name="arrow-right" size={13} color={colors.action} />
          </Pressable>
        </View>
      </AnimatedReveal>

      {/* ── GALLERY ──────────────────────────────────────────────────────── */}
      {photos.length > 1 && (
        <AnimatedReveal delay={60}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Project Gallery</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 18 }}>
              {photos.map((photo, i) => (
                <Pressable key={i} onPress={() => { setGalleryIndex(i); setGalleryOpen(true); }}>
                  <Image source={photo} style={[styles.galleryThumb, { borderColor: colors.border }]} resizeMode="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </AnimatedReveal>
      )}

      {/* ── AVAILABLE UNITS ───────────────────────────────────────────────── */}
      {(units.length > 0 || (staticProject?.units && staticProject.units.length > 0)) && (
        <AnimatedReveal delay={80}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Available Units</Text>

            {/* filter tabs — only if we have real inventory units */}
            {units.length > 1 && unitTypes.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
                {unitTypes.map((t) => (
                  <Pressable key={t} onPress={() => setUnitFilter(t)}
                    style={[styles.filterTab, unitFilter === t ? { backgroundColor: colors.selectionBackground, borderColor: colors.selectionBorder, borderWidth: 1.5 } : { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }]}>
                    <Text style={[styles.filterTabText, { color: unitFilter === t ? colors.selectionForeground : colors.mutedForeground, fontWeight: unitFilter === t ? '600' : '400' }]}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* inventory units */}
            {filteredUnits.map((u) => {
              const sc = unitStatusColor(u.status);
              return (
                <View key={u.id} style={[styles.unitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.unitTop}>
                    <View>
                      <Text style={[styles.unitNumber, { color: colors.foreground }]}>{u.unitNumber}</Text>
                      <Text style={[styles.unitType, { color: colors.mutedForeground }]}>{u.type}</Text>
                    </View>
                    <View style={[styles.unitStatus, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.unitStatusText, { color: sc.text }]}>{u.status}</Text>
                    </View>
                  </View>
                  <View style={[styles.unitDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.unitMeta}>
                    <UnitMetaItem icon="maximize-2" label={u.size} colors={colors} />
                    {u.bedrooms !== undefined && u.bedrooms > 0 && <UnitMetaItem icon="home" label={`${u.bedrooms} Bed`} colors={colors} />}
                    {u.floor && <UnitMetaItem icon="layers" label={`Floor ${u.floor}`} colors={colors} />}
                    {u.facing && <UnitMetaItem icon="compass" label={u.facing} colors={colors} />}
                    {u.isCorner && <UnitMetaItem icon="corner-up-right" label="Corner" colors={colors} />}
                    {u.isParkFacing && <UnitMetaItem icon="wind" label="Park Facing" colors={colors} />}
                  </View>
                  <Text style={[styles.unitPrice, { color: colors.foreground }]}>
                    PKR {formatPKR(u.price)}
                  </Text>
                  {u.status === 'Available' && (
                    <Pressable onPress={() => setInquiryOpen(true)}
                      style={({ pressed }) => [styles.unitEnquire, { borderColor: colors.action, opacity: pressed ? 0.8 : 1 }]}>
                      <Text style={[styles.unitEnquireText, { color: colors.action }]}>Enquire about this unit</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}

            {/* static project units fallback */}
            {units.length === 0 && staticProject?.units.map((u) => (
              <View key={u.name} style={[styles.unitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.unitTop}>
                  <View>
                    <Text style={[styles.unitNumber, { color: colors.foreground }]}>{u.name}</Text>
                    {u.bedrooms !== '—' && <Text style={[styles.unitType, { color: colors.mutedForeground }]}>{u.bedrooms} Bed · {u.bathrooms} Bath</Text>}
                  </View>
                  <View style={[styles.unitStatus, { backgroundColor: '#1a6b3a18' }]}>
                    <Text style={[styles.unitStatusText, { color: '#1a6b3a' }]}>Available</Text>
                  </View>
                </View>
                <View style={[styles.unitDivider, { backgroundColor: colors.border }]} />
                <View style={styles.unitMeta}>
                  <UnitMetaItem icon="maximize-2" label={u.area} colors={colors} />
                </View>
                <Text style={[styles.unitPrice, { color: colors.foreground }]}>{u.price}</Text>
                <Pressable onPress={() => setInquiryOpen(true)}
                  style={({ pressed }) => [styles.unitEnquire, { borderColor: colors.action, opacity: pressed ? 0.8 : 1 }]}>
                  <Text style={[styles.unitEnquireText, { color: colors.action }]}>Enquire about this unit</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </AnimatedReveal>
      )}

      {/* ── PAYMENT PLAN ─────────────────────────────────────────────────── */}
      {payPlan && (
        <AnimatedReveal delay={100}>
          <View style={[styles.section, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payment Plan</Text>
            <Text style={[styles.payPlanName, { color: colors.mutedForeground }]}>{payPlan.planName} — {payPlan.unitType}</Text>
            <View style={[styles.payCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { label: 'Total Price', value: fmtPKR(payPlan.totalPrice), highlight: true },
                { label: 'Booking Amount', value: fmtPKR(payPlan.bookingAmount) },
                { label: 'Down Payment', value: fmtPKR(payPlan.downPayment) },
                { label: 'Confirmation', value: fmtPKR(payPlan.confirmationAmount) },
                { label: 'Monthly Instalment', value: fmtPKR(payPlan.monthlyInstallment) },
                { label: 'Duration', value: payPlan.installmentCount > 0 ? `${payPlan.installmentCount} months` : '—' },
                { label: 'Possession Charges', value: fmtPKR(payPlan.possessionCharges) },
              ].filter((row) => row.value !== '—').map((row, i) => (
                <View key={row.label} style={[styles.payRow, i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : {}]}>
                  <Text style={[styles.payRowLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                  <Text style={[styles.payRowValue, { color: row.highlight ? colors.action : colors.foreground, fontFamily: row.highlight ? 'Inter_700Bold' : 'Inter_600SemiBold' }]}>PKR {row.value}</Text>
                </View>
              ))}
            </View>
            <Pressable onPress={() => setInquiryOpen(true)}
              style={({ pressed }) => [styles.payRequestBtn, { backgroundColor: colors.action, opacity: pressed ? 0.85 : 1 }]}>
              <Text style={[styles.payRequestText, { color: colors.actionForeground }]}>Request Full Payment Plan</Text>
              <Feather name="arrow-right" size={14} color={colors.actionForeground} />
            </Pressable>
          </View>
        </AnimatedReveal>
      )}

      {/* ── AMENITIES ─────────────────────────────────────────────────────── */}
      {amenities.length > 0 && (
        <AnimatedReveal delay={110}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Project Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {amenities.map((a) => (
                <View key={a} style={[styles.amenityChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Feather name={(AMENITY_ICON[a] ?? 'check') as any} size={13} color={colors.primary} />
                  <Text style={[styles.amenityText, { color: colors.foreground }]}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        </AnimatedReveal>
      )}

      {/* static project features / key points */}
      {staticProject && (
        <AnimatedReveal delay={115}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Key Features</Text>
            {staticProject.features.map((group) => (
              <View key={group.title} style={[styles.featureCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.featureTitle, { color: colors.foreground }]}>{group.title}</Text>
                {group.items.map((item) => (
                  <View key={item} style={styles.featureItem}>
                    <Feather name="check-circle" size={12} color="#1a6b3a" />
                    <Text style={[styles.featureText, { color: colors.mutedForeground }]}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </AnimatedReveal>
      )}

      {/* ── DEVELOPMENT PROGRESS ─────────────────────────────────────────── */}
      {devStatus && (
        <AnimatedReveal delay={120}>
          <View style={[styles.section, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Development Progress</Text>
            <View style={styles.progressRow}>
              <Text style={[styles.progressPct, { color: colors.action }]}>{progressPct(devStatus)}%</Text>
              <Text style={[styles.progressStatus, { color: colors.mutedForeground }]}>{devStatus}</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.action, width: `${progressPct(devStatus)}%` as any }]} />
            </View>
            <View style={styles.milestones}>
              {MILESTONES.map((m, i) => {
                const done = i < milestonesComplete(devStatus);
                return (
                  <View key={m} style={styles.milestoneRow}>
                    <View style={[styles.milestoneIcon, { backgroundColor: done ? '#1a6b3a18' : colors.border }]}>
                      <Feather name={done ? 'check' : 'circle'} size={11} color={done ? '#1a6b3a' : colors.mutedForeground} />
                    </View>
                    <Text style={[styles.milestoneText, { color: done ? colors.foreground : colors.mutedForeground }]}>{m}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </AnimatedReveal>
      )}

      {/* ── LOCATION ─────────────────────────────────────────────────────── */}
      <AnimatedReveal delay={130}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Project Location</Text>
          <View style={styles.locationInfo}>
            <Feather name="map-pin" size={14} color={colors.primary} />
            <Text style={[styles.locationText, { color: colors.mutedForeground }]}>
              {devProject ? devProject.address || location : location}
            </Text>
          </View>
          {devProject?.nearbyLandmark ? (
            <Text style={[styles.nearbyText, { color: colors.mutedForeground }]}>
              Near: {devProject.nearbyLandmark}
            </Text>
          ) : null}
          <PinnedMapCard
            latitude={devProject?.latitude}
            longitude={devProject?.longitude}
            address={devProject?.address || location}
            colors={colors}
          />
          <Pressable onPress={() => {
            const lat = devProject?.latitude ?? 30.8136;
            const lng = devProject?.longitude ?? 73.4519;
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
          }} style={({ pressed }) => [styles.directionsBtn, { borderColor: colors.action, opacity: pressed ? 0.8 : 1 }]}>
            <Feather name="navigation" size={14} color={colors.action} />
            <Text style={[styles.directionsBtnText, { color: colors.action }]}>Get Directions</Text>
          </Pressable>
        </View>
      </AnimatedReveal>

    </ScrollView>

    {/* ── INQUIRY MODAL ────────────────────────────────────────────────── */}
    <ProjectInquiryModal
      visible={inquiryOpen}
      onClose={() => setInquiryOpen(false)}
      projectName={name}
      developer={developer}
      colors={colors}
      insets={insets}
    />

    {/* ── VISIT SCHEDULER MODAL ────────────────────────────────────────── */}
    <VisitSchedulerModal
      visible={visitOpen}
      onClose={() => setVisitOpen(false)}
      providerType="developer"
      providerId={developerId}
      projectTitle={name}
      contactPerson={developer}
      contactPhone={devProject?.projectOfficePhone ?? '03042569000'}
      location={location}
      buyerId={user?.id}
    />

    {/* ── GALLERY MODAL ────────────────────────────────────────────────── */}
    {/* ── INLINE GALLERY MODAL ─────────────────────────────────────── */}
    <Modal visible={galleryOpen} transparent animationType="fade" onRequestClose={() => setGalleryOpen(false)} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000000ee', justifyContent: 'center', alignItems: 'center' }}>
        <Pressable style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setGalleryOpen(false)}>
          <Feather name="x" size={20} color="#ffffff" />
        </Pressable>
        <Image source={photos[galleryIndex] ?? photos[0]} style={{ width: SW, height: SW }} resizeMode="contain" />
        {photos.length > 1 && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <Pressable onPress={() => setGalleryIndex(Math.max(0, galleryIndex - 1))} style={{ padding: 10 }}>
              <Feather name="chevron-left" size={24} color="#ffffff" />
            </Pressable>
            <Text style={{ color: '#ffffff', fontFamily: 'Inter_400Regular', fontSize: 13, paddingTop: 12 }}>{galleryIndex + 1} / {photos.length}</Text>
            <Pressable onPress={() => setGalleryIndex(Math.min(photos.length - 1, galleryIndex + 1))} style={{ padding: 10 }}>
              <Feather name="chevron-right" size={24} color="#ffffff" />
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
    </>
  );
}

function UnitMetaItem({ icon, label, colors }: { icon: string; label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.metaItem}>
      <Feather name={icon as any} size={11} color={colors.mutedForeground} />
      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:          { flex: 1 },
  loadingText:     { fontFamily: 'Inter_400Regular', fontSize: 14 },
  // Hero
  hero:            { height: 370, position: 'relative', overflow: 'hidden' },
  heroImage:       { width: '100%', height: '100%' },
  heroGradient:    { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,20,30,0.55)' },
  heroTopRow:      { position: 'absolute', left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTopRight:    { flexDirection: 'row', gap: 10 },
  heroRound:       { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(15,25,35,0.68)', alignItems: 'center', justifyContent: 'center' },
  heroBottom:      { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, paddingBottom: 20 },
  sampleBadge:     { alignSelf: 'flex-start', backgroundColor: '#c8a45a', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 },
  sampleText:      { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1, color: '#1c2024' },
  typeBadge:       { alignSelf: 'flex-start', backgroundColor: 'rgba(200,164,90,0.28)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  typeBadgeText:   { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#c8a45a', letterSpacing: 0.5 },
  heroName:        { fontFamily: 'Inter_700Bold', fontSize: 26, color: '#ffffff', letterSpacing: -0.5, marginBottom: 6 },
  heroDevRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  heroDevText:     { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#c8a45a' },
  heroLocRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroLocText:     { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  photoCount:      { position: 'absolute', top: 16, right: 18, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(10,20,30,0.68)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  photoCountText:  { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#ffffff' },
  // CTA bar
  ctaBar:          { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 },
  priceLabel:      { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  priceText:       { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 2 },
  enquireBtn:      { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  enquireBtnText:  { fontFamily: 'Inter_700Bold', fontSize: 13 },
  // Quick actions
  quickActions:    { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1 },
  quickAction:     { flex: 1, alignItems: 'center', gap: 6 },
  quickIcon:       { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  quickLabel:      { fontFamily: 'Inter_400Regular', fontSize: 10 },
  // Sections
  section:         { padding: 18 },
  sectionTitle:    { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 12, letterSpacing: -0.2 },
  sectionEyebrow:  { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1, marginBottom: 10 },
  desc:            { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  // Stats grid
  statsGrid:       { borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
  statCell:        { width: '50%', padding: 14 },
  statVal:         { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 3 },
  statLabel:       { fontFamily: 'Inter_400Regular', fontSize: 11 },
  // Badges
  badgesRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  statusChipText:  { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.3 },
  accentForeground:{ color: '#6f531d' },
  // Developer card
  devCard:         { marginHorizontal: 18, marginBottom: 4, borderWidth: 1, borderRadius: 16, padding: 16 },
  devCardRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  devAvatar:       { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  devAvatarText:   { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#ffffff' },
  devNameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  devName:         { fontFamily: 'Inter_700Bold', fontSize: 14 },
  devType:         { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  verifiedBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  verifiedText:    { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#1a6b3a' },
  viewDevBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 11 },
  viewDevText:     { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  // Gallery
  galleryThumb:    { width: 160, height: 110, borderRadius: 12, borderWidth: 1 },
  // Units
  filterTab:       { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  filterTabText:   { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  unitCard:        { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  unitTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  unitNumber:      { fontFamily: 'Inter_700Bold', fontSize: 14 },
  unitType:        { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  unitStatus:      { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  unitStatusText:  { fontFamily: 'Inter_700Bold', fontSize: 10 },
  unitDivider:     { height: 1, marginVertical: 10 },
  unitMeta:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  metaItem:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:        { fontFamily: 'Inter_400Regular', fontSize: 11 },
  unitPrice:       { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 10 },
  unitEnquire:     { borderWidth: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  unitEnquireText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  // Payment plan
  payPlanName:     { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: -6, marginBottom: 12 },
  payCard:         { borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
  payRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  payRowLabel:     { fontFamily: 'Inter_400Regular', fontSize: 12 },
  payRowValue:     { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  payRequestBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, paddingVertical: 13 },
  payRequestText:  { fontFamily: 'Inter_700Bold', fontSize: 13 },
  // Amenities
  amenitiesGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  amenityText:     { fontFamily: 'Inter_400Regular', fontSize: 12 },
  // Static features
  featureCard:     { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  featureTitle:    { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 10 },
  featureItem:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  featureText:     { fontFamily: 'Inter_400Regular', fontSize: 12 },
  // Progress
  progressRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 10 },
  progressPct:     { fontFamily: 'Inter_700Bold', fontSize: 32 },
  progressStatus:  { fontFamily: 'Inter_400Regular', fontSize: 13 },
  progressTrack:   { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 18 },
  progressFill:    { height: '100%', borderRadius: 3 },
  milestones:      { gap: 10 },
  milestoneRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  milestoneIcon:   { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  milestoneText:   { fontFamily: 'Inter_400Regular', fontSize: 13 },
  // Location
  locationInfo:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  locationText:    { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },
  nearbyText:      { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 12 },
  directionsBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: 12, paddingVertical: 12, marginTop: 12 },
  directionsBtnText:{ fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
