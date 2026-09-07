/**
 * Developer Portal — Team Member Store
 * Team members are persisted to the authenticated backend account.
 */
import { apiRequest } from '@/lib/api';

export type TeamRole = 'Sales Rep' | 'Agent' | 'Manager' | 'Admin';
export const TEAM_ROLES: TeamRole[] = ['Sales Rep', 'Agent', 'Manager', 'Admin'];

export type TeamMember = {
  id: string;
  developerId: string;
  name: string;
  phone: string;
  email: string;
  role: TeamRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export function newMemberId(): string {
  return `member_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function roleColor(role: TeamRole): { bg: string; text: string } {
  switch (role) {
    case 'Admin':    return { bg: '#102a4318', text: '#102a43' };
    case 'Manager':  return { bg: '#7c3aed18', text: '#7c3aed' };
    case 'Agent':    return { bg: '#c8a45a18', text: '#c8a45a' };
    case 'Sales Rep':return { bg: '#1a6b3a18', text: '#1a6b3a' };
  }
}

export async function getTeamMembers(developerId: string): Promise<TeamMember[]> {
  return (await apiRequest<TeamMember[]>('/api/developer/team'))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function saveTeamMember(member: TeamMember): Promise<void> {
  const existing = !member.id.startsWith('member_');
  await apiRequest(`/api/developer/team${existing ? `/${encodeURIComponent(member.id)}` : ''}`, {
    method: existing ? 'PUT' : 'POST', body: JSON.stringify(member),
  });
}

export async function toggleMemberActive(id: string, developerId: string): Promise<TeamMember[]> {
  await apiRequest(`/api/developer/team/${encodeURIComponent(id)}/active`, { method: 'PATCH' });
  return getTeamMembers(developerId);
}

export async function deleteTeamMember(id: string): Promise<void> {
  await apiRequest(`/api/developer/team/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
