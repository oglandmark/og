const LIVE_API_BASE = 'https://www.oglandmark.com';

export function resolveApiBase(previewDomain = process.env.EXPO_PUBLIC_DOMAIN ?? ''): string {
  const domain = String(previewDomain).trim().replace(/\/+$/, '');
  if (!domain) return LIVE_API_BASE;
  const origin = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  return origin.replace(/\/api$/i, '');
}