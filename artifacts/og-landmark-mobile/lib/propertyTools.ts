/**
 * Pure calculation services for the OG Landmark property tools.
 *
 * All area calculations use the Pakistan-standard values documented in the
 * product requirements. UI components should only format and present these
 * results; they should not duplicate the formulas.
 */

export type AreaUnit =
  | 'marla'
  | 'kanal'
  | 'sqft'
  | 'sqyard'
  | 'sqm'
  | 'acre'
  | 'hectare';

export const AREA_UNITS: Array<{ key: AreaUnit; label: string; shortLabel: string }> = [
  { key: 'marla', label: 'Marla', shortLabel: 'Marla' },
  { key: 'kanal', label: 'Kanal', shortLabel: 'Kanal' },
  { key: 'sqft', label: 'Square Feet', shortLabel: 'Sq.ft' },
  { key: 'sqyard', label: 'Square Yard', shortLabel: 'Sq.yd' },
  { key: 'sqm', label: 'Square Meter', shortLabel: 'Sq.m' },
  { key: 'acre', label: 'Acre', shortLabel: 'Acre' },
  { key: 'hectare', label: 'Hectare', shortLabel: 'Hectare' },
];

/** Pakistan-standard land conversion values. */
export const AREA_TO_SQFT: Record<AreaUnit, number> = {
  marla: 272.25,
  kanal: 5_445,
  sqft: 1,
  sqyard: 9,
  sqm: 10.763910416709722,
  acre: 43_560,
  hectare: 107_639.104167,
};

export const MARLA_SQFT = AREA_TO_SQFT.marla;
export const KANAL_SQFT = AREA_TO_SQFT.kanal;
export const ACRE_SQFT = AREA_TO_SQFT.acre;

export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  if (!Number.isFinite(value) || value < 0) return Number.NaN;
  return (value * AREA_TO_SQFT[from]) / AREA_TO_SQFT[to];
}

export function areaToAcres(value: number, unit: AreaUnit): number {
  return convertArea(value, unit, 'acre');
}

export function parseInputNumber(raw: string): number {
  const normalized = raw.replace(/,/g, '').trim();
  if (!normalized) return Number.NaN;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function validateNumber(
  raw: string,
  label: string,
  options: { required?: boolean; allowZero?: boolean } = {},
): string | null {
  const { required = true, allowZero = false } = options;
  if (!raw.trim()) return required ? `${label} is required.` : null;
  const value = parseInputNumber(raw);
  if (!Number.isFinite(value)) return `${label} must be a valid number.`;
  if (value < 0 || (!allowZero && value === 0)) {
    return allowZero
      ? `${label} cannot be negative.`
      : `${label} must be greater than zero.`;
  }
  if (value > Number.MAX_SAFE_INTEGER) return `${label} is too large.`;
  return null;
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

export function formatPKR(value: number): string {
  if (!Number.isFinite(value)) return 'PKR —';
  return `PKR ${value.toLocaleString('en-PK', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export interface PropertyPriceResult {
  area: number;
  pricePerUnit: number;
  totalPrice: number;
}

export function calculatePropertyPrice(
  area: number,
  pricePerUnit: number,
): PropertyPriceResult | null {
  if (!Number.isFinite(area) || !Number.isFinite(pricePerUnit) || area < 0 || pricePerUnit < 0) {
    return null;
  }
  const totalPrice = area * pricePerUnit;
  return Number.isFinite(totalPrice) ? { area, pricePerUnit, totalPrice } : null;
}

export interface ROICalculationInput {
  initialInvestment?: number;
  purchasePrice: number;
  developmentCost: number;
  annualRentalIncome: number;
  annualExpenses: number;
  expectedSellingPrice: number;
  investmentPeriodYears: number;
}

export interface ROICalculationResult {
  initialInvestment: number | null;
  totalInvestment: number;
  annualNetIncome: number;
  totalRentalIncome: number;
  capitalGain: number;
  totalProfit: number;
  roiPercent: number;
  annualRoiPercent: number;
  monthlyRentalIncome: number;
  monthlyNetIncome: number;
  breakEvenYears: number | null;
}

export function calculateROI(input: ROICalculationInput): ROICalculationResult | null {
  const {
    initialInvestment,
    purchasePrice,
    developmentCost,
    annualRentalIncome,
    annualExpenses,
    expectedSellingPrice,
    investmentPeriodYears,
  } = input;

  const numbers = [
    purchasePrice,
    developmentCost,
    annualRentalIncome,
    annualExpenses,
    expectedSellingPrice,
    investmentPeriodYears,
  ];
  if (
    numbers.some((value) => !Number.isFinite(value) || value < 0) ||
    investmentPeriodYears <= 0
  ) {
    return null;
  }

  const totalInvestment = purchasePrice + developmentCost;
  if (!Number.isFinite(totalInvestment) || totalInvestment <= 0) return null;

  const annualNetIncome = annualRentalIncome - annualExpenses;
  const totalRentalIncome = annualNetIncome * investmentPeriodYears;
  const capitalGain = expectedSellingPrice - purchasePrice;
  const totalProfit = totalRentalIncome + capitalGain - developmentCost;
  const roiPercent = (totalProfit / totalInvestment) * 100;
  const annualRoiPercent = (annualNetIncome / totalInvestment) * 100;

  return {
    initialInvestment:
      initialInvestment !== undefined && Number.isFinite(initialInvestment)
        ? initialInvestment
        : null,
    totalInvestment,
    annualNetIncome,
    totalRentalIncome,
    capitalGain,
    totalProfit,
    roiPercent,
    annualRoiPercent,
    monthlyRentalIncome: annualRentalIncome / 12,
    monthlyNetIncome: annualNetIncome / 12,
    breakEvenYears: annualNetIncome > 0 ? totalInvestment / annualNetIncome : null,
  };
}

export interface CropYieldResult {
  totalAcres: number;
  totalProduction: number;
  estimatedRevenue: number;
}

export function calculateCropYield(input: {
  landArea: number;
  areaUnit: AreaUnit;
  expectedYieldPerAcre: number;
  sellingPricePerUnit: number;
}): CropYieldResult | null {
  const { landArea, areaUnit, expectedYieldPerAcre, sellingPricePerUnit } = input;
  if (
    [landArea, expectedYieldPerAcre, sellingPricePerUnit].some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  ) {
    return null;
  }
  const totalAcres = areaToAcres(landArea, areaUnit);
  const totalProduction = totalAcres * expectedYieldPerAcre;
  const estimatedRevenue = totalProduction * sellingPricePerUnit;
  if (![totalAcres, totalProduction, estimatedRevenue].every(Number.isFinite)) return null;
  return { totalAcres, totalProduction, estimatedRevenue };
}

export interface AgriculturalIncomeResult {
  totalAcres: number;
  grossAnnualIncome: number;
  netAnnualIncome: number;
  monthlyEquivalentIncome: number;
  annualRoiPercent: number | null;
}

export function calculateAgriculturalIncome(input: {
  landArea: number;
  areaUnit: AreaUnit;
  annualRentPerAcre: number;
  annualFarmingExpenses: number;
  purchasePrice?: number;
}): AgriculturalIncomeResult | null {
  const { landArea, areaUnit, annualRentPerAcre, annualFarmingExpenses, purchasePrice } = input;
  if (
    [landArea, annualRentPerAcre, annualFarmingExpenses].some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  ) {
    return null;
  }
  const totalAcres = areaToAcres(landArea, areaUnit);
  const grossAnnualIncome = totalAcres * annualRentPerAcre;
  const netAnnualIncome = grossAnnualIncome - annualFarmingExpenses;
  const monthlyEquivalentIncome = netAnnualIncome / 12;
  const annualRoiPercent =
    purchasePrice !== undefined && Number.isFinite(purchasePrice) && purchasePrice > 0
      ? (netAnnualIncome / purchasePrice) * 100
      : null;
  if (![totalAcres, grossAnnualIncome, netAnnualIncome, monthlyEquivalentIncome].every(Number.isFinite)) {
    return null;
  }
  return {
    totalAcres,
    grossAnnualIncome,
    netAnnualIncome,
    monthlyEquivalentIncome,
    annualRoiPercent,
  };
}

export interface LandInvestmentResult {
  totalPurchaseCost: number;
  totalInvestment: number;
  expectedSellingPrice: number;
  expectedProfit: number;
  roiPercent: number;
  annualizedRoiPercent: number | null;
}

export function calculateLandInvestment(input: {
  area: number;
  areaUnit: AreaUnit;
  pricePerUnit: number;
  purchasePrice?: number;
  developmentCost: number;
  expectedSellingPrice: number;
  holdingPeriodYears?: number;
}): LandInvestmentResult | null {
  const {
    area,
    areaUnit,
    pricePerUnit,
    purchasePrice,
    developmentCost,
    expectedSellingPrice,
    holdingPeriodYears,
  } = input;
  if (
    [area, pricePerUnit, developmentCost, expectedSellingPrice].some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  ) {
    return null;
  }
  const calculatedPurchaseCost = area * pricePerUnit;
  const totalPurchaseCost =
    purchasePrice !== undefined && Number.isFinite(purchasePrice) && purchasePrice > 0
      ? purchasePrice
      : calculatedPurchaseCost;
  const totalInvestment = totalPurchaseCost + developmentCost;
  if (!Number.isFinite(totalPurchaseCost) || !Number.isFinite(totalInvestment) || totalInvestment <= 0) {
    return null;
  }
  const expectedProfit = expectedSellingPrice - totalInvestment;
  const roiPercent = (expectedProfit / totalInvestment) * 100;
  const annualizedRoiPercent =
    holdingPeriodYears !== undefined &&
    Number.isFinite(holdingPeriodYears) &&
    holdingPeriodYears > 0 &&
    expectedSellingPrice > 0
      ? (Math.pow(expectedSellingPrice / totalInvestment, 1 / holdingPeriodYears) - 1) * 100
      : null;

  // Keep the argument explicit so TypeScript catches accidental unit changes in callers.
  void areaUnit;
  return {
    totalPurchaseCost,
    totalInvestment,
    expectedSellingPrice,
    expectedProfit,
    roiPercent,
    annualizedRoiPercent,
  };
}