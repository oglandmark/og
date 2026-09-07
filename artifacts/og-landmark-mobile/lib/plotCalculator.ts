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

type TriangleCalculation = { area: number; isEstimate: boolean };

function estimateTriangleArea(a: number, b: number, c: number): number {
  const [base, sideA, sideB] = [a, b, c].sort((left, right) => right - left);
  // When side lengths cannot form a triangle, use the longest side as the
  // baseline and the average of the other measurements as an estimated height.
  return (base * (sideA + sideB)) / 4;
}

function calculateTriangleArea(a: number, b: number, c: number): TriangleCalculation {
  const exactArea = triangleArea(a, b, c);
  if (exactArea !== null) return { area: exactArea, isEstimate: false };
  return { area: estimateTriangleArea(a, b, c), isEstimate: true };
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
    const calculation = calculateTriangleArea(value('A'), value('B'), value('C'));
    return makeResult(
      calculation.area,
      calculation.isEstimate,
      calculation.isEstimate
        ? 'Approximate estimate because the entered side lengths do not form a geometric triangle.'
        : undefined,
    );
  }

  if (mode === 'basic') {
    if (corners !== 4) {
      return 'Side lengths alone cannot determine an irregular plot. Switch to Accurate Irregular Plot mode and add diagonals.';
    }
    const [a, b, c, d] = sideKeys.map(value);
    const oppositeMismatch = Math.max(Math.abs(a - c) / Math.max(a, c), Math.abs(b - d) / Math.max(b, d));
    const area = ((a + c) / 2) * ((b + d) / 2);
    return makeResult(
      area,
      true,
      oppositeMismatch > 0.15
        ? 'Approximate estimate using the average of the entered opposite-side measurements.'
        : 'Basic estimate using the average of opposite sides. Use Accurate mode for an irregular plot.',
    );
  }

  const diagonalKeys = Array.from(
    { length: corners - 3 },
    (_, index) => `A${String.fromCharCode(67 + index)}`,
  );
  let sqft = 0;
  let isEstimate = false;
  const firstTriangle = calculateTriangleArea(value('A'), value('B'), value(diagonalKeys[0]!));
  sqft += firstTriangle.area;
  isEstimate ||= firstTriangle.isEstimate;

  for (let index = 1; index < diagonalKeys.length; index += 1) {
    const middleTriangle = calculateTriangleArea(
      value(diagonalKeys[index - 1]!),
      value(sideKeys[index + 1]!),
      value(diagonalKeys[index]!),
    );
    sqft += middleTriangle.area;
    isEstimate ||= middleTriangle.isEstimate;
  }

  const lastDiagonal = diagonalKeys[diagonalKeys.length - 1]!;
  const lastTriangle = calculateTriangleArea(
    value(lastDiagonal),
    value(sideKeys[corners - 2]!),
    value(sideKeys[corners - 1]!),
  );
  sqft += lastTriangle.area;
  isEstimate ||= lastTriangle.isEstimate;
  return makeResult(
    sqft,
    isEstimate,
    isEstimate
      ? 'Approximate estimate because one or more entered measurements do not form valid triangle geometry.'
      : 'Accurate triangulation from the entered boundary measurements.',
  );
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