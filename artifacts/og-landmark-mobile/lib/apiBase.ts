const LIVE_API_BASE = 'https://www.oglandmark.com';

export function resolveApiBase(_previewDomain?: string): string {
  // Mobile clients use the public Laravel API directly. Replit preview hosts
  // serve the web app, so fetching /api/* from them can return HTML instead.
  return LIVE_API_BASE;
}