export type DemoPropertyVisibilityRecord = {
  id: number;
  isDemo?: boolean;
  demoId?: number;
};

const demoIdOf = (property: DemoPropertyVisibilityRecord) => property.demoId ?? property.id;

export function isDemoPropertyVisible(
  property: DemoPropertyVisibilityRecord,
  hiddenDemoPropertyIds: readonly number[],
): boolean {
  return property.isDemo !== true || !hiddenDemoPropertyIds.includes(demoIdOf(property));
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
  bundledFallback: readonly T[],
  allowBundledFallback = true,
): T[] {
  if (apiProperties.length > 0) return [...apiProperties];
  return allowBundledFallback ? [...bundledFallback] : [];
}

export function replacePropertiesFromSuccessfulPublicFeed<T extends DemoPropertyVisibilityRecord>(
  cachedProperties: readonly T[],
  remoteProperties: readonly T[],
): T[] {
  if (remoteProperties.length === 0) return [];
  return [...remoteProperties];
}

export function keepCachedPropertiesWhenRemoteIsEmpty<T extends DemoPropertyVisibilityRecord>(
  cachedProperties: readonly T[],
  remoteProperties: readonly T[],
): T[] {
  if (remoteProperties.length === 0) {
    return cachedProperties.filter((property) => property.isDemo !== true);
  }
  return [...remoteProperties];
}
