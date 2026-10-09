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
  const canonicalFirstPartyUrl = value.replace(
    /^https?:\/\/(?:www\.)?oglandmark\.com(?=\/|$)/i,
    base,
  );
  if (canonicalFirstPartyUrl !== value) return canonicalFirstPartyUrl;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `${base}${value.startsWith('/') ? value : `/${value}`}`;
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
