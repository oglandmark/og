/**
 * Saved searches belong to the authenticated account on the server.  Keeping
 * this module free of an AsyncStorage fallback is intentional: a failed save
 * must be shown to the user rather than presented as a successful local save.
 */
import { apiRequest } from '@/lib/api';

export type SavedSearch = {
  id: string;
  label: string;
  query: string;
  filters: {
    type?: string; category?: string; transaction?: string; location?: string;
    minPrice?: string; maxPrice?: string; minArea?: string; maxArea?: string;
  };
  savedAt: string;
};

export async function getSavedSearches(): Promise<SavedSearch[]> {
  const searches = await apiRequest<SavedSearch[]>('/api/saved-searches');
  return [...searches].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

export async function saveSearch(search: Omit<SavedSearch, 'id' | 'savedAt'>): Promise<SavedSearch> {
  return apiRequest<SavedSearch>('/api/saved-searches', {
    method: 'POST', body: JSON.stringify(search),
  });
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await apiRequest(`/api/saved-searches/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function clearSavedSearches(): Promise<void> {
  await apiRequest('/api/saved-searches', { method: 'DELETE' });
}