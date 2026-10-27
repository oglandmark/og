const LIVE_API_BASE = 'https://www.oglandmark.com';

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