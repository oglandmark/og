import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Platform, View } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import type { NotificationResponse } from 'expo-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SavedProvider } from '@/context/SavedContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';
import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';
import { OpeningSplash } from '@/components/OpeningSplash';
import { useColors } from '@/hooks/useColors';
import {
  configurePushNotifications,
  clearLastNotificationResponse,
  getNotificationData,
  hasNotificationPermission,
  registerPushTokenForUser,
  subscribeToNotificationResponses,
} from '@/lib/pushNotifications';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

function RootLayoutNav({ splashDone }: { splashDone: boolean }) {
  const colors = useColors();
  const { isRTL } = useLanguage();
  const { isLoggedIn, isLoading, user } = useAuth();
  const { isLoading: onboardingLoading, hasCompletedOnboarding } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();
  const [navigationReady, setNavigationReady] = React.useState(false);
  const handledNotificationResponses = React.useRef(new Set<string>());
  const notificationDenialAlertShown = React.useRef(false);

  useEffect(() => {
    void configurePushNotifications();

    if (Platform.OS === 'web') return;
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
      const propertyId = data.propertyId;

      if (propertyId !== undefined && propertyId !== null && String(propertyId)) {
        router.push({
          pathname: '/property/[id]',
          params: { id: String(propertyId) },
        });
      } else {
        router.push('/(tabs)');
      }
    };

    subscribeToNotificationResponses(handleNotificationResponse)
      .then((cleanup) => {
        if (mounted) unsubscribe = cleanup;
        else cleanup();
      })
      .catch((error: unknown) => {
        console.warn('[push] Could not subscribe to notification responses.', error);
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!user?.id || Platform.OS === 'web') return;
    let mounted = true;
    notificationDenialAlertShown.current = false;

    const showRegistrationError = (error: unknown) => {
      if (!mounted) return;
      console.warn('[push] Could not register this device for notifications.', error);
      Alert.alert(
        'Notifications unavailable',
        'We could not register this device for notifications. Please check your connection and try again.',
      );
    };

    const attemptRegistration = async (showDeniedAlert: boolean) => {
      try {
        const result = await registerPushTokenForUser(user.id);
        if (!mounted) return;
        if (result.status === 'registered') {
          notificationDenialAlertShown.current = false;
          return;
        }
        if (
          result.status !== 'denied' ||
          !showDeniedAlert ||
          notificationDenialAlertShown.current
        ) {
          return;
        }

        notificationDenialAlertShown.current = true;
        Alert.alert(
          'Notifications are off',
          result.canAskAgain
            ? 'Allow notifications to receive property approvals and announcements while the app is closed.'
            : 'Notifications are blocked for OG Landmark. Open your device settings to enable property approvals and announcements.',
          result.canAskAgain
            ? [
                { text: 'Not now', style: 'cancel' },
                { text: 'Try again', onPress: () => { void attemptRegistration(false); } },
              ]
            : [
                { text: 'Not now', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    Linking.openSettings().catch((error: unknown) => {
                      console.warn('[push] Could not open notification settings.', error);
                    });
                  },
                },
              ],
        );
      } catch (error: unknown) {
        showRegistrationError(error);
      }
    };

    void attemptRegistration(true);

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      hasNotificationPermission()
        .then((granted) => {
          if (granted) {
            void attemptRegistration(false);
          }
        })
        .catch((error: unknown) => {
          console.warn('[push] Could not refresh notification permission state.', error);
        });
    });

    return () => {
      mounted = false;
      appStateSubscription.remove();
    };
  }, [user?.id]);

  useEffect(() => {
    if (isLoading || onboardingLoading || !splashDone) return;
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
    const inKnownRoute = inTabs || inAuth || inProperty || inProject || inSettings || inAgent || inPost || inAdmin || inTools;

    // Allow registration routes even when onboarding is already completed
    const isRegisterRoute = inOnboarding && ['select-role', 'register-buyer', 'register-agent', 'register-developer'].includes(segments[1] as string);

    if (!hasCompletedOnboarding && !inOnboarding) {
      router.replace('/onboarding');
      // Reveal after short delay to let navigation commit
      setTimeout(() => setNavigationReady(true), 120);
    } else if (hasCompletedOnboarding && inOnboarding && !isRegisterRoute) {
      router.replace('/(tabs)');
      setTimeout(() => setNavigationReady(true), 120);
    } else if (isLoggedIn && inOnboarding) {
      router.replace('/(tabs)');
      setTimeout(() => setNavigationReady(true), 120);
    } else if (!inKnownRoute && !inOnboarding) {
      // Guest or anyone at an unknown/root route → send to tabs directly
      router.replace('/(tabs)');
      setTimeout(() => setNavigationReady(true), 120);
    } else {
      setNavigationReady(true);
    }
  }, [hasCompletedOnboarding, isLoggedIn, isLoading, onboardingLoading, segments, router, splashDone]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#102a43', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#c8a45a" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.action, direction: isRTL ? 'rtl' : 'ltr' }}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="tools" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="property/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="project/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="(auth)" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      </Stack>
      {!navigationReady && (
        <View
          pointerEvents="auto"
          style={[{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 200,
            elevation: 200,
          }, { backgroundColor: colors.action }]}
        />
      )}
    </View>
  );
}

function DirectionalApp({ splashDone }: { splashDone: boolean }) {
  const { isRTL } = useLanguage();
  return (
    <View style={{ flex: 1, direction: isRTL ? 'rtl' : 'ltr' }}>
      <RootLayoutNav splashDone={splashDone} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold,
  });
  const [fontGateTimedOut, setFontGateTimedOut] = React.useState(false);
  // On web (browser preview), skip the splash animation entirely so the app loads immediately
  const [splashDone, setSplashDone] = React.useState(Platform.OS === 'web');
  useEffect(() => {
    if (fontsLoaded || fontError || fontGateTimedOut) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError, fontGateTimedOut]);
  useEffect(() => {
    const timeout = setTimeout(
      () => setFontGateTimedOut(true),
      Platform.OS === 'web' ? 1800 : 6000,
    );
    return () => clearTimeout(timeout);
  }, []);

  // ── Set audio session ONCE at app startup so videos play with sound
  // even when iOS silent switch is off or no explicit user interaction yet.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    setAudioModeAsync({
      playsInSilentMode: true, // ignore iOS silent/mute switch
      allowsRecording: false,
      shouldPlayInBackground: false,
    }).catch(() => undefined);
  }, []);
  // The browser preview can render with platform fallback fonts while the
  // bundled font manifest is unavailable in offline mode. Native keeps the
  // gate so the branded splash does not reveal unstyled text.
  if (Platform.OS !== 'web' && !fontsLoaded && !fontError && !fontGateTimedOut) return null;
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <OnboardingProvider>
            <LanguageProvider>
              <AuthProvider>
                <SavedProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                     <KeyboardProvider>
                       <DirectionalApp splashDone={splashDone} />
                     </KeyboardProvider>
                  </GestureHandlerRootView>
                </SavedProvider>
              </AuthProvider>
            </LanguageProvider>
          </OnboardingProvider>
        </QueryClientProvider>
        {Platform.OS !== 'web' && <OpeningSplash onFinished={() => setSplashDone(true)} />}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
