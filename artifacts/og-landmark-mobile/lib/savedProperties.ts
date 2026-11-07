import type { Property } from '@/lib/properties';

export function getLiveSavedPropertyIds(savedIds: readonly number[]): number[] {
  return Array.from(new Set(savedIds.filter((id) => Number.isInteger(id) && id > 0)));
}

export function selectSavedProperties(
  savedIds: readonly number[],
  bundledProperties: readonly Property[],
  liveProperties: readonly Property[],
): Property[] {
  const demosBySavedId = new Map(
    bundledProperties.map((property) => {
      const demoId = Math.abs(property.id);
      return [-demoId, { ...property, id: -demoId, demoId }] as const;
    }),
  );
  const liveById = new Map(liveProperties.map((property) => [property.id, property]));

  return savedIds.flatMap((id) => {
    const property = id < 0 ? demosBySavedId.get(id) : liveById.get(id);
    return property ? [property] : [];
  });
}
