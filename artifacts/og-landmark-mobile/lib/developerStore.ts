/**
 * Developer Portal — Project Store
 * Developer projects are persisted to the authenticated backend account.
 */
import { apiRequest } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | 'Draft'
  | 'Pending Review'
  | 'Approved'
  | 'Live'
  | 'Coming Soon'
  | 'Under Development'
  | 'Completed'
  | 'Paused'
  | 'Archived';

export type ProjectType =
  | 'Housing Society'
  | 'Residential'
  | 'Apartments'
  | 'Commercial'
  | 'Plaza'
  | 'Mixed Use'
  | 'Industrial'
  | 'Farmhouse'
  | 'Other';

export type ProjectVerificationStatus =
  | 'Unverified'
  | 'Pending'
  | 'Under Review'
  | 'Verified';

export type DevelopmentStatus =
  | 'Pre-Launch'
  | 'Under Construction'
  | 'Construction Ongoing'
  | 'Near Completion'
  | 'Ready for Possession'
  | 'Completed';

export type NocStatus = 'Not Applied' | 'Applied' | 'Pending' | 'Approved';
export type PossessionStatus = 'Ready' | 'Partial' | 'Not Ready';

export type DeveloperProject = {
  id: string;
  apiId?: number;          // backend property ID — set after first successful sync
  developerId: string;
  // Basic Info
  name: string;
  type: ProjectType;
  tagline: string;
  shortDescription: string;
  fullDescription: string;
  highlights: string[];          // Up to 3 key selling points
  // Location & Contact
  district: string;
  city: string;
  tehsil: string;
  area: string;
  address: string;
  nearbyLandmark: string;
  googleMapsLink: string;
  latitude?: number;
  longitude?: number;
  projectOfficePhone: string;
  // Pricing & Inventory
  startingPrice: number;         // PKR
  maxPrice: number;              // PKR
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  soldUnits: number;
  plotSizes: string[];           // e.g. ['5 Marla', '10 Marla', '1 Kanal']
  paymentPlanAvailable: boolean;
  downPaymentPct: number;        // 0–100
  installmentMonths: number;
  // Details
  totalArea: string;
  totalBlocks: number;
  developmentStatus: DevelopmentStatus | '';
  launchDate: string;
  expectedCompletion: string;
  possessionStatus: PossessionStatus | '';
  // Legal & Compliance
  nocStatus: NocStatus | '';
  approvedBy: string[];          // e.g. ['LDA', 'TMA']
  registrationNumber: string;
  // Status
  status: ProjectStatus;
  verificationStatus: ProjectVerificationStatus;
  // Media
  coverImageUri?: string;        // URI of the cover/hero photo
  photos: string[];              // gallery URIs (up to 10)
  videoLinks: string[];          // YouTube / video URLs (up to 3)
  // Social
  facebookPage: string;
  website: string;
  youtubeChannel: string;
  // Meta
  amenities: string[];
  createdAt: string;
  updatedAt: string;
};

export type DevStats = {
  totalProjects: number;
  activeProjects: number;
  totalInventory: number;
  availableUnits: number;
  reservedUnits: number;
  soldUnits: number;
  totalListedValue: number;
  reservedValue: number;
  soldValue: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export const PROJECT_TYPES: ProjectType[] = [
  'Housing Society', 'Residential', 'Apartments', 'Commercial',
  'Plaza', 'Mixed Use', 'Industrial', 'Farmhouse', 'Other',
];

export const DEVELOPMENT_STATUSES: DevelopmentStatus[] = [
  'Pre-Launch', 'Under Construction', 'Construction Ongoing',
  'Near Completion', 'Ready for Possession', 'Completed',
];

export const OKARA_CITIES = [
  'Okara', 'Depalpur', 'Renala Khurd', 'Haveli Lakha',
  'Dipalpur', 'Basirpur', 'Chunian', 'Gogera', 'Sahiwal',
];

export const PLOT_SIZES = [
  '3 Marla', '5 Marla', '7 Marla', '10 Marla', '1 Kanal',
  '2 Kanal', '4 Kanal', '8 Kanal', '1 Acre', 'Commercial Plot',
];

export const NOC_STATUSES: NocStatus[] = [
  'Not Applied', 'Applied', 'Pending', 'Approved',
];

export const POSSESSION_STATUSES: PossessionStatus[] = [
  'Ready', 'Partial', 'Not Ready',
];

export const APPROVED_BY_LIST = [
  'LDA', 'DHA', 'TMA', 'PHATA', 'RDA', 'CDA', 'Cantonment Board',
  'WASA', 'EPA', 'Revenue Department', 'Other Authority',
];

export const AMENITIES_LIST = [
  'Mosque', 'Park', 'Playground', 'School', 'Hospital / Clinic',
  'Shopping Area', 'Community Hall', 'Boundary Wall', 'Security Guards',
  'CCTV Surveillance', 'Main Boulevard', 'Underground Utilities',
  'Gas Connection', 'Water Supply', 'Sewage System', 'Street Lights',
  'Wide Roads', 'Generator Backup', 'Swimming Pool', 'Gym / Fitness',
  'Sports Complex', 'Graveyard', 'Gated Entry', 'Green Belts',
];

/** Migrate old project records to include new fields with safe defaults */
export function migrateProject(p: Partial<DeveloperProject> & { id: string; developerId: string; name: string }): DeveloperProject {
  return {
    highlights: [], plotSizes: [], maxPrice: 0,
    paymentPlanAvailable: false, downPaymentPct: 20, installmentMonths: 36,
    possessionStatus: '', nocStatus: '', approvedBy: [], registrationNumber: '',
    googleMapsLink: '', projectOfficePhone: '', facebookPage: '', website: '', youtubeChannel: '',
    latitude: undefined, longitude: undefined,
    type: 'Housing Society', tagline: '', shortDescription: '', fullDescription: '',
    district: 'Okara', city: '', tehsil: '', area: '', address: '', nearbyLandmark: '',
    startingPrice: 0, totalUnits: 0, availableUnits: 0, reservedUnits: 0, soldUnits: 0,
    totalArea: '', totalBlocks: 0, developmentStatus: '', launchDate: '', expectedCompletion: '',
    status: 'Draft', verificationStatus: 'Unverified', amenities: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    ...p,
    // Ensure arrays are never undefined after spread (backward compat)
    photos:     (p as DeveloperProject).photos     ?? [],
    videoLinks: (p as DeveloperProject).videoLinks ?? [],
  } as DeveloperProject;
}

// ── Status colours ───────────────────────────────────────────────────────────

export function statusColor(status: ProjectStatus): { bg: string; text: string } {
  switch (status) {
    case 'Live':             return { bg: '#1a6b3a18', text: '#1a6b3a' };
    case 'Approved':         return { bg: '#1a6b3a12', text: '#1a6b3a' };
    case 'Draft':            return { bg: '#c8a45a18', text: '#c8a45a' };
    case 'Pending Review':   return { bg: '#102a4318', text: '#102a43' };
    case 'Under Development':return { bg: '#1a6b3a12', text: '#1a6b3a' };
    case 'Coming Soon':      return { bg: '#6b3a1a18', text: '#6b3a1a' };
    case 'Completed':        return { bg: '#0a8c6218', text: '#0a8c62' };
    case 'Paused':           return { bg: '#b94b4218', text: '#b94b42' };
    case 'Archived':         return { bg: '#88888818', text: '#888888' };
    default:                 return { bg: '#88888818', text: '#888888' };
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function getDevProjects(developerId: string): Promise<DeveloperProject[]> {
  const projects = await apiRequest<DeveloperProject[]>('/api/developer/projects');
  return projects.map(migrateProject).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function saveDevProject(project: DeveloperProject): Promise<void> {
  const existing = project.apiId ?? (project.id.startsWith('proj_') ? undefined : project.id);
  await apiRequest(`/api/developer/projects${existing ? `/${encodeURIComponent(String(existing))}` : ''}`, {
    method: existing ? 'PUT' : 'POST',
    body: JSON.stringify(project),
  });
}

export async function deleteDevProject(id: string): Promise<void> {
  await apiRequest(`/api/developer/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── Stats calculation ─────────────────────────────────────────────────────────

export function calcDevStats(projects: DeveloperProject[]): DevStats {
  const activeStatuses: ProjectStatus[] = ['Live', 'Under Development', 'Coming Soon', 'Approved'];
  const activeProjects = projects.filter((p) => activeStatuses.includes(p.status));
  const totalInventory = projects.reduce((s, p) => s + p.totalUnits, 0);
  const availableUnits = projects.reduce((s, p) => s + p.availableUnits, 0);
  const reservedUnits  = projects.reduce((s, p) => s + p.reservedUnits, 0);
  const soldUnits      = projects.reduce((s, p) => s + p.soldUnits, 0);
  const totalListedValue = projects.reduce((s, p) => s + p.startingPrice * p.totalUnits, 0);
  const reservedValue    = projects.reduce((s, p) => s + p.startingPrice * p.reservedUnits, 0);
  const soldValue        = projects.reduce((s, p) => s + p.startingPrice * p.soldUnits, 0);

  return {
    totalProjects: projects.length,
    activeProjects: activeProjects.length,
    totalInventory,
    availableUnits,
    reservedUnits,
    soldUnits,
    totalListedValue,
    reservedValue,
    soldValue,
  };
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function formatPKR(amount: number): string {
  if (amount >= 10_000_000) return `${(amount / 10_000_000).toFixed(1)}Cr`;
  if (amount >= 100_000)    return `${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000)      return `${(amount / 1_000).toFixed(0)}K`;
  return String(amount);
}

export function newProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Find a single project by ID across all developers — for buyer-facing screens. */
export async function getDevProjectById(id: string): Promise<DeveloperProject | null> {
  return migrateProject(await apiRequest<DeveloperProject>(`/api/developer/projects/${encodeURIComponent(id)}`));
}

/** Return all approved/live projects for buyer-facing browsing (not scoped to a developer). */
export async function getAllPublicProjects(): Promise<DeveloperProject[]> {
  return (await apiRequest<DeveloperProject[]>('/api/projects', {}, false)).map(migrateProject);
}
