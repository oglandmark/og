export const LIVE_API_BASE = 'https://www.oglandmark.com';

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

export function getPreviewLiveProxyPath(path: string): string | undefined {
  if (path === '/api/mobile/settings') return '/api/preview/live/mobile/settings';
  if (path === '/api/mobile/banners') return '/api/preview/live/mobile/banners';
  return undefined;
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