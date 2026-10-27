export const PUBLIC_CONTACT_PHONE = '03272569000';
export const PUBLIC_CONTACT_PHONE_E164 = '+923272569000';
export const PUBLIC_CONTACT_WHATSAPP = '923272569000';

export function publicWhatsAppUrl(message?: string): string {
  const text = message?.trim();
  return text
    ? `https://wa.me/${PUBLIC_CONTACT_WHATSAPP}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${PUBLIC_CONTACT_WHATSAPP}`;
}
