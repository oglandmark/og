/**
 * Developer Portal — Inventory Store
 * Block and unit CRUD is persisted to the authenticated backend account.
 */
import { apiRequest } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

export type UnitStatus = 'Available' | 'Reserved' | 'Booked' | 'Sold' | 'Blocked';

export type UnitType =
  | 'Residential Plot'
  | 'Commercial Plot'
  | 'House'
  | 'Flat / Apartment'
  | 'Shop'
  | 'Office'
  | 'Farmhouse'
  | 'Other';

export type PlotSize =
  | '3 Marla'
  | '5 Marla'
  | '7 Marla'
  | '10 Marla'
  | '1 Kanal'
  | '2 Kanal'
  | 'Custom';

export type BlockDevelopmentStatus =
  | 'Planned'
  | 'Under Development'
  | 'Near Completion'
  | 'Completed';

export type InventoryBlock = {
  id: string;
  projectId: string;
  name: string;                        // e.g. "Block A", "Phase 1"
  totalUnits: number;
  developmentStatus: BlockDevelopmentStatus;
  createdAt: string;
  updatedAt: string;
};

export type InventoryUnit = {
  id: string;
  projectId: string;
  blockId: string;
  // Core
  unitNumber: string;                  // e.g. "A-101", "Plot 23"
  type: UnitType;
  status: UnitStatus;
  price: number;                       // PKR
  // Size / Plot fields
  size: PlotSize | string;             // "5 Marla", "2400 sqft", etc.
  // Optional fields
  floor?: string;                      // for apartments / shops
  bedrooms?: number;
  bathrooms?: number;
  street?: string;
  facing?: string;                     // N, S, E, W, Main Road
  isCorner: boolean;
  isParkFacing: boolean;
  notes?: string;
  // Meta
  createdAt: string;
  updatedAt: string;
};

export type InventoryStats = {
  totalBlocks: number;
  totalUnits: number;
  available: number;
  reserved: number;
  booked: number;
  sold: number;
  blocked: number;
  availableValue: number;
  reservedValue: number;
  soldValue: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

export const UNIT_TYPES: UnitType[] = [
  'Residential Plot', 'Commercial Plot', 'House',
  'Flat / Apartment', 'Shop', 'Office', 'Farmhouse', 'Other',
];

export const PLOT_SIZES: PlotSize[] = [
  '3 Marla', '5 Marla', '7 Marla', '10 Marla', '1 Kanal', '2 Kanal', 'Custom',
];

export const UNIT_STATUSES: UnitStatus[] = [
  'Available', 'Reserved', 'Booked', 'Sold', 'Blocked',
];

export const BLOCK_DEV_STATUSES: BlockDevelopmentStatus[] = [
  'Planned', 'Under Development', 'Near Completion', 'Completed',
];

export const FACINGS = ['North', 'South', 'East', 'West', 'Main Road', 'Park'];

// ── Status colours ────────────────────────────────────────────────────────────

export function unitStatusColor(status: UnitStatus): { bg: string; text: string } {
  switch (status) {
    case 'Available': return { bg: '#1a6b3a18', text: '#1a6b3a' };
    case 'Reserved':  return { bg: '#c8a45a18', text: '#c8a45a' };
    case 'Booked':    return { bg: '#102a4318', text: '#102a43' };
    case 'Sold':      return { bg: '#0a8c6218', text: '#0a8c62' };
    case 'Blocked':   return { bg: '#88888818', text: '#888888' };
    default:          return { bg: '#88888818', text: '#888888' };
  }
}

// ── ID generators ─────────────────────────────────────────────────────────────

export function newBlockId(): string {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function newUnitId(): string {
  return `unit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Block CRUD ────────────────────────────────────────────────────────────────

export async function getBlocks(projectId: string): Promise<InventoryBlock[]> {
  return (await apiRequest<InventoryBlock[]>(`/api/developer/projects/${encodeURIComponent(projectId)}/blocks`))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveBlock(block: InventoryBlock): Promise<void> {
  const existing = !block.id.startsWith('blk_');
  await apiRequest(`/api/developer/blocks${existing ? `/${encodeURIComponent(block.id)}` : ''}`, {
    method: existing ? 'PUT' : 'POST', body: JSON.stringify(block),
  });
}

export async function deleteBlock(blockId: string): Promise<void> {
  await apiRequest(`/api/developer/blocks/${encodeURIComponent(blockId)}`, { method: 'DELETE' });
}

// ── Unit CRUD ─────────────────────────────────────────────────────────────────

export async function getUnits(projectId: string, blockId?: string): Promise<InventoryUnit[]> {
  const query = blockId ? `?blockId=${encodeURIComponent(blockId)}` : '';
  return (await apiRequest<InventoryUnit[]>(`/api/developer/projects/${encodeURIComponent(projectId)}/units${query}`))
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }));
}

export async function saveUnit(unit: InventoryUnit): Promise<void> {
  const existing = !unit.id.startsWith('unit_');
  await apiRequest(`/api/developer/units${existing ? `/${encodeURIComponent(unit.id)}` : ''}`, {
    method: existing ? 'PUT' : 'POST', body: JSON.stringify(unit),
  });
}

export async function deleteUnit(unitId: string): Promise<void> {
  await apiRequest(`/api/developer/units/${encodeURIComponent(unitId)}`, { method: 'DELETE' });
}


// ── Stats ─────────────────────────────────────────────────────────────────────

export function calcInventoryStats(blocks: InventoryBlock[], units: InventoryUnit[]): InventoryStats {
  const available = units.filter((u) => u.status === 'Available');
  const reserved  = units.filter((u) => u.status === 'Reserved');
  const booked    = units.filter((u) => u.status === 'Booked');
  const sold      = units.filter((u) => u.status === 'Sold');
  const blocked   = units.filter((u) => u.status === 'Blocked');

  const sum = (arr: InventoryUnit[]) => arr.reduce((s, u) => s + u.price, 0);

  return {
    totalBlocks: blocks.length,
    totalUnits: units.length,
    available: available.length,
    reserved: reserved.length,
    booked: booked.length,
    sold: sold.length,
    blocked: blocked.length,
    availableValue: sum(available),
    reservedValue:  sum(reserved),
    soldValue:      sum(sold),
  };
}
