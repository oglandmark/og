/**
 * Visit History Store
 * Records when a buyer views a property detail screen.
 * Called from app/property/[id].tsx on mount.
 * Max 50 entries, deduplicated by propertyId (most recent wins).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VisitRecord = {
  propertyId: number;
  propertyTitle: string;
  propertyType: string;
  propertyCity: string;
  propertyPrice: number;
  propertyStatus: string;
  viewedAt: string; // ISO
};

const KEY   = '@og-landmark/visit-history-v1';
const LIMIT = 50;

let _cache: VisitRecord[] | null = null;

async function load(): Promise<VisitRecord[]> {
  if (_cache) return _cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) { _cache = JSON.parse(raw) as VisitRecord[]; return _cache; }
  } catch { /* ignore */ }
  _cache = [];
  return _cache;
}

async function persist(list: VisitRecord[]): Promise<void> {
  _cache = list;
  await AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => undefined);
}

/** Call on property detail mount to record the visit. */
export async function recordVisit(record: Omit<VisitRecord, 'viewedAt'>): Promise<void> {
  const list = await load();
  // Remove older entry for same property (so it re-floats to top)
  const filtered = list.filter((v) => v.propertyId !== record.propertyId);
  const next: VisitRecord = { ...record, viewedAt: new Date().toISOString() };
  await persist([next, ...filtered].slice(0, LIMIT));
}

export async function getVisitHistory(): Promise<VisitRecord[]> {
  return load();
}

export async function clearVisitHistory(): Promise<void> {
  await persist([]);
}

export async function removeVisit(propertyId: number): Promise<void> {
  const list = await load();
  await persist(list.filter((v) => v.propertyId !== propertyId));
}
