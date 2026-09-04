import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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
  color: string;
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
      <Feather name={name} size={size} color={color} />
    </Animated.View>
  );
}

// ── Plus icon (post-ad) keeps its own raised circle treatment ────────────────
function PostAdIcon({ color, focused }: { color: string; focused: boolean }) {
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
      <Tabs.Screen name="index"   options={{ title: tr('tabHome'),    href: isBuyer ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="home"   color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="explore" options={{ title: tr('tabExplore'), href: isBuyer ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="search" color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="post-ad" options={{
        title: tr('tabPostAd'), href: isBuyer ? undefined : null,
        tabBarActiveTintColor: colors.action,
        tabBarIcon: ({ color, focused }) => <PostAdIcon color={color} focused={focused} />,
      }} />
      <Tabs.Screen name="saved"   options={{ title: tr('tabSaved'),   href: isBuyer ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="heart"  color={color} size={size} focused={focused} /> }} />

      {/* ── PROFESSIONAL TABS ───────────── */}
      <Tabs.Screen name="dashboard" options={{ title: tr('tabDashboard'), href: isProfessional ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="bar-chart-2"   color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="listings"  options={{ title: tr('tabListings'),  href: isAgent      ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="home"           color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="projects"  options={{ title: tr('tabProjects'),  href: isDeveloper  ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="layers"         color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="leads"     options={{ title: tr('tabLeads'),     href: isProfessional ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="users"          color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="messages"  options={{ title: tr('tabMessages'),  href: isProfessional ? undefined : null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="message-circle" color={color} size={size} focused={focused} /> }} />

      {/* ── ALWAYS VISIBLE ──────────────── */}
      <Tabs.Screen name="calculator" options={{ title: 'Calculator', href: null, tabBarIcon: ({ color, size, focused }) => <TabIcon name="grid" color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="profile"    options={{ title: tr('tabProfile'), tabBarIcon: ({ color, size, focused }) => <TabIcon name="user" color={color} size={size} focused={focused} /> }} />
    </Tabs>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  tabGlass: { overflow: 'hidden', borderTopWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  postIcon:  { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: -16, borderWidth: 4, borderColor: '#ffffff' },
});
