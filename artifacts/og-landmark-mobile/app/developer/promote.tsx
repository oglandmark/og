/**
 * Developer Portal — Promote Project
 * Generate professional marketing copy and share across WhatsApp, Facebook,
 * and native system share sheet.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert, Linking, Platform, Pressable, ScrollView,
  Share, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import {
  DeveloperProject, getDevProjects, formatPKR,
} from '@/lib/developerStore';

// ── Marketing copy generator ─────────────────────────────────────────────────
function generateCopy(p: DeveloperProject, lang: 'en' | 'ur'): string {
  const priceStr = p.startingPrice > 0
    ? `PKR ${formatPKR(p.startingPrice)}`
    : 'Contact for pricing';

  const amenitiesStr = p.amenities.length > 0
    ? p.amenities.slice(0, 5).join(' · ')
    : '';

  if (lang === 'en') {
    return [
      `🏗️ *${p.name}* — Now ${p.status === 'Coming Soon' ? 'Coming Soon' : 'Available'}!`,
      ``,
      `📍 ${p.city}${p.district && p.district !== p.city ? ', ' + p.district : ''}`,
      `🏠 ${p.type}${p.developmentStatus ? ' · ' + p.developmentStatus : ''}`,
      p.startingPrice > 0 ? `💰 Starting from *${priceStr}*` : '',
      p.availableUnits > 0 ? `🏘️ ${p.availableUnits} units still available` : '',
      p.totalArea ? `📐 Total Area: ${p.totalArea}` : '',
      ``,
      p.tagline ? `"${p.tagline}"` : '',
      ``,
      amenitiesStr ? `✅ ${amenitiesStr}` : '',
      `✅ Flexible payment plans available`,
      `✅ Trusted by families in Okara District`,
      ``,
      `📞 Contact OG Landmark for a site visit or booking!`,
      ``,
      `#OGLandmark #RealEstate #${p.city.replace(/\s+/g, '')} #${p.type.replace(/\s+/g, '')} #Pakistan`,
    ].filter((l) => l !== '').join('\n').replace(/\n{3,}/g, '\n\n');
  }

  return [
    `🏗️ *${p.name}* — ${p.status === 'Coming Soon' ? 'جلد آ رہا ہے' : 'ابھی دستیاب'}!`,
    ``,
    `📍 ${p.city}${p.district && p.district !== p.city ? '، ' + p.district : ''}`,
    `🏠 ${p.type}${p.developmentStatus ? ' · ' + p.developmentStatus : ''}`,
    p.startingPrice > 0 ? `💰 قیمت شروع *${priceStr}* سے` : '',
    p.availableUnits > 0 ? `🏘️ ${p.availableUnits} یونٹس ابھی دستیاب ہیں` : '',
    p.totalArea ? `📐 کل رقبہ: ${p.totalArea}` : '',
    ``,
    p.tagline ? `"${p.tagline}"` : '',
    ``,
    amenitiesStr ? `✅ ${amenitiesStr}` : '',
    `✅ آسان اقساط پر دستیاب`,
    `✅ اوکاڑہ کے خاندانوں کا اعتماد`,
    ``,
    `📞 سائٹ وزٹ یا بکنگ کے لیے OG Landmark سے رابطہ کریں!`,
    ``,
    `#OGLandmark #RealEstate #${p.city.replace(/\s+/g, '')} #Pakistan`,
  ].filter((l) => l !== '').join('\n').replace(/\n{3,}/g, '\n\n');
}

// ── Promotional card preview ─────────────────────────────────────────────────
function PromoCard({ p, colors }: { p: DeveloperProject; colors: ReturnType<typeof import('@/hooks/useColors').useColors> }) {
  const hasPrice = p.startingPrice > 0;
  return (
    <View style={[pc.card, { backgroundColor: colors.action }]}>
      {/* Top band */}
      <View style={pc.topBand}>
        <View style={pc.brandRow}>
          <View style={pc.brandDot} />
          <Text style={pc.brandText}>OG LANDMARK</Text>
          <View style={[pc.statusPill, { backgroundColor: '#ffffff22' }]}>
            <Text style={pc.statusText}>{p.status.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Main content */}
      <View style={pc.body}>
        <Text style={pc.projectType}>{p.type}</Text>
        <Text style={pc.projectName} numberOfLines={2}>{p.name}</Text>
        {p.tagline ? <Text style={pc.tagline} numberOfLines={1}>"{p.tagline}"</Text> : null}

        {/* Location */}
        <View style={pc.locRow}>
          <Feather name="map-pin" size={11} color="#ffffffaa" />
          <Text style={pc.locText}>{p.city}{p.district && p.district !== p.city ? `, ${p.district}` : ''}</Text>
        </View>
      </View>

      {/* Footer stats */}
      <View style={[pc.footer, { borderTopColor: '#ffffff22' }]}>
        {hasPrice && (
          <View style={pc.stat}>
            <Text style={pc.statLabel}>Starting from</Text>
            <Text style={pc.statValue}>PKR {formatPKR(p.startingPrice)}</Text>
          </View>
        )}
        {p.availableUnits > 0 && (
          <View style={[pc.stat, hasPrice && { borderLeftWidth: 1, borderLeftColor: '#ffffff22', paddingLeft: 14 }]}>
            <Text style={pc.statLabel}>Available</Text>
            <Text style={pc.statValue}>{p.availableUnits} units</Text>
          </View>
        )}
        {p.developmentStatus ? (
          <View style={[pc.stat, { borderLeftWidth: 1, borderLeftColor: '#ffffff22', paddingLeft: 14 }]}>
            <Text style={pc.statLabel}>Status</Text>
            <Text style={pc.statValue} numberOfLines={1}>{p.developmentStatus}</Text>
          </View>
        ) : null}
      </View>

      {/* Amenities */}
      {p.amenities.length > 0 && (
        <View style={pc.amenities}>
          {p.amenities.slice(0, 4).map((a) => (
            <View key={a} style={pc.amenityChip}>
              <Text style={pc.amenityText}>{a}</Text>
            </View>
          ))}
          {p.amenities.length > 4 && (
            <View style={pc.amenityChip}>
              <Text style={pc.amenityText}>+{p.amenities.length - 4} more</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const pc = StyleSheet.create({
  card:        { borderRadius: 20, overflow: 'hidden' },
  topBand:     { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  brandRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#c8a45a' },
  brandText:   { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 2, color: '#ffffffbb' },
  statusPill:  { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 'auto' },
  statusText:  { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1, color: '#ffffffcc' },
  body:        { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, gap: 4 },
  projectType: { fontFamily: 'Inter_500Medium', fontSize: 10, color: '#c8a45a', letterSpacing: 1, textTransform: 'uppercase' },
  projectName: { fontFamily: 'Inter_700Bold', fontSize: 26, color: '#ffffff', letterSpacing: -0.5, lineHeight: 30, marginTop: 2 },
  tagline:     { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#ffffffaa', fontStyle: 'italic', marginTop: 2 },
  locRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  locText:     { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#ffffffbb' },
  footer:      { borderTopWidth: 1, flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 0 },
  stat:        { flex: 1, gap: 2 },
  statLabel:   { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#ffffffaa' },
  statValue:   { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#ffffff' },
  amenities:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 14 },
  amenityChip: { backgroundColor: '#ffffff18', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  amenityText: { fontFamily: 'Inter_500Medium', fontSize: 10, color: '#ffffffcc' },
});

// ── Share platform button ─────────────────────────────────────────────────────
function PlatformBtn({
  icon, label, bg, fg, onPress,
}: { icon: React.ComponentProps<typeof Feather>['name']; label: string; bg: string; fg: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pb.btn, { backgroundColor: bg, opacity: pressed ? 0.8 : 1 }]}>
      <Feather name={icon} size={20} color={fg} />
      <Text style={[pb.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}
const pb = StyleSheet.create({
  btn:   { flex: 1, alignItems: 'center', borderRadius: 16, paddingVertical: 16, gap: 8 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function PromoteScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user }  = useAuth();
  const { tr } = useLanguage();
  const router  = useRouter();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const [projects, setProjects]   = useState<DeveloperProject[]>([]);
  const [selected, setSelected]   = useState<DeveloperProject | null>(null);
  const [copyLang, setCopyLang]   = useState<'en' | 'ur'>('en');
  const [copyText, setCopyText]   = useState('');
  const [copied, setCopied]       = useState(false);

  useFocusEffect(useCallback(() => {
    void getDevProjects(user?.id ?? '').then((p) => {
      setProjects(p);
      if (p.length > 0 && !selected) {
        const first = p[0];
        setSelected(first);
        setCopyText(generateCopy(first, copyLang));
      }
    });
  }, [user?.id]));

  const selectProject = (p: DeveloperProject) => {
    setSelected(p);
    setCopyText(generateCopy(p, copyLang));
    setCopied(false);
  };

  const toggleLang = (lang: 'en' | 'ur') => {
    setCopyLang(lang);
    if (selected) setCopyText(generateCopy(selected, lang));
    setCopied(false);
  };

  const regenerate = () => {
    if (selected) { setCopyText(generateCopy(selected, copyLang)); setCopied(false); }
  };

  // ── Share handlers ─────────────────────────────────────────────────────
  const shareWhatsApp = async () => {
    if (!copyText) return;
    const encoded = encodeURIComponent(copyText);
    const url = `https://wa.me/?text=${encoded}`;
    const can = await Linking.canOpenURL(url);
    if (can) { await Linking.openURL(url); }
    else { Alert.alert('WhatsApp not installed', 'Please install WhatsApp to use this option.'); }
  };

  const shareFacebook = async () => {
    const url = 'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Foglandmark.com';
    await Linking.openURL(url);
  };

  const shareNative = async () => {
    if (!selected || !copyText) return;
    try {
      await Share.share({
        message: copyText,
        title: selected.name,
      });
    } catch {
      Alert.alert('Share failed', 'Could not open share sheet.');
    }
  };

  const copyToClipboard = async () => {
    if (!copyText) return;
    try {
      // Use Share as clipboard fallback (works everywhere without extra package)
      await Share.share({ message: copyText });
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      /* dismissed */
    }
  };

  const tipData = [
    { icon: 'message-circle' as const, color: '#25d366', text: tr('promoteTip1') },
    { icon: 'facebook'        as const, color: '#1877f2', text: tr('promoteTip2') },
    { icon: 'users'           as const, color: '#c8a45a', text: tr('promoteTip3') },
  ];

  return (
    <View style={[pr.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad + 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ───────────────────────────────────── */}
        <AnimatedReveal>
          <View style={[pr.header, { paddingTop: topPad + 12, paddingHorizontal: 20 }]}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={[pr.backBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[pr.eyebrow, { color: colors.action }]}>DEVELOPER PORTAL</Text>
              <Text style={[pr.title, { color: colors.foreground }]}>{tr('promoteScreenTitle')}</Text>
            </View>
          </View>
          <Text style={[pr.subtitle, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 4, marginBottom: 20 }]}>
            {tr('promoteScreenSubtitle')}
          </Text>
        </AnimatedReveal>

        {/* ── Project selector ─────────────────────────── */}
        <AnimatedReveal delay={50}>
          <Text style={[pr.sectionLabel, { color: colors.mutedForeground, paddingHorizontal: 20, marginBottom: 10 }]}>
            {tr('promoteSelectProject')}
          </Text>
          {projects.length === 0 ? (
            <View style={[pr.emptyProj, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 20 }]}>
              <Feather name="layers" size={22} color={colors.mutedForeground} />
              <Text style={[pr.emptyProjText, { color: colors.mutedForeground }]}>{tr('promoteNoProjects')}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {projects.map((p) => {
                const active = selected?.id === p.id;
                return (
                  <Pressable key={p.id} onPress={() => selectProject(p)}
                    style={[pr.projChip, {
                      backgroundColor: active ? colors.action : colors.card,
                      borderColor: active ? colors.action : colors.border,
                    }]}>
                    <View style={[pr.projChipDot, { backgroundColor: active ? '#c8a45a' : colors.mutedForeground }]} />
                    <View>
                      <Text style={[pr.projChipName, { color: active ? '#ffffff' : colors.foreground }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={[pr.projChipType, { color: active ? '#ffffffaa' : colors.mutedForeground }]}>{p.type}</Text>
                    </View>
                    {active && <Feather name="check-circle" size={14} color="#c8a45a" style={{ marginLeft: 6 }} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </AnimatedReveal>

        {selected ? (
          <>
            {/* ── Promotional card preview ─────────────── */}
            <AnimatedReveal delay={100}>
              <Text style={[pr.sectionLabel, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 24, marginBottom: 12 }]}>
                {tr('promotePreviewLabel')}
              </Text>
              <View style={{ paddingHorizontal: 20 }}>
                <PromoCard p={selected} colors={colors} />
              </View>
            </AnimatedReveal>

            {/* ── Share buttons ─────────────────────────── */}
            <AnimatedReveal delay={150}>
              <Text style={[pr.sectionLabel, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 24, marginBottom: 12 }]}>
                {tr('promoteShareOn')}
              </Text>
              <View style={{ paddingHorizontal: 20, flexDirection: 'row', gap: 10 }}>
                <PlatformBtn
                  icon="message-circle" label={tr('promoteShareWhatsApp')}
                  bg="#25d36618" fg="#25d366"
                  onPress={() => { void shareWhatsApp(); }}
                />
                <PlatformBtn
                  icon="facebook" label={tr('promoteShareFacebook')}
                  bg="#1877f218" fg="#1877f2"
                  onPress={() => { void shareFacebook(); }}
                />
                <PlatformBtn
                  icon="share-2" label={tr('promoteShareMore')}
                  bg={colors.secondary} fg={colors.foreground}
                  onPress={() => { void shareNative(); }}
                />
              </View>
            </AnimatedReveal>

            {/* ── Marketing copy ────────────────────────── */}
            <AnimatedReveal delay={180}>
              <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
                {/* Label row */}
                <View style={pr.copyLabelRow}>
                  <Text style={[pr.sectionLabel, { color: colors.mutedForeground }]}>{tr('promoteCopyLabel')}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    {/* Lang toggle */}
                    <View style={[pr.langToggle, { backgroundColor: colors.secondary }]}>
                      {(['en', 'ur'] as const).map((l) => (
                        <Pressable key={l} onPress={() => toggleLang(l)}
                          style={[pr.langBtn, { backgroundColor: copyLang === l ? colors.action : 'transparent' }]}>
                          <Text style={[pr.langBtnText, { color: copyLang === l ? '#ffffff' : colors.mutedForeground }]}>
                            {l === 'en' ? tr('promoteLangEN') : tr('promoteLangUR')}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {/* Regenerate */}
                    <Pressable onPress={regenerate}
                      style={[pr.regenBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <Feather name="refresh-cw" size={12} color={colors.mutedForeground} />
                      <Text style={[pr.regenText, { color: colors.mutedForeground }]}>{tr('promoteRefreshCopy')}</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Copy textarea */}
                <View style={[pr.copyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput
                    value={copyText}
                    onChangeText={setCopyText}
                    multiline
                    textAlignVertical="top"
                    style={[pr.copyInput, { color: colors.foreground, textAlign: copyLang === 'ur' ? 'right' : 'left' }]}
                    placeholderTextColor={colors.mutedForeground + '77'}
                  />
                  {/* Copy button overlay */}
                  <Pressable
                    onPress={() => { void copyToClipboard(); }}
                    style={[pr.copyBtn, { backgroundColor: copied ? '#1a6b3a' : colors.action }]}
                  >
                    <Feather name={copied ? 'check' : 'copy'} size={13} color="#ffffff" />
                    <Text style={pr.copyBtnText}>{copied ? tr('promoteCopied') : tr('promoteCopyText')}</Text>
                  </Pressable>
                </View>

                {/* Quick-send to WhatsApp button */}
                <Pressable
                  onPress={() => { void shareWhatsApp(); }}
                  style={[pr.whatsappSend, { backgroundColor: '#25d366' }]}
                >
                  <Feather name="message-circle" size={16} color="#ffffff" />
                  <Text style={pr.whatsappSendText}>Send via WhatsApp</Text>
                  <Feather name="arrow-up-right" size={14} color="#ffffff" style={{ marginLeft: 'auto' }} />
                </Pressable>
              </View>
            </AnimatedReveal>

            {/* ── Reach tips ───────────────────────────── */}
            <AnimatedReveal delay={220}>
              <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
                <Text style={[pr.sectionLabel, { color: colors.mutedForeground, marginBottom: 12 }]}>{tr('promoteTipsLabel')}</Text>
                <View style={[pr.tipsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {tipData.map((t, i) => (
                    <View key={i} style={[pr.tipRow, i < tipData.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                      <View style={[pr.tipIcon, { backgroundColor: t.color + '18' }]}>
                        <Feather name={t.icon} size={14} color={t.color} />
                      </View>
                      <Text style={[pr.tipText, { color: colors.mutedForeground }]}>{t.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </AnimatedReveal>
          </>
        ) : (
          projects.length > 0 && (
            <AnimatedReveal delay={80}>
              <View style={[pr.selectHint, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 20, marginTop: 20 }]}>
                <Feather name="arrow-up" size={20} color={colors.mutedForeground} />
                <Text style={[pr.selectHintText, { color: colors.mutedForeground }]}>{tr('promoteNoProjectSelected')}</Text>
              </View>
            </AnimatedReveal>
          )
        )}
      </ScrollView>
    </View>
  );
}

const pr = StyleSheet.create({
  screen:        { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center' },
  backBtn:       { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow:       { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title:         { fontFamily: 'Inter_700Bold', fontSize: 22 },
  subtitle:      { fontFamily: 'Inter_400Regular', fontSize: 12 },
  sectionLabel:  { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5 },
  emptyProj:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 16 },
  emptyProjText: { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },
  projChip:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, maxWidth: 200 },
  projChipDot:   { width: 7, height: 7, borderRadius: 4 },
  projChipName:  { fontFamily: 'Inter_700Bold', fontSize: 13, maxWidth: 130 },
  projChipType:  { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 1 },
  copyLabelRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 },
  langToggle:    { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', padding: 3 },
  langBtn:       { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  langBtnText:   { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  regenBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  regenText:     { fontFamily: 'Inter_500Medium', fontSize: 11 },
  copyBox:       { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  copyInput:     { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 21, padding: 14, minHeight: 180 },
  copyBtn:       { flexDirection: 'row', alignItems: 'center', gap: 7, margin: 12, marginTop: 0, borderRadius: 12, paddingVertical: 12, justifyContent: 'center' },
  copyBtnText:   { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#ffffff' },
  whatsappSend:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 18, marginTop: 10 },
  whatsappSendText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' },
  tipsCard:      { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  tipRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  tipIcon:       { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipText:       { fontFamily: 'Inter_400Regular', fontSize: 12, flex: 1, lineHeight: 18 },
  selectHint:    { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center', gap: 10, borderStyle: 'dashed' },
  selectHintText:{ fontFamily: 'Inter_500Medium', fontSize: 13, textAlign: 'center' },
});
