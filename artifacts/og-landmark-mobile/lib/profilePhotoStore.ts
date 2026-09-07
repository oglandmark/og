import { apiRequest } from '@/lib/api';

export async function getProfilePhoto(): Promise<string | null> {
  const profile = await apiRequest<{ url?: string | null }>('/api/account/profile-photo');
  return profile.url ?? null;
}

export async function saveProfilePhoto(uri: string): Promise<void> {
  await apiRequest('/api/account/profile-photo', {
    method: 'PUT', body: JSON.stringify({ url: uri }),
  });
}

export async function removeProfilePhoto(): Promise<void> {
  await apiRequest('/api/account/profile-photo', { method: 'DELETE' });
}