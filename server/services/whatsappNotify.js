/**
 * WhatsApp — wa.me deep links only (no Meta/Twilio API).
 * Dial numbers must come from the agency (DB). Never fall back to another tenant's number.
 */
import { PLATFORM_NAME } from '../utils/brand.js';

export const normalizeWhatsAppDial = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length === 10) return `212${digits.slice(1)}`;
  return digits;
};

/**
 * Platform-only dial (trial/license screens). Empty if unset — do not invent a number.
 * @deprecated for tenant messaging — pass agency dial explicitly.
 */
export const getAgencyWhatsAppDial = () => {
  const raw =
    process.env.PLATFORM_SUPPORT_WHATSAPP ||
    process.env.WHATSAPP_BUSINESS_NUMBER ||
    process.env.WHATSAPP_TO ||
    '';
  return normalizeWhatsAppDial(raw);
};

export const buildWaMeUrl = (text, dial) => {
  const to = normalizeWhatsAppDial(dial);
  if (!to) return '';
  if (!text?.trim()) return `https://wa.me/${to}`;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-GB', { hour12: false });
};

export const buildReservationWhatsAppMessage = ({
  reservationId,
  customerName,
  customerPhone,
  customerEmail,
  vehicle,
  pickupLocation,
  returnLocation,
  pickupDate,
  returnDate,
  price,
  priceBreakdown,
  currency = 'MAD',
  notes = '',
  agencyName = '',
}) => {
  const brand = String(agencyName || '').trim() || 'car rental';
  const lines = [
    `Hello, I would like to confirm my ${brand} reservation.`,
    '',
    `Reservation: ${reservationId || '—'}`,
    `Customer: ${customerName || '—'}`,
    `Phone: ${customerPhone || '—'}`,
    `Email: ${customerEmail || '—'}`,
    `Vehicle: ${vehicle || '—'}`,
    `Pickup: ${formatDateTime(pickupDate)} — ${pickupLocation || '—'}`,
    `Return: ${formatDateTime(returnDate)} — ${returnLocation || '—'}`,
  ];

  if (priceBreakdown && typeof priceBreakdown === 'object') {
    lines.push(
      `Rental: ${currency}${priceBreakdown.rentalPrice ?? '—'}`,
      `Total: ${currency}${priceBreakdown.total ?? price ?? '—'}`,
    );
  } else {
    lines.push(`Total: ${currency}${price ?? '—'}`);
  }

  if (notes?.trim()) lines.push(`Notes: ${notes.trim()}`);
  return lines.join('\n');
};

/** Guest reservation → chat with agency on wa.me */
export const buildGuestToAgencyWhatsAppUrl = (reservation = {}, dial, agencyName = '') => {
  const currency = process.env.WHATSAPP_CURRENCY || process.env.CURRENCY || 'MAD';
  const body = buildReservationWhatsAppMessage({
    ...reservation,
    currency,
    agencyName: agencyName || reservation.agencyName || '',
  });
  return buildWaMeUrl(body, dial || reservation.whatsappDial || '');
};

/** Owner: message to agency with customer + completion link (review & send in WhatsApp) */
export const buildCompletionToAgencyWhatsAppUrl = ({
  reservationId,
  customerName,
  customerPhone,
  vehicle,
  pickupLocation,
  returnLocation,
  pickupDate,
  returnDate,
  price,
  currency = 'MAD',
  completionUrl,
  dial,
  agencyName = '',
}) => {
  const brand = String(agencyName || '').trim() || 'Booking';
  const lines = [
    `${brand} — booking confirmation (please send to customer):`,
    '',
    `Hello ${customerName || 'Customer'},`,
    '',
    'Your reservation is confirmed.',
    `Reservation: ${reservationId || '—'}`,
    `Vehicle: ${vehicle || '—'}`,
    `Pickup: ${formatDateTime(pickupDate)} — ${pickupLocation || '—'}`,
    `Return: ${formatDateTime(returnDate)} — ${returnLocation || '—'}`,
    `Total: ${currency}${price ?? '—'}`,
    '',
    'Complete your booking (documents & signature):',
    completionUrl || '—',
    '',
    `Customer phone: ${customerPhone || '—'}`,
  ];
  return buildWaMeUrl(lines.join('\n'), dial || '');
};

/** Legacy no-op — API disabled */
export const sendWhatsAppMessage = async () => ({
  success: false,
  skipped: true,
  reason: 'WhatsApp API disabled — use wa.me deep links',
});

export default buildGuestToAgencyWhatsAppUrl;

/** Platform label for system/support messages only */
export { PLATFORM_NAME };
