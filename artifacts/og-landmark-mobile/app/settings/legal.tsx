import React, { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { useColors } from '@/hooks/useColors';
import { BrandMark } from '@/components/BrandMark';

type Section = 'about' | 'legal' | 'security';
type LegalTab = 'terms' | 'privacy';

const EFFECTIVE_DATE = 'September 6, 2026';

function BulletList({
  items,
  colors,
}: {
  items: string[];
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.bulletList}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionCard({
  icon,
  eyebrow,
  title,
  children,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <AnimatedReveal>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: colors.accent }]}>
            <Feather name={icon} size={17} color={colors.accentForeground} />
          </View>
          <View style={styles.cardHeaderCopy}>
            {eyebrow ? <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{eyebrow}</Text> : null}
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
          </View>
        </View>
        {children}
      </View>
    </AnimatedReveal>
  );
}

function Paragraph({ children, colors }: { children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return <Text style={[styles.body, { color: colors.mutedForeground }]}>{children}</Text>;
}

function LegalDocument({
  tab,
  onTabChange,
  colors,
}: {
  tab: LegalTab;
  onTabChange: (tab: LegalTab) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const isTerms = tab === 'terms';
  return (
    <>
      <View style={[styles.tabRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        {([
          ['terms', 'Terms of Use', 'file-text'],
          ['privacy', 'Privacy Policy', 'lock'],
        ] as const).map(([value, label, icon]) => {
          const selected = tab === value;
          return (
            <Pressable
              key={value}
              onPress={() => onTabChange(value)}
              style={[
                styles.tab,
                selected && { backgroundColor: colors.card, borderColor: colors.selectionBorder },
              ]}
            >
              <Feather name={icon} size={14} color={selected ? colors.selectionForeground : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: selected ? colors.selectionForeground : colors.mutedForeground, fontWeight: selected ? '600' : '400' }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.updated, { backgroundColor: colors.selectionTint, borderColor: colors.selectionBorder }]}>
        <Feather name="calendar" size={13} color={colors.selectionForeground} />
        <Text style={[styles.updatedText, { color: colors.selectionForeground }]}>
          Effective {EFFECTIVE_DATE}
        </Text>
      </View>

      {isTerms ? (
        <>
          <SectionCard icon="briefcase" eyebrow="01" title="Using OG Landmark" colors={colors}>
            <Paragraph colors={colors}>
              OG Landmark is a digital real-estate platform for discovering properties, publishing listings, connecting with agents and developers, and arranging property visits. The platform supports buyers, sellers, agents, developers, and administrators.
            </Paragraph>
            <Paragraph colors={colors}>
              Property information is provided by listing owners or authorised representatives. OG Landmark helps facilitate discovery and communication; it is not a party to a property sale, lease, payment, or transfer.
            </Paragraph>
          </SectionCard>

          <SectionCard icon="user-check" eyebrow="02" title="Account responsibilities" colors={colors}>
            <Paragraph colors={colors}>You agree to provide accurate information, keep your login details private, and use the platform lawfully and respectfully.</Paragraph>
            <BulletList colors={colors} items={[
              'Do not impersonate another person or create misleading accounts.',
              'Do not upload false, fraudulent, unlawful, or duplicate listings.',
              'Do not use the platform to harass, spam, scrape, or collect another person’s data.',
              'Tell OG Landmark promptly if you believe your account has been compromised.',
            ]} />
          </SectionCard>

          <SectionCard icon="check-square" eyebrow="03" title="Property and transaction guidance" colors={colors}>
            <Paragraph colors={colors}>
              Buyers should personally inspect a property and independently verify ownership, title, approvals, taxes, utilities, and other documents before making an offer or payment.
            </Paragraph>
            <Paragraph colors={colors}>
              Sellers and agents are responsible for the accuracy of their listings and for responding professionally to enquiries. Never transfer money solely because information appears on the platform.
            </Paragraph>
          </SectionCard>

          <SectionCard icon="shield" eyebrow="04" title="Content, moderation, and availability" colors={colors}>
            <Paragraph colors={colors}>
              We may review, limit, suspend, or remove content and accounts that violate these terms, create risk for users, or conflict with applicable law. We work to keep the platform reliable, but some features may be unavailable during maintenance or due to factors outside our control.
            </Paragraph>
          </SectionCard>

          <SectionCard icon="book-open" eyebrow="05" title="Important limitation" colors={colors}>
            <Paragraph colors={colors}>
              OG Landmark does not provide legal, tax, valuation, lending, or investment advice. Please consult qualified professionals for decisions involving property documents, financing, taxes, or contracts. Use of the platform is subject to applicable laws of Pakistan.
            </Paragraph>
          </SectionCard>
        </>
      ) : (
        <>
          <SectionCard icon="database" eyebrow="01" title="Information we collect" colors={colors}>
            <Paragraph colors={colors}>Depending on how you use the app, we may collect:</Paragraph>
            <BulletList colors={colors} items={[
              'Account details such as name, email, phone number, role, and verification information.',
              'Property listings, photos, documents, saved searches, calculator history, enquiries, and scheduled visits.',
              'Device and technical information needed to keep sessions, notifications, and security features working.',
              'Optional location information when you choose location-based discovery or map features.',
            ]} />
          </SectionCard>

          <SectionCard icon="activity" eyebrow="02" title="How we use information" colors={colors}>
            <Paragraph colors={colors}>We use information to provide and improve OG Landmark, including:</Paragraph>
            <BulletList colors={colors} items={[
              'Creating and securing your account and personalising your experience.',
              'Showing relevant properties, connecting enquiries, and coordinating visits.',
              'Sending service messages, account alerts, listing updates, and notifications you allow.',
              'Detecting abuse, protecting users, troubleshooting, and meeting legal obligations.',
            ]} />
          </SectionCard>

          <SectionCard icon="share-2" eyebrow="03" title="When information is shared" colors={colors}>
            <Paragraph colors={colors}>
              We share only what is needed to operate the requested service. For example, an enquiry may include your name and contact details with the relevant seller, agent, or developer. We may also use trusted providers for hosting, email delivery, notifications, and security.
            </Paragraph>
            <Paragraph colors={colors}>
              We do not sell personal information for advertising. We may disclose information when required by law, to protect users, or as part of a genuine business transfer.
            </Paragraph>
          </SectionCard>

          <SectionCard icon="clock" eyebrow="04" title="Retention and your choices" colors={colors}>
            <Paragraph colors={colors}>
              We retain information only as long as reasonably needed for the service, security, dispute handling, legal requirements, or a legitimate business purpose. You can update account details, manage optional permissions, and request account deletion through the app or support.
            </Paragraph>
            <Pressable onPress={() => Linking.openURL('mailto:support@oglandmark.pk')} style={[styles.inlineAction, { borderColor: colors.selectionBorder, backgroundColor: colors.selectionTint }]}>
              <Feather name="mail" size={14} color={colors.selectionForeground} />
              <Text style={[styles.inlineActionText, { color: colors.selectionForeground }]}>Contact privacy support</Text>
            </Pressable>
          </SectionCard>

          <SectionCard icon="lock" eyebrow="05" title="Security" colors={colors}>
            <Paragraph colors={colors}>
              We use reasonable technical and organisational safeguards, including secure connections, protected sessions, access controls, password hashing, and additional verification for sensitive administration features. No internet service can promise absolute security, so please protect your password and verification codes.
            </Paragraph>
          </SectionCard>
        </>
      )}
    </>
  );
}

function AboutContent({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <>
      <AnimatedReveal>
        <View style={[styles.aboutHero, { backgroundColor: colors.action }]}>
          <View style={[styles.aboutMark, { backgroundColor: colors.accent }]}>
            <Feather name="home" size={23} color={colors.accentForeground} />
          </View>
          <Text style={styles.aboutHeroTitle}>Property, with perspective.</Text>
          <Text style={styles.aboutHeroBody}>A clearer way to discover, list, and move forward with property in Pakistan.</Text>
          <View style={styles.aboutMeta}>
            <Text style={styles.aboutMetaText}>OG LANDMARK</Text>
            <Text style={styles.aboutMetaText}>VERSION 1.0</Text>
          </View>
        </View>
      </AnimatedReveal>

      <SectionCard icon="compass" eyebrow="OUR PERSPECTIVE" title="A more considered property platform" colors={colors}>
        <Paragraph colors={colors}>
          OG Landmark brings buyers, property owners, agents, and developers together through one trusted digital experience. We focus on clear information, practical tools, and responsive communication so people can make better-informed property decisions.
        </Paragraph>
        <Paragraph colors={colors}>
          Our roots are in Okara District and the wider Punjab region, with a platform built to support homes, land, commercial spaces, and development projects.
        </Paragraph>
      </SectionCard>

      <SectionCard icon="layers" eyebrow="WHAT YOU CAN DO" title="Everything important, in one place" colors={colors}>
        <BulletList colors={colors} items={[
          'Explore residential, agricultural, commercial, and development listings.',
          'Publish and manage property listings with photos, details, and documents.',
          'Save searches, shortlist properties, send enquiries, and schedule visits.',
          'Use practical land and property calculators for early-stage planning.',
          'Stay informed through account updates, notifications, and support.',
        ]} />
      </SectionCard>

      <SectionCard icon="star" eyebrow="OUR PRINCIPLES" title="What we stand for" colors={colors}>
        <View style={styles.principleGrid}>
          {[
            ['shield', 'Integrity', 'Clearer information and responsible platform use.'],
            ['eye', 'Transparency', 'Straightforward details without hidden promises.'],
            ['zap', 'Useful technology', 'Tools that make property decisions simpler.'],
            ['users', 'Community', 'A platform designed around real local needs.'],
          ].map(([icon, title, body]) => (
            <View key={title} style={[styles.principle, { backgroundColor: colors.secondary }]}>
              <Feather name={icon as keyof typeof Feather.glyphMap} size={15} color={colors.action} />
              <Text style={[styles.principleTitle, { color: colors.foreground }]}>{title}</Text>
              <Text style={[styles.principleBody, { color: colors.mutedForeground }]}>{body}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <View style={[styles.disclaimer, { backgroundColor: colors.selectionTint, borderColor: colors.border }]}>
        <Feather name="info" size={15} color={colors.selectionForeground} />
        <Text style={[styles.disclaimerText, { color: colors.selectionForeground }]}>
          OG Landmark is a platform for property discovery and communication. Always complete your own legal and financial due diligence before committing to a transaction.
        </Text>
      </View>
    </>
  );
}

function SecurityContent({ colors, router }: { colors: ReturnType<typeof useColors>; router: ReturnType<typeof useRouter> }) {
  return (
    <>
      <AnimatedReveal>
        <View style={[styles.securityHero, { backgroundColor: colors.action }]}>
          <View style={[styles.securityIcon, { backgroundColor: colors.accent }]}>
            <Feather name="shield" size={24} color={colors.accentForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.securityTitle}>Your account, protected</Text>
            <Text style={styles.securityBody}>Practical controls and clear guidance for your OG Landmark account.</Text>
          </View>
        </View>
      </AnimatedReveal>

      <SectionCard icon="lock" eyebrow="OUR APPROACH" title="Security built into the experience" colors={colors}>
        <BulletList colors={colors} items={[
          'Secure connections help protect information in transit.',
          'Passwords are stored using one-way cryptographic protection.',
          'Account sessions use access controls and can be ended by signing out.',
          'Sensitive administrative access includes additional verification.',
          'Abuse and suspicious activity may be reviewed to protect the community.',
        ]} />
      </SectionCard>

      <SectionCard icon="key" eyebrow="YOUR ACCOUNT" title="Keep your access secure" colors={colors}>
        <BulletList colors={colors} items={[
          'Use a strong, unique password and never share it or an OTP.',
          'Sign out on devices you no longer use.',
          'Only upload documents and contact details needed for your property journey.',
          'Contact support immediately if you see activity you do not recognise.',
        ]} />
        <Pressable onPress={() => router.push('/settings/account' as any)} style={[styles.inlineAction, { borderColor: colors.selectionBorder, backgroundColor: colors.selectionTint }]}>
          <Feather name="settings" size={14} color={colors.selectionForeground} />
          <Text style={[styles.inlineActionText, { color: colors.selectionForeground }]}>Manage account settings</Text>
        </Pressable>
      </SectionCard>

      <SectionCard icon="sliders" eyebrow="YOUR CHOICES" title="Control your data and permissions" colors={colors}>
        <Paragraph colors={colors}>
          You choose whether to use optional location features and whether to allow notifications. You can update your profile, review saved content, remove local history, or request account deletion from the relevant account controls.
        </Paragraph>
        <View style={styles.controlRows}>
          {[
            ['bell', 'Notifications', 'Manage alerts from Profile settings.'],
            ['map-pin', 'Location', 'Used only when you choose location-based tools.'],
            ['trash-2', 'Account deletion', 'Request permanent removal through account controls.'],
          ].map(([icon, title, body]) => (
            <View key={title} style={[styles.controlRow, { borderTopColor: colors.border }]}>
              <Feather name={icon as keyof typeof Feather.glyphMap} size={16} color={colors.action} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.controlTitle, { color: colors.foreground }]}>{title}</Text>
                <Text style={[styles.controlBody, { color: colors.mutedForeground }]}>{body}</Text>
              </View>
            </View>
          ))}
        </View>
      </SectionCard>

      <View style={[styles.contactCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="help-circle" size={18} color={colors.action} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.contactTitle, { color: colors.foreground }]}>Need help with privacy or security?</Text>
          <Text style={[styles.contactBody, { color: colors.mutedForeground }]}>Our support team can help with account access and data requests.</Text>
        </View>
        <Pressable onPress={() => Linking.openURL('mailto:support@oglandmark.pk')} hitSlop={8}>
          <Feather name="arrow-up-right" size={17} color={colors.action} />
        </Pressable>
      </View>
    </>
  );
}

export default function LegalScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ section?: string }>();
  const section: Section = params.section === 'security' || params.section === 'legal' ? params.section : 'about';
  const [legalTab, setLegalTab] = useState<LegalTab>('terms');
  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const title = section === 'about' ? 'About OG Landmark' : section === 'security' ? 'Privacy & Security' : 'Terms & Privacy';
  const subtitle = section === 'about'
    ? 'Our platform, purpose, and principles'
    : section === 'security'
      ? 'Clear guidance for your account and data'
      : 'The rules and privacy choices behind the platform';

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: insets.bottom + 34, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <AnimatedReveal>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.secondary, borderColor: colors.border }]} hitSlop={8}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerEyebrow, { color: colors.mutedForeground }]}>OG LANDMARK</Text>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
          </View>
          <View style={[styles.headerMark, { backgroundColor: colors.accent }]}>
            <Feather name={section === 'about' ? 'info' : section === 'security' ? 'shield' : 'file-text'} size={17} color={colors.accentForeground} />
          </View>
        </View>
      </AnimatedReveal>

      {section === 'about' ? <AboutContent colors={colors} /> : null}
      {section === 'security' ? <SecurityContent colors={colors} router={router} /> : null}
      {section === 'legal' ? <LegalDocument tab={legalTab} onTabChange={setLegalTab} colors={colors} /> : null}

      <View style={styles.footer}>
        <BrandMark />
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Clearer property decisions.</Text>
        <Text style={[styles.footerMeta, { color: colors.mutedForeground }]}>© 2026 OG Landmark · Effective {EFFECTIVE_DATE}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.6, marginBottom: 3 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5 },
  headerSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 4 },
  headerMark: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  aboutHero: { borderRadius: 22, padding: 20, marginBottom: 14 },
  aboutMark: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  aboutHeroTitle: { color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.3 },
  aboutHeroBody: { color: '#ffffffb8', fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 7, maxWidth: 300 },
  aboutMeta: { flexDirection: 'row', gap: 18, marginTop: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#ffffff28' },
  aboutMetaText: { color: '#ffffffa8', fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 13 },
  cardIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardHeaderCopy: { flex: 1 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.3, marginBottom: 3 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginBottom: 11 },
  bulletList: { gap: 9, marginTop: 2, marginBottom: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  tabRow: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4, marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', paddingVertical: 10, paddingHorizontal: 5 },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  updated: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  updatedText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  inlineAction: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginTop: 2 },
  inlineActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  principleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  principle: { width: '48%', borderRadius: 12, padding: 11, minHeight: 94 },
  principleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 8 },
  principleBody: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 3 },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1, borderRadius: 15, padding: 13, marginBottom: 5 },
  disclaimerText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 17 },
  securityHero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 17, marginBottom: 14 },
  securityIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  securityTitle: { color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 17 },
  securityBody: { color: '#ffffffb8', fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 4 },
  controlRows: { marginTop: 3 },
  controlRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderTopWidth: 1, paddingVertical: 11 },
  controlTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  controlBody: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 2 },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  contactTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  contactBody: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 3 },
  footer: { alignItems: 'center', gap: 6, paddingTop: 14, paddingBottom: 10 },
  footerText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  footerMeta: { fontFamily: 'Inter_400Regular', fontSize: 9 },
});