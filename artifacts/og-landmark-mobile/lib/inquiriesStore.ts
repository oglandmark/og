/**
 * Inquiries Store
 * Tracks buyer inquiries sent from property detail screens.
 * Persisted to the authenticated account on the backend.
 */
import { apiRequest } from '@/lib/api';

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

export async function getInquiries(): Promise<Inquiry[]> {
  const list = await apiRequest<Inquiry[]>('/api/inquiries');
  return [...list].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}

export async function addInquiry(inquiry: Omit<Inquiry, 'id' | 'sentAt' | 'status'>): Promise<Inquiry> {
  return apiRequest<Inquiry>('/api/inquiries', { method: 'POST', body: JSON.stringify(inquiry) });
}

export async function deleteInquiry(id: string): Promise<void> {
  await apiRequest(`/api/inquiries/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function formatInquiryPrice(price: number): string {
  if (price >= 10_000_000) return `PKR ${(price / 10_000_000).toFixed(1)} Crore`;
  if (price >= 100_000)    return `PKR ${(price / 100_000).toFixed(0)} Lac`;
  return `PKR ${price.toLocaleString()}`;
}
