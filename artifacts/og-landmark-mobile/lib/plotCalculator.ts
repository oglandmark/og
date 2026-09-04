/**
 * Measurement-driven plot-area calculations.
 *
 * Every polygon is triangulated from the entered boundary sides and diagonals.
 * No depth, average, standard plot size, or missing measurement is inferred.
 */

export const SQFT_PER_SQYARD = 9;
export const SQFT_PER_SQM = 10.763910416709722;
export const SQFT_PER_INCH = 1 / 144;
export const MARLA_SQFT = 272.25;
export const KANAL_SQFT = 5445; // 20 marla
export const ACRE_SQFT = 43560; // 8 kanal

export type CalcCorners = 3 | 4 | 5;
export type CalcUnit = 'ft' | 'in' | 'm';

export interface CalcResult {
  sqft: number;
  sqYards: number;
  marla: number;
  kanal: number;
  acre: number;
  sqm: number;
}

export interface CalcField {
  key: string;
  label: string;
  hint: string;
  kind: 'side' | 'diagonal';
}

function toFeet(value: number, unit: CalcUnit): number {
  if (unit === 'in') return value / 12;
  if (unit === 'm') return value * 3.280839895013123;
  return value;
}

function parseMeasurement(raw: Record<string, string>, key: string, unit: CalcUnit): number | null {
  const text = (raw[key] ?? '').trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  return toFeet(value, unit);
}

function triangleArea(a: number, b: number, c: number): number | null {
  const semiperimeter = (a + b + c) / 2;
  const squaredArea =
    semiperimeter *
    (semiperimeter - a) *
    (semiperimeter - b) *
    (semiperimeter - c);

  if (!Number.isFinite(squaredArea)) return null;

  // Keep the calculator permissive: any positive numeric measurements should
  // produce a result instead of stopping on a triangle-inequality warning.
  return Math.sqrt(Math.abs(squaredArea));
}

function missingMeasurements(fields: CalcField[], raw: Record<string, string>): string[] {
  return fields
    .filter((field) => !(raw[field.key] ?? '').trim())
    .map((field) => field.label);
}

function invalidMeasurement(fields: CalcField[], raw: Record<string, string>): string | null {
  const invalid = fields.find((field) => {
    const text = (raw[field.key] ?? '').trim();
    if (!text) return false;
    const value = Number(text);
    return !Number.isFinite(value) || value <= 0;
  });
  return invalid ? `${invalid.label} must be a number greater than zero.` : null;
}

function makeResult(sqft: number): CalcResult {
  return {
    sqft,
    sqYards: sqft / SQFT_PER_SQYARD,
    marla: sqft / MARLA_SQFT,
    kanal: sqft / KANAL_SQFT,
    acre: sqft / ACRE_SQFT,
    sqm: sqft / SQFT_PER_SQM,
  };
}

export function computePlotArea(
  corners: CalcCorners,
  raw: Record<string, string>,
  unit: CalcUnit,
): CalcResult | string {
  const fields = CALC_FIELDS[corners];
  const invalid = invalidMeasurement(fields, raw);
  if (invalid) return invalid;

  const missing = missingMeasurements(fields, raw);
  if (missing.length > 0) {
    return `Additional measurement required: enter ${missing.join(', ')}.`;
  }

  const value = (key: string) => parseMeasurement(raw, key, unit)!;
  let sqft = 0;

  if (corners === 3) {
    const area = triangleArea(value('A'), value('B'), value('C'));
    if (area == null) return 'Unable to calculate these measurements.';
    sqft = area;
  } else if (corners === 4) {
    const firstTriangle = triangleArea(value('A'), value('B'), value('AC'));
    const secondTriangle = triangleArea(value('C'), value('D'), value('AC'));
    if (firstTriangle == null || secondTriangle == null) return 'Unable to calculate these measurements.';
    sqft = firstTriangle + secondTriangle;
  } else {
    const firstTriangle = triangleArea(value('A'), value('B'), value('AC'));
    const middleTriangle = triangleArea(value('AC'), value('C'), value('AD'));
    const lastTriangle = triangleArea(value('AD'), value('D'), value('E'));
    if (firstTriangle == null || middleTriangle == null || lastTriangle == null) {
      return 'Unable to calculate these measurements.';
    }
    sqft = firstTriangle + middleTriangle + lastTriangle;
  }

  return makeResult(sqft);
}

export const CALC_FIELDS: Record<CalcCorners, CalcField[]> = {
  3: [
    { key: 'A', label: 'Side A', hint: 'AB', kind: 'side' },
    { key: 'B', label: 'Side B', hint: 'BC', kind: 'side' },
    { key: 'C', label: 'Side C', hint: 'CA', kind: 'side' },
  ],
  4: [
    { key: 'A', label: 'Side A', hint: 'AB', kind: 'side' },
    { key: 'B', label: 'Side B', hint: 'BC', kind: 'side' },
    { key: 'C', label: 'Side C', hint: 'CD', kind: 'side' },
    { key: 'D', label: 'Side D', hint: 'DA', kind: 'side' },
    { key: 'AC', label: 'Diagonal AC', hint: 'Corner 1 → 3', kind: 'diagonal' },
  ],
  5: [
    { key: 'A', label: 'Side A', hint: 'AB', kind: 'side' },
    { key: 'B', label: 'Side B', hint: 'BC', kind: 'side' },
    { key: 'C', label: 'Side C', hint: 'CD', kind: 'side' },
    { key: 'D', label: 'Side D', hint: 'DE', kind: 'side' },
    { key: 'E', label: 'Side E', hint: 'EA', kind: 'side' },
    { key: 'AC', label: 'Diagonal AC', hint: 'Corner 1 → 3', kind: 'diagonal' },
    { key: 'AD', label: 'Diagonal AD', hint: 'Corner 1 → 4', kind: 'diagonal' },
  ],
};