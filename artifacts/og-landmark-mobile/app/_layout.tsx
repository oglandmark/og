import React, { useEffect } from 'react';
import { AppState, InteractionManager, Platform, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { setAudioModeAsync } from 'expo-audio';
import type { NotificationResponse } from 'expo-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { useFonts, type FontSource } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { OGLandmarkLogo } from '@/components/OGLandmarkLogo';
import { SavedProvider } from '@/context/SavedContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DemoPropertyVisibilityProvider } from '@/context/DemoPropertyVisibilityContext';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';
import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';
import { useColors } from '@/hooks/useColors';
import {
  configurePushNotifications,
  clearLastNotificationResponse,
  getNotificationData,
  hasNotificationPermission,
  registerPushTokenForUser,
  subscribeToNotificationResponses,
} from '@/lib/pushNotifications';
import { markNotificationRead } from '@/lib/api';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();
const STARTUP_SPLASH_MIN_DURATION_MS = Platform.OS === 'web' ? 0 : 7000;

function RootLayoutNav() {
  const colors = useColors();
  const { isRTL } = useLanguage();
  const { isLoggedIn, isLoading, user } = useAuth();
  const { isLoading: onboardingLoading, hasCompletedOnboarding } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();
  const [navigationReady, setNavigationReady] = React.useState(false);
  const [splashDurationElapsed, setSplashDurationElapsed] = React.useState(false);
  const handledNotificationResponses = React.useRef(new Set<string>());

  useEffect(() => {
    const timeout = setTimeout(
      () => setSplashDurationElapsed(true),
      STARTUP_SPLASH_MIN_DURATION_MS,
    );
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: () => void = () => {};
    const handleNotificationResponse = (response: NotificationResponse) => {
      const responseId = response.notification.request.identifier;
      if (handledNotificationResponses.current.has(responseId)) return;
      handledNotificationResponses.current.add(responseId);
      clearLastNotificationResponse().catch((error: unknown) => {
        console.warn('[push] Could not clear the handled notification response.', error);
      });

      const data = getNotificationData(response.notification);
      if (data.notificationId) {
        void markNotificationRead(String(data.notificationId)).catch(() => undefined);
      }
      const deepLink = typeof data.deepLink === 'string' ? data.deepLink : '';
      const propertyId = data.propertyId;

      if (deepLink.startsWith('/property/')) {
        router.push(deepLink as any);
      } else if (deepLink.startsWith('/project/')) {
        router.push(deepLink as any);
      } else if (deepLink.startsWith('/announcements/')) {
        router.push(deepLink as any);
      } else if (propertyId !== undefined && propertyId !== null && String(propertyId)) {
        router.push({
          pathname: '/property/[id]',
          params: { id: String(propertyId) },
        });
      } else {
        router.push('/notifications');
      }
    };

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      void configurePushNotifications().catch((error: unknown) => {
        console.warn('[push] Could not configure push notifications.', error);
      });

      if (Platform.OS === 'web') return;
      subscribeToNotificationResponses(handleNotificationResponse)
        .then((cleanup) => {
          if (mounted) unsubscribe = cleanup;
          else cleanup();
        })
        .catch((error: unknown) => {
          console.warn('[push] Could not subscribe to notification responses.', error);
        });
    });

    return () => {
      mounted = false;
      interactionTask.cancel();
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!user?.id || Platform.OS === 'web') return;
    let mounted = true;

    const syncPushTokenIfAllowed = async () => {
      try {
        // Push permission is opt-in. Never interrupt the main app flow with a
        // permission prompt or an error alert during startup.
        if (!(await hasNotificationPermission())) return;
        const result = await registerPushTokenForUser(user.id);
        if (!mounted) return;
        if (result.status !== 'registered' && result.status !== 'unsupported') {
          console.warn('[push] Push token was not registered.', result.status);
        }
      } catch (error: unknown) {
        console.warn('[push] Could not sync the existing notification permission.', error);
      }
    };

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      void syncPushTokenIfAllowed();
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      void syncPushTokenIfAllowed();
    });

    return () => {
      mounted = false;
      interactionTask.cancel();
      appStateSubscription.remove();
    };
  }, [user?.id]);

  useEffect(() => {
    if (isLoading || onboardingLoading) return;
    const inOnboarding = segments[0] === 'onboarding';
    const inAuth      = segments[0] === '(auth)';
    const inTabs      = segments[0] === '(tabs)';
    const inAdmin     = segments[0] === 'admin';
    const inProperty  = segments[0] === 'property';
    const inProject   = segments[0] === 'project';
    const inSettings  = segments[0] === 'settings';
    const inAgent     = segments[0] === 'agent';
    const inPost      = segments[0] === 'post';
    const inTools     = segments[0] === 'tools';
    const inNotifications = segments[0] === 'notifications';
    const inAnnouncements = segments[0] === 'announcements';
    const inKnownRoute = inTabs || inAuth || inProperty || inProject || inSettings || inAgent || inPost || inAdmin || inTools || inNotifications || inAnnouncements;

    // Allow registration routes even when onboarding is already completed
    const isRegisterRoute = inOnboarding && ['select-role', 'register-buyer', 'register-agent', 'register-developer'].includes(segments[1] as string);

    if (isLoggedIn && inAuth) {
      // Keep authenticated users out of login, signup, and reset-password
      // screens after a session is restored or created.
      router.replace('/(tabs)');
      setTimeout(() => setNavigationReady(true), 120);
    } else if (!hasCompletedOnboarding && !inOnboarding) {
      router.replace('/onboarding');
      // Reveal after short delay to let navigation commit
      setTimeout(() => setNavigationReady(true), 120);
    } else if (hasCompletedOnboarding && inOnboarding && !isRegisterRoute) {
      router.replace('/(tabs)');
      setTimeout(() => setNavigationReady(true), 120);
    } else if (isLoggedIn && inOnboarding) {
      router.replace('/(tabs)');
      setTimeout(() => setNavigationReady(true), 120);
    } else if (inAdmin && (!isLoggedIn || user?.role !== 'admin')) {
      // Admin screens are never reachable by an unauthenticated user or by
      // a normal buyer/agent account, even if they manually enter the route.
      router.replace(isLoggedIn ? '/(tabs)' : '/(auth)/login');
      setTimeout(() => setNavigationReady(true), 120);
    } else if (!inKnownRoute && !inOnboarding) {
      // Guest or anyone at an unknown/root route → send to tabs directly
      router.replace('/(tabs)');
      setTimeout(() => setNavigationReady(true), 120);
    } else {
      setNavigationReady(true);
    }
  }, [hasCompletedOnboarding, isLoggedIn, isLoading, onboardingLoading, segments, router]);

  if (isLoading) {
    return <StartupSplash colors={colors} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.action, direction: isRTL ? 'rtl' : 'ltr' }}>
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="tools" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="property/[id]" options={{ presentation: 'card', animation: 'none' }} />
        <Stack.Screen name="project/[id]" options={{ presentation: 'card', animation: 'none' }} />
        <Stack.Screen name="(auth)" options={{ presentation: 'card', animation: 'none' }} />
      </Stack>
      {(!navigationReady || !splashDurationElapsed) && (
        <StartupSplash colors={colors} overlay />
      )}
    </View>
  );
}

const rootStyles = {
  loading: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
  },
  startupBrand: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 20,
    letterSpacing: 0.4,
    marginTop: 12,
    textAlign: 'center' as const,
  },
  startupMark: {
    width: '76%' as const,
    maxWidth: 260,
    aspectRatio: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  startupRingOuter: {
    position: 'absolute' as const,
    top: '4%' as const,
    right: '4%' as const,
    bottom: '4%' as const,
    left: '4%' as const,
    borderWidth: 1,
    borderRadius: 999,
  },
  startupRingInner: {
    position: 'absolute' as const,
    top: '11%' as const,
    right: '11%' as const,
    bottom: '11%' as const,
    left: '11%' as const,
    borderWidth: 1,
    borderRadius: 999,
  },
  startupRingDot: {
    position: 'absolute' as const,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  startupRingDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  startupRingDotAccent: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  startupRingDotTop: {
    top: -3,
    left: '50%' as const,
    marginLeft: -3,
  },
  startupRingDotBottom: {
    bottom: -3,
    left: '50%' as const,
    marginLeft: -3,
  },
  startupRingDotLeft: {
    left: -3,
    top: '50%' as const,
    marginTop: -3,
  },
  startupRingDotRight: {
    right: -3,
    top: '50%' as const,
    marginTop: -3,
  },
  startupOverlay: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 200,
    elevation: 200,
  },
};

function StartupSplash({
  colors,
  overlay = false,
}: {
  colors: ReturnType<typeof useColors>;
  overlay?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const outerRotation = useSharedValue(0);
  const innerRotation = useSharedValue(0);
  const outerRingMotion = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerRotation.value}deg` }],
  }));
  const innerRingMotion = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerRotation.value}deg` }],
  }));

  useEffect(() => {
    if (reduceMotion) return undefined;

    outerRotation.value = withRepeat(
      withTiming(360, { duration: 2800, easing: Easing.linear }),
      -1,
      false,
    );
    innerRotation.value = withRepeat(
      withTiming(-360, { duration: 3600, easing: Easing.linear }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(outerRotation);
      cancelAnimation(innerRotation);
    };
  }, [innerRotation, outerRotation, reduceMotion]);

  return (
    <View
      accessible
      accessibilityLabel="Loading OG Landmark"
      style={[
        rootStyles.loading,
        { backgroundColor: colors.background },
        overlay && rootStyles.startupOverlay,
      ]}
    >
      <View style={rootStyles.startupMark}>
        <Animated.View
          style={[
            rootStyles.startupRingOuter,
            { borderColor: colors.border, opacity: 0.72 },
            outerRingMotion,
          ]}
        >
          <View style={[rootStyles.startupRingDot, rootStyles.startupRingDotAccent, rootStyles.startupRingDotTop, { backgroundColor: colors.gold, opacity: 0.76 }]} />
          <View style={[rootStyles.startupRingDot, rootStyles.startupRingDotSmall, rootStyles.startupRingDotRight, { backgroundColor: colors.actionSoft, opacity: 0.4 }]} />
          <View style={[rootStyles.startupRingDot, rootStyles.startupRingDotBottom, { backgroundColor: colors.gold, opacity: 0.58 }]} />
          <View style={[rootStyles.startupRingDot, rootStyles.startupRingDotSmall, rootStyles.startupRingDotLeft, { backgroundColor: colors.actionSoft, opacity: 0.34 }]} />
        </Animated.View>
        <Animated.View
          style={[
            rootStyles.startupRingInner,
            { borderColor: colors.border, opacity: 0.62 },
            innerRingMotion,
          ]}
        >
          <View style={[rootStyles.startupRingDot, rootStyles.startupRingDotSmall, rootStyles.startupRingDotTop, { backgroundColor: colors.actionSoft, opacity: 0.34 }]} />
          <View style={[rootStyles.startupRingDot, rootStyles.startupRingDotAccent, rootStyles.startupRingDotRight, { backgroundColor: colors.gold, opacity: 0.74 }]} />
          <View style={[rootStyles.startupRingDot, rootStyles.startupRingDotSmall, rootStyles.startupRingDotBottom, { backgroundColor: colors.actionSoft, opacity: 0.4 }]} />
          <View style={[rootStyles.startupRingDot, rootStyles.startupRingDotLeft, { backgroundColor: colors.gold, opacity: 0.54 }]} />
        </Animated.View>
        <OGLandmarkLogo size={112} />
      </View>
      <Text style={[rootStyles.startupBrand, { color: colors.actionDeep }]}>
        OG Landmark
      </Text>
    </View>
  );
}

function DirectionalApp() {
  const { isRTL } = useLanguage();
  return (
    <View style={{ flex: 1, direction: isRTL ? 'rtl' : 'ltr' }}>
      <RootLayoutNav />
    </View>
  );
}

export default function RootLayout() {
  // Expo Web can spend 12 seconds waiting for remote font-face assets in the
  // preview proxy. Web already has safe browser fallbacks, while native must
  // keep the bundled fonts for the branded startup screen.
  const fontDefinitions: Record<string, FontSource> = Platform.OS === 'web' ? {} : {
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold,
  };
  const [fontsLoaded, fontError] = useFonts(fontDefinitions);
  const [fontGateTimedOut, setFontGateTimedOut] = React.useState(false);
  useEffect(() => {
    if (fontsLoaded || fontError || fontGateTimedOut) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError, fontGateTimedOut]);
  useEffect(() => {
    const timeout = setTimeout(
      () => setFontGateTimedOut(true),
       Platform.OS === 'web' ? 1800 : 2500,
    );
    return () => clearTimeout(timeout);
  }, []);

  // ── Set audio session ONCE at app startup so videos play with sound
  // even when iOS silent switch is off or no explicit user interaction yet.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      setAudioModeAsync({
        playsInSilentMode: true, // ignore iOS silent/mute switch
        allowsRecording: false,
        shouldPlayInBackground: false,
      }).catch(() => undefined);
    });
    return () => interactionTask.cancel();
  }, []);
  // The browser preview can render with platform fallback fonts while the
  // bundled font manifest is unavailable in offline mode. Native keeps the
  // gate so the branded splash does not reveal unstyled text.
  if (Platform.OS !== 'web' && !fontsLoaded && !fontError && !fontGateTimedOut) {
    return <StatusBar style="dark" />;
  }
  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <OnboardingProvider>
              <LanguageProvider>
                <AuthProvider>
                  <DemoPropertyVisibilityProvider>
                    <SavedProvider>
                      <GestureHandlerRootView style={{ flex: 1 }}>
                        <KeyboardProvider>
                          <DirectionalApp />
                        </KeyboardProvider>
                      </GestureHandlerRootView>
                    </SavedProvider>
                  </DemoPropertyVisibilityProvider>
                </AuthProvider>
              </LanguageProvider>
            </OnboardingProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </>
  );
}
