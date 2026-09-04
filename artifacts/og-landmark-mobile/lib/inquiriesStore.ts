/**
 * Inquiries Store
 * Tracks buyer inquiries sent from property detail screens.
 * Persisted to AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type InquiryStatus = 'sent' | 'replied' | 'closed';

export type Inquiry = {
  id: string;
  propertyId: number;
  propertyTitle: string;
  propertyType: string;
  propertyCity: string;
  propertyPrice: number;
  agentName: string;
  message: string;
  sentAt: string;       // ISO
  status: InquiryStatus;
  reply?: string;
  repliedAt?: string;
};

const KEY = '@og-landmark/inquiries-v1';

/** Seed data so buyer sees something useful on first launch */
const SEED: Inquiry[] = [
  {
    id: 'inq-seed-1',
    propertyId: 3,
    propertyTitle: '10 Marla House in Model Town',
    propertyType: 'House',
    propertyCity: 'Okara',
    propertyPrice: 9500000,
    agentName: 'Ahmed Property Consultants',
    message: 'I am interested in this property. Please share the full details and arrange a viewing.',
    sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'replied',
    reply: 'Thank you for your interest! The property is available for viewing this weekend. Please call us at 0304-2569000 to confirm.',
    repliedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'inq-seed-2',
    propertyId: 7,
    propertyTitle: '5 Marla Plot in Satellite Town',
    propertyType: 'Plot',
    propertyCity: 'Depalpur',
    propertyPrice: 3200000,
    agentName: 'Malik Properties',
    message: 'Is this plot in a possession scheme? What is the nearest landmark?',
    sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'sent',
  },
];

let _cache: Inquiry[] | null = null;

async function load(): Promise<Inquiry[]> {
  if (_cache) return _cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      _cache = JSON.parse(raw) as Inquiry[];
      return _cache;
    }
  } catch { /* ignore */ }
  // First launch — persist seed data
  _cache = SEED;
  await AsyncStorage.setItem(KEY, JSON.stringify(_cache)).catch(() => undefined);
  return _cache;
}

async function save(list: Inquiry[]): Promise<void> {
  _cache = list;
  await AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => undefined);
}

export async function getInquiries(): Promise<Inquiry[]> {
  const list = await load();
  return [...list].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}

export async function addInquiry(inquiry: Omit<Inquiry, 'id' | 'sentAt' | 'status'>): Promise<Inquiry> {
  const list = await load();
  const newInquiry: Inquiry = {
    ...inquiry,
    id: `inq-${Date.now()}`,
    sentAt: new Date().toISOString(),
    status: 'sent',
  };
  await save([newInquiry, ...list]);
  return newInquiry;
}

export async function deleteInquiry(id: string): Promise<void> {
  const list = await load();
  await save(list.filter((i) => i.id !== id));
}

export function formatInquiryPrice(price: number): string {
  if (price >= 10_000_000) return `PKR ${(price / 10_000_000).toFixed(1)} Crore`;
  if (price >= 100_000)    return `PKR ${(price / 100_000).toFixed(0)} Lac`;
  return `PKR ${price.toLocaleString()}`;
}
