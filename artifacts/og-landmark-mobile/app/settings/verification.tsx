import React from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';

type Step = {
  id: number;
  title: string;
  desc: string;
  icon: keyof typeof Feather.glyphMap;
  status: 'done' | 'pending' | 'todo';
};

export default function VerificationScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const status = user?.verificationStatus ?? 'pending';
  const isVerified = status === 'verified';

  const steps: Step[] = [
    {
      id: 1,
      title: 'Account Created',
      desc: 'Your OG Landmark account was created successfully.',
      icon: 'user-check',
      status: 'done',
    },
    {
      id: 2,
      title: 'Phone Verification',
      desc: 'Verify your mobile number via OTP.',
      icon: 'smartphone',
      status: 'done',
    },
    {
      id: 3,
      title: 'CNIC Submission',
      desc: 'Your CNIC was submitted for identity verification.',
      icon: 'credit-card',
      status: user?.cnic ? 'done' : 'pending',
    },
    {
      id: 4,
      title: 'Admin Review',
      desc: isVerified
        ? 'Your account has been reviewed and approved.'
        : 'Our team is reviewing your documents. This typically takes 24–48 hours.',
      icon: 'shield',
      status: isVerified ? 'done' : 'pending',
    },
    {
      id: 5,
      title: 'Account Activated',
      desc: isVerified
        ? 'Your agent account is fully active. You can post listings and manage leads.'
        : 'Your account will be fully activated once admin review is complete.',
      icon: 'check-circle',
      status: isVerified ? 'done' : 'todo',
    },
  ];

  const stepColors: Record<Step['status'], string> = {
    done:    '#059669',
    pending: '#d97706',
    todo:    '#9ca3af',
  };

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
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>ACCOUNT</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Verification Status</Text>
          </View>
        </View>
      </AnimatedReveal>

      {/* Status card */}
      <AnimatedReveal delay={60}>
        <View style={[
          styles.statusCard,
          {
            backgroundColor: isVerified ? '#05966918' : '#f59e0b18',
            borderColor: isVerified ? '#05966944' : '#f59e0b44',
          },
        ]}>
          <View style={[styles.statusIcon, { backgroundColor: isVerified ? '#05966922' : '#f59e0b22' }]}>
            <Feather name={isVerified ? 'check-circle' : 'clock'} size={28} color={isVerified ? '#059669' : '#d97706'} />
          </View>
          <Text style={[styles.statusTitle, { color: isVerified ? '#059669' : '#d97706' }]}>
            {isVerified ? 'Account Verified' : 'Verification Pending'}
          </Text>
          <Text style={[styles.statusDesc, { color: colors.mutedForeground }]}>
            {isVerified
              ? 'Your agent account is fully verified. You can post listings, manage leads, and access all features.'
              : 'Your documents are under review. Our team will activate your account within 24–48 hours of submission.'}
          </Text>
          <View style={[styles.statusBadge, {
            backgroundColor: isVerified ? '#059669' : '#f59e0b',
          }]}>
            <Text style={styles.statusBadgeText}>
              {isVerified ? '✓ VERIFIED' : '⏳ UNDER REVIEW'}
            </Text>
          </View>
        </View>
      </AnimatedReveal>

      {/* Steps */}
      <AnimatedReveal delay={100}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>VERIFICATION STEPS</Text>
        <View style={[styles.stepsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {steps.map((step, i) => {
            const c = stepColors[step.status];
            return (
              <View key={step.id}>
                {i > 0 && (
                  <View style={[styles.stepConnector, { backgroundColor: i <= steps.findIndex(s => s.status !== 'done') ? colors.border : '#059669' }]} />
                )}
                <View style={styles.stepRow}>
                  <View style={styles.stepLeft}>
                    <View style={[styles.stepCircle, { backgroundColor: c + '1a', borderColor: c }]}>
                      <Feather name={step.status === 'done' ? 'check' : step.icon} size={14} color={c} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.stepTitleRow}>
                      <Text style={[styles.stepTitle, { color: colors.foreground }]}>{step.title}</Text>
                      {step.status === 'pending' && (
                        <View style={[styles.pendingChip, { backgroundColor: '#f59e0b18' }]}>
                          <Text style={[styles.pendingChipText, { color: '#d97706' }]}>In Progress</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>{step.desc}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </AnimatedReveal>

      {/* What to do section */}
      {!isVerified && (
        <AnimatedReveal delay={140}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>WHAT TO DO NEXT</Text>
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { icon: 'clock' as const, text: 'Wait 24–48 hours for admin review after submission.' },
              { icon: 'bell' as const, text: 'You will receive a notification when your account is activated.' },
              { icon: 'message-circle' as const, text: 'If 48 hours have passed, contact support via WhatsApp.' },
            ].map((item, i) => (
              <View key={i} style={[styles.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[styles.infoIcon, { backgroundColor: colors.accent }]}>
                  <Feather name={item.icon} size={14} color={colors.accentForeground} />
                </View>
                <Text style={[styles.infoText, { color: colors.foreground }]}>{item.text}</Text>
              </View>
            ))}
          </View>
        </AnimatedReveal>
      )}

      {/* Contact support */}
      <AnimatedReveal delay={180}>
        <Pressable
          onPress={() => Linking.openURL('https://wa.me/923042569000?text=Hi%2C%20I%20need%20help%20with%20my%20OG%20Landmark%20agent%20verification.')}
          style={[styles.whatsappBtn, { backgroundColor: '#25d36618', borderColor: '#25d36633' }]}
        >
          <Feather name="message-circle" size={18} color="#25d366" />
          <View>
            <Text style={[styles.whatsappBtnTitle, { color: '#25d366' }]}>Contact Support via WhatsApp</Text>
            <Text style={[styles.whatsappBtnSub, { color: '#25d36699' }]}>OG Landmark support team · Usually replies in 1–2 hours</Text>
          </View>
        </Pressable>
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
  statusCard: { borderRadius: 20, borderWidth: 1, padding: 22, alignItems: 'center', gap: 12, marginBottom: 28 },
  statusIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statusTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.2 },
  statusDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  statusBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#ffffff', letterSpacing: 0.5 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 10 },
  stepsCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 24 },
  stepRow: { flexDirection: 'row', gap: 14, paddingVertical: 4 },
  stepLeft: { alignItems: 'center', width: 32 },
  stepConnector: { width: 2, height: 12, marginLeft: 15, marginVertical: 2 },
  stepCircle: { width: 32, height: 32, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' },
  stepTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  stepDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, paddingBottom: 4 },
  pendingChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pendingChipText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.4 },
  infoCard: { borderRadius: 18, borderWidth: 1, marginBottom: 22, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  infoIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  whatsappBtn: { borderRadius: 18, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  whatsappBtnTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  whatsappBtnSub: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
});
