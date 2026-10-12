const MX_PHONE = /^[0-9]{10}$/;

// wa.me link to a Mexican number (stored as 10 digits) with a prefilled message.
// Uses the international format 52 + 10 digits. Returns null for invalid numbers.
export function whatsAppLink(phone: string | null, message: string): string | null {
  if (!phone || !MX_PHONE.test(phone)) return null;
  return `https://wa.me/52${phone}?text=${encodeURIComponent(message)}`;
}
