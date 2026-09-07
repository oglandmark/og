/**
 * Developer Portal — Site Visit Store
 * Site visits are persisted to the authenticated backend account.
 */
import { apiRequest } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type VisitStatus =
  | 'Requested' | 'Confirmed' | 'Rescheduled' | 'Completed' | 'Cancelled';

export type SiteVisit = {
  id: string;
  developerId: string;
  projectName: string;
  projectLocation?: string;   // city/area for buyer confirmation screen
  contactName?: string;       // developer/agent name shown on buyer profile
  contactPhone?: string;      // developer/agent phone shown on buyer profile
  // Visitor info
  visitorName: string;
  visitorPhone: string;
  visitorCount: number;
  message: string;
  // Buyer tracking (set when submitted from buyer-facing UI)
  buyerId?: string;
  // Schedule
  date: string;   // ISO date: "2026-08-15"
  time: string;   // "10:00 AM"
  rescheduleDate?: string;
  rescheduleTime?: string;
  // Status
  status: VisitStatus;
  // Timestamps
  createdAt: string;
  updatedAt: string;
};

// ── Status colour ─────────────────────────────────────────────────────────────

export function visitStatusColor(status: VisitStatus): { bg: string; text: string } {
  switch (status) {
    case 'Requested':    return { bg: '#c8a45a18', text: '#c8a45a' };
    case 'Confirmed':    return { bg: '#1a6b3a18', text: '#1a6b3a' };
    case 'Rescheduled':  return { bg: '#0891b218', text: '#0891b2' };
    case 'Completed':    return { bg: '#10293818', text: '#102a43' };
    case 'Cancelled':    return { bg: '#dc262618', text: '#dc2626' };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isUpcoming(visit: SiteVisit): boolean {
  return visit.status === 'Requested' || visit.status === 'Confirmed' || visit.status === 'Rescheduled';
}

export function formatVisitDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr; // not an ISO date, return as-is (plain text)
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function newVisitId(): string {
  return `visit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getSiteVisitsByBuyer(buyerId: string): Promise<SiteVisit[]> {
  return (await apiRequest<SiteVisit[]>('/api/developer/site-visits/mine'))
    .filter((v) => v.buyerId === buyerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getSiteVisits(developerId: string): Promise<SiteVisit[]> {
  return (await apiRequest<SiteVisit[]>('/api/developer/site-visits'))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function saveSiteVisit(visit: SiteVisit): Promise<void> {
  const existing = !visit.id.startsWith('visit_');
  await apiRequest(`/api/developer/site-visits${existing ? `/${encodeURIComponent(visit.id)}` : ''}`, {
    method: existing ? 'PUT' : 'POST', body: JSON.stringify(visit),
  });
}

export async function updateVisitStatus(
  id: string, status: VisitStatus, developerId: string,
  rescheduleDate?: string, rescheduleTime?: string,
): Promise<SiteVisit[]> {
  await apiRequest(`/api/developer/site-visits/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, rescheduleDate, rescheduleTime }),
  });
  return getSiteVisits(developerId);
}
