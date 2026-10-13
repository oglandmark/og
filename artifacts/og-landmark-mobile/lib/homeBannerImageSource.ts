export function shouldUseBundledHomeBanner(
  imageUrl: string | null | undefined,
  category: string,
): boolean {
  if (!imageUrl?.trim()) return true;

  const imagePath = imageUrl
    .trim()
    .split(/[?#]/, 1)[0]
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/\/+$/, '')
    .toLowerCase();

  return imagePath === `/images/mobile-banners/${category.toLowerCase()}.jpg`;
}
