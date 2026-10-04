import Promotion from '../models/Promotion.js';
import PromotionRedemption from '../models/PromotionRedemption.js';
import PromotionCustomerUsage from '../models/PromotionCustomerUsage.js';
import { calcRentalDays } from '../utils/helpers.js';

const toMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
};

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

export const computeDiscountAmount = (promo, subtotalBeforeDiscount) => {
  const base = toMoney(subtotalBeforeDiscount);
  if (base <= 0) return 0;
  let amount = 0;
  if (promo.discountType === 'percentage') {
    amount = toMoney((base * Number(promo.discountValue)) / 100);
  } else {
    amount = toMoney(promo.discountValue);
  }
  if (promo.maxDiscountAmount > 0) {
    amount = Math.min(amount, toMoney(promo.maxDiscountAmount));
  }
  return Math.min(amount, base);
};

const vehicleAllowed = (promo, car) => {
  const cats = (promo.vehicleCategories || []).map((c) => String(c).toLowerCase());
  if (cats.length) {
    if (!cats.includes(String(car?.category || '').toLowerCase())) return false;
  }
  const models = (promo.vehicleModels || []).map((m) => String(m).toLowerCase().trim()).filter(Boolean);
  if (models.length) {
    const full = `${car?.brand || ''} ${car?.model || ''}`.toLowerCase().trim();
    const modelOnly = String(car?.model || '').toLowerCase().trim();
    const ok = models.some((m) => full === m || modelOnly === m || full.includes(m));
    if (!ok) return false;
  }
  return true;
};

const isWithinSchedule = (promo, at = new Date()) => {
  const t = at.getTime();
  return t >= new Date(promo.startAt).getTime() && t <= new Date(promo.endAt).getTime();
};

/**
 * Check eligibility without mutating usage counters.
 */
export const isPromotionEligible = async (promo, context) => {
  const {
    car,
    pickupDate,
    returnDate,
    subtotalBeforeDiscount,
    customerEmail = '',
    now = new Date(),
    promoCode = '',
  } = context;

  if (!promo || !promo.isActive) return { ok: false, reason: 'Promotion is inactive' };
  if (!isWithinSchedule(promo, now)) return { ok: false, reason: 'Promotion is not in its valid period' };

  const code = normalizeCode(promoCode);
  if (promo.requirePromoCode || promo.code) {
    if (!code || code !== normalizeCode(promo.code)) {
      return { ok: false, reason: 'Promo code required' };
    }
  }

  const days = calcRentalDays(pickupDate, returnDate);
  if (days < (promo.minRentalDays || 1)) {
    return { ok: false, reason: `Minimum ${promo.minRentalDays} rental day(s) required` };
  }
  if (promo.maxRentalDays > 0 && days > promo.maxRentalDays) {
    return { ok: false, reason: `Maximum ${promo.maxRentalDays} rental day(s) for this offer` };
  }

  const subtotal = toMoney(subtotalBeforeDiscount);
  if (subtotal < toMoney(promo.minBookingAmount)) {
    return { ok: false, reason: `Minimum booking amount is ${promo.minBookingAmount}` };
  }

  if (!vehicleAllowed(promo, car)) {
    return { ok: false, reason: 'Promotion does not apply to this vehicle' };
  }

  if (promo.globalUsageLimit > 0 && promo.usageCount >= promo.globalUsageLimit) {
    return { ok: false, reason: 'Promotion usage limit reached' };
  }

  if (promo.perCustomerUsageLimit > 0 && customerEmail) {
    const used = await PromotionRedemption.countDocuments({
      promotion: promo._id,
      customerEmail: String(customerEmail).toLowerCase().trim(),
    });
    if (used >= promo.perCustomerUsageLimit) {
      return { ok: false, reason: 'You have already used this promotion the maximum number of times' };
    }
  }

  const amount = computeDiscountAmount(promo, subtotal);
  if (amount <= 0) return { ok: false, reason: 'Discount amount is zero' };

  return { ok: true, amount, days };
};

/**
 * Resolve discounts for a quote/booking.
 * - Explicit promo code takes precedence when valid
 * - Otherwise highest-priority automatic promotion
 * - Stacking only when allowStacking is true on applied promos
 */
export const resolvePromotionsForBooking = async ({
  ownerId,
  car,
  pickupDate,
  returnDate,
  subtotalBeforeDiscount,
  promoCode = '',
  customerEmail = '',
  now = new Date(),
} = {}) => {
  if (!ownerId) return { discounts: [], applied: [], message: null };

  const code = normalizeCode(promoCode);
  const promos = await Promotion.find({
    owner: ownerId,
    isActive: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
  })
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  const applied = [];
  let message = null;

  if (code) {
    const coded = promos.find((p) => normalizeCode(p.code) === code);
    if (!coded) {
      return { discounts: [], applied: [], message: 'Invalid or expired promo code' };
    }
    const check = await isPromotionEligible(coded, {
      car,
      pickupDate,
      returnDate,
      subtotalBeforeDiscount,
      customerEmail,
      now,
      promoCode: code,
    });
    if (!check.ok) {
      return { discounts: [], applied: [], message: check.reason };
    }
    applied.push({ promo: coded, amount: check.amount });
  } else {
    for (const promo of promos) {
      if (promo.requirePromoCode || promo.code) continue;
      const check = await isPromotionEligible(promo, {
        car,
        pickupDate,
        returnDate,
        subtotalBeforeDiscount,
        customerEmail,
        now,
        promoCode: '',
      });
      if (check.ok) {
        applied.push({ promo, amount: check.amount });
        break;
      }
    }
  }

  // Optional stacking of additional automatic promos
  if (applied.length && applied.every((a) => a.promo.allowStacking)) {
    let runningSubtotal = toMoney(subtotalBeforeDiscount) - applied.reduce((s, a) => s + a.amount, 0);
    for (const promo of promos) {
      if (applied.some((a) => String(a.promo._id) === String(promo._id))) continue;
      if (!promo.allowStacking) continue;
      if (promo.requirePromoCode || (promo.code && normalizeCode(promo.code) !== code)) continue;
      const check = await isPromotionEligible(promo, {
        car,
        pickupDate,
        returnDate,
        subtotalBeforeDiscount: runningSubtotal,
        customerEmail,
        now,
        promoCode: promo.code && normalizeCode(promo.code) === code ? code : '',
      });
      if (!check.ok) continue;
      applied.push({ promo, amount: check.amount });
      runningSubtotal = toMoney(runningSubtotal - check.amount);
      if (runningSubtotal <= 0) break;
    }
  }

  const discounts = applied.map(({ promo, amount }) => ({
    code: promo.code || '',
    label: promo.name,
    amount,
    promotionId: promo._id,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
  }));

  return { discounts, applied, message };
};

const normalizeEmail = (email) => String(email || '').toLowerCase().trim();

/**
 * Atomically reserve one per-customer slot when a limit is configured.
 * Uses upsert + unique (promotion, customerEmail) with retry on race.
 */
const reserveCustomerSlot = async ({ ownerId, promo, customerEmail }) => {
  const email = normalizeEmail(customerEmail);
  const limit = Number(promo?.perCustomerUsageLimit) || 0;
  if (!limit || !email) return { reserved: false };

  const filter = {
    promotion: promo._id,
    customerEmail: email,
    usageCount: { $lt: limit },
  };
  const update = {
    $inc: { usageCount: 1 },
    $setOnInsert: {
      owner: ownerId || promo.owner,
      promotion: promo._id,
      customerEmail: email,
    },
  };

  try {
    const updated = await PromotionCustomerUsage.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    if (!updated) throw new Error('Per-customer promotion usage limit reached');
    return { reserved: true };
  } catch (error) {
    if (error?.code === 11000) {
      // Concurrent first insert — retry as conditional update only
      const retried = await PromotionCustomerUsage.findOneAndUpdate(
        filter,
        { $inc: { usageCount: 1 } },
        { new: true },
      );
      if (!retried) throw new Error('Per-customer promotion usage limit reached');
      return { reserved: true };
    }
    throw error;
  }
};

/**
 * Atomically reserve global + per-customer usage slots.
 * Rolls back all increments if any fail.
 *
 * @param {Array<{promo: object, amount: number}>} applied
 * @param {{ customerEmail?: string, ownerId?: any }} [opts]
 */
export const reservePromotionUsage = async (applied = [], opts = {}) => {
  const customerEmail = normalizeEmail(opts.customerEmail);
  const ownerId = opts.ownerId;
  /** @type {{ id: any, customer: boolean }[]} */
  const reserved = [];

  try {
    for (const { promo } of applied) {
      if (!promo?.globalUsageLimit || promo.globalUsageLimit <= 0) {
        await Promotion.updateOne({ _id: promo._id }, { $inc: { usageCount: 1 } });
      } else {
        const updated = await Promotion.findOneAndUpdate(
          {
            _id: promo._id,
            isActive: true,
            usageCount: { $lt: promo.globalUsageLimit },
          },
          { $inc: { usageCount: 1 } },
          { new: true },
        );
        if (!updated) {
          throw new Error('Promotion usage limit reached');
        }
      }

      let customer = false;
      if ((promo.perCustomerUsageLimit || 0) > 0 && customerEmail) {
        await reserveCustomerSlot({ ownerId, promo, customerEmail });
        customer = true;
      }

      reserved.push({ id: promo._id, customer });
    }
    return { ok: true, reserved };
  } catch (error) {
    await releasePromotionUsage(reserved, { customerEmail });
    return { ok: false, message: error.message || 'Could not reserve promotion' };
  }
};

/**
 * @param {Array<any|{id:any,customer?:boolean}>} reserved
 */
export const releasePromotionUsage = async (reserved = [], opts = {}) => {
  const customerEmail = normalizeEmail(opts.customerEmail);
  const entries = (reserved || []).map((item) =>
    item && typeof item === 'object' && 'id' in item
      ? { id: item.id, customer: Boolean(item.customer) }
      : { id: item, customer: false },
  ).filter((e) => e.id);

  const promoIds = entries.map((e) => e.id);
  if (promoIds.length) {
    await Promotion.updateMany({ _id: { $in: promoIds } }, { $inc: { usageCount: -1 } });
  }

  if (customerEmail) {
    const customerPromoIds = entries.filter((e) => e.customer).map((e) => e.id);
    if (customerPromoIds.length) {
      await PromotionCustomerUsage.updateMany(
        {
          promotion: { $in: customerPromoIds },
          customerEmail,
          usageCount: { $gt: 0 },
        },
        { $inc: { usageCount: -1 } },
      );
    }
  }
};

export const recordPromotionRedemptions = async ({
  ownerId,
  bookingId,
  customerEmail,
  customerPhone,
  applied = [],
}) => {
  if (!applied.length || !bookingId) return;
  const docs = applied.map(({ promo, amount }) => ({
    owner: ownerId,
    promotion: promo._id,
    booking: bookingId,
    customerEmail: String(customerEmail || '').toLowerCase().trim(),
    customerPhone: String(customerPhone || '').trim(),
    code: promo.code || '',
    discountAmount: amount,
  }));
  try {
    await PromotionRedemption.insertMany(docs, { ordered: false });
  } catch (error) {
    // Unique booking index — ignore duplicates on retry
    if (error?.code !== 11000) console.error('[recordPromotionRedemptions]', error.message);
  }
};

export const buildPricingSnapshot = ({
  priceBreakdown,
  discounts = [],
  extras = {},
  cancellation = {},
  mileage = {},
  timezone = 'Africa/Casablanca',
} = {}) => {
  const originalPrice = toMoney(priceBreakdown?.subtotal ?? 0);
  const discountAmount = toMoney(
    discounts.reduce((sum, d) => sum + toMoney(d.amount), 0),
  );
  const finalPrice = toMoney(priceBreakdown?.total ?? Math.max(0, originalPrice - discountAmount));
  const primary = discounts[0] || null;
  return {
    originalPrice,
    discountAmount,
    finalPrice,
    extraDriverFee: toMoney(extras.extraDriverFee ?? priceBreakdown?.extraDriverFee ?? 0),
    extras: {
      extraDriverEnabled: Boolean(extras.extraDriverEnabled),
      extraDriverFee: toMoney(extras.extraDriverFee ?? priceBreakdown?.extraDriverFee ?? 0),
      extraDriverFeePerDay: toMoney(extras.extraDriverFeePerDay ?? 0),
    },
    cancellation: {
      feeType: cancellation.feeType || 'none',
      feeValue: toMoney(cancellation.feeValue ?? 0),
      policyText: String(cancellation.policyText || ''),
      estimatedFee: toMoney(cancellation.estimatedFee ?? 0),
    },
    mileage: {
      mode: mileage.mode || 'unlimited',
      limitKmPerDay: Number(mileage.limitKmPerDay) || 0,
      includedKm: mileage.includedKm == null ? null : Number(mileage.includedKm),
    },
    timezone,
    promoCode: primary?.code || '',
    promotionId: primary?.promotionId || null,
    promotionName: primary?.label || '',
    promotions: discounts.map((d) => ({
      promotionId: d.promotionId || null,
      code: d.code || '',
      name: d.label || '',
      amount: toMoney(d.amount),
      discountType: d.discountType || '',
      discountValue: d.discountValue ?? null,
    })),
  };
};

export const serializePromotion = (doc) => {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  const now = Date.now();
  const start = new Date(o.startAt).getTime();
  const end = new Date(o.endAt).getTime();
  let lifecycle = 'scheduled';
  if (!o.isActive) lifecycle = 'inactive';
  else if (now > end) lifecycle = 'expired';
  else if (now >= start && now <= end) lifecycle = 'active';
  return {
    ...o,
    _id: String(o._id),
    owner: String(o.owner),
    lifecycle,
  };
};

export default {
  computeDiscountAmount,
  isPromotionEligible,
  resolvePromotionsForBooking,
  reservePromotionUsage,
  recordPromotionRedemptions,
  buildPricingSnapshot,
  serializePromotion,
};
