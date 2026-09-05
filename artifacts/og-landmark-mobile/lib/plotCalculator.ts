/**
 * Measurement-driven plot-area calculations.
 *
 * A polygon's side lengths alone do not uniquely describe an irregular plot.
 * Accurate mode therefore uses diagonals from corner A to triangulate the plot.
 * Basic mode only calculates triangles exactly and offers a clearly labelled
 * estimate for rectangle-like four-sided plots.
 */

export const SQFT_PER_SQYARD = 9;
export const SQFT_PER_SQM = 10.763910416709722;
export const MARLA_SQFT = 272.25;
export const KANAL_SQFT = 5445;
export const ACRE_SQFT = 43560;

export type CalcCorners = 3 | 4 | 5 | 6 | 7 | 8;
export type CalcUnit = 'ft' | 'in' | 'm';
export type CalcMode = 'basic' | 'accurate';

export interface CalcResult {
  sqft: number;
  sqYards: number;
  marla: number;
  kanal: number;
  acre: number;
  sqm: number;
  isEstimate: boolean;
  note?: string;
}

export interface CalcField {
  key: string;
  label: string;
  hint: string;
  kind: 'side' | 'diagonal';
}

export const SIDE_LABELS: Record<string, string> = {
  A: 'Side A–B',
  B: 'Side B–C',
  C: 'Side C–D',
  D: 'Side D–E',
  E: 'Side E–F',
  F: 'Side F–G',
  G: 'Side G–H',
  H: 'Side H–A',
};

function toFeet(value: number, unit: CalcUnit): number {
  if (unit === 'in') return value / 12;
  return unit === 'm' ? value * 3.280839895013123 : value;
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
  const squaredArea = semiperimeter *
    (semiperimeter - a) * (semiperimeter - b) * (semiperimeter - c);
  if (!Number.isFinite(squaredArea) || squaredArea < 0) return null;
  return Math.sqrt(squaredArea);
}

function makeResult(sqft: number, isEstimate = false, note?: string): CalcResult {
  return {
    sqft,
    sqYards: sqft / SQFT_PER_SQYARD,
    marla: sqft / MARLA_SQFT,
    kanal: sqft / KANAL_SQFT,
    acre: sqft / ACRE_SQFT,
    sqm: sqft / SQFT_PER_SQM,
    isEstimate,
    note,
  };
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

function missingMeasurements(fields: CalcField[], raw: Record<string, string>): string[] {
  return fields.filter((field) => !(raw[field.key] ?? '').trim()).map((field) => field.label);
}

/**
 * Calculates the area in square feet, then returns all configured conversions.
 * Accurate polygons are fan-triangulated from A using AC, AD, AE, etc.
 */
export function computePlotArea(
  corners: CalcCorners,
  raw: Record<string, string>,
  unit: CalcUnit,
  mode: CalcMode = 'accurate',
): CalcResult | string {
  const fields = CALC_FIELDS[corners].filter((field) => mode === 'accurate' || field.kind === 'side');
  const invalid = invalidMeasurement(fields, raw);
  if (invalid) return invalid;
  const missing = missingMeasurements(fields, raw);
  if (missing.length > 0) return `Enter ${missing.join(', ')} to calculate the area.`;

  const sideKeys = Array.from({ length: corners }, (_, index) => String.fromCharCode(65 + index));
  const value = (key: string) => parseMeasurement(raw, key, unit)!;

  if (corners === 3) {
    const area = triangleArea(value('A'), value('B'), value('C'));
    return area == null ? 'These measurements cannot form a valid triangle.' : makeResult(area);
  }

  if (mode === 'basic') {
    if (corners !== 4) {
      return 'Side lengths alone cannot determine an irregular plot. Switch to Accurate Irregular Plot mode and add diagonals.';
    }
    const [a, b, c, d] = sideKeys.map(value);
    const oppositeMismatch = Math.max(Math.abs(a - c) / Math.max(a, c), Math.abs(b - d) / Math.max(b, d));
    if (oppositeMismatch > 0.15) {
      return 'Basic mode needs a rectangle-like plot. For an irregular four-sided plot, switch to Accurate mode and enter diagonal AC.';
    }
    const area = ((a + c) / 2) * ((b + d) / 2);
    return makeResult(area, true, 'Basic estimate using the average of opposite sides. Use Accurate mode for an irregular plot.');
  }

  const diagonalKeys = Array.from(
    { length: corners - 3 },
    (_, index) => `A${String.fromCharCode(67 + index)}`,
  );
  let sqft = 0;
  const firstTriangle = triangleArea(value('A'), value('B'), value(diagonalKeys[0]!));
  if (firstTriangle == null) return 'The entered sides and diagonals cannot form a valid triangle.';
  sqft += firstTriangle;

  for (let index = 1; index < diagonalKeys.length; index += 1) {
    const middleTriangle = triangleArea(
      value(diagonalKeys[index - 1]!),
      value(sideKeys[index + 1]!),
      value(diagonalKeys[index]!),
    );
    if (middleTriangle == null) return 'The entered sides and diagonals cannot form a valid triangle.';
    sqft += middleTriangle;
  }

  const lastDiagonal = diagonalKeys[diagonalKeys.length - 1]!;
  const lastTriangle = triangleArea(value(lastDiagonal), value(sideKeys[corners - 2]!), value(sideKeys[corners - 1]!));
  if (lastTriangle == null) return 'The entered sides and diagonals cannot form a valid triangle.';
  return makeResult(sqft, false, 'Accurate triangulation from the entered boundary measurements.');
}

function makeCalcFields(corners: CalcCorners): CalcField[] {
  const sideFields: CalcField[] = Array.from({ length: corners }, (_, index) => {
    const current = String.fromCharCode(65 + index);
    const next = String.fromCharCode(65 + ((index + 1) % corners));
    return {
      key: current,
      label: SIDE_LABELS[current] ?? `Side ${current}–${next}`,
      hint: `${current}${next}`,
      kind: 'side',
    };
  });
  const diagonalFields: CalcField[] = Array.from({ length: corners - 3 }, (_, index) => {
    const target = String.fromCharCode(67 + index);
    return { key: `A${target}`, label: `Diagonal A–${target}`, hint: `A → ${target}`, kind: 'diagonal' };
  });
  return [...sideFields, ...diagonalFields];
}

export const CALC_FIELDS: Record<CalcCorners, CalcField[]> = {
  3: makeCalcFields(3),
  4: makeCalcFields(4),
  5: makeCalcFields(5),
  6: makeCalcFields(6),
  7: makeCalcFields(7),
  8: makeCalcFields(8),
};