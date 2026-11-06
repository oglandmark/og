import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETED_KEY = '@og-landmark/onboarding-completed-v1';
const ONBOARDING_STORAGE_READ_TIMEOUT_MS = 5_000;

export async function getOnboardingCompletion(): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY).then((value) => value === 'true'),
      new Promise<boolean>((resolve) => {
        timeout = setTimeout(() => resolve(true), ONBOARDING_STORAGE_READ_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
}
