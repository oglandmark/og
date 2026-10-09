export type DemoPropertyVisibilityRecord = {
  id: number;
  isDemo?: boolean;
};

export function isDemoPropertyVisible(
  property: DemoPropertyVisibilityRecord,
  hiddenDemoPropertyIds: readonly number[],
): boolean {
  return property.isDemo !== true || !hiddenDemoPropertyIds.includes(property.id);
}

export function isDemoPropertyHidden(
  property: DemoPropertyVisibilityRecord,
  hiddenDemoPropertyIds: readonly number[],
): boolean {
  return property.isDemo === true && hiddenDemoPropertyIds.includes(property.id);
}

export function filterVisibleDemoProperties<T extends DemoPropertyVisibilityRecord>(
  properties: readonly T[],
  hiddenDemoPropertyIds: readonly number[],
): T[] {
  return properties.filter((property) =>
    isDemoPropertyVisible(property, hiddenDemoPropertyIds),
  );
}

export function selectHomePropertySource<T>(
  apiProperties: readonly T[],
  bundledFallback: readonly T[],
): T[] {
  return [...(apiProperties.length > 0 ? apiProperties : bundledFallback)];
}

export function keepCachedPropertiesWhenRemoteIsEmpty<T>(
  cachedProperties: readonly T[],
  remoteProperties: readonly T[],
): T[] {
  return [...(remoteProperties.length > 0 ? remoteProperties : cachedProperties)];
}
