/**
 * Agent Visits Store — manage property visit appointments for agents.
 * AsyncStorage-backed. Swap fetch() calls for oglandmark.com API when ready.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const KEY = '@og-landmark/agent-visits-v1';

export function newVisitId(): string {
  return `visit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function tomorrowISO(): string { return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10); }
function in3daysISO(): string { return new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10); }
function yesterdayISO(): string { return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); }

function seedVisits(agentId: string): AgentVisit[] {
  const now = new Date().toISOString();
  return [
    { id: 'v1', agentId, clientName: 'Muhammad Imran', clientPhone: '0301-1234567', propertyTitle: '5 Marla House – Okara City', propertyCity: 'Okara', date: tomorrowISO(), time: '10:00', status: 'Confirmed', notes: 'Client is a cash buyer, bring NOC copy.', createdAt: now, updatedAt: now },
    { id: 'v2', agentId, clientName: 'Asif Raza', clientPhone: '0321-9876543', propertyTitle: 'Agricultural Land – Depalpur', propertyCity: 'Depalpur', date: in3daysISO(), time: '09:00', status: 'Requested', notes: 'Wants to check tube well and canal access.', createdAt: now, updatedAt: now },
    { id: 'v3', agentId, clientName: 'Sana Bibi', clientPhone: '0341-7778899', propertyTitle: '3 Marla Plot – Okara', propertyCity: 'Okara', date: todayISO(), time: '14:00', status: 'Confirmed', notes: 'Second visit — she liked it last time.', createdAt: now, updatedAt: now },
    { id: 'v4', agentId, clientName: 'Zahid Hussain', clientPhone: '0300-5554321', propertyTitle: 'Commercial Shop – Renala Khurd', propertyCity: 'Renala Khurd', date: yesterdayISO(), time: '11:00', status: 'Completed', notes: 'Visit done. Interested, negotiation pending.', createdAt: now, updatedAt: now },
  ];
}

export async function getAgentVisitsByBuyer(buyerId: string): Promise<AgentVisit[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const all: AgentVisit[] = JSON.parse(raw);
    return all
      .filter((v) => v.buyerId === buyerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function getAgentVisits(agentId: string): Promise<AgentVisit[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const all: AgentVisit[] = JSON.parse(raw);
      const mine = all.filter((v) => v.agentId === agentId);
      if (mine.length > 0) return mine.sort((a, b) => a.date.localeCompare(b.date));
    }
    // Seed on first load
    const seeded = seedVisits(agentId);
    const existing: AgentVisit[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(KEY, JSON.stringify([...seeded, ...existing]));
    return seeded;
  } catch {
    return seedVisits(agentId);
  }
}

export async function saveAgentVisit(visit: AgentVisit): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY);
  const all: AgentVisit[] = raw ? JSON.parse(raw) : [];
  const now = new Date().toISOString();
  const idx = all.findIndex((v) => v.id === visit.id);
  if (idx >= 0) { all[idx] = { ...visit, updatedAt: now }; }
  else { all.unshift({ ...visit, createdAt: now, updatedAt: now }); }
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function updateVisitStatus(id: string, status: VisitStatus): Promise<AgentVisit[]> {
  const raw = await AsyncStorage.getItem(KEY);
  const all: AgentVisit[] = raw ? JSON.parse(raw) : [];
  const now = new Date().toISOString();
  const updated = all.map((v) => v.id === id ? { ...v, status, updatedAt: now } : v);
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
}

export async function deleteAgentVisit(id: string): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY);
  const all: AgentVisit[] = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((v) => v.id !== id)));
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
