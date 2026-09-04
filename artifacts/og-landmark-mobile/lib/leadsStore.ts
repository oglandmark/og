import AsyncStorage from '@react-native-async-storage/async-storage';

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

const KEY = '@og-landmark/leads-v2';
const OLD_KEY = '@og-landmark/leads-v1';

const INITIAL_LEADS: Lead[] = [
  { id: 1, name: 'Muhammad Imran', phone: '0301-1234567', property: '5 Marla House – Okara City', area: 'Okara City', budget: 'PKR 40–50 Lac', status: 'new', priority: 'high', source: 'Direct Inquiry', time: '2 hours ago', createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(), notes: 'Looking for immediate possession, cash buyer.' },
  { id: 2, name: 'Asif Raza', phone: '0321-9876543', property: 'Agricultural Land – Depalpur', area: 'Depalpur', budget: 'PKR 1–1.5 Cr', status: 'interested', priority: 'high', source: 'WhatsApp', time: '5 hours ago', createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(), notes: 'Wants tube well facility. Will visit Saturday.' },
  { id: 3, name: 'Zahid Hussain', phone: '0300-5554321', property: 'Commercial Shop – Renala Khurd', area: 'Renala Khurd', budget: 'PKR 70–90 Lac', status: 'contacted', priority: 'medium', source: 'Phone Call', time: 'Yesterday', createdAt: new Date(Date.now() - 24 * 3600_000).toISOString(), notes: 'Talked on phone, waiting for site visit booking.' },
  { id: 4, name: 'Sana Bibi', phone: '0341-7778899', property: '3 Marla Plot – Okara', area: 'Okara City', budget: 'PKR 12–15 Lac', status: 'viewing', priority: 'medium', source: 'Referral', time: '2 days ago', createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), notes: 'Site visit booked for Monday 10am.', followUpDate: new Date(Date.now() + 86_400_000).toISOString() },
  { id: 5, name: 'Tariq Mehmood', phone: '0333-4441111', property: '10 Marla House – Okara', area: 'Okara City', budget: 'PKR 80 Lac+', status: 'closed', priority: 'low', source: 'Referral', time: '1 week ago', createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(), notes: 'Deal closed. Transferred on 1st Jan.' },
];

function migrateLead(l: Partial<Lead> & { id: number; name: string }): Lead {
  return {
    phone: '', property: '', area: '', budget: '', status: 'new',
    time: 'Recently', notes: '', priority: 'medium', source: 'Other',
    createdAt: new Date().toISOString(),
    ...l,
  } as Lead;
}

/** Load leads from storage — seeds on first run. */
export async function getLeads(): Promise<Lead[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return (JSON.parse(raw) as Lead[]).map(migrateLead);
    // Migrate from v1 key
    const oldRaw = await AsyncStorage.getItem(OLD_KEY);
    if (oldRaw) {
      const migrated = (JSON.parse(oldRaw) as Lead[]).map(migrateLead);
      await AsyncStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(INITIAL_LEADS));
    return INITIAL_LEADS;
  } catch {
    return INITIAL_LEADS;
  }
}

export async function saveLeads(leads: Lead[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(leads)); } catch { /* silent */ }
}

export async function updateLeadStatus(id: number, status: LeadStatus): Promise<Lead[]> {
  const leads = await getLeads();
  const updated = leads.map((l) => l.id === id ? { ...l, status, lastContact: new Date().toISOString() } : l);
  await saveLeads(updated);
  return updated;
}

export async function updateLeadNotes(id: number, notes: string): Promise<Lead[]> {
  const leads = await getLeads();
  const updated = leads.map((l) => l.id === id ? { ...l, notes } : l);
  await saveLeads(updated);
  return updated;
}

export async function setLeadFollowUp(id: number, followUpDate: string): Promise<Lead[]> {
  const leads = await getLeads();
  const updated = leads.map((l) => l.id === id ? { ...l, followUpDate } : l);
  await saveLeads(updated);
  return updated;
}

export async function addLead(lead: Lead): Promise<Lead[]> {
  const leads = await getLeads();
  const updated = [lead, ...leads];
  await saveLeads(updated);
  return updated;
}

export async function deleteLead(id: number): Promise<Lead[]> {
  const leads = await getLeads();
  const updated = leads.filter((l) => l.id !== id);
  await saveLeads(updated);
  return updated;
}

export function nextLeadId(leads: Lead[]): number {
  return leads.length > 0 ? Math.max(...leads.map((l) => l.id)) + 1 : 1;
}

export const LEAD_SOURCES: LeadSource[] = [
  'Direct Inquiry', 'WhatsApp', 'Phone Call', 'Referral', 'Walk-in', 'Online Ad', 'Other',
];
