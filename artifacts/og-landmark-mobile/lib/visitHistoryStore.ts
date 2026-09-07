/**
 * Visit History Store
 * Records when a buyer views a property detail screen.
 * Called from app/property/[id].tsx on mount.
 * Max 50 entries, deduplicated by propertyId (most recent wins).
 */
import { apiRequest } from '@/lib/api';

export type VisitRecord = {
  propertyId: number;
  propertyTitle: string;
  propertyType: string;
  propertyCity: string;
  propertyPrice: number;
  propertyStatus: string;
  viewedAt: string; // ISO
};

const LIMIT = 50;

/** Call on property detail mount to record the visit. */
export async function recordVisit(record: Omit<VisitRecord, 'viewedAt'>): Promise<void> {
  await apiRequest('/api/visit-history', {
    method: 'POST', body: JSON.stringify({ ...record, limit: LIMIT }),
  });
}

export async function getVisitHistory(): Promise<VisitRecord[]> {
  return apiRequest<VisitRecord[]>('/api/visit-history');
}

export async function clearVisitHistory(): Promise<void> {
  await apiRequest('/api/visit-history', { method: 'DELETE' });
}

export async function removeVisit(propertyId: number): Promise<void> {
  await apiRequest(`/api/visit-history/${propertyId}`, { method: 'DELETE' });
}
