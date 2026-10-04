/**
 * Verifies Admin minRentalDays → bookingSettings → assertBookingRules → customer guidance.
 * Run: node scripts/verify-min-rental-flow.mjs
 * Optional live DB: MONGODB_URI=... node scripts/verify-min-rental-flow.mjs
 */
import assert from 'assert';
import {
  normalizeBookingSettings,
  assertBookingRules,
  DEFAULT_BOOKING_SETTINGS,
  updateBookingSettings,
  getBookingSettings,
} from '../services/bookingSettingsService.js';

let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

console.log('verify-min-rental-flow');

await check('normalize coerces string "3" from admin form inputs', () => {
  const n = normalizeBookingSettings({ minRentalDays: '3', maxRentalDays: '90' });
  assert.equal(n.minRentalDays, 3);
  assert.equal(n.maxRentalDays, 90);
});

for (const min of [1, 3, 5]) {
  await check(`assertBookingRules rejects below ${min} and accepts ${min}`, () => {
    const settings = { ...DEFAULT_BOOKING_SETTINGS, minRentalDays: min };
    const short = assertBookingRules(
      settings,
      '2026-08-20T10:00',
      '2026-08-20T18:00',
    );
    if (min > 1) {
      assert.equal(short.ok, false);
      assert.equal(short.code, 'MIN_RENTAL_DAYS');
      assert.equal(short.minRentalDays, min);
    }

    const endDay = String(20 + min).padStart(2, '0');
    const ok = assertBookingRules(
      settings,
      '2026-08-20T10:00',
      `2026-08-${endDay}T10:00`,
    );
    assert.equal(ok.ok, true, `expected ok for ${min}-day span, got ${JSON.stringify(ok)}`);
    assert.equal(ok.days, min);
  });
}

await check('owner isolation: different settings objects do not leak', () => {
  const ownerA = assertBookingRules(
    { ...DEFAULT_BOOKING_SETTINGS, minRentalDays: 5 },
    '2026-08-20T10:00',
    '2026-08-23T10:00',
  );
  assert.equal(ownerA.ok, false);
  assert.equal(ownerA.minRentalDays, 5);

  const ownerB = assertBookingRules(
    { ...DEFAULT_BOOKING_SETTINGS, minRentalDays: 1 },
    '2026-08-20T10:00',
    '2026-08-21T10:00',
  );
  assert.equal(ownerB.ok, true);
});

const uri = process.env.MONGODB_URI;
if (uri) {
  const mongoose = (await import('mongoose')).default;
  await mongoose.connect(uri);
  try {
    const ownerId = new mongoose.Types.ObjectId();
    // Seed via model directly then updateBookingSettings round-trip
    const AgencySettings = (await import('../models/AgencySettings.js')).default;
    await AgencySettings.create({
      owner: ownerId,
      bookingSettings: { ...DEFAULT_BOOKING_SETTINGS, minRentalDays: 1 },
    });

    for (const min of [3, 5, 1]) {
      await check(`live DB persist + read minRentalDays=${min}`, async () => {
        const saved = await updateBookingSettings(ownerId, { minRentalDays: min });
        assert.equal(saved.minRentalDays, min);
        const read = await getBookingSettings(ownerId);
        assert.equal(read.minRentalDays, min);

        const short = assertBookingRules(
          read,
          '2026-09-01T10:00',
          '2026-09-02T10:00',
        );
        if (min > 1) {
          assert.equal(short.ok, false);
          assert.equal(short.code, 'MIN_RENTAL_DAYS');
          assert.equal(short.minRentalDays, min);
        } else {
          assert.equal(short.ok, true);
        }
      });
    }

    await AgencySettings.deleteOne({ owner: ownerId });
  } finally {
    await mongoose.disconnect();
  }
} else {
  console.log('  · skipped live Mongo persistence (set MONGODB_URI to enable)');
}

console.log(`verify-min-rental-flow: ${passed} assertions passed`);
