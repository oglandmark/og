export function getListingVideoExportOptions<T>(
  platform: string,
  h2641080pPreset: T,
): { videoExportPreset?: T } {
  return platform === 'ios' ? { videoExportPreset: h2641080pPreset } : {};
}
