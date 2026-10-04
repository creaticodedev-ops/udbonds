import { getOrCreateAgencySettings } from './agencySettingsService.js';
import { calcRentalDays } from '../utils/helpers.js';
import {
  AGENCY_TIMEZONE,
  moroccoMinutesOfDay,
  parseAgencyDateTime,
} from '../utils/moroccoTime.js';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DEFAULT_BOOKING_SETTINGS = {
  minRentalDays: 1,
  maxRentalDays: 90,
  advanceBookingDays: 365,
  cancellationPolicyText: '',
  cancellationFeeType: 'none',
  cancellationFeeValue: 0,
  securityDepositDefault: 0,
  extraDriverAllowed: true,
  extraDriverFeePerDay: 0,
  mileageMode: 'unlimited',
  mileageLimitKmPerDay: 250,
  pickupHoursStart: '08:00',
  pickupHoursEnd: '20:00',
  returnHoursStart: '08:00',
  returnHoursEnd: '20:00',
  pendingReservationExpiryHours: 48,
};

const toNum = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(toNum(value, fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const toMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
};

export const normalizeBookingSettings = (raw = {}) => {
  const base = { ...DEFAULT_BOOKING_SETTINGS, ...(raw || {}) };
  const pickupHoursStart = TIME_RE.test(base.pickupHoursStart) ? base.pickupHoursStart : '08:00';
  const pickupHoursEnd = TIME_RE.test(base.pickupHoursEnd) ? base.pickupHoursEnd : '20:00';
  const returnHoursStart = TIME_RE.test(base.returnHoursStart) ? base.returnHoursStart : '08:00';
  const returnHoursEnd = TIME_RE.test(base.returnHoursEnd) ? base.returnHoursEnd : '20:00';

  let minRentalDays = clampInt(base.minRentalDays, 1, 365, 1);
  let maxRentalDays = clampInt(base.maxRentalDays, 1, 730, 90);
  if (maxRentalDays < minRentalDays) maxRentalDays = minRentalDays;

  const feeType = ['none', 'fixed', 'percent'].includes(base.cancellationFeeType)
    ? base.cancellationFeeType
    : 'none';
  let cancellationFeeValue = Math.max(0, toNum(base.cancellationFeeValue, 0));
  if (feeType === 'percent') cancellationFeeValue = Math.min(100, cancellationFeeValue);

  return {
    minRentalDays,
    maxRentalDays,
    advanceBookingDays: clampInt(base.advanceBookingDays, 1, 1095, 365),
    cancellationPolicyText: String(base.cancellationPolicyText || '').slice(0, 5000),
    cancellationFeeType: feeType,
    cancellationFeeValue: Math.round(cancellationFeeValue * 100) / 100,
    securityDepositDefault: Math.max(0, toNum(base.securityDepositDefault, 0)),
    extraDriverAllowed: Boolean(base.extraDriverAllowed),
    extraDriverFeePerDay: Math.max(0, toNum(base.extraDriverFeePerDay, 0)),
    mileageMode: base.mileageMode === 'limited' ? 'limited' : 'unlimited',
    mileageLimitKmPerDay: clampInt(base.mileageLimitKmPerDay, 0, 5000, 250),
    pickupHoursStart,
    pickupHoursEnd,
    returnHoursStart,
    returnHoursEnd,
    pendingReservationExpiryHours: clampInt(base.pendingReservationExpiryHours, 0, 720, 48),
  };
};

export const getBookingSettings = async (ownerId) => {
  const doc = await getOrCreateAgencySettings(ownerId);
  return normalizeBookingSettings(doc?.bookingSettings || {});
};

const parseHm = (hm) => {
  const [h, m] = String(hm).split(':').map(Number);
  return h * 60 + m;
};

const assertWithinHours = (date, startHm, endHm, label) => {
  const mins = moroccoMinutesOfDay(date);
  if (!Number.isFinite(mins)) return `Invalid ${label.toLowerCase()}`;
  const start = parseHm(startHm);
  const end = parseHm(endHm);
  if (start <= end) {
    if (mins < start || mins > end) {
      return `${label} must be between ${startHm} and ${endHm} (${AGENCY_TIMEZONE})`;
    }
  } else if (mins < start && mins > end) {
    return `${label} must be between ${startHm} and ${endHm} (${AGENCY_TIMEZONE})`;
  }
  return null;
};

/**
 * Extra-driver fee for the full rental (fee/day × days). 0 when not enabled.
 */
export const computeExtraDriverFee = (settingsInput, days, secondDriverEnabled) => {
  const settings = normalizeBookingSettings(settingsInput);
  if (!secondDriverEnabled) return 0;
  if (!settings.extraDriverAllowed) return 0;
  return toMoney((settings.extraDriverFeePerDay || 0) * Math.max(0, Number(days) || 0));
};

/**
 * Cancellation fee against a booking total. Does not alter rental price at create time.
 */
export const computeCancellationFee = (settingsInput, bookingTotal) => {
  const settings = normalizeBookingSettings(settingsInput);
  const total = toMoney(bookingTotal);
  if (settings.cancellationFeeType === 'fixed') {
    return toMoney(settings.cancellationFeeValue);
  }
  if (settings.cancellationFeeType === 'percent') {
    return toMoney((total * settings.cancellationFeeValue) / 100);
  }
  return 0;
};

/**
 * Mileage allowance metadata (policy). Does not add to customer total at booking.
 */
export const buildMileagePolicy = (settingsInput, days) => {
  const settings = normalizeBookingSettings(settingsInput);
  const rentalDays = Math.max(0, Number(days) || 0);
  if (settings.mileageMode !== 'limited') {
    return {
      mode: 'unlimited',
      limitKmPerDay: 0,
      includedKm: null,
    };
  }
  return {
    mode: 'limited',
    limitKmPerDay: settings.mileageLimitKmPerDay,
    includedKm: settings.mileageLimitKmPerDay * rentalDays,
  };
};

/**
 * Validate rental against owner booking settings.
 * Pickup/return hours are evaluated in Africa/Casablanca.
 * Backend is the final authority for customer booking / quote / WhatsApp create.
 * @returns {{ ok: true, days, settings, timezone } | { ok: false, code?: string, message: string, minRentalDays?: number, maxRentalDays?: number, days?: number, settings }}
 */
export const assertBookingRules = (settingsInput, pickupDate, returnDate) => {
  const settings = normalizeBookingSettings(settingsInput);
  const picked = parseAgencyDateTime(pickupDate);
  const returned = parseAgencyDateTime(returnDate);
  if (Number.isNaN(picked.getTime()) || Number.isNaN(returned.getTime()) || returned <= picked) {
    return {
      ok: false,
      code: 'INVALID_DATES',
      message: 'Invalid rental dates',
      settings,
    };
  }

  const now = new Date();
  if (picked < now) {
    return {
      ok: false,
      code: 'PAST_PICKUP',
      message: 'Pickup date & time cannot be in the past',
      settings,
    };
  }

  const days = calcRentalDays(picked, returned);
  if (days < settings.minRentalDays) {
    return {
      ok: false,
      code: 'MIN_RENTAL_DAYS',
      message: `Minimum rental duration is ${settings.minRentalDays} day(s)`,
      minRentalDays: settings.minRentalDays,
      maxRentalDays: settings.maxRentalDays,
      days,
      settings,
    };
  }
  if (days > settings.maxRentalDays) {
    return {
      ok: false,
      code: 'MAX_RENTAL_DAYS',
      message: `Maximum rental duration is ${settings.maxRentalDays} day(s)`,
      minRentalDays: settings.minRentalDays,
      maxRentalDays: settings.maxRentalDays,
      days,
      settings,
    };
  }

  const maxAdvance = new Date(now.getTime() + settings.advanceBookingDays * 24 * 60 * 60 * 1000);
  if (picked > maxAdvance) {
    return {
      ok: false,
      code: 'ADVANCE_BOOKING',
      message: `Bookings cannot be made more than ${settings.advanceBookingDays} day(s) in advance`,
      advanceBookingDays: settings.advanceBookingDays,
      settings,
    };
  }

  const pickupErr = assertWithinHours(
    picked,
    settings.pickupHoursStart,
    settings.pickupHoursEnd,
    'Pickup time',
  );
  if (pickupErr) {
    return { ok: false, code: 'PICKUP_HOURS', message: pickupErr, settings };
  }

  const returnErr = assertWithinHours(
    returned,
    settings.returnHoursStart,
    settings.returnHoursEnd,
    'Return time',
  );
  if (returnErr) {
    return { ok: false, code: 'RETURN_HOURS', message: returnErr, settings };
  }

  return { ok: true, days, settings, timezone: AGENCY_TIMEZONE };
};

export const updateBookingSettings = async (ownerId, body = {}) => {
  const doc = await getOrCreateAgencySettings(ownerId);
  if (!doc) throw new Error('Owner required');
  const current = doc.bookingSettings?.toObject?.() || doc.bookingSettings || {};
  const next = normalizeBookingSettings({ ...current, ...body });

  // Use atomic $set so nested bookingSettings always persist (avoids silent
  // Mongoose subdoc replace misses).
  const AgencySettings = (await import('../models/AgencySettings.js')).default;
  const updated = await AgencySettings.findOneAndUpdate(
    { owner: ownerId },
    { $set: { bookingSettings: next } },
    { new: true, upsert: false, runValidators: true },
  );
  if (!updated) {
    doc.bookingSettings = next;
    doc.markModified('bookingSettings');
    await doc.save();
    return next;
  }
  return normalizeBookingSettings(updated.bookingSettings || next);
};

export default {
  DEFAULT_BOOKING_SETTINGS,
  normalizeBookingSettings,
  getBookingSettings,
  assertBookingRules,
  updateBookingSettings,
  computeExtraDriverFee,
  computeCancellationFee,
  buildMileagePolicy,
};
