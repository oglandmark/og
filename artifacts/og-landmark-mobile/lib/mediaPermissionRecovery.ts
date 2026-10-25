type NativePlatform = 'android' | 'ios';

export function getMediaPermissionRecovery(
  platform: NativePlatform,
  canAskAgain: boolean,
): { title: string; message: string } {
  const settingsPath = platform === 'ios'
    ? 'Settings > OG Landmark > Photos'
    : 'Settings > Apps > OG Landmark > Permissions > Photos and videos';

  return {
    title: 'Photo access needed',
    message: canAskAgain
      ? `Allow OG Landmark to access photos when asked. If access was already denied, enable it in ${settingsPath}, then try again.`
      : `Photo access is disabled. Enable it in ${settingsPath}, return to OG Landmark, and try again.`,
  };
}
