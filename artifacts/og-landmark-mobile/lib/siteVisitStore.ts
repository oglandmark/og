/**
 * Developer Portal — Site Visit Store
 * API-ready: swap AsyncStorage calls with oglandmark.com API when backend docs available.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const VISITS_KEY = '@og-landmark/site-visits-v1';

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

// ── Seed data ─────────────────────────────────────────────────────────────────

function seedVisits(developerId: string): SiteVisit[] {
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const in3days  = new Date(now); in3days.setDate(now.getDate() + 3);
  const lastWeek = new Date(now); lastWeek.setDate(now.getDate() - 7);
  const nowIso   = now.toISOString();

  return [
    {
      id: `visit_seed_1_${Date.now()}`, developerId,
      projectName: 'OG Green Valley',
      visitorName: 'Muhammad Imran', visitorPhone: '03011234567', visitorCount: 2,
      message: 'Want to see the plots in Block A.',
      date: tomorrow.toISOString().split('T')[0], time: '10:00 AM',
      status: 'Requested', createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: `visit_seed_2_${Date.now()}`, developerId,
      projectName: 'OG Green Valley',
      visitorName: 'Fahad Ali', visitorPhone: '03051234567', visitorCount: 4,
      message: 'Family visit to check surrounding area.',
      date: in3days.toISOString().split('T')[0], time: '02:00 PM',
      status: 'Confirmed', createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: `visit_seed_3_${Date.now()}`, developerId,
      projectName: 'OG Green Valley',
      visitorName: 'Shahid Khan', visitorPhone: '03061234567', visitorCount: 1,
      message: 'Individual visit, interested in commercial plots.',
      date: lastWeek.toISOString().split('T')[0], time: '11:00 AM',
      status: 'Completed', createdAt: nowIso, updatedAt: nowIso,
    },
  ];
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getSiteVisitsByBuyer(buyerId: string): Promise<SiteVisit[]> {
  try {
    const raw = await AsyncStorage.getItem(VISITS_KEY);
    if (!raw) return [];
    const all: SiteVisit[] = JSON.parse(raw);
    return all
      .filter((v) => v.buyerId === buyerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function getSiteVisits(developerId: string): Promise<SiteVisit[]> {
  try {
    const raw = await AsyncStorage.getItem(VISITS_KEY);
    if (!raw) {
      const seeded = seedVisits(developerId);
      await AsyncStorage.setItem(VISITS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const all: SiteVisit[] = JSON.parse(raw);
    const mine = all.filter((v) => v.developerId === developerId);
    if (mine.length === 0) {
      const seeded = seedVisits(developerId);
      await AsyncStorage.setItem(VISITS_KEY, JSON.stringify([...all, ...seeded]));
      return seeded;
    }
    return mine.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export async function saveSiteVisit(visit: SiteVisit): Promise<void> {
  // Save to AsyncStorage (primary)
  const raw = await AsyncStorage.getItem(VISITS_KEY);
  const all: SiteVisit[] = raw ? JSON.parse(raw) : [];
  const now = new Date().toISOString();
  const idx = all.findIndex((v) => v.id === visit.id);
  if (idx >= 0) all[idx] = { ...visit, updatedAt: now };
  else all.push({ ...visit, createdAt: now, updatedAt: now });
  await AsyncStorage.setItem(VISITS_KEY, JSON.stringify(all));

  // Mirror to backend as an appointment (best-effort)
  try {
    const { bookAppointment } = await import('@/lib/api');
    await bookAppointment({
      propertyId:      0,
      propertyTitle:   visit.projectName,
      propertyAddress: visit.projectLocation ?? '',
      buyerName:       visit.visitorName,
      buyerId:         visit.buyerId ? parseInt(visit.buyerId) : undefined,
      date:            visit.date,
      time:            visit.time,
      type:            'Site Visit',
    });
  } catch { /* offline or non-critical */ }
}

export async function updateVisitStatus(
  id: string, status: VisitStatus, developerId: string,
  rescheduleDate?: string, rescheduleTime?: string,
): Promise<SiteVisit[]> {
  try {
    const raw = await AsyncStorage.getItem(VISITS_KEY);
    if (!raw) return [];
    const all: SiteVisit[] = JSON.parse(raw);
    const idx = all.findIndex((v) => v.id === id);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx], status, updatedAt: new Date().toISOString(),
        ...(rescheduleDate && { rescheduleDate }),
        ...(rescheduleTime && { rescheduleTime }),
      };
    }
    await AsyncStorage.setItem(VISITS_KEY, JSON.stringify(all));
    return all.filter((v) => v.developerId === developerId);
  } catch {
    return [];
  }
}
