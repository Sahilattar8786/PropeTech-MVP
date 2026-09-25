/**
 * Phone helpers. WhatsApp identifies users by digits-only E.164 numbers
 * (e.g. 919876543210), so that is the canonical stored format.
 */
const DEFAULT_COUNTRY_CODE = "91";

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d+]/g, "");
  const hadPlus = digits.startsWith("+");
  digits = digits.replace(/\+/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Local Indian formats: 09876543210 or 9876543210.
  if (!hadPlus && digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (!hadPlus && digits.length === 10) digits = DEFAULT_COUNTRY_CODE + digits;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/** 919876543210 → +91 98765 43210 */
export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return "";
  if (digits.startsWith("91") && digits.length === 12) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return `+${digits}`;
}
