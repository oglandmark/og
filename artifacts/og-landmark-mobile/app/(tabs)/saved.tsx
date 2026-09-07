import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { PropertyCard } from '@/components/PropertyCard';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { properties } from '@/lib/properties';
import { useSaved } from '@/context/SavedContext';
import { useColors } from '@/hooks/useColors';
import { GlassCard } from '@/components/GlassCard';

export default function SavedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { savedIds } = useSaved();
  const savedProperties = properties.filter((property) => savedIds.includes(property.id));
  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: tabBarHeight, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <AnimatedReveal>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR SHORTLIST</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Saved properties</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Keep the places that feel like a possibility.</Text>
      </AnimatedReveal>

      {savedProperties.length > 0 ? (
        <View style={styles.list}>
          {savedProperties.map((property, index) => (
            <AnimatedReveal key={property.id} delay={130 + index * 90} distance={16}>
              <PropertyCard property={property} compact />
            </AnimatedReveal>
          ))}
        </View>
      ) : (
        <GlassCard style={styles.empty} contentStyle={styles.emptyContent}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
            <Feather name="heart" size={22} color={colors.accentForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your shortlist is empty</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tap the heart on a property to keep it here.</Text>
        </GlassCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.8, marginBottom: 7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.5 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 9 },
  list: { marginTop: 24 },
  empty: { borderRadius: 20, marginTop: 34 },
  emptyContent: { padding: 30, alignItems: 'center' },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 6 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18 },
});