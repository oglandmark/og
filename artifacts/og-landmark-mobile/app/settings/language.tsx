import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import type { Lang } from '@/lib/i18n';

const LANGUAGES: { code: Lang; name: string; native: string; script: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', name: 'English', native: 'English', script: 'A', dir: 'ltr' },
  { code: 'ur', name: 'Urdu', native: 'اردو', script: 'ا', dir: 'rtl' },
];

export default function LanguageSettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang, setLang } = useLanguage();
  const [selected, setSelected] = useState<Lang>(lang);
  const [saving, setSaving] = useState(false);

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  const handleSelect = async (code: Lang) => {
    if (saving) return;
    setSelected(code);
    setSaving(true);
    await setLang(code);
    setSaving(false);
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
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>SETTINGS</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{lang === 'ur' ? 'زبان' : 'Language'}</Text>
          </View>
        </View>
      </AnimatedReveal>

      {/* Active language pill */}
      <AnimatedReveal delay={50}>
        <View style={[styles.activeBanner, { backgroundColor: colors.action + '14', borderColor: colors.action + '44' }]}>
          <Feather name="globe" size={15} color={colors.action} />
          <Text style={[styles.activeBannerText, { color: colors.action }]}>
            {selected === 'en' ? 'English is the active language' : 'اردو فعال زبان ہے'}
          </Text>
          {saving && <Feather name="loader" size={13} color={colors.action} />}
        </View>
      </AnimatedReveal>

      {/* Language options */}
      <AnimatedReveal delay={100}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SELECT LANGUAGE</Text>
        <View style={[styles.optionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {LANGUAGES.map((lang, i) => {
            const isActive = selected === lang.code;
            return (
              <View key={lang.code}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <Pressable
                  onPress={() => void handleSelect(lang.code)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    isActive && { backgroundColor: colors.selectionTint, borderColor: colors.selectionBorder, borderWidth: 1.5 },
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  {/* Script icon */}
                  <View style={[styles.scriptBadge, {
                    backgroundColor: isActive ? colors.selectionBackground : colors.secondary,
                  }]}>
                    <Text style={[styles.scriptChar, {
                      color: isActive ? colors.selectionForeground : colors.mutedForeground,
                      fontFamily: lang.dir === 'rtl' ? 'Inter_400Regular' : 'Inter_700Bold',
                      fontSize: lang.dir === 'rtl' ? 22 : 18,
                    }]}>
                      {lang.script}
                    </Text>
                  </View>

                  {/* Text */}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.langName, { color: colors.foreground }]}>{lang.name}</Text>
                    <Text style={[styles.langNative, {
                      color: colors.mutedForeground,
                      textAlign: lang.dir === 'rtl' ? 'left' : 'left',
                    }]}>
                      {lang.native}
                    </Text>
                  </View>

                  {/* Check or radio */}
                  {isActive ? (
                    <View style={[styles.checkCircle, { backgroundColor: colors.action }]}>
                      <Feather name="check" size={13} color="#ffffff" />
                    </View>
                  ) : (
                    <View style={[styles.radioCircle, { borderColor: colors.border }]} />
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      </AnimatedReveal>

      {/* Info note */}
      <AnimatedReveal delay={160}>
        <View style={[styles.infoBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
             {lang === 'ur'
               ? 'زبان کی تبدیلی پوری ایپ پر فوراً لاگو ہوتی ہے۔ آپ پروفائل سیٹنگز سے کسی بھی وقت تبدیل کر سکتے ہیں۔'
               : 'Language changes apply instantly across the entire app. You can switch at any time from your profile settings.'}
          </Text>
        </View>
      </AnimatedReveal>

      {/* Done button */}
      <AnimatedReveal delay={200}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.doneBtn, { backgroundColor: colors.action, opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="check" size={16} color={colors.actionForeground} />
          <Text style={[styles.doneBtnText, { color: colors.actionForeground }]}>
            {selected === 'ur' ? 'مکمل' : 'Done'}
          </Text>
        </Pressable>
      </AnimatedReveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.3 },
  activeBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 28 },
  activeBannerText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flex: 1 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 10 },
  optionsCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  divider: { height: 1, marginHorizontal: 16 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  scriptBadge: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  scriptChar: { lineHeight: 30 },
  langName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, marginBottom: 3 },
  langNative: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  radioCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  infoBox: { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 24, alignItems: 'flex-start' },
  infoText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, flex: 1 },
  doneBtn: { height: 52, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  doneBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
