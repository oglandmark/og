export function buildPropertyImageGallery<T>(
  ownImages: readonly T[],
  paddingImages: readonly T[],
  shouldPadWithDemoImages: boolean,
  maxImages = 15,
): T[] {
  const own = ownImages.slice(0, maxImages);
  if (!shouldPadWithDemoImages || own.length >= maxImages || paddingImages.length === 0) {
    return own;
  }

  const uniquePadding = paddingImages.filter(
    (image) => !own.some((ownImage) => JSON.stringify(ownImage) === JSON.stringify(image)),
  );
  const pool = uniquePadding.length > 0 ? uniquePadding : paddingImages;
  const result = [...own];
  let index = 0;

  while (result.length < maxImages) {
    result.push(pool[index % pool.length]!);
    index += 1;
  }

  return result;
}
