import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
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
  | { status: 'skipped' };

/**
 * Configure foreground presentation once. Background/locked-screen delivery is
 * handled by the operating system after the Expo token is registered.
 */
export function configurePushNotifications(): void {
  if (Platform.OS === 'web' || handlerConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  handlerConfigured = true;
}

/**
 * Ask for permission and return the Expo push token for this installation.
 * The projectId comes from app.json so production builds can use the same
 * Expo project for Android and iOS delivery.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  // Android 13+ requires at least one notification channel before the runtime
  // permission prompt can be shown on a fresh installation.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'OG Landmark',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C8A45A',
      sound: 'default',
    });
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
  if (Platform.OS === 'web' || !Number.isInteger(numericUserId) || numericUserId <= 0) {
    return { status: 'skipped' };
  }

  const token = await getExpoPushToken();
  if (!token) {
    const permission = await Notifications.getPermissionsAsync();
    return { status: 'denied', canAskAgain: permission.canAskAgain };
  }

  await updatePushToken(numericUserId, token);
  return { status: 'registered' };
}

export function getNotificationData(
  notification: Notifications.Notification,
): PushNotificationData {
  return notification.request.content.data as PushNotificationData;
}
