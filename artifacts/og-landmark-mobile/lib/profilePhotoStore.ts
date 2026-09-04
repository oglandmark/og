import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@og-landmark/profile-photo-v1';

export async function getProfilePhoto(): Promise<string | null> {
  try { return await AsyncStorage.getItem(KEY); } catch { return null; }
}

export async function saveProfilePhoto(uri: string): Promise<void> {
  try { await AsyncStorage.setItem(KEY, uri); } catch { /* ignore */ }
}

export async function removeProfilePhoto(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ }
}
