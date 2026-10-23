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

export function selectHomePropertySource<T extends DemoPropertyVisibilityRecord>(
  apiProperties: readonly T[],
  bundledFallback: readonly T[],
): T[] {
  if (apiProperties.length === 0) return [...bundledFallback];
  return mergeLiveWithDemoProperties(apiProperties, bundledFallback);
}

export function keepCachedPropertiesWhenRemoteIsEmpty<T extends DemoPropertyVisibilityRecord>(
  cachedProperties: readonly T[],
  remoteProperties: readonly T[],
): T[] {
  if (remoteProperties.length === 0) return [...cachedProperties];
  const bundledDemos = cachedProperties.filter(
    (property) => (property as DemoPropertyVisibilityRecord).isDemo === true,
  );
  return mergeLiveWithDemoProperties(remoteProperties, bundledDemos);
}

function mergeLiveWithDemoProperties<T extends DemoPropertyVisibilityRecord>(
  live: readonly T[],
  demos: readonly T[],
): T[] {
  return [
    ...live,
    ...demos.map((property) => ({
      ...property,
      id: -Math.abs(property.demoId ?? property.id),
      demoId: property.demoId ?? property.id,
    })),
  ];
}
