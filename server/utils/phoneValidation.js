import { parsePhoneNumberFromString, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Normalize and validate a phone number to E.164 format.
 * @param {string} phone - Raw phone input
 * @param {string} [defaultCountry='MA'] - ISO country code fallback
 * @returns {{ valid: boolean, e164: string, message: string }}
 */
export const normalizeToE164 = (phone, defaultCountry = 'MA') => {
  const raw = String(phone || '').trim();
  if (!raw) {
    return { valid: false, e164: '', message: 'Phone number is required' };
  }

  try {
    const parsed = parsePhoneNumberFromString(raw, defaultCountry);
    if (!parsed || !isValidPhoneNumber(parsed.number)) {
      return { valid: false, e164: '', message: 'Please provide a valid phone number' };
    }
    return { valid: true, e164: parsed.format('E.164'), message: '' };
  } catch {
    return { valid: false, e164: '', message: 'Please provide a valid phone number' };
  }
};

export default normalizeToE164;
