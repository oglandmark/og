export type RecommendedPropertyLike = {
  status: string;
  recommended?: boolean;
  isDemo?: boolean;
};

export function selectRecommendedProperties<T extends RecommendedPropertyLike>(
  properties: T[],
  transaction: 'Buy' | 'Rent',
  allowDemoFallback = false,
): T[] {
  const expectedStatus = transaction === 'Rent' ? 'For Rent' : 'For Sale';
  return properties
    .filter((property) => ((allowDemoFallback && property.isDemo === true) || property.recommended === true)
      && property.status === expectedStatus)
    .slice(0, 8);
}
