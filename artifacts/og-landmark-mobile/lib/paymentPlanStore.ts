/**
 * Developer Portal — Payment Plan Store
 * Payment plans are persisted to the authenticated backend account.
 */
import { apiRequest } from '@/lib/api';

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
  const plans = await apiRequest<PaymentPlan[]>('/api/developer/payment-plans');
  return plans.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function savePaymentPlan(plan: PaymentPlan): Promise<void> {
  const existing = !plan.id.startsWith('plan_');
  await apiRequest(`/api/developer/payment-plans${existing ? `/${encodeURIComponent(plan.id)}` : ''}`, {
    method: existing ? 'PUT' : 'POST', body: JSON.stringify(plan),
  });
}

export async function deletePaymentPlan(id: string): Promise<void> {
  await apiRequest(`/api/developer/payment-plans/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
