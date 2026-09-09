/**
 * Agent Visits Store — manage property visit appointments for agents.
 * Agent visits are persisted to the authenticated backend account.
 */
import { apiRequest } from '@/lib/api';

export type VisitStatus = 'Requested' | 'Confirmed' | 'Completed' | 'Cancelled' | 'No Show' | 'Rescheduled';

export type AgentVisit = {
  id: string;
  agentId: string;
  clientName: string;
  clientPhone: string;
  propertyTitle: string;
  propertyCity: string;
  date: string;         // YYYY-MM-DD
  time: string;         // "10:00 AM" or HH:MM (24h)
  visitorCount?: number; // number of people attending (default 1 for legacy records)
  status: VisitStatus;
  notes: string;
  // Buyer tracking (set when submitted from buyer-facing UI)
  buyerId?: string;
  contactName?: string;  // agent display name stored at submission time
  contactPhone?: string; // agent phone stored at submission time
  createdAt: string;    // ISO
  updatedAt: string;    // ISO
};

export function newVisitId(): string {
  return `visit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function todayISO(): string { return new Date().toISOString().slice(0, 10); }
export async function getAgentVisitsByBuyer(buyerId: string): Promise<AgentVisit[]> {
  return (await apiRequest<AgentVisit[]>('/api/agent-visits'))
    .filter((v) => v.buyerId === buyerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAgentVisits(agentId: string): Promise<AgentVisit[]> {
  return (await apiRequest<AgentVisit[]>('/api/agent-visits'))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveAgentVisit(visit: AgentVisit): Promise<void> {
  const existing = !visit.id.startsWith('visit_');
  await apiRequest(`/api/agent-visits${existing ? `/${encodeURIComponent(visit.id)}` : ''}`, {
    method: existing ? 'PATCH' : 'POST', body: JSON.stringify(visit),
  });
}

export async function updateVisitStatus(id: string, status: VisitStatus): Promise<AgentVisit[]> {
  await apiRequest(`/api/agent-visits/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  return getAgentVisits('');
}

export async function deleteAgentVisit(id: string): Promise<void> {
  await apiRequest(`/api/agent-visits/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function isToday(date: string): boolean { return date === todayISO(); }
export function isUpcomingVisit(v: AgentVisit): boolean { return v.date >= todayISO() && v.status !== 'Cancelled' && v.status !== 'Completed'; }
export function isTodayVisit(v: AgentVisit): boolean { return isToday(v.date) && v.status !== 'Cancelled'; }

export function visitStatusColor(status: VisitStatus): { bg: string; text: string } {
  switch (status) {
    case 'Confirmed':    return { bg: '#1a6b3a18', text: '#1a6b3a' };
    case 'Requested':    return { bg: '#c8a45a18', text: '#c8a45a' };
    case 'Completed':    return { bg: '#102a4318', text: '#102a43' };
    case 'Cancelled':    return { bg: '#b94b4218', text: '#b94b42' };
    case 'No Show':      return { bg: '#b94b4218', text: '#b94b42' };
    case 'Rescheduled':  return { bg: '#7c3aed18', text: '#7c3aed' };
    default:             return { bg: '#88888818', text: '#888888' };
  }
}

export function formatVisitDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' });
}
