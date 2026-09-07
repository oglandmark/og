import React, { useEffect } from 'react';
import { useState } from 'react';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getMobileSettings } from '@/lib/api';
import { useMobileContent } from '@/hooks/useMobileContent';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';

// ── Animated tab icon — springs to scale 1.14 when focused ───────────────────
function TabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  color: ColorValue;
  size: number;
  focused: boolean;
}) {
  const scale = useSharedValue(focused ? 1.14 : 1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      scale.value = focused ? 1.14 : 1;
      return;
    }
    scale.value = withSpring(focused ? 1.14 : 1, {
      damping: 16,
      stiffness: 340,
      mass: 0.6,
    });
  }, [focused, reducedMotion, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Feather name={name} size={size} color={color as string} />
    </Animated.View>
  );
}

// ── Plus icon (post-ad) keeps its own raised circle treatment ────────────────
function PostAdIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  const colors = useColors();
  const scale = useSharedValue(focused ? 1.08 : 1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) { scale.value = focused ? 1.08 : 1; return; }
    scale.value = withSpring(focused ? 1.08 : 1, { damping: 16, stiffness: 340, mass: 0.6 });
  }, [focused, reducedMotion, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[styles.postIcon, { backgroundColor: colors.action }, animStyle]}
    >
      <Feather name="plus" size={22} color={colors.actionForeground} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const { role } = useAuth();
  const { tr } = useLanguage();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  // Tab bar grows downward to cover the Android system-nav / iOS home-indicator.
  // Icons sit above that zone; the height seen by the user stays 78 (icons+labels).
  const tabBarHeight     = isWeb ? 84 : 78 + insets.bottom;
  const tabBarPadBottom  = isWeb ? 30 : 11 + insets.bottom;

  const isBuyer      = !role || role === 'buyer';
  const isAgent      = role === 'agent';
  const isDeveloper  = role === 'developer';
  const isProfessional = isAgent || isDeveloper;
  const content = useMobileContent();
  const visibility = content?.global?.screenVisibility || {};
  const isVisible = (key: string, roleAllowed = true) => roleAllowed && visibility[key] !== false;
  const [navLabels, setNavLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    getMobileSettings().then((settings) => setNavLabels(settings.content?.screens?.navigation || {})).catch(() => undefined);
  }, []);

  return (
    <ErrorBoundary>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   colors.action,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 10 },
        tabBarStyle: {
          position: 'absolute',
          height:        tabBarHeight,
          paddingTop:    7,
          paddingBottom: tabBarPadBottom,
          backgroundColor: 'transparent',
          borderTopWidth:  0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === 'web' ? (
            <View style={[StyleSheet.absoluteFill, styles.tabGlass, { borderTopColor: colors.glassBorder }]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
            </View>
          ) : (
            <BlurView
              intensity={72}
              tint="light"
              style={[StyleSheet.absoluteFill, styles.tabGlass, { borderTopColor: colors.glassBorder }]}
            >
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
            </BlurView>
          ),
      }}
    >
      {/* ── BUYER TABS ──────────────────── */}
      <Tabs.Screen name="index"   options={{ title: navLabels.home || tr('tabHome'),    href: isVisible('home', isBuyer) ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="home"   color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="explore" options={{ title: navLabels.explore || tr('tabExplore'), href: isVisible('explore', isBuyer) ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="search" color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="post-ad" options={{
        title: navLabels.postAd || tr('tabPostAd'), href: isVisible('postAd', isBuyer) ? undefined : null,
        tabBarActiveTintColor: colors.action,
        tabBarIcon: ({ color, focused }) => <PostAdIcon color={color} focused={focused} />,
      }} />
      <Tabs.Screen name="saved"   options={{ title: navLabels.saved || tr('tabSaved'),   href: isVisible('saved', isBuyer) ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="heart"  color={color} size={size} focused={focused} /> }} />

      {/* ── PROFESSIONAL TABS ───────────── */}
      <Tabs.Screen name="dashboard" options={{ title: navLabels.dashboard || tr('tabDashboard'), href: isVisible('agentPortal', isProfessional) ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="bar-chart-2"   color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="listings"  options={{ title: navLabels.listings || tr('tabListings'),  href: isVisible('agentPortal', isAgent) ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="home"           color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="projects"  options={{ title: navLabels.projects || tr('tabProjects'),  href: isVisible('developerPortal', isDeveloper) ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="layers"         color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="leads"     options={{ title: navLabels.leads || tr('tabLeads'),     href: isVisible('agentPortal', isProfessional) ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="users"          color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="messages"  options={{ title: navLabels.messages || tr('tabMessages'),  href: isVisible('agentPortal', isProfessional) ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="message-circle" color={color} size={size} focused={focused} /> }} />

      {/* ── ALWAYS VISIBLE ──────────────── */}
      {/* Keep the utility route available to internal links, but never show it in the tab bar. */}
      <Tabs.Screen name="calculator" options={{ href: null }} />
      <Tabs.Screen name="profile"    options={{ title: navLabels.profile || tr('tabProfile'), href: visibility.profile === false ? null : undefined, tabBarIcon: ({ color, size, focused }) => <TabIcon name="user" color={color} size={size} focused={focused} /> }} />
    </Tabs>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  tabGlass: { overflow: 'hidden', borderTopWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  postIcon:  { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: -16, borderWidth: 4, borderColor: '#ffffff' },
});
