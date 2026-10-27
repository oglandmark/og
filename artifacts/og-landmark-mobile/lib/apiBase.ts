export const LIVE_API_BASE = 'https://www.oglandmark.com';

export function shouldFallbackToLivePropertyFeed(
  response: unknown,
  currentBase: string,
  liveBase = LIVE_API_BASE,
): boolean {
  if (currentBase === liveBase) return false;
  if (Array.isArray(response)) return response.length === 0;
  if (typeof response !== 'object' || response === null || !('items' in response)) return false;
  const items = (response as { items?: unknown }).items;
  return Array.isArray(items) && items.length === 0;
}

export function shouldFallbackUnauthenticatedReadToLive(
  currentBase: string,
  method: string,
  withAuth: boolean,
  status: number,
  liveBase = LIVE_API_BASE,
): boolean {
  return currentBase !== liveBase
    && !withAuth
    && method.toUpperCase() === 'GET'
    && status === 404;
}

export function resolveApiBase(previewDomain?: string): string {
  const domain = previewDomain?.trim();
  if (!domain) return LIVE_API_BASE;

  try {
    const parsed = new URL(/^[a-z][a-z\d+.-]*:/i.test(domain) ? domain : `https://${domain}`);
    if (!/(^|\.)replit\.dev$|(^|\.)repl\.co$|(^|\.)expo\.pike\.replit\.dev$/i.test(parsed.hostname)) {
      return LIVE_API_BASE;
    }
    return `${parsed.origin}/api-legacy`;
  } catch {
    return LIVE_API_BASE;
  }
}