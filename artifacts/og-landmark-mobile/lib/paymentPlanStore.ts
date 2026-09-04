/**
 * Developer Portal — Payment Plan Store
 * API-ready: swap AsyncStorage calls with oglandmark.com API when backend docs available.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PLANS_KEY = '@og-landmark/payment-plans-v1';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaymentPlan = {
  id: string;
  developerId: string;
  projectId: string;
  projectName: string;
  // Plan identity
  planName: string;
  unitType: string;     // e.g. "5 Marla Plot", "2 Bed Apartment"
  // Price
  totalPrice: number;
  // Fixed payments
  bookingAmount: number;
  downPayment: number;
  confirmationAmount: number;
  possessionCharges: number;
  developmentCharges: number;
  otherCharges: number;
  // Installments
  monthlyInstallment: number;
  quarterlyInstallment: number;
  installmentCount: number;   // number of monthly installments
  // Timestamps
  createdAt: string;
  updatedAt: string;
};

// ── Calculations ──────────────────────────────────────────────────────────────

export type PlanSummary = {
  totalFixed: number;     // sum of all fixed payments
  totalInstallments: number; // monthlyInstallment × installmentCount
  remaining: number;      // totalPrice - totalFixed (paid via installments)
  totalPaid: number;      // totalFixed + totalInstallments (should equal totalPrice)
};

export function calcPlanSummary(plan: PaymentPlan): PlanSummary {
  const totalFixed =
    plan.bookingAmount +
    plan.downPayment +
    plan.confirmationAmount +
    plan.possessionCharges +
    plan.developmentCharges +
    plan.otherCharges;
  const totalInstallments = plan.monthlyInstallment * plan.installmentCount;
  const remaining = Math.max(0, plan.totalPrice - totalFixed);
  const totalPaid = totalFixed + totalInstallments;
  return { totalFixed, totalInstallments, remaining, totalPaid };
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function fmtPKR(n: number): string {
  if (n === 0) return '—';
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)} Cr`;
  if (n >= 100_000)    return `${(n / 100_000).toFixed(1)} L`;
  if (n >= 1_000)      return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export function newPlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getPaymentPlans(developerId: string): Promise<PaymentPlan[]> {
  try {
    const raw = await AsyncStorage.getItem(PLANS_KEY);
    if (!raw) return [];
    const all: PaymentPlan[] = JSON.parse(raw);
    return all
      .filter((p) => p.developerId === developerId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

export async function savePaymentPlan(plan: PaymentPlan): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PLANS_KEY);
    const all: PaymentPlan[] = raw ? JSON.parse(raw) : [];
    const now = new Date().toISOString();
    const idx = all.findIndex((p) => p.id === plan.id);
    if (idx >= 0) all[idx] = { ...plan, updatedAt: now };
    else all.push({ ...plan, createdAt: now, updatedAt: now });
    await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(all));
  } catch {
    // TODO: POST/PATCH oglandmark.com/api/developer/payment-plans
  }
}

export async function deletePaymentPlan(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PLANS_KEY);
    if (!raw) return;
    const all: PaymentPlan[] = JSON.parse(raw);
    await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(all.filter((p) => p.id !== id)));
  } catch {}
}
