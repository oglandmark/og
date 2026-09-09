import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Notifications from 'expo-notifications';
import { updatePushToken } from '@/lib/api';

export type PushNotificationData = {
  type?: 'property' | 'announcement' | 'listing' | string;
  propertyId?: number | string;
  route?: string;
  [key: string]: unknown;
};

let handlerConfigured = false;

export type PushRegistrationResult =
  | { status: 'registered' }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'skipped' }
  | { status: 'unsupported' };

export type NotificationPermissionState = {
  status: 'granted' | 'denied' | 'undetermined' | 'unsupported';
  granted: boolean;
  canAskAgain: boolean;
};

export type PushConfigurationResult =
  | { status: 'configured' }
  | { status: 'unsupported' };

type NotificationsModule = typeof import('expo-notifications');
type NotificationResponse = Notifications.NotificationResponse;

/**
 * Expo Go no longer includes the native expo-notifications module. Keep this
 * check ahead of every dynamic import so opening the app in Expo Go never
 * attempts to load that module.
 */
export const isExpoGoAndroid =
  Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient';

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web' || isExpoGoAndroid) return null;
  return import('expo-notifications');
}

/**
 * Configure foreground presentation once. Background/locked-screen delivery is
 * handled by the operating system after the Expo token is registered.
 */
export async function configurePushNotifications(): Promise<PushConfigurationResult> {
  if (handlerConfigured) return { status: 'configured' };
  const Notifications = await getNotificationsModule();
  if (!Notifications) return { status: 'unsupported' };

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // The notification center is the source of truth while the app is open.
      // Background/closed delivery remains a native push notification.
      shouldShowAlert: false,
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
  return { status: 'configured' };
}

/**
 * Subscribe to notification taps and inspect a launch response when the
 * native module is available. Expo Go intentionally receives a no-op cleanup.
 */
export async function subscribeToNotificationResponses(
  onResponse: (response: NotificationResponse) => void,
): Promise<() => void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return () => undefined;

  const subscription = Notifications.addNotificationResponseReceivedListener(onResponse);
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) onResponse(response);
    })
    .catch((error: unknown) => {
      console.warn('[push] Could not inspect the last notification response.', error);
    });

  return () => subscription.remove();
}

export async function clearLastNotificationResponse(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (Notifications) await Notifications.clearLastNotificationResponseAsync();
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return { status: 'unsupported', granted: false, canAskAgain: false };
  }

  const permission = await Notifications.getPermissionsAsync();
  const status = permission.granted
    ? 'granted'
    : permission.status === 'denied'
      ? 'denied'
      : 'undetermined';

  return {
    status,
    granted: permission.granted,
    canAskAgain: permission.canAskAgain,
  };
}

export async function hasNotificationPermission(): Promise<boolean> {
  return (await getNotificationPermissionState()).granted;
}

/**
 * Ask for permission and return the Expo push token for this installation.
 * The projectId comes from app.json so production builds can use the same
 * Expo project for Android and iOS delivery.
 */
export async function getExpoPushToken(): Promise<string | null> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;

  // Android 13+ requires at least one notification channel before the runtime
  // permission prompt can be shown on a fresh installation.
  if (Platform.OS === 'android') {
    const channels = [
      ['properties', 'OG Landmark — Properties', Notifications.AndroidImportance.DEFAULT],
      ['projects', 'OG Landmark — Projects', Notifications.AndroidImportance.DEFAULT],
      ['announcements', 'OG Landmark — Announcements', Notifications.AndroidImportance.HIGH],
      ['account', 'OG Landmark — Account', Notifications.AndroidImportance.HIGH],
      ['system', 'OG Landmark — System', Notifications.AndroidImportance.MAX],
    ] as const;
    await Promise.all(channels.map(([id, name, importance]) =>
      Notifications.setNotificationChannelAsync(id, {
        name,
        importance,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C8A45A',
        sound: 'default',
      }),
    ));
  }

  const existing = await Notifications.getPermissionsAsync();
  let permission = existing;
  if (!permission.granted) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    throw new Error('OG Landmark notification project is not configured.');
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

/**
 * Associate the installation's token with the signed-in account. The server
 * stores the token and uses it for listing and announcement broadcasts.
 */
export async function registerPushTokenForUser(userId: string): Promise<PushRegistrationResult> {
  const numericUserId = Number(userId);
  if (isExpoGoAndroid) return { status: 'unsupported' };
  if (Platform.OS === 'web' || !Number.isInteger(numericUserId) || numericUserId <= 0) {
    return { status: 'skipped' };
  }

  const token = await getExpoPushToken();
  if (!token) {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return { status: 'unsupported' };
    const permission = await Notifications.getPermissionsAsync();
    return { status: 'denied', canAskAgain: permission.canAskAgain };
  }

  const deviceStorageKey = '@og-landmark/notification-device-id';
  let deviceId = await AsyncStorage.getItem(deviceStorageKey).catch(() => null);
  if (!deviceId) {
    deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(deviceStorageKey, deviceId).catch(() => undefined);
  }
  await updatePushToken(numericUserId, token, {
    deviceId,
    platform: Platform.OS,
    appVersion: String(Constants.expoConfig?.version || ''),
  });
  return { status: 'registered' };
}

export function getNotificationData(
  notification: Notifications.Notification,
): PushNotificationData {
  return notification.request.content.data as PushNotificationData;
}
