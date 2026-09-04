/**
 * Developer Portal — Team Member Store
 * API-ready: swap AsyncStorage calls with oglandmark.com API when backend docs available.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TEAM_KEY = '@og-landmark/team-members-v1';

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
  try {
    const raw = await AsyncStorage.getItem(TEAM_KEY);
    if (!raw) return [];
    const all: TeamMember[] = JSON.parse(raw);
    return all
      .filter((m) => m.developerId === developerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function saveTeamMember(member: TeamMember): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TEAM_KEY);
    const all: TeamMember[] = raw ? JSON.parse(raw) : [];
    const now = new Date().toISOString();
    const idx = all.findIndex((m) => m.id === member.id);
    if (idx >= 0) all[idx] = { ...member, updatedAt: now };
    else all.push({ ...member, createdAt: now, updatedAt: now });
    await AsyncStorage.setItem(TEAM_KEY, JSON.stringify(all));
  } catch {
    // TODO: POST/PATCH oglandmark.com/api/developer/team
  }
}

export async function toggleMemberActive(id: string, developerId: string): Promise<TeamMember[]> {
  try {
    const raw = await AsyncStorage.getItem(TEAM_KEY);
    if (!raw) return [];
    const all: TeamMember[] = JSON.parse(raw);
    const idx = all.findIndex((m) => m.id === id);
    if (idx >= 0) all[idx] = { ...all[idx], active: !all[idx].active, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(TEAM_KEY, JSON.stringify(all));
    return all.filter((m) => m.developerId === developerId);
  } catch {
    return [];
  }
}

export async function deleteTeamMember(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TEAM_KEY);
    if (!raw) return;
    const all: TeamMember[] = JSON.parse(raw);
    await AsyncStorage.setItem(TEAM_KEY, JSON.stringify(all.filter((m) => m.id !== id)));
  } catch {}
}
