/**
 * Single orchestration path: booking settings → base price → promotions → snapshot.
 * Used by createBooking, walk-in, and public quote.
 */
import { calculateBookingPrice, resolveLocationDeliveryFees } from './pricingEngine.js';
import {
  getBookingSettings,
  assertBookingRules,
  computeExtraDriverFee,
  computeCancellationFee,
  buildMileagePolicy,
} from './bookingSettingsService.js';
import {
  resolvePromotionsForBooking,
  recordPromotionRedemptions,
  buildPricingSnapshot,
} from './promotionService.js';
import { AGENCY_TIMEZONE } from '../utils/moroccoTime.js';
import { calcRentalDays } from '../utils/helpers.js';

/**
 * @returns {{
 *   ok: boolean,
 *   message?: string,
 *   settings?: object,
 *   priceBreakdown?: object,
 *   price?: number,
 *   pricingSnapshot?: object,
 *   applied?: array,
 *   promoMessage?: string|null,
 * }}
 */
export const buildAuthoritativeQuote = async ({
  ownerId,
  car,
  pickupDate,
  returnDate,
  pickupLoc = null,
  returnLoc = null,
  promoCode = '',
  customerEmail = '',
  secondDriverEnabled = false,
  /** When true, invalid promo codes fail the quote. When false, ignore bad codes (preview). */
  requireValidPromoCode = true,
} = {}) => {
  const settings = await getBookingSettings(ownerId);
  const rules = assertBookingRules(settings, pickupDate, returnDate);
  if (!rules.ok) {
    return {
      ok: false,
      message: rules.message,
      code: rules.code,
      minRentalDays: rules.minRentalDays ?? settings.minRentalDays,
      maxRentalDays: rules.maxRentalDays ?? settings.maxRentalDays,
      days: rules.days,
      settings,
    };
  }

  if (secondDriverEnabled && !settings.extraDriverAllowed) {
    return {
      ok: false,
      message: 'Extra drivers are not allowed by current booking settings',
      settings,
    };
  }

  const days = calcRentalDays(pickupDate, returnDate);
  const extraDriverFee = computeExtraDriverFee(settings, days, secondDriverEnabled);

  const { pickupDeliveryFee, dropoffDeliveryFee } = resolveLocationDeliveryFees(pickupLoc, returnLoc);
  const baseBreakdown = calculateBookingPrice({
    pricePerDay: car.pricePerDay,
    pickupDate,
    returnDate,
    pickupDeliveryFee,
    dropoffDeliveryFee,
    extraDriverFee,
    discounts: [],
  });

  const resolved = await resolvePromotionsForBooking({
    ownerId,
    car,
    pickupDate,
    returnDate,
    subtotalBeforeDiscount: baseBreakdown.subtotal,
    promoCode,
    customerEmail,
  });

  if (promoCode && resolved.message && !resolved.discounts.length) {
    if (requireValidPromoCode) {
      return {
        ok: false,
        message: resolved.message,
        settings,
        promoMessage: resolved.message,
      };
    }
  }

  const applied = resolved.applied || [];

  const priceBreakdown = calculateBookingPrice({
    pricePerDay: car.pricePerDay,
    pickupDate,
    returnDate,
    pickupDeliveryFee,
    dropoffDeliveryFee,
    extraDriverFee,
    discounts: resolved.discounts.map((d) => ({
      code: d.code,
      label: d.label,
      amount: d.amount,
    })),
  });

  priceBreakdown.discounts = resolved.discounts.map((d, i) => ({
    ...priceBreakdown.discounts[i],
    promotionId: d.promotionId,
    discountType: d.discountType,
    discountValue: d.discountValue,
  }));

  const estimatedCancellationFee = computeCancellationFee(settings, priceBreakdown.total);
  const mileage = buildMileagePolicy(settings, priceBreakdown.days);

  const pricingSnapshot = buildPricingSnapshot({
    priceBreakdown,
    discounts: resolved.discounts,
    extras: {
      extraDriverEnabled: Boolean(secondDriverEnabled),
      extraDriverFee,
      extraDriverFeePerDay: settings.extraDriverFeePerDay,
    },
    cancellation: {
      feeType: settings.cancellationFeeType,
      feeValue: settings.cancellationFeeValue,
      policyText: settings.cancellationPolicyText,
      estimatedFee: estimatedCancellationFee,
    },
    mileage,
    timezone: AGENCY_TIMEZONE,
  });

  return {
    ok: true,
    settings,
    priceBreakdown,
    price: priceBreakdown.total,
    pricingSnapshot,
    applied,
    promoMessage: resolved.message,
  };
};

export const pendingExpiresAtFromSettings = (settings, createdAt = new Date()) => {
  const hours = Number(settings?.pendingReservationExpiryHours);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
};

export const resolveFranchiseAmount = (car, settings, override) => {
  if (override !== undefined && override !== null && override !== '') {
    const n = Number(override);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const fromCar = Number(car?.securityDeposit);
  if (Number.isFinite(fromCar) && fromCar > 0) return fromCar;
  return Math.max(0, Number(settings?.securityDepositDefault) || 0);
};

export const attachRedemptions = async ({
  ownerId,
  bookingId,
  customerEmail,
  customerPhone,
  applied,
}) => {
  await recordPromotionRedemptions({
    ownerId,
    bookingId,
    customerEmail,
    customerPhone,
    applied,
  });
};

export default { buildAuthoritativeQuote, attachRedemptions };
