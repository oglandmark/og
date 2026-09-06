import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { useLanguage } from '@/context/LanguageContext';
import type { Role } from '@/context/AuthContext';

type RoleCard = {
  role: Role;
  icon: keyof typeof Feather.glyphMap;
  titleKey: 'buyerTitle' | 'agentTitle' | 'developerTitle';
  subtitleKey: 'buyerTitleUrdu' | 'agentTitleUrdu' | 'developerTitleUrdu';
  descKey: 'buyerDesc' | 'agentDesc' | 'developerDesc';
  points: [string, string, string, string];
};

// Agent / Developer accounts are created by admin — only Buyer self-registration
const roles: RoleCard[] = [
  {
    role: 'buyer', icon: 'home',
    titleKey: 'buyerTitle', subtitleKey: 'buyerTitleUrdu', descKey: 'buyerDesc',
    points: ['buyerP1', 'buyerP2', 'buyerP3', 'buyerP4'],
  },
];

export default function SelectRoleScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tr, isRTL } = useLanguage();
  const [selected, setSelected] = useState<Role | null>(null);

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const handleContinue = () => {
    if (!selected) return;
    router.push('/onboarding/register-buyer');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: botPad + 100, paddingHorizontal: 20 }}
      >
        <AnimatedReveal>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.eyebrow, { color: colors.primary, textAlign: isRTL ? 'right' : 'left' }]}>
            {tr('roleSelectionEyebrow')}
          </Text>
          <Text style={[styles.title, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
            {tr('roleSelectionTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
            {tr('roleSelectionSub')}
          </Text>
        </AnimatedReveal>

        <View style={styles.cards}>
          {roles.map((item, idx) => {
            const isSelected = selected === item.role;
            return (
              <AnimatedReveal key={item.role} delay={100 + idx * 70}>
                <Pressable
                  onPress={() => setSelected(item.role)}
                  style={[styles.card, {
                     backgroundColor: isSelected ? colors.selectionBackground : colors.card,
                     borderColor: isSelected ? colors.selectionBorder : colors.border,
                     borderWidth: isSelected ? 2 : 1,
                  }]}
                >
                  <View style={styles.cardTop}>
                     <View style={[styles.iconWrap, { backgroundColor: isSelected ? colors.selectionTint : colors.secondary }]}>
                       <Feather name={item.icon} size={22} color={isSelected ? colors.selectionForeground : colors.action} />
                    </View>
                    <View style={styles.cardTitles}>
                       <Text style={[styles.cardTitle, { color: isSelected ? colors.selectionForeground : colors.foreground, fontWeight: isSelected ? '600' : '500' }]}>
                        {tr(item.titleKey)}
                      </Text>
                       <Text style={[styles.cardUrdu, { color: isSelected ? colors.selectionForeground : colors.mutedForeground }]}>
                        {tr(item.subtitleKey)}
                      </Text>
                    </View>
                    <View style={[styles.radio, {
                       borderColor: isSelected ? colors.selectionBorder : colors.border,
                       backgroundColor: isSelected ? colors.selectionTint : 'transparent',
                    }]}>
                       {isSelected && <View style={[styles.radioDot, { backgroundColor: colors.selectionForeground }]} />}
                    </View>
                  </View>
                   <Text style={[styles.cardDesc, { color: isSelected ? colors.selectionForeground : colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
                    {tr(item.descKey)}
                  </Text>
                  <View style={styles.points}>
                    {item.points.map((pk) => (
                      <View key={pk} style={[styles.pointRow, isRTL && { flexDirection: 'row-reverse' }]}>
                         <Feather name="check" size={12} color={isSelected ? colors.selectionForeground : colors.action} />
                         <Text style={[styles.pointText, { color: isSelected ? colors.selectionForeground : colors.mutedForeground }]}>
                          {tr(pk as Parameters<typeof tr>[0])}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Pressable>
              </AnimatedReveal>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: botPad + 16, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Pressable
          onPress={handleContinue} disabled={!selected}
          style={({ pressed }) => [styles.continueBtn, {
            backgroundColor: selected ? colors.action : colors.muted,
            opacity: pressed ? 0.88 : 1,
          }]}
        >
          <Text style={[styles.continueBtnText, { color: selected ? colors.actionForeground : colors.mutedForeground }]}>
            {tr('roleSelectionBtn')}
          </Text>
          <Feather name={isRTL ? 'arrow-left' : 'arrow-right'} size={18} color={selected ? colors.actionForeground : colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.5, marginBottom: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 26, lineHeight: 33, letterSpacing: -0.4, marginBottom: 10 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginBottom: 28 },
  cards: { gap: 12 },
  card: { borderRadius: 18, borderWidth: 1.5, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitles: { flex: 1 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 2 },
  cardUrdu: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  cardDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  points: { gap: 6 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  continueBtn: { height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  continueBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
});
