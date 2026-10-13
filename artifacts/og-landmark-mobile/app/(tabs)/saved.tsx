import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { PropertyCard } from '@/components/PropertyCard';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { properties } from '@/lib/properties';
import { filterVisibleDemoProperties } from '@/lib/demoPropertyVisibility';
import { useDemoPropertyVisibility } from '@/context/DemoPropertyVisibilityContext';
import { useSaved } from '@/context/SavedContext';
import { useColors } from '@/hooks/useColors';
import { GlassCard } from '@/components/GlassCard';
import { useTabBarScrollHandler } from '@/context/TabBarScrollContext';
import { useRouter } from 'expo-router';

export default function SavedScreen() {
  const colors = useColors();
  const router = useRouter();
  const { hiddenDemoPropertyIds } = useDemoPropertyVisibility();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { savedIds } = useSaved();
  const onScroll = useTabBarScrollHandler();
  const savedProperties = filterVisibleDemoProperties(
    properties.filter((property) => savedIds.includes(property.id)),
    hiddenDemoPropertyIds,
  );
  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: tabBarHeight, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <AnimatedReveal>
        <View style={styles.headingRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.accentForeground }]}>YOUR SHORTLIST</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Saved properties</Text>
          </View>
          <View style={[styles.countPill, { backgroundColor: colors.accent }]}>
            <Text style={[styles.countText, { color: colors.accentForeground }]}>{savedProperties.length}</Text>
          </View>
        </View>
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
          <Pressable
            onPress={() => router.push('/explore')}
            accessibilityRole="button"
            accessibilityLabel="Explore properties"
            style={({ pressed }) => [styles.exploreButton, { backgroundColor: colors.action, opacity: pressed ? 0.84 : 1 }]}
          >
            <Text style={[styles.exploreText, { color: colors.actionForeground }]}>Explore properties</Text>
            <Feather name="arrow-right" size={15} color={colors.actionForeground} />
          </Pressable>
        </GlassCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.8, marginBottom: 7 },
  title: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 29, letterSpacing: -0.45 },
  countPill: { minWidth: 38, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 9 },
  list: { marginTop: 24 },
  empty: { borderRadius: 20, marginTop: 34 },
  emptyContent: { padding: 30, alignItems: 'center' },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 6 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  exploreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 44, borderRadius: 13, paddingHorizontal: 17, marginTop: 8 },
  exploreText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});