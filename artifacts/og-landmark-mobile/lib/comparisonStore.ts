/**
 * Property comparison store — persists selected property IDs to AsyncStorage.
 * Max 3 properties at once.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY    = '@og-landmark/compare-ids-v1';
export const MAX_COMPARE = 3;

export async function getCompareIds(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch { return []; }
}

export async function toggleCompare(id: number): Promise<{ added: boolean; ids: number[] }> {
  const ids = await getCompareIds();
  const idx = ids.indexOf(id);
  let next: number[];
  let added = false;
  if (idx >= 0) {
    next = ids.filter((i) => i !== id);
  } else {
    if (ids.length >= MAX_COMPARE) {
      // Replace oldest
      next = [...ids.slice(1), id];
    } else {
      next = [...ids, id];
    }
    added = true;
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return { added, ids: next };
}

export async function clearCompare(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export async function isInCompare(id: number): Promise<boolean> {
  const ids = await getCompareIds();
  return ids.includes(id);
}
