const PRODUCTION_API_BASE = 'https://api.oglandmark.com';

export type ApiBaseEnvironment = {
  configuredApiUrl?: string;
  replitId?: string;
  replitDomain?: string;
  isDevelopment?: boolean;
};

export function resolveApiBase({
  configuredApiUrl = '',
  replitId = '',
  replitDomain = '',
  isDevelopment = false,
}: ApiBaseEnvironment): string {
  const configured = configuredApiUrl.trim().replace(/\/+$/, '');
  const replitPreview = isDevelopment && replitId && replitDomain
    ? `https://${replitDomain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')}`
    : '';

  return replitPreview || configured || PRODUCTION_API_BASE;
}