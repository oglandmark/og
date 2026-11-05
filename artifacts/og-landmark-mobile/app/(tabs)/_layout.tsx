import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, useRouter } from 'expo-router';
import { BottomTabBar, type BottomTabBarProps } from 'expo-router/tabs';
import { Feather } from '@expo/vector-icons';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { TabBarVisibilityContext } from '@/context/TabBarScrollContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getMobileSettings } from '@/lib/api';
import { useMobileContent } from '@/hooks/useMobileContent';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { POST_AD_LISTING_ROUTE } from '@/lib/postAdEntry';

function FullTabLabel({ label, color }: { label: string; color: ColorValue }) {
  return (
    <Text
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={0.82}
      style={[styles.tabLabel, { color }]}
    >
      {label}
    </Text>
  );
}

// ── Static tab icon ───────────────────────────────────────────────────────────
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
  const colors = useColors();
  return (
    <View
      style={[
        styles.tabIconWrap,
        focused && {
          backgroundColor: colors.selectionTint,
          borderColor: colors.selectionBorder + '55',
        },
      ]}
    >
      <Feather name={name} size={Math.min(size, 21)} color={color as string} />
    </View>
  );
}

// ── Plus icon (post-ad) keeps its own raised circle treatment ────────────────
function PostAdIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  const colors = useColors();

  return (
       <View style={[styles.postIcon, { backgroundColor: focused ? colors.gold : colors.action, borderColor: colors.background }]}>
       <Feather name="plus" size={focused ? 23 : 21} color={focused ? colors.goldForeground : colors.actionForeground} />
    </View>
  );
}

function AnimatedTabBar({
  height,
  hidden,
  ...props
}: BottomTabBarProps & { height: number; hidden: SharedValue<boolean> }) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: withTiming(hidden.value ? height + 12 : 0, {
        duration: 230,
        easing: Easing.out(Easing.cubic),
      }),
    }],
    opacity: withTiming(hidden.value ? 0 : 1, { duration: hidden.value ? 150 : 190 }),
  }), [height]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.animatedTabBarFrame, { height }, animatedStyle]}
    >
      <BottomTabBar {...props} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const { role, isLoggedIn, isLoading } = useAuth();
  const { tr } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const tabBarHidden = useSharedValue(false);
  const setTabBarHidden = useCallback((hidden: boolean) => {
    tabBarHidden.value = hidden;
  }, [tabBarHidden]);

  // Keep the visible navigation compact and let only the safe-area inset extend
  // below the floating glass dock into the Android / iOS system area.
  const tabBarHeight     = isWeb ? 92 : 68 + insets.bottom;
  const tabBarPadBottom  = isWeb ? 30 : 6 + insets.bottom;
  const tabDockStyle = [
    StyleSheet.absoluteFill,
    styles.tabGlass,
    {
      top: 6,
      left: 12,
      right: 12,
      bottom: isWeb ? 8 : insets.bottom + 6,
      borderColor: colors.glassBorder,
    },
    Platform.OS === 'ios'
      ? {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 18,
        }
      : Platform.OS === 'android'
        ? { elevation: 12 }
        : {},
  ];

  const isBuyer      = !role || role === 'user' || role === 'buyer';
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
    <TabBarVisibilityContext.Provider value={setTabBarHidden}>
      <ErrorBoundary>
      <Tabs
        tabBar={(props) => <AnimatedTabBar {...props} height={tabBarHeight} hidden={tabBarHidden} />}
        screenOptions={{
          headerShown: false,
          animation: Platform.OS === 'ios' ? 'fade' : 'none',
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor:   colors.action,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarItemStyle: { paddingTop: 3, minWidth: 0 },
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            height: tabBarHeight,
            paddingTop: 6,
            paddingBottom: tabBarPadBottom,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
          },
          tabBarBackground: () => {
            if (Platform.OS === 'android') {
              return (
                <BlurView
                  intensity={84}
                  tint="light"
                  blurMethod="dimezisBlurView"
                  style={tabDockStyle}
                >
                  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
                  <LinearGradient
                    colors={[colors.actionGlassHighlight, 'transparent']}
                    style={[styles.tabGlassHighlight, { pointerEvents: 'none' } as any]}
                  />
                </BlurView>
              );
            }
            if (Platform.OS === 'web') {
              return (
                <View style={tabDockStyle}>
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
                  <LinearGradient
                    colors={[colors.actionGlassHighlight, 'transparent']}
                    style={[styles.tabGlassHighlight, { pointerEvents: 'none' } as any]}
                  />
                </View>
              );
            }
            return (
              <BlurView
                intensity={84}
                tint="light"
                style={tabDockStyle}
              >
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
                <LinearGradient
                  colors={[colors.actionGlassHighlight, 'transparent']}
                  style={[styles.tabGlassHighlight, { pointerEvents: 'none' } as any]}
                />
              </BlurView>
            );
          },
        }}
      >
      {/* ── BUYER TABS ──────────────────── */}
      <Tabs.Screen name="index" options={{
        title: navLabels.home || tr('tabHome'),
        tabBarLabel: ({ color }) => <FullTabLabel label={navLabels.home || tr('tabHome')} color={color} />,
        href: isVisible('home', isBuyer) ? undefined : null,
        tabBarIcon: ({ color, size, focused }) => <TabIcon name="home" color={color} size={size} focused={focused} />,
      }} />
      <Tabs.Screen name="explore" options={{
        title: navLabels.explore || tr('tabExplore'),
        tabBarLabel: ({ color }) => <FullTabLabel label={navLabels.explore || tr('tabExplore')} color={color} />,
        href: isVisible('explore', isBuyer) ? undefined : null,
        tabBarIcon: ({ color, size, focused }) => <TabIcon name="search" color={color} size={size} focused={focused} />,
      }} />
      <Tabs.Screen name="post-ad" options={{
        title: navLabels.postAd || tr('tabPostAd'),
        tabBarLabel: ({ color }) => <FullTabLabel label={navLabels.postAd || tr('tabPostAd')} color={color} />,
        href: isVisible('postAd', isBuyer) ? undefined : null,
        tabBarActiveTintColor: colors.action,
        tabBarIcon: ({ color, focused }) => <PostAdIcon color={color} focused={focused} />,
      }} listeners={{
        tabPress: (event) => {
          if (isLoading || !isLoggedIn) return;
          event.preventDefault();
          router.replace(POST_AD_LISTING_ROUTE);
        },
      }} />
      <Tabs.Screen name="saved" options={{
        title: navLabels.saved || tr('tabSaved'),
        tabBarLabel: ({ color }) => <FullTabLabel label={navLabels.saved || tr('tabSaved')} color={color} />,
        href: isVisible('saved', isBuyer) ? undefined : null,
        tabBarIcon: ({ color, size, focused }) => <TabIcon name="heart" color={color} size={size} focused={focused} />,
      }} />

      {/* ── PROFESSIONAL TABS ───────────── */}
      <Tabs.Screen name="dashboard" options={{
        title: navLabels.dashboard || tr('tabDashboard'),
        tabBarLabel: ({ color }) => <FullTabLabel label={navLabels.dashboard || tr('tabDashboard')} color={color} />,
        href: isVisible('agentPortal', isProfessional) ? undefined : null,
        tabBarIcon: ({ color, size, focused }) => <TabIcon name="bar-chart-2" color={color} size={size} focused={focused} />,
      }} />
      <Tabs.Screen name="listings" options={{
        title: navLabels.listings || tr('tabListings'),
        tabBarLabel: ({ color }) => <FullTabLabel label={navLabels.listings || tr('tabListings')} color={color} />,
        href: isVisible('agentPortal', isAgent) ? undefined : null,
        tabBarIcon: ({ color, size, focused }) => <TabIcon name="home" color={color} size={size} focused={focused} />,
      }} />
      <Tabs.Screen name="projects" options={{
        title: navLabels.projects || tr('tabProjects'),
        tabBarLabel: ({ color }) => <FullTabLabel label={navLabels.projects || tr('tabProjects')} color={color} />,
        href: isVisible('developerPortal', isDeveloper) ? undefined : null,
        tabBarIcon: ({ color, size, focused }) => <TabIcon name="layers" color={color} size={size} focused={focused} />,
      }} />
      <Tabs.Screen name="leads" options={{
        title: navLabels.leads || tr('tabLeads'),
        tabBarLabel: ({ color }) => <FullTabLabel label={navLabels.leads || tr('tabLeads')} color={color} />,
        href: isVisible('agentPortal', isProfessional) ? undefined : null,
        tabBarIcon: ({ color, size, focused }) => <TabIcon name="users" color={color} size={size} focused={focused} />,
      }} />
      <Tabs.Screen name="messages" options={{
        title: navLabels.messages || tr('tabMessages'),
        tabBarLabel: ({ color }) => <FullTabLabel label={navLabels.messages || tr('tabMessages')} color={color} />,
        href: isVisible('agentPortal', isProfessional) ? undefined : null,
        tabBarIcon: ({ color, size, focused }) => <TabIcon name="message-circle" color={color} size={size} focused={focused} />,
      }} />

      {/* ── ALWAYS VISIBLE ──────────────── */}
      {/* Keep the utility route available to internal links, but never show it in the tab bar. */}
      <Tabs.Screen name="calculator" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{
        title: navLabels.profile || tr('tabProfile'),
        tabBarLabel: ({ color }) => <FullTabLabel label={navLabels.profile || tr('tabProfile')} color={color} />,
        href: visibility.profile === false ? null : undefined,
        tabBarIcon: ({ color, size, focused }) => <TabIcon name="user" color={color} size={size} focused={focused} />,
      }} />
      </Tabs>
      </ErrorBoundary>
    </TabBarVisibilityContext.Provider>
  );
}

const styles = StyleSheet.create({
  animatedTabBarFrame: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 },
  tabGlass: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 30,
  },
  tabGlassHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: 28,
    borderTopLeftRadius: 29,
    borderTopRightRadius: 29,
  },
  tabIconWrap: {
    width: 44,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    width: '100%',
    paddingHorizontal: 1,
    marginTop: 2,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    lineHeight: 11,
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  postIcon:  { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: -13, borderWidth: 3 },
});
