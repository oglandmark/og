/**
 * Property comparison selections belong to the authenticated account.
 * Max 3 properties at once.
 */
import { apiRequest } from '@/lib/api';

export const MAX_COMPARE = 3;

export async function getCompareIds(): Promise<number[]> {
  return apiRequest<number[]>('/api/comparison');
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
  await apiRequest('/api/comparison', { method: 'PUT', body: JSON.stringify({ propertyIds: next }) });
  return { added, ids: next };
}

export async function clearCompare(): Promise<void> {
  await apiRequest('/api/comparison', { method: 'DELETE' });
}

export async function isInCompare(id: number): Promise<boolean> {
  const ids = await getCompareIds();
  return ids.includes(id);
}
