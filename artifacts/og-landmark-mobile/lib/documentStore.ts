/**
 * Developer Portal — Document Store
 * Stores document metadata against the authenticated backend account.
 */
import { apiRequest } from '@/lib/api';

export type DocType =
  | 'NOC'
  | 'Layout Plan'
  | 'Title Deed'
  | 'Registration'
  | 'NTN Certificate'
  | 'ID Card'
  | 'Other';

export const DOC_TYPES: DocType[] = [
  'NOC', 'Layout Plan', 'Title Deed', 'Registration', 'NTN Certificate', 'ID Card', 'Other',
];

export type DeveloperDocument = {
  id: string;
  developerId: string;
  projectId: string;
  projectName: string;
  title: string;
  type: DocType;
  uri: string;        // local URI from expo-image-picker
  fileName: string;
  uploadedAt: string;
};

export function newDocId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function docTypeColor(type: DocType): { bg: string; text: string; icon: string } {
  switch (type) {
    case 'NOC':            return { bg: '#1a6b3a18', text: '#1a6b3a', icon: 'shield' };
    case 'Layout Plan':    return { bg: '#102a4318', text: '#102a43', icon: 'map' };
    case 'Title Deed':     return { bg: '#c8a45a18', text: '#c8a45a', icon: 'award' };
    case 'Registration':   return { bg: '#7c3aed18', text: '#7c3aed', icon: 'file-text' };
    case 'NTN Certificate':return { bg: '#0891b218', text: '#0891b2', icon: 'credit-card' };
    case 'ID Card':        return { bg: '#059669' + '18', text: '#059669', icon: 'user' };
    case 'Other':          return { bg: '#6b728018', text: '#6b7280', icon: 'paperclip' };
  }
}

export async function getDocuments(developerId: string): Promise<DeveloperDocument[]> {
  return (await apiRequest<DeveloperDocument[]>('/api/developer/documents'))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export async function saveDocument(doc: DeveloperDocument): Promise<void> {
  const existing = !doc.id.startsWith('doc_');
  await apiRequest(`/api/developer/documents${existing ? `/${encodeURIComponent(doc.id)}` : ''}`, {
    method: existing ? 'PUT' : 'POST', body: JSON.stringify(doc),
  });
}

export async function deleteDocument(id: string): Promise<void> {
  await apiRequest(`/api/developer/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
