/**
 * Offline + optional Mongo verification for booking settings + promotions hardenings.
 * Run: node scripts/verify-booking-settings-promotions.mjs
 */
import assert from 'assert';
import { calculateBookingPrice } from '../services/pricingEngine.js';
import {
  normalizeBookingSettings,
  assertBookingRules,
  DEFAULT_BOOKING_SETTINGS,
  computeExtraDriverFee,
  computeCancellationFee,
  buildMileagePolicy,
} from '../services/bookingSettingsService.js';
import {
  computeDiscountAmount,
  buildPricingSnapshot,
  isPromotionEligible,
  resolvePromotionsForBooking,
} from '../services/promotionService.js';
import { pendingExpiresAtFromSettings, resolveFranchiseAmount } from '../services/bookingPricingFlow.js';
import {
  AGENCY_TIMEZONE,
  moroccoMinutesOfDay,
  parseAgencyDateTime,
} from '../utils/moroccoTime.js';
import { parseDateRange } from '../utils/helpers.js';

let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

console.log('verify-booking-settings-promotions');

// --- Settings normalization ---
await check('normalize clamps max rental and percent fee', () => {
  const normalized = normalizeBookingSettings({
    minRentalDays: 2,
    maxRentalDays: 1,
    cancellationFeeType: 'percent',
    cancellationFeeValue: 150,
    mileageMode: 'limited',
  });
  assert.equal(normalized.minRentalDays, 2);
  assert.equal(normalized.maxRentalDays, 2);
  assert.equal(normalized.cancellationFeeValue, 100);
  assert.equal(normalized.mileageMode, 'limited');
});

// --- Morocco timezone ---
await check('naive datetime parsed as Africa/Casablanca wall time', () => {
  assert.equal(AGENCY_TIMEZONE, 'Africa/Casablanca');
  const d = parseAgencyDateTime('2026-06-15T10:00');
  assert.ok(!Number.isNaN(d.getTime()));
  assert.equal(moroccoMinutesOfDay(d), 10 * 60);
  // Absolute UTC for 10:00 Casablanca (UTC+1) is 09:00Z
  assert.equal(d.toISOString(), '2026-06-15T09:00:00.000Z');
});

await check('parseDateRange uses Morocco interpretation', () => {
  const range = parseDateRange('2026-06-15T10:00', '2026-06-18T10:00');
  assert.equal(range.valid, true);
  assert.equal(range.picked.toISOString(), '2026-06-15T09:00:00.000Z');
});

await check('pickup/return hours enforced in Morocco timezone', () => {
  const settings = {
    ...DEFAULT_BOOKING_SETTINGS,
    pickupHoursStart: '08:00',
    pickupHoursEnd: '20:00',
    returnHoursStart: '08:00',
    returnHoursEnd: '20:00',
  };
  const ok = assertBookingRules(settings, '2026-06-20T10:00', '2026-06-23T10:00');
  assert.equal(ok.ok, true);
  assert.equal(ok.timezone, AGENCY_TIMEZONE);

  const late = assertBookingRules(settings, '2026-06-20T22:00', '2026-06-23T10:00');
  assert.equal(late.ok, false);
  assert.ok(String(late.message).includes(AGENCY_TIMEZONE));
});

// --- Booking rules duration ---
await check('min rental duration enforced', () => {
  const short = assertBookingRules(
    { ...DEFAULT_BOOKING_SETTINGS, minRentalDays: 3 },
    '2026-06-20T10:00',
    '2026-06-21T10:00',
  );
  assert.equal(short.ok, false);
  assert.equal(short.code, 'MIN_RENTAL_DAYS');
  assert.equal(short.minRentalDays, 3);
  assert.equal(short.days, 1);

  const ok = assertBookingRules(
    { ...DEFAULT_BOOKING_SETTINGS, minRentalDays: 3 },
    '2026-06-20T10:00',
    '2026-06-23T10:00',
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.days, 3);
});

// --- Fee integration ---
await check('extra driver fee is fee/day × days and affects total', () => {
  const days = 3;
  const fee = computeExtraDriverFee(
    { ...DEFAULT_BOOKING_SETTINGS, extraDriverFeePerDay: 50 },
    days,
    true,
  );
  assert.equal(fee, 150);
  assert.equal(computeExtraDriverFee(DEFAULT_BOOKING_SETTINGS, days, false), 0);

  const priced = calculateBookingPrice({
    pricePerDay: 500,
    pickupDate: parseAgencyDateTime('2026-06-20T10:00'),
    returnDate: parseAgencyDateTime('2026-06-23T10:00'),
    pickupDeliveryFee: 0,
    dropoffDeliveryFee: 0,
    extraDriverFee: fee,
    discounts: [],
  });
  assert.equal(priced.extraDriverFee, 150);
  assert.equal(priced.rentalPrice, 1500);
  assert.equal(priced.subtotal, 1650);
  assert.equal(priced.total, 1650);
  assert.ok(priced.lineItems.some((l) => l.type === 'extra_driver' && l.amount === 150));
});

await check('cancellation fee computed for snapshot / cancel — not in create total', () => {
  assert.equal(computeCancellationFee({ cancellationFeeType: 'none' }, 3000), 0);
  assert.equal(computeCancellationFee({ cancellationFeeType: 'fixed', cancellationFeeValue: 200 }, 3000), 200);
  assert.equal(computeCancellationFee({ cancellationFeeType: 'percent', cancellationFeeValue: 10 }, 3000), 300);

  const breakdown = calculateBookingPrice({
    pricePerDay: 1000,
    pickupDate: parseAgencyDateTime('2026-06-20T10:00'),
    returnDate: parseAgencyDateTime('2026-06-21T10:00'),
    discounts: [],
  });
  const snap = buildPricingSnapshot({
    priceBreakdown: breakdown,
    discounts: [],
    cancellation: {
      feeType: 'percent',
      feeValue: 10,
      policyText: '10% if cancelled',
      estimatedFee: computeCancellationFee(
        { cancellationFeeType: 'percent', cancellationFeeValue: 10 },
        breakdown.total,
      ),
    },
    mileage: buildMileagePolicy({ mileageMode: 'limited', mileageLimitKmPerDay: 250 }, breakdown.days),
    extras: { extraDriverEnabled: false, extraDriverFee: 0 },
  });
  assert.equal(snap.cancellation.estimatedFee, 100);
  assert.equal(snap.finalPrice, breakdown.total);
  assert.notEqual(snap.finalPrice, breakdown.total - snap.cancellation.estimatedFee);
  assert.equal(snap.mileage.mode, 'limited');
  assert.equal(snap.mileage.includedKm, 250);
  assert.equal(snap.timezone, AGENCY_TIMEZONE);
});

await check('mileage unlimited has null includedKm; limited multiplies days', () => {
  assert.deepEqual(buildMileagePolicy({ mileageMode: 'unlimited' }, 5), {
    mode: 'unlimited',
    limitKmPerDay: 0,
    includedKm: null,
  });
  assert.equal(buildMileagePolicy({ mileageMode: 'limited', mileageLimitKmPerDay: 200 }, 4).includedKm, 800);
});

// --- Discount math ---
await check('percentage/fixed discounts with caps', () => {
  assert.equal(computeDiscountAmount({ discountType: 'percentage', discountValue: 15, maxDiscountAmount: 0 }, 3500), 525);
  assert.equal(computeDiscountAmount({ discountType: 'percentage', discountValue: 15, maxDiscountAmount: 400 }, 3500), 400);
  assert.equal(computeDiscountAmount({ discountType: 'fixed', discountValue: 200, maxDiscountAmount: 0 }, 3500), 200);
  assert.equal(computeDiscountAmount({ discountType: 'fixed', discountValue: 9999, maxDiscountAmount: 0 }, 100), 100);
});

await check('promo discount applied after extras in subtotal base', () => {
  const priced = calculateBookingPrice({
    pricePerDay: 500,
    pickupDate: parseAgencyDateTime('2026-06-20T10:00'),
    returnDate: parseAgencyDateTime('2026-06-23T10:00'),
    extraDriverFee: 150,
    discounts: [{ code: 'SUMMER', label: 'Summer', amount: 247.5 }],
  });
  assert.equal(priced.subtotal, 1650);
  assert.equal(priced.discountTotal, 247.5);
  assert.equal(priced.total, 1402.5);
});

// --- Eligibility ---
await check('promo eligibility inactive/expired/category/duration', async () => {
  const now = new Date();
  const pickup = parseAgencyDateTime('2026-07-01T10:00');
  const okReturn = parseAgencyDateTime('2026-07-04T10:00');
  const promo = {
    _id: 'p1',
    isActive: true,
    startAt: new Date(now.getTime() - 86400000),
    endAt: new Date(now.getTime() + 86400000 * 10),
    requirePromoCode: true,
    code: 'SUMMER15',
    discountType: 'percentage',
    discountValue: 15,
    minRentalDays: 2,
    maxRentalDays: 0,
    minBookingAmount: 0,
    maxDiscountAmount: 0,
    vehicleCategories: ['SUV'],
    vehicleModels: [],
    globalUsageLimit: 0,
    perCustomerUsageLimit: 0,
    usageCount: 0,
  };
  const car = { category: 'SUV', brand: 'Dacia', model: 'Duster', pricePerDay: 500 };
  assert.equal((await isPromotionEligible(promo, {
    car, pickupDate: pickup, returnDate: okReturn, subtotalBeforeDiscount: 1500, promoCode: 'SUMMER15', now,
  })).ok, true);
  assert.equal((await isPromotionEligible({ ...promo, isActive: false }, {
    car, pickupDate: pickup, returnDate: okReturn, subtotalBeforeDiscount: 1500, promoCode: 'SUMMER15', now,
  })).ok, false);
  assert.equal((await isPromotionEligible({ ...promo, endAt: new Date(now.getTime() - 1000) }, {
    car, pickupDate: pickup, returnDate: okReturn, subtotalBeforeDiscount: 1500, promoCode: 'SUMMER15', now,
  })).ok, false);
  assert.equal((await isPromotionEligible(promo, {
    car: { ...car, category: 'Economy' }, pickupDate: pickup, returnDate: okReturn, subtotalBeforeDiscount: 1500, promoCode: 'SUMMER15', now,
  })).ok, false);
});

await check('resolve without owner returns empty', async () => {
  const emptyResolve = await resolvePromotionsForBooking({ ownerId: null });
  assert.deepEqual(emptyResolve.discounts, []);
});

await check('franchise + pending expiry helpers', () => {
  assert.equal(resolveFranchiseAmount({ securityDeposit: 3000 }, { securityDepositDefault: 1000 }), 3000);
  assert.equal(resolveFranchiseAmount({ securityDeposit: 0 }, { securityDepositDefault: 1500 }), 1500);
  const exp = pendingExpiresAtFromSettings({ pendingReservationExpiryHours: 48 }, new Date('2026-01-01T00:00:00Z'));
  assert.equal(exp.toISOString(), '2026-01-03T00:00:00.000Z');
  assert.equal(pendingExpiresAtFromSettings({ pendingReservationExpiryHours: 0 }), null);
});

await check('compound index migration helper exports', async () => {
  const mod = await import('../services/ensurePromotionIndexes.js');
  assert.equal(typeof mod.ensurePromotionIndexes, 'function');
});

await check('PromotionCustomerUsage model has unique promotion+email index', async () => {
  const mod = await import('../models/PromotionCustomerUsage.js');
  const indexes = mod.default.schema.indexes();
  const compound = indexes.find(
    ([keys, opts]) => keys.promotion === 1 && keys.customerEmail === 1 && opts?.unique,
  );
  assert.ok(compound, 'unique { promotion, customerEmail } index required');
});

await check('PromotionRedemption schema has unique { booking, promotion }', async () => {
  const mod = await import('../models/PromotionRedemption.js');
  const indexes = mod.default.schema.indexes();
  const compound = indexes.find(
    ([keys, opts]) => keys.booking === 1 && keys.promotion === 1 && opts?.unique,
  );
  assert.ok(compound, 'unique { booking, promotion } index required');
  const legacyBookingOnly = indexes.find(
    ([keys, opts]) => keys.booking === 1 && !keys.promotion && opts?.unique,
  );
  assert.equal(legacyBookingOnly, undefined);
});

// Optional live Mongo concurrency check
if (process.env.MONGODB_URI) {
  const mongoose = (await import('mongoose')).default;
  const { buildMongoUri } = await import('../configs/db.js');
  const Promotion = (await import('../models/Promotion.js')).default;
  const { reservePromotionUsage, releasePromotionUsage } = await import('../services/promotionService.js');
  const { ensurePromotionIndexes } = await import('../services/ensurePromotionIndexes.js');

  await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
  try {
    await check('ensurePromotionIndexes creates compound unique', async () => {
      const result = await ensurePromotionIndexes();
      assert.equal(result.ok, true);
      assert.ok(result.compoundIndex);
    });

    await check('concurrent per-customer reserve allows only limit slots', async () => {
      const ownerId = new mongoose.Types.ObjectId();
      const promo = await Promotion.create({
        owner: ownerId,
        name: 'Concurrent test',
        discountType: 'fixed',
        discountValue: 10,
        startAt: new Date(Date.now() - 3600000),
        endAt: new Date(Date.now() + 86400000),
        perCustomerUsageLimit: 1,
        globalUsageLimit: 0,
        isActive: true,
        requirePromoCode: true,
        code: `CONC${Date.now().toString(36).toUpperCase()}`,
      });
      const email = `conc-${Date.now()}@example.com`;
      const applied = [{ promo: promo.toObject(), amount: 10 }];
      const results = await Promise.all([
        reservePromotionUsage(applied, { customerEmail: email, ownerId }),
        reservePromotionUsage(applied, { customerEmail: email, ownerId }),
        reservePromotionUsage(applied, { customerEmail: email, ownerId }),
      ]);
      const okCount = results.filter((r) => r.ok).length;
      const failCount = results.filter((r) => !r.ok).length;
      assert.equal(okCount, 1);
      assert.equal(failCount, 2);
      for (const r of results.filter((x) => x.ok)) {
        await releasePromotionUsage(r.reserved, { customerEmail: email });
      }
      await Promotion.deleteOne({ _id: promo._id });
      const PromotionCustomerUsage = (await import('../models/PromotionCustomerUsage.js')).default;
      await PromotionCustomerUsage.deleteMany({ promotion: promo._id });
    });
  } finally {
    await mongoose.disconnect();
  }
} else {
  console.log('  · skipped live Mongo concurrency tests (set MONGODB_URI to enable)');
}

// --- Presentation isolation: catalog badges must not feed pricing SSOT ---
await check('pricing pipeline does not import promotionDisplayService', async () => {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const here = dirname(fileURLToPath(import.meta.url));
  const pricingFiles = [
    join(here, '../services/pricingEngine.js'),
    join(here, '../services/bookingPricingFlow.js'),
    join(here, '../services/promotionService.js'),
  ];
  for (const file of pricingFiles) {
    const src = readFileSync(file, 'utf8');
    assert.equal(
      src.includes('promotionDisplayService'),
      false,
      `${file} must not import promotionDisplayService`,
    );
    assert.equal(
      src.includes('displayPromotion'),
      false,
      `${file} must not reference displayPromotion`,
    );
  }
  const displaySrc = readFileSync(join(here, '../services/promotionDisplayService.js'), 'utf8');
  assert.ok(displaySrc.includes('Presentation-only') || displaySrc.includes('presentation'));
  assert.equal(displaySrc.includes('calculateBookingPrice'), false);
  assert.equal(displaySrc.includes('buildAuthoritativeQuote'), false);
  assert.equal(displaySrc.includes('reservePromotionUsage'), false);
});

console.log(`verify-booking-settings-promotions: ${passed} assertions passed`);
