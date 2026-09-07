import { apiRequest } from '@/lib/api';
import type { CalcCorners, CalcMode, CalcResult, CalcUnit } from '@/lib/plotCalculator';

export type SavedMeasurement = {
  id: string | number;
  name: string;
  corners: CalcCorners;
  unit: CalcUnit;
  mode: CalcMode;
  inputs: Record<string, string>;
  labels: Record<string, string>;
  result?: CalcResult;
  createdAt?: string;
};

export async function getMeasurements(): Promise<SavedMeasurement[]> {
  return apiRequest<SavedMeasurement[]>('/api/measurements');
}

export async function saveMeasurement(
  measurement: Omit<SavedMeasurement, 'id' | 'createdAt'>,
): Promise<SavedMeasurement> {
  return apiRequest<SavedMeasurement>('/api/measurements', {
    method: 'POST',
    body: JSON.stringify(measurement),
  });
}

export async function deleteMeasurement(id: string | number): Promise<void> {
  await apiRequest(`/api/measurements/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
}