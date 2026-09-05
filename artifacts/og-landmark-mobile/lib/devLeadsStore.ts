/**
 * Developer CRM — Project Leads Store
 * 8-stage pipeline: NEW → CONTACTED → INTERESTED → SITE_VISIT → NEGOTIATION → BOOKING → WON / LOST
 * Leads are persisted to the authenticated backend account.
 */
import { apiRequest } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DevLeadStatus =
  | 'new' | 'contacted' | 'interested' | 'site_visit'
  | 'negotiation' | 'booking' | 'won' | 'lost';

export type DevLeadSource =
  | 'Walk-in' | 'Phone' | 'WhatsApp' | 'Website'
  | 'Social Media' | 'Referral' | 'OG Landmark' | 'Other';

export const DEV_LEAD_SOURCES: DevLeadSource[] = [
  'Walk-in', 'Phone', 'WhatsApp', 'Website',
  'Social Media', 'Referral', 'OG Landmark', 'Other',
];

export type DevLead = {
  id: string;
  developerId: string;
  // Contact
  name: string;
  phone: string;
  email: string;
  // Interest
  interestedProject: string;
  interestedUnit: string;
  budget: string;
  propertyType: string;
  // Meta
  source: DevLeadSource;
  assignedTo: string;
  notes: string;
  nextFollowUp: string;
  // Stage
  status: DevLeadStatus;
  // Timestamps
  createdAt: string;
  updatedAt: string;
};

// ── Stage config ──────────────────────────────────────────────────────────────

export const DEV_STAGE_CONFIG: Record<DevLeadStatus, { color: string; label: string }> = {
  new:         { color: '#059669', label: 'New' },
  contacted:   { color: '#102a43', label: 'Contacted' },
  interested:  { color: '#c8a45a', label: 'Interested' },
  site_visit:  { color: '#7c3aed', label: 'Site Visit' },
  negotiation: { color: '#0891b2', label: 'Negotiation' },
  booking:     { color: '#f59e0b', label: 'Booking' },
  won:         { color: '#16a34a', label: 'Won' },
  lost:        { color: '#dc2626', label: 'Lost' },
};

export const DEV_STAGES: DevLeadStatus[] = [
  'new', 'contacted', 'interested', 'site_visit',
  'negotiation', 'booking', 'won', 'lost',
];

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED: Omit<DevLead, 'id' | 'developerId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Muhammad Imran', phone: '03011234567', email: 'imran@example.com',
    interestedProject: 'OG Green Valley', interestedUnit: '5 Marla Plot',
    budget: '35–45 Lakh', propertyType: 'Plot', source: 'Website',
    assignedTo: 'Self', notes: 'Very interested, wants to see master plan.',
    nextFollowUp: '2026-08-15', status: 'new',
  },
  {
    name: 'Asif Raza', phone: '03021234567', email: '',
    interestedProject: 'OG Green Valley', interestedUnit: '10 Marla Plot',
    budget: '70–85 Lakh', propertyType: 'Plot', source: 'Referral',
    assignedTo: 'Self', notes: 'Asked about NOC status. Called twice.',
    nextFollowUp: '2026-08-18', status: 'contacted',
  },
  {
    name: 'Zahid Hussain', phone: '03031234567', email: 'zahid@example.com',
    interestedProject: 'OG Green Valley', interestedUnit: '1 Kanal Plot',
    budget: '1.5–2 Crore', propertyType: 'Plot', source: 'WhatsApp',
    assignedTo: 'Self', notes: 'Site visit scheduled. Bring development plan.',
    nextFollowUp: '2026-08-20', status: 'site_visit',
  },
  {
    name: 'Naveed Ahmed', phone: '03041234567', email: '',
    interestedProject: 'OG Green Valley', interestedUnit: '5 Marla Plot',
    budget: '40–50 Lakh', propertyType: 'Plot', source: 'Walk-in',
    assignedTo: 'Self', notes: 'Visited office, reviewing payment plan.',
    nextFollowUp: '2026-08-22', status: 'interested',
  },
];

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getDevLeads(developerId: string): Promise<DevLead[]> {
  return (await apiRequest<DevLead[]>('/api/developer/leads'))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function saveDevLead(lead: DevLead): Promise<void> {
  const existing = !lead.id.startsWith('devlead_');
  await apiRequest(`/api/developer/leads${existing ? `/${encodeURIComponent(lead.id)}` : ''}`, {
    method: existing ? 'PUT' : 'POST', body: JSON.stringify(lead),
  });
}

export async function updateDevLeadStatus(
  id: string, status: DevLeadStatus, developerId: string,
): Promise<DevLead[]> {
  await apiRequest(`/api/developer/leads/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  return getDevLeads(developerId);
}

export async function updateDevLeadNotes(
  id: string, notes: string, developerId: string,
): Promise<DevLead[]> {
  await apiRequest(`/api/developer/leads/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ notes }) });
  return getDevLeads(developerId);
}

export async function deleteDevLead(id: string): Promise<void> {
  await apiRequest(`/api/developer/leads/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export type DevLeadStats = {
  total: number; newCount: number; wonCount: number; lostCount: number;
};

export function calcDevLeadStats(leads: DevLead[]): DevLeadStats {
  return {
    total:    leads.length,
    newCount: leads.filter((l) => l.status === 'new').length,
    wonCount: leads.filter((l) => l.status === 'won').length,
    lostCount:leads.filter((l) => l.status === 'lost').length,
  };
}

export function newDevLeadId(): string {
  return `devlead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
