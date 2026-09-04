/**
 * Recent Searches Store
 * Records the last N text searches made from the Explore screen.
 * Stored in AsyncStorage, capped at MAX_ENTRIES.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@og-landmark/recent-searches-v1';
const MAX_ENTRIES = 10;
let _cache: string[] | null = null;

async function load(): Promise<string[]> {
  if (_cache) return _cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) { _cache = JSON.parse(raw) as string[]; return _cache; }
  } catch { /* ignore */ }
  _cache = [];
  return _cache;
}

async function persist(list: string[]): Promise<void> {
  _cache = list;
  await AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => undefined);
}

export async function getRecentSearches(): Promise<string[]> {
  return load();
}

export async function addRecentSearch(query: string): Promise<void> {
  const q = query.trim();
  if (!q) return;
  const list = await load();
  const deduped = [q, ...list.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, MAX_ENTRIES);
  await persist(deduped);
}

export async function clearRecentSearches(): Promise<void> {
  await persist([]);
}

export async function removeRecentSearch(query: string): Promise<void> {
  const list = await load();
  await persist(list.filter((s) => s !== query));
}
