import { apiRequest } from '@/lib/api';

export type LeadStatus = 'new' | 'contacted' | 'interested' | 'viewing' | 'closed';
export type LeadPriority = 'high' | 'medium' | 'low';
export type LeadSource = 'Direct Inquiry' | 'WhatsApp' | 'Phone Call' | 'Referral' | 'Walk-in' | 'Online Ad' | 'Other';

export type Lead = {
  id: number;
  agentId?: string;
  name: string;
  phone: string;
  email?: string;
  property: string;
  area: string;
  budget: string;
  status: LeadStatus;
  priority?: LeadPriority;
  source?: LeadSource;
  time: string;        // display string e.g. "2 hours ago"
  createdAt?: string;  // ISO
  lastContact?: string;// ISO
  followUpDate?: string;// ISO — scheduled follow-up
  notes: string;
};

function migrateLead(l: Partial<Lead> & { id: number; name: string }): Lead {
  return {
    phone: '', property: '', area: '', budget: '', status: 'new',
    time: 'Recently', notes: '', priority: 'medium', source: 'Other',
    createdAt: new Date().toISOString(),
    ...l,
  } as Lead;
}

export async function getLeads(): Promise<Lead[]> {
  return (await apiRequest<Lead[]>('/api/agent-leads')).map(migrateLead);
}

export async function saveLeads(leads: Lead[]): Promise<void> {
  await Promise.all(leads.map((lead) => apiRequest(`/api/agent-leads/${lead.id}`, {
    method: 'PUT', body: JSON.stringify(lead),
  })));
}

export async function updateLeadStatus(id: number, status: LeadStatus): Promise<Lead[]> {
  await apiRequest(`/api/agent-leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  return getLeads();
}

export async function updateLeadNotes(id: number, notes: string): Promise<Lead[]> {
  await apiRequest(`/api/agent-leads/${id}`, { method: 'PATCH', body: JSON.stringify({ notes }) });
  return getLeads();
}

export async function setLeadFollowUp(id: number, followUpDate: string): Promise<Lead[]> {
  await apiRequest(`/api/agent-leads/${id}`, { method: 'PATCH', body: JSON.stringify({ followUpDate }) });
  return getLeads();
}

export async function addLead(lead: Lead): Promise<Lead[]> {
  await apiRequest('/api/agent-leads', { method: 'POST', body: JSON.stringify(lead) });
  return getLeads();
}

export async function deleteLead(id: number): Promise<Lead[]> {
  await apiRequest(`/api/agent-leads/${id}`, { method: 'DELETE' });
  return getLeads();
}

export function nextLeadId(leads: Lead[]): number {
  return leads.length > 0 ? Math.max(...leads.map((l) => l.id)) + 1 : 1;
}

export const LEAD_SOURCES: LeadSource[] = [
  'Direct Inquiry', 'WhatsApp', 'Phone Call', 'Referral', 'Walk-in', 'Online Ad', 'Other',
];
