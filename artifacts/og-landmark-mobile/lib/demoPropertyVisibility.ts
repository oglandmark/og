export type DemoPropertyVisibilityRecord = {
  id: number;
  isDemo?: boolean;
  demoId?: number;
  approvalStatus?: string;
  listingStatus?: string;
};

const demoIdOf = (property: DemoPropertyVisibilityRecord) => property.demoId ?? property.id;

export function isDemoPropertyVisible(
  property: DemoPropertyVisibilityRecord,
  hiddenDemoPropertyIds: readonly number[],
): boolean {
  return isAdminApprovedProperty(property)
    && (property.isDemo !== true || !hiddenDemoPropertyIds.includes(demoIdOf(property)));
}

export function isAdminApprovedProperty(property: DemoPropertyVisibilityRecord): boolean {
  if (property.isDemo === true) return false;
  const approvalStatus = String(property.approvalStatus || 'active').toLowerCase();
  const listingStatus = String(property.listingStatus || 'active').toLowerCase();
  return ['approved', 'active'].includes(approvalStatus)
    && ['approved', 'active'].includes(listingStatus);
}

export function isDemoPropertyHidden(
  property: DemoPropertyVisibilityRecord,
  hiddenDemoPropertyIds: readonly number[],
): boolean {
  return property.isDemo === true && hiddenDemoPropertyIds.includes(demoIdOf(property));
}

export function filterVisibleDemoProperties<T extends DemoPropertyVisibilityRecord>(
  properties: readonly T[],
  hiddenDemoPropertyIds: readonly number[],
): T[] {
  return properties.filter((property) =>
    isDemoPropertyVisible(property, hiddenDemoPropertyIds),
  );
}

export function filterDeletedDemoProjects<T extends { id: string }>(
  projects: readonly T[],
  deletedIds: readonly string[],
): T[] {
  const deleted = new Set(deletedIds);
  return projects.filter((project) => !deleted.has(project.id));
}

export function selectHomePropertySource<T extends DemoPropertyVisibilityRecord>(
  apiProperties: readonly T[],
): T[] {
  return apiProperties.filter(isAdminApprovedProperty);
}

export function replacePropertiesFromSuccessfulPublicFeed<T extends DemoPropertyVisibilityRecord>(
  cachedProperties: readonly T[],
  remoteProperties: readonly T[],
): T[] {
  return remoteProperties.filter(isAdminApprovedProperty);
}

export function keepCachedPropertiesWhenRemoteIsEmpty<T extends DemoPropertyVisibilityRecord>(
  cachedProperties: readonly T[],
  remoteProperties: readonly T[],
): T[] {
  if (remoteProperties.length === 0) {
    return cachedProperties.filter(isAdminApprovedProperty);
  }
  return remoteProperties.filter(isAdminApprovedProperty);
}
