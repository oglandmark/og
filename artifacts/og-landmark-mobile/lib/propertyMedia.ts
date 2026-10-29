export type PropertyMediaFields = {
  images?: string[] | null;
  coverImage?: string | null;
  videoUrl?: string | null;
};

export function resolveMediaUrl(
  value: string | null | undefined,
  apiBase: string,
): string | undefined {
  if (!value) return undefined;

  const base = apiBase.replace(/\/+$/, '');
  const normalizedValue = value.replace(
    /\/api-legacy\/api(?=\/admin\/property-media\/)/i,
    '/api',
  );
  if (normalizedValue !== value) return resolveMediaUrl(normalizedValue, apiBase);

  let baseUrl: URL;
  try {
    baseUrl = new URL(base);
  } catch {
    return value;
  }
  const canonicalFirstPartyUrl = value.replace(
    /^https?:\/\/(?:www\.)?oglandmark\.com(?=\/|$)/i,
    'https://www.oglandmark.com',
  );
  if (canonicalFirstPartyUrl !== value) {
    return baseUrl.hostname.endsWith('oglandmark.com') ? canonicalFirstPartyUrl : value;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return new URL(value.startsWith('/') ? value : `/${value}`, `${baseUrl.origin}/`).toString();
}

export function normalizePropertyMedia<T extends PropertyMediaFields>(
  property: T,
  apiBase: string,
): T {
  return {
    ...property,
    ...(Array.isArray(property.images)
      ? { images: property.images.map((url) => resolveMediaUrl(url, apiBase) ?? url) }
      : {}),
    ...(typeof property.coverImage === 'string'
      ? { coverImage: resolveMediaUrl(property.coverImage, apiBase) ?? property.coverImage }
      : {}),
    ...(typeof property.videoUrl === 'string'
      ? { videoUrl: resolveMediaUrl(property.videoUrl, apiBase) ?? property.videoUrl }
      : {}),
  } as T;
}
