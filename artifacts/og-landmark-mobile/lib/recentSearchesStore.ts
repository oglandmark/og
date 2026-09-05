/**
 * Recent Searches Store
 * Records the last N text searches made from the Explore screen.
 * Stored against the authenticated account, capped at MAX_ENTRIES.
 */
import { apiRequest } from '@/lib/api';

const MAX_ENTRIES = 10;

export async function getRecentSearches(): Promise<string[]> {
  return apiRequest<string[]>('/api/recent-searches');
}

export async function addRecentSearch(query: string): Promise<void> {
  const q = query.trim();
  if (!q) return;
  await apiRequest('/api/recent-searches', {
    method: 'POST', body: JSON.stringify({ query: q, limit: MAX_ENTRIES }),
  });
}

export async function clearRecentSearches(): Promise<void> {
  await apiRequest('/api/recent-searches', { method: 'DELETE' });
}

export async function removeRecentSearch(query: string): Promise<void> {
  await apiRequest(`/api/recent-searches/${encodeURIComponent(query)}`, { method: 'DELETE' });
}
