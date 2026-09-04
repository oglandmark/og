import AsyncStorage from '@react-native-async-storage/async-storage';

// Remove cached account-owned data without resetting app preferences such as
// language selection or onboarding completion.
const ACCOUNT_DATA_KEYS = [
  '@og-landmark/saved-properties',
  '@og-landmark/saved-searches-v1',
  '@og-landmark/recent-searches-v1',
  '@og-landmark/compare-ids-v1',
  '@og-landmark/visit-history-v1',
  '@og-landmark/profile-photo-v1',
  '@og-landmark/user-listings-v1',
  '@og-landmark/user-listings-v2',
  '@og-landmark/inquiries-v1',
  '@og-landmark/leads-v1',
  '@og-landmark/leads-v2',
  '@og-landmark/agent-visits-v1',
  '@og-landmark/site-visits-v1',
  '@og-landmark/dev-leads-v1',
  '@og-landmark/developer-projects-v1',
  '@og-landmark/payment-plans-v1',
  '@og-landmark/inventory-blocks-v1',
  '@og-landmark/team-members-v1',
  '@og-landmark/documents-v1',
] as const;

export async function clearLocalAccountData(): Promise<void> {
  await AsyncStorage.multiRemove([...ACCOUNT_DATA_KEYS]).catch(() => undefined);
}