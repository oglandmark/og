/**
 * Developer Portal — Inventory Store
 * Block + Unit CRUD backed by AsyncStorage.
 * API-ready: replace AsyncStorage calls with oglandmark.com API endpoints when backend is ready.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const BLOCKS_KEY = '@og-landmark/inventory-blocks-v1';
const UNITS_KEY  = '@og-landmark/inventory-units-v1';

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
  try {
    const raw = await AsyncStorage.getItem(BLOCKS_KEY);
    if (!raw) return [];
    const all: InventoryBlock[] = JSON.parse(raw);
    return all
      .filter((b) => b.projectId === projectId)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function saveBlock(block: InventoryBlock): Promise<void> {
  // Failures propagate to the caller — never swallow silently.
  // TODO: replace AsyncStorage calls with API — POST/PATCH oglandmark.com/api/developer/blocks
  let all: InventoryBlock[] = [];
  try {
    const raw = await AsyncStorage.getItem(BLOCKS_KEY);
    if (raw) all = JSON.parse(raw) as InventoryBlock[];
  } catch {
    // Corrupted storage: start fresh rather than losing the incoming write.
    all = [];
  }
  const now = new Date().toISOString();
  const idx = all.findIndex((b) => b.id === block.id);
  if (idx >= 0) {
    all[idx] = { ...block, updatedAt: now };
  } else {
    all.push({ ...block, createdAt: now, updatedAt: now });
  }
  // Let this throw if AsyncStorage itself fails — the UI will catch and alert.
  await AsyncStorage.setItem(BLOCKS_KEY, JSON.stringify(all));
}

export async function deleteBlock(blockId: string): Promise<void> {
  // TODO: replace with API — DELETE oglandmark.com/api/developer/blocks/:id
  let all: InventoryBlock[] = [];
  try {
    const raw = await AsyncStorage.getItem(BLOCKS_KEY);
    if (raw) all = JSON.parse(raw) as InventoryBlock[];
  } catch {
    all = [];
  }
  await AsyncStorage.setItem(BLOCKS_KEY, JSON.stringify(all.filter((b) => b.id !== blockId)));
  // Cascade: also delete all units in this block (propagates if it throws)
  await deleteUnitsByBlock(blockId);
}

// ── Unit CRUD ─────────────────────────────────────────────────────────────────

export async function getUnits(projectId: string, blockId?: string): Promise<InventoryUnit[]> {
  try {
    const raw = await AsyncStorage.getItem(UNITS_KEY);
    if (!raw) return [];
    const all: InventoryUnit[] = JSON.parse(raw);
    return all
      .filter((u) => u.projectId === projectId && (!blockId || u.blockId === blockId))
      .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }));
  } catch {
    return [];
  }
}

export async function saveUnit(unit: InventoryUnit): Promise<void> {
  // Failures propagate to the caller — never swallow silently.
  // TODO: replace AsyncStorage calls with API — POST/PATCH oglandmark.com/api/developer/units
  let all: InventoryUnit[] = [];
  try {
    const raw = await AsyncStorage.getItem(UNITS_KEY);
    if (raw) all = JSON.parse(raw) as InventoryUnit[];
  } catch {
    // Corrupted storage: start fresh so the incoming write still succeeds.
    all = [];
  }
  const now = new Date().toISOString();
  const idx = all.findIndex((u) => u.id === unit.id);
  if (idx >= 0) {
    all[idx] = { ...unit, updatedAt: now };
  } else {
    all.push({ ...unit, createdAt: now, updatedAt: now });
  }
  // Let this throw if AsyncStorage itself fails — the UI will catch and alert.
  await AsyncStorage.setItem(UNITS_KEY, JSON.stringify(all));
}

export async function deleteUnit(unitId: string): Promise<void> {
  // TODO: replace with API — DELETE oglandmark.com/api/developer/units/:id
  let all: InventoryUnit[] = [];
  try {
    const raw = await AsyncStorage.getItem(UNITS_KEY);
    if (raw) all = JSON.parse(raw) as InventoryUnit[];
  } catch {
    all = [];
  }
  await AsyncStorage.setItem(UNITS_KEY, JSON.stringify(all.filter((u) => u.id !== unitId)));
}

async function deleteUnitsByBlock(blockId: string): Promise<void> {
  let all: InventoryUnit[] = [];
  try {
    const raw = await AsyncStorage.getItem(UNITS_KEY);
    if (raw) all = JSON.parse(raw) as InventoryUnit[];
  } catch {
    all = [];
  }
  await AsyncStorage.setItem(UNITS_KEY, JSON.stringify(all.filter((u) => u.blockId !== blockId)));
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
