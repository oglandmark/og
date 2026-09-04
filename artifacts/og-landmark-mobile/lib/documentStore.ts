/**
 * Developer Portal — Document Store
 * Stores document metadata in AsyncStorage; the URI points to the local file
 * selected via expo-image-picker. API-ready: swap with oglandmark.com file upload.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const DOCS_KEY = '@og-landmark/documents-v1';

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
  try {
    const raw = await AsyncStorage.getItem(DOCS_KEY);
    if (!raw) return [];
    const all: DeveloperDocument[] = JSON.parse(raw);
    return all
      .filter((d) => d.developerId === developerId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  } catch {
    return [];
  }
}

export async function saveDocument(doc: DeveloperDocument): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(DOCS_KEY);
    const all: DeveloperDocument[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex((d) => d.id === doc.id);
    if (idx >= 0) all[idx] = doc;
    else all.push(doc);
    await AsyncStorage.setItem(DOCS_KEY, JSON.stringify(all));
  } catch {
    // TODO: POST oglandmark.com/api/developer/documents (multipart upload)
  }
}

export async function deleteDocument(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(DOCS_KEY);
    if (!raw) return;
    const all: DeveloperDocument[] = JSON.parse(raw);
    await AsyncStorage.setItem(DOCS_KEY, JSON.stringify(all.filter((d) => d.id !== id)));
  } catch {}
}
