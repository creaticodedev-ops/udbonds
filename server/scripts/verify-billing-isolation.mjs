/**
 * P4 E2E: Agency billing isolation + entitlements.
 *
 *   npm run test:billing:e2e
 */
import 'dotenv/config';
// Isolation e2e defaults to memory DB (set E2E_USE_PROD=true to hit MONGODB_URI)
if (process.env.E2E_USE_PROD !== 'true') delete process.env.MONGODB_URI;
import assert from 'assert';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-billing-test-secret-min-32-chars!!!';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'https://kririder.com';
process.env.BILLING_ENFORCEMENT = 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
delete process.env.PUBLIC_AGENCY_ID;
delete process.env.PUBLIC_OWNER_ID;

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};
const pass = (msg) => console.log(`PASS: ${msg}`);

const mockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const call = async (handler, req) => {
  const res = mockRes();
  await handler(req, res);
  return res;
};

const unique = () => `bl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function connectDb() {
  if (process.env.MONGODB_URI) {
    const { buildMongoUri } = await import('../configs/db.js');
    await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
    console.log('Connected via MONGODB_URI');
    return { stop: async () => mongoose.disconnect() };
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('car-rental-billing-e2e'));
  console.log('Connected via mongodb-memory-server');
  return {
    stop: async () => {
      await mongoose.disconnect();
      await mem.stop();
    },
  };
}

async function seedOwnerAgency(tag, suffix) {
  const User = (await import('../models/User.js')).default;
  const Agency = (await import('../models/Agency.js')).default;
  const { createTrialDefaults } = await import('../services/licenseService.js');
  const { ensureAgencySubscription } = await import('../services/billingService.js');

  const trial = createTrialDefaults();
  const user = await User.create({
    name: `Owner ${suffix}`,
    email: `${tag}-${suffix}@billing-e2e.test`,
    password: await bcrypt.hash('TestPass123!', 10),
    role: 'owner',
    accountStatus: 'active',
    agencyName: `Agency ${suffix}`,
    ...trial,
  });
  const agency = await Agency.create({
    name: `Agency ${suffix}`,
    slug: `${tag}-${suffix}`,
    status: 'active',
    primaryOwnerUserId: user._id,
    legacyOwnerId: user._id,
  });
  user.agencyId = agency._id;
  await user.save();
  const sub = await ensureAgencySubscription(agency._id, {
    planCode: 'free_trial',
    status: 'trialing',
    trialStartedAt: trial.trialStartedAt,
    trialEndsAt: trial.trialEndsAt,
  });
  return { user, agency, sub };
}

async function main() {
  const db = await connectDb();
  const tag = unique();
  const created = { users: [], agencies: [], cars: [], subs: [] };

  try {
    const { ensureDefaultPlans } = await import('../services/planCatalog.js');
    const {
      assignPlan,
      expireSubscription,
      getCurrentSubscription,
      migrateAgencyBillingFromOwner,
      syncOwnerLicenseFromSubscription,
    } = await import('../services/billingService.js');
    const {
      assertCanAddVehicle,
      assertFeature,
      getAgencyEntitlements,
      EntitlementError,
    } = await import('../services/entitlementsService.js');
    const { getOwnerBilling, getSuperAdminAgencyBilling, assignSuperAdminAgencyPlan } =
      await import('../controllers/billingController.js');
    const { addCar } = await import('../controllers/ownerController.js');
    const { getPublicStorefront } = await import('../controllers/publicStorefrontController.js');
    const { clearPublicTenantCache } = await import('../services/publicTenant.js');
    const Car = (await import('../models/Car.js')).default;
    const User = (await import('../models/User.js')).default;
    const AgencySubscription = (await import('../models/AgencySubscription.js')).default;

    await ensureDefaultPlans();
    pass('default plans seeded');

    const a = await seedOwnerAgency(tag, 'a');
    const b = await seedOwnerAgency(tag, 'b');
    created.users.push(a.user._id, b.user._id);
    created.agencies.push(a.agency._id, b.agency._id);

    // Isolation: A cannot see B billing via owner handler (scoped to req.agencyId)
    const billA = await call(getOwnerBilling, {
      agencyId: a.agency._id,
      user: a.user,
    });
    assert.equal(billA.statusCode, 200);
    assert.equal(billA.body.billing.subscription.planCode, 'free_trial');
    assert.notEqual(
      String(billA.body.billing.subscription.agencyId),
      String(b.agency._id),
    );
    pass('owner billing scoped to own agency');

    const saA = await call(getSuperAdminAgencyBilling, { params: { id: a.agency._id }, user: { _id: a.user._id } });
    const saB = await call(getSuperAdminAgencyBilling, { params: { id: b.agency._id }, user: { _id: a.user._id } });
    assert.equal(saA.body.billing.subscription.planCode, 'free_trial');
    assert.equal(saB.body.billing.subscription.planCode, 'free_trial');
    pass('super admin can load A and B billing independently');

    await assignPlan(a.agency._id, 'pro', { actorType: 'system' });
    const subA = await getCurrentSubscription(a.agency._id);
    const subB = await getCurrentSubscription(b.agency._id);
    assert.equal(subA.planCode, 'pro');
    assert.equal(subB.planCode, 'free_trial');
    pass('assign plan A does not change B');

    await expireSubscription(a.agency._id, { actorType: 'system' });
    await syncOwnerLicenseFromSubscription(a.agency._id);
    const ownerA = await User.findById(a.user._id);
    assert.equal(ownerA.licenseStatus, 'expired');
    const ownerB = await User.findById(b.user._id);
    assert.notEqual(ownerB.licenseStatus, 'expired');
    pass('expire A syncs User.license A only');

    // Reactivate A on free_trial for quota tests
    await assignPlan(a.agency._id, 'free_trial', { actorType: 'system', trialDays: 7 });
    const entA = await getAgencyEntitlements(a.agency._id);
    assert.equal(entA.limits.maxVehicles, 5);
    assert.equal(entA.limits.customDomain, false);
    pass('trial entitlements: maxVehicles=5, no customDomain');

    // Fill fleet to limit
    for (let i = 0; i < 5; i += 1) {
      const car = await Car.create({
        agencyId: a.agency._id,
        owner: a.user._id,
        brand: 'Test',
        model: `Car${i}`,
        year: 2024,
        category: 'Sedan',
        transmission: 'Automatic',
        fuel_type: 'Petrol',
        seating_capacity: 5,
        description: 'e2e',
        pricePerDay: 100,
        image: 'https://example.com/car.jpg',
        isAvaliable: true,
        location: 'Safi',
        locations: ['Safi'],
        fleetId: `${tag}-a-${i}`,
      });
      created.cars.push(car._id);
    }

    let blocked = false;
    try {
      await assertCanAddVehicle(a.agency._id);
    } catch (e) {
      blocked = e instanceof EntitlementError && e.code === 'LIMIT_REACHED';
    }
    assert.ok(blocked, '6th vehicle should be blocked');
    pass('maxVehicles blocks add beyond plan limit');

    let domainBlocked = false;
    try {
      await assertFeature(a.agency._id, 'customDomain');
    } catch (e) {
      domainBlocked = e instanceof EntitlementError && e.code === 'FEATURE_LOCKED';
    }
    assert.ok(domainBlocked, 'customDomain should be locked on trial');
    pass('customDomain feature locked on free_trial');

    await assignPlan(a.agency._id, 'pro', { actorType: 'system' });
    await assertFeature(a.agency._id, 'customDomain');
    pass('customDomain allowed on pro');

    // Suspend → storefront off
    const { suspendSubscription } = await import('../services/billingService.js');
    await suspendSubscription(a.agency._id, { actorType: 'system' });
    clearPublicTenantCache();
    const sf = await call(getPublicStorefront, {
      headers: {},
      query: {},
      params: {},
      get: () => null,
      // publicTenant uses X-Agency-Slug
    });
    // Force via slug header helper — set on req
    const sf2 = await call(getPublicStorefront, {
      headers: { 'x-agency-slug': a.agency.slug },
      query: { agency: a.agency.slug },
      params: {},
      get(name) {
        if (String(name).toLowerCase() === 'x-agency-slug') return a.agency.slug;
        return undefined;
      },
    });
    assert.ok(
      sf2.statusCode === 404 || sf2.body?.code === 'STOREFRONT_SUSPENDED' || sf2.body?.success === false,
      'suspended storefront should be unavailable',
    );
    pass('suspended billing hides storefront');

    // Isolation: B still trialing
    const entB = await getAgencyEntitlements(b.agency._id);
    assert.equal(entB.subscription.status, 'trialing');
    pass('agency B unaffected by A suspend');

    // Migration idempotent
    const mig1 = await migrateAgencyBillingFromOwner(b.agency);
    const mig2 = await migrateAgencyBillingFromOwner(b.agency);
    assert.equal(mig1.created, false);
    assert.equal(mig2.created, false);
    const count = await AgencySubscription.countDocuments({
      agencyId: b.agency._id,
      isCurrent: true,
    });
    assert.equal(count, 1);
    pass('migration idempotent — one current subscription');

    // Super Admin assign B independently
    const assignRes = await call(assignSuperAdminAgencyPlan, {
      params: { id: String(b.agency._id) },
      body: { planCode: 'basic' },
      user: { _id: a.user._id },
    });
    assert.equal(assignRes.statusCode, 200);
    assert.equal(assignRes.body.subscription.planCode, 'basic');
    const stillA = await getCurrentSubscription(a.agency._id);
    assert.equal(stillA.status, 'suspended');
    pass('super admin assign B leaves A suspended');

    // addCar entitlement path
    await assignPlan(b.agency._id, 'free_trial', { actorType: 'system', trialDays: 7 });
    for (let i = 0; i < 5; i += 1) {
      const car = await Car.create({
        agencyId: b.agency._id,
        owner: b.user._id,
        brand: 'Test',
        model: `B${i}`,
        year: 2024,
        category: 'Sedan',
        transmission: 'Automatic',
        fuel_type: 'Petrol',
        seating_capacity: 5,
        description: 'e2e',
        pricePerDay: 100,
        image: 'https://example.com/car.jpg',
        isAvaliable: true,
        location: 'Safi',
        locations: ['Safi'],
        fleetId: `${tag}-b-${i}`,
      });
      created.cars.push(car._id);
    }
    const addRes = await call(addCar, {
      agencyId: b.agency._id,
      agencyLegacyOwnerId: b.user._id,
      user: b.user,
      file: null,
      body: {},
    });
    assert.equal(addRes.statusCode, 403);
    assert.ok(
      addRes.body.code === 'LIMIT_REACHED' || addRes.body.code === 'ENTITLEMENT_DENIED',
    );
    pass('addCar returns 403 at vehicle limit');

    console.log('\nBilling E2E complete.');
  } catch (error) {
    fail(error.stack || error.message);
  } finally {
    try {
      const User = (await import('../models/User.js')).default;
      const Agency = (await import('../models/Agency.js')).default;
      const Car = (await import('../models/Car.js')).default;
      const AgencySubscription = (await import('../models/AgencySubscription.js')).default;
      const BillingEvent = (await import('../models/BillingEvent.js')).default;
      if (created.cars.length) await Car.deleteMany({ _id: { $in: created.cars } });
      if (created.agencies.length) {
        await AgencySubscription.deleteMany({ agencyId: { $in: created.agencies } });
        await BillingEvent.deleteMany({ agencyId: { $in: created.agencies } });
        await Agency.deleteMany({ _id: { $in: created.agencies } });
      }
      if (created.users.length) await User.deleteMany({ _id: { $in: created.users } });
    } catch (cleanupErr) {
      console.warn('cleanup', cleanupErr.message);
    }
    await db.stop();
  }
}

main();
