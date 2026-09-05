import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { getMobileSettings } from '@/lib/api';

type FAQ = { q: string; a: string };

const FAQS: FAQ[] = [
  {
    q: 'How long does agent verification take?',
    a: 'Verification typically takes 24–48 hours after you submit your CNIC and contact details. Our team reviews applications during business hours (9am–6pm, Mon–Sat).',
  },
  {
    q: 'How do I post a property listing?',
    a: 'Tap the "Post an Ad" tab at the bottom of your screen. Fill in the property details, add photos, and submit. Your listing will appear immediately after submission.',
  },
  {
    q: 'Can I edit or delete my listing after posting?',
    a: 'Yes. Go to the Listings tab, find your listing, and tap Edit to update details or Delete to remove it. Changes take effect immediately.',
  },
  {
    q: 'How do I contact a lead?',
    a: 'Open the Leads tab, tap on any lead to expand it, then use the Call or WhatsApp buttons to contact them directly. You can also add notes and update their status.',
  },
  {
    q: 'What areas does OG Landmark cover?',
    a: 'We specialize in Okara District, including Okara City, Depalpur, Renala Khurd, Haveli Lakha, Dipalpur, and surrounding areas. We focus on residential, agricultural, and commercial properties.',
  },
  {
    q: 'How do I switch from English to Urdu?',
    a: 'Go to your Profile tab and tap Language, or go to Profile → Language. You can switch between English and Urdu at any time.',
  },
  {
    q: 'My account is not getting verified. What should I do?',
    a: 'If 48 hours have passed since registration, contact us via WhatsApp or call our support number. Please have your CNIC number ready for faster resolution.',
  },
  {
    q: 'Is OG Landmark free for agents?',
    a: 'Basic listings are free. Premium promotion packages to boost your listings to the top of search results are available at competitive rates. Contact us for pricing.',
  },
];

export default function HelpScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [content, setContent] = useState<any>(null);
  useEffect(() => {
    getMobileSettings().then((settings) => setContent(settings.content?.screens?.help)).catch(() => undefined);
  }, []);
  const faqList: FAQ[] = content?.faqs?.length ? content.faqs : FAQS;

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  const CONTACTS = [
    {
      icon: 'message-circle' as const,
      label: 'WhatsApp Support',
      sub: 'Chat with us · Usually responds in 1–2 hours',
      color: '#25d366',
      bg: '#25d36618',
      onPress: () => Linking.openURL('https://wa.me/923042569000?text=Hi%2C%20I%20need%20help%20with%20OG%20Landmark.'),
    },
    {
      icon: 'phone' as const,
      label: 'Call Support',
      sub: '+92 304 256 9000 · Mon–Sat, 9am–6pm',
      color: '#102a43',
      bg: colors.secondary,
      onPress: () => Linking.openURL('tel:+923042569000'),
    },
    {
      icon: 'mail' as const,
      label: 'Email Support',
      sub: 'support@oglandmark.pk · Reply within 24hrs',
      color: '#c8a45a',
      bg: '#c8a45a18',
      onPress: () => Linking.openURL('mailto:support@oglandmark.pk?subject=Support%20Request&body=Hi%20OG%20Landmark%2C%0A%0A'),
    },
  ];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <AnimatedReveal>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            hitSlop={8}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>SUPPORT</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Help & Support</Text>
          </View>
        </View>
      </AnimatedReveal>

      {/* Hero */}
      <AnimatedReveal delay={50}>
        <View style={[styles.heroCard, { backgroundColor: colors.action }]}>
          <View style={[styles.heroIcon, { backgroundColor: '#ffffff22' }]}>
            <Feather name="help-circle" size={26} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{content?.heroTitle || "We're here to help"}</Text>
            <Text style={styles.heroSub}>{content?.heroSubtitle || 'OG Landmark support team is available 6 days a week'}</Text>
          </View>
        </View>
      </AnimatedReveal>

      {/* Contact options */}
      <AnimatedReveal delay={80}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CONTACT US</Text>
        <View style={styles.contactList}>
          {CONTACTS.map((c, i) => (
            <AnimatedReveal key={c.label} delay={100 + i * 50}>
              <Pressable
                onPress={c.onPress}
                style={({ pressed }) => [
                  styles.contactCard,
                  { backgroundColor: c.bg, borderColor: c.color + '33', opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={[styles.contactIcon, { backgroundColor: c.color + '22' }]}>
                  <Feather name={c.icon} size={20} color={c.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactLabel, { color: c.color }]}>{c.label}</Text>
                  <Text style={[styles.contactSub, { color: c.color + '99' }]}>{c.sub}</Text>
                </View>
                <Feather name="external-link" size={14} color={c.color + '88'} />
              </Pressable>
            </AnimatedReveal>
          ))}
        </View>
      </AnimatedReveal>

      {/* FAQ */}
      <AnimatedReveal delay={200}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>FREQUENTLY ASKED QUESTIONS</Text>
        <View style={[styles.faqCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {faqList.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <View key={i}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <Pressable
                  onPress={() => setOpenFaq(isOpen ? null : i)}
                  style={styles.faqRow}
                >
                  <View style={[styles.faqNumBadge, { backgroundColor: isOpen ? colors.action : colors.secondary }]}>
                    <Text style={[styles.faqNum, { color: isOpen ? colors.actionForeground : colors.mutedForeground }]}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={[styles.faqQ, { color: colors.foreground, flex: 1 }]}>{faq.q}</Text>
                  <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                </Pressable>
                {isOpen && (
                  <View style={[styles.faqAnswer, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.faqA, { color: colors.foreground }]}>{faq.a}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </AnimatedReveal>

      {/* App info */}
      <AnimatedReveal delay={260}>
        <View style={[styles.appInfo, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.appInfoText, { color: colors.mutedForeground }]}>OG Landmark · Real Estate with Perspective</Text>
          <Text style={[styles.appInfoText, { color: colors.mutedForeground }]}>Okara District, Punjab, Pakistan</Text>
          <Text style={[styles.appInfoText, { color: colors.mutedForeground }]}>Version 1.0.0</Text>
        </View>
      </AnimatedReveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.3 },
  heroCard: { borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28 },
  heroIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#ffffff', marginBottom: 4 },
  heroSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#ffffffcc', lineHeight: 18 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 10 },
  contactList: { gap: 10, marginBottom: 28 },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1, padding: 16 },
  contactIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 3 },
  contactSub: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  faqCard: { borderRadius: 18, borderWidth: 1, marginBottom: 28, overflow: 'hidden' },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  faqNumBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  faqNum: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  faqQ: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19 },
  faqAnswer: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4 },
  faqA: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 21 },
  divider: { height: 1 },
  appInfo: { borderRadius: 14, borderWidth: 1, padding: 16, alignItems: 'center', gap: 4, marginBottom: 8 },
  appInfoText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
});
