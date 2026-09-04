/**
 * Saved Searches Store
 * Allows buyers to save a search query for later re-use.
 * Called from app/explore.tsx when the user taps "Save this search".
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedSearch = {
  id: string;
  label: string;       // Human-readable e.g. "5 Marla House · Okara"
  query: string;       // Search text
  filters: {
    type?: string;
    category?: string;
    transaction?: string;
    location?: string;
    minPrice?: string;
    maxPrice?: string;
    minArea?: string;
    maxArea?: string;
  };
  savedAt: string;     // ISO
};

const KEY = '@og-landmark/saved-searches-v1';
let _cache: SavedSearch[] | null = null;

async function load(): Promise<SavedSearch[]> {
  if (_cache) return _cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) { _cache = JSON.parse(raw) as SavedSearch[]; return _cache; }
  } catch { /* ignore */ }
  _cache = [];
  return _cache;
}

async function persist(list: SavedSearch[]): Promise<void> {
  _cache = list;
  await AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => undefined);
}

export async function getSavedSearches(): Promise<SavedSearch[]> {
  const list = await load();
  return [...list].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

export async function saveSearch(search: Omit<SavedSearch, 'id' | 'savedAt'>): Promise<SavedSearch> {
  const list = await load();
  // Avoid duplicate labels
  const filtered = list.filter((s) => s.label !== search.label);
  const newSearch: SavedSearch = { ...search, id: `ss-${Date.now()}`, savedAt: new Date().toISOString() };
  await persist([newSearch, ...filtered]);
  return newSearch;
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const list = await load();
  await persist(list.filter((s) => s.id !== id));
}

export async function clearSavedSearches(): Promise<void> {
  await persist([]);
}
