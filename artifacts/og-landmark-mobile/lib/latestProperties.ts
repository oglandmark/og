export type LatestPropertyLike = {
  id: number;
  createdAt?: string;
  isDemo?: boolean;
};

export function selectLatestProperties<T extends LatestPropertyLike>(
  properties: T[],
  allowDemoFallback = false,
): T[] {
  return properties
    .filter((property) => allowDemoFallback ? property.isDemo === true : property.isDemo !== true)
    .slice()
    .sort((left, right) => {
      const leftDate = Date.parse(left.createdAt || '');
      const rightDate = Date.parse(right.createdAt || '');
      const dateOrder = (Number.isFinite(rightDate) ? rightDate : 0)
        - (Number.isFinite(leftDate) ? leftDate : 0);
      return dateOrder || right.id - left.id;
    })
    .slice(0, 6);
}
