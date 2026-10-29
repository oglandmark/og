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
  let baseUrl: URL;
  try {
    baseUrl = new URL(base);
  } catch {
    return value;
  }
  const absolute = /^[a-z][a-z\d+.-]*:/i.test(value);
  let sourceUrl: URL | undefined;
  try {
    if (absolute) sourceUrl = new URL(value);
  } catch {
    return value;
  }
  const mediaMatch = (sourceUrl?.pathname || value)
    .match(/\/(?:api-legacy\/api|api)\/admin\/property-media\/([A-Za-z0-9._-]+)$/i);
  if (mediaMatch) {
    const sourceHost = sourceUrl?.hostname || baseUrl.hostname;
    if (sourceUrl && /(^|\.)oglandmark\.com$/i.test(sourceHost)) {
      return `https://www.oglandmark.com/api/admin/property-media/${mediaMatch[1]}`;
    }
    if (sourceUrl && sourceHost !== baseUrl.hostname) return value;
    const isPreview = baseUrl.pathname.startsWith('/api-legacy')
      || /(^|\.)replit\.dev$|(^|\.)repl\.co$/i.test(baseUrl.hostname);
    const route = isPreview ? '/api-legacy/api' : '/api';
    return `${baseUrl.origin}${route}/admin/property-media/${mediaMatch[1]}`;
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
