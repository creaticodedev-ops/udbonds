/**
 * E2E: Agency A/B public storefront isolation via slug resolver.
 *
 *   npm run test:storefront:e2e
 */
import 'dotenv/config';
// Isolation e2e defaults to memory DB (set E2E_USE_PROD=true to hit MONGODB_URI)
if (process.env.E2E_USE_PROD !== 'true') delete process.env.MONGODB_URI;
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-storefront-test-secret-min-32-chars!';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'https://kririder.com';
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

const unique = () => `sf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function connectDb() {
  if (process.env.MONGODB_URI) {
    const { buildMongoUri } = await import('../configs/db.js');
    await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
    console.log('Connected via MONGODB_URI');
    return { stop: async () => mongoose.disconnect() };
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('car-rental-storefront-e2e'));
  console.log('Connected via mongodb-memory-server');
  return {
    stop: async () => {
      await mongoose.disconnect();
      await mem.stop();
    },
  };
}

async function main() {
  const db = await connectDb();
  const { default: User } = await import('../models/User.js');
  const { default: Agency } = await import('../models/Agency.js');
  const { default: Car } = await import('../models/Car.js');
  const { default: PickupLocation } = await import('../models/PickupLocation.js');
  const { getCars } = await import('../controllers/userController.js');
  const { getActivePickupLocations } = await import('../controllers/pickupLocationController.js');
  const { getPublicStorefront } = await import('../controllers/publicStorefrontController.js');
  const { createTrialDefaults } = await import('../services/licenseService.js');
  const {
    clearPublicTenantCache,
    buildStorefrontPath,
    buildStorefrontUrl,
  } = await import('../services/publicTenant.js');

  const tag = unique();
  const created = { users: [], agencies: [], cars: [], locations: [] };

  try {
    const password = await bcrypt.hash('StorefrontTest123!', 10);
    const trial = createTrialDefaults();

    const ownerA = await User.create({
      name: `Owner A ${tag}`,
      email: `sf-a-${tag}@e2e.test`,
      password,
      role: 'owner',
      accountStatus: 'active',
      agencyName: `Storefront A ${tag}`,
      passwordSetAt: new Date(),
      onboardingCompletedAt: new Date(),
      ...trial,
    });
    const ownerB = await User.create({
      name: `Owner B ${tag}`,
      email: `sf-b-${tag}@e2e.test`,
      password,
      role: 'owner',
      accountStatus: 'active',
      agencyName: `Storefront B ${tag}`,
      passwordSetAt: new Date(),
      onboardingCompletedAt: new Date(),
      ...trial,
    });
    created.users.push(ownerA._id, ownerB._id);

    const slugA = `agency-a-${tag}`;
    const slugB = `agency-b-${tag}`;

    const agencyA = await Agency.create({
      name: `Agency A ${tag}`,
      slug: slugA,
      status: 'active',
      primaryOwnerUserId: ownerA._id,
      legacyOwnerId: ownerA._id,
      logoUrl: 'https://cdn.example.com/a-logo.png',
      primaryBrandColor: '#111111',
      phone: '+21260000000A',
      whatsapp: '+21260000000A',
      city: 'Rabat',
      country: 'Morocco',
      onboardingCompletedAt: new Date(),
    });
    const agencyB = await Agency.create({
      name: `Agency B ${tag}`,
      slug: slugB,
      status: 'active',
      primaryOwnerUserId: ownerB._id,
      legacyOwnerId: ownerB._id,
      logoUrl: 'https://cdn.example.com/b-logo.png',
      primaryBrandColor: '#222222',
      phone: '+21260000000B',
      whatsapp: '+21260000000B',
      city: 'Marrakech',
      country: 'Morocco',
      onboardingCompletedAt: new Date(),
    });
    created.agencies.push(agencyA._id, agencyB._id);

    await User.updateOne({ _id: ownerA._id }, { $set: { agencyId: agencyA._id } });
    await User.updateOne({ _id: ownerB._id }, { $set: { agencyId: agencyB._id } });

    const carA = await Car.create({
      agencyId: agencyA._id,
      owner: ownerA._id,
      brand: 'Toyota',
      model: `A-${tag}`,
      year: 2024,
      category: 'Sedan',
      seating_capacity: 5,
      fuel_type: 'Petrol',
      transmission: 'Automatic',
      pricePerDay: 300,
      description: 'A fleet',
      isAvaliable: true,
      status: 'available',
    });
    const carB = await Car.create({
      agencyId: agencyB._id,
      owner: ownerB._id,
      brand: 'Hyundai',
      model: `B-${tag}`,
      year: 2023,
      category: 'Economy',
      seating_capacity: 4,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      pricePerDay: 200,
      description: 'B fleet',
      isAvaliable: true,
      status: 'available',
    });
    created.cars.push(carA._id, carB._id);

    await PickupLocation.create({
      agencyId: agencyA._id,
      owner: ownerA._id,
      name: `Loc A ${tag}`,
      city: 'Rabat',
      address: 'A',
      isActive: true,
    });
    await PickupLocation.create({
      agencyId: agencyB._id,
      owner: ownerB._id,
      name: `Loc B ${tag}`,
      city: 'Marrakech',
      address: 'B',
      isActive: true,
    });

    clearPublicTenantCache();

    if (buildStorefrontPath(slugA) === `/s/${slugA}`) {
      pass('Storefront path format is /s/{slug}');
    } else fail(`path format wrong: ${buildStorefrontPath(slugA)}`);

    if (buildStorefrontUrl(slugA) === `https://kririder.com/s/${slugA}`) {
      pass('Storefront absolute URL uses CLIENT_URL + /s/{slug}');
    } else fail(`url format wrong: ${buildStorefrontUrl(slugA)}`);

    // Agency A storefront
    const carsA = await call(getCars, {
      query: { agency: slugA },
      headers: { 'x-agency-slug': slugA },
      body: {},
      params: {},
    });
    const listA = carsA.body?.cars || [];
    const aHasA = listA.some((c) => String(c.model || '').includes(`A-${tag}`));
    const aHasB = listA.some((c) => String(c.model || '').includes(`B-${tag}`));
    if (carsA.statusCode === 200 && aHasA && !aHasB) {
      pass('Agency A → View My Website → only A fleet');
    } else fail(`A fleet isolation failed hasA=${aHasA} hasB=${aHasB} status=${carsA.statusCode}`);

    const sfA = await call(getPublicStorefront, {
      query: { agency: slugA },
      headers: { 'x-agency-slug': slugA },
      body: {},
      params: {},
    });
    if (
      sfA.statusCode === 200 &&
      sfA.body?.storefront?.slug === slugA &&
      sfA.body.storefront.logoUrl.includes('a-logo') &&
      sfA.body.storefront.primaryBrandColor === '#111111' &&
      sfA.body.storefront.city === 'Rabat' &&
      !String(sfA.body.storefront.logoUrl).includes('b-logo')
    ) {
      pass('Agency A storefront branding is A-only');
    } else fail(`A branding leak/mismatch ${JSON.stringify(sfA.body)}`);

    const locsA = await call(getActivePickupLocations, {
      query: { agency: slugA },
      headers: { 'x-agency-slug': slugA },
      body: {},
      params: {},
    });
    const locNamesA = (locsA.body?.locations || []).map((l) => l.name);
    if (locNamesA.some((n) => n.includes('Loc A')) && !locNamesA.some((n) => n.includes('Loc B'))) {
      pass('Agency A storefront locations are A-only');
    } else fail(`A locations isolation failed ${locNamesA.join(',')}`);

    // Agency B storefront
    clearPublicTenantCache();
    const carsB = await call(getCars, {
      query: {},
      headers: { 'x-agency-slug': slugB },
      body: {},
      params: {},
    });
    const listB = carsB.body?.cars || [];
    const bHasB = listB.some((c) => String(c.model || '').includes(`B-${tag}`));
    const bHasA = listB.some((c) => String(c.model || '').includes(`A-${tag}`));
    if (carsB.statusCode === 200 && bHasB && !bHasA) {
      pass('Agency B → View My Website → only B fleet');
    } else fail(`B fleet isolation failed hasB=${bHasB} hasA=${bHasA}`);

    const sfB = await call(getPublicStorefront, {
      headers: { 'x-agency-slug': slugB },
      query: {},
      body: {},
      params: {},
    });
    if (
      sfB.statusCode === 200 &&
      sfB.body?.storefront?.slug === slugB &&
      sfB.body.storefront.logoUrl.includes('b-logo') &&
      sfB.body.storefront.primaryBrandColor === '#222222' &&
      sfB.body.storefront.city === 'Marrakech'
    ) {
      pass('Agency B storefront branding is B-only');
    } else fail(`B branding mismatch ${JSON.stringify(sfB.body)}`);

    // Cross-check: A never sees B ids
    const aIds = new Set(listA.map((c) => String(c._id)));
    if (!aIds.has(String(carB._id))) pass('No cross-agency car IDs in Agency A catalog');
    else fail('Agency A catalog contains Agency B car id');

    // Suspended agency slug must not resolve
    await Agency.updateOne({ _id: agencyA._id }, { $set: { status: 'suspended' } });
    clearPublicTenantCache();
    const suspended = await call(getPublicStorefront, {
      query: { agency: slugA },
      headers: {},
      body: {},
      params: {},
    });
    if (suspended.statusCode === 404 && suspended.body?.code === 'PUBLIC_AGENCY_NOT_FOUND') {
      pass('Suspended agency storefront is not publicly resolvable');
    } else {
      fail(`suspended expected 404 NOT_FOUND, got ${suspended.statusCode} ${suspended.body?.code}`);
    }

    // Restore for cleanup
    await Agency.updateOne({ _id: agencyA._id }, { $set: { status: 'active' } });
  } catch (error) {
    console.error('Storefront E2E error:', error);
    process.exitCode = 1;
  } finally {
    try {
      if (created.cars.length) await Car.deleteMany({ _id: { $in: created.cars } });
      await PickupLocation.deleteMany({ owner: { $in: created.users } });
      if (created.agencies.length) await Agency.deleteMany({ _id: { $in: created.agencies } });
      if (created.users.length) await User.deleteMany({ _id: { $in: created.users } });
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }
    await db.stop();
    console.log(process.exitCode ? 'DONE WITH FAILURES' : 'DONE — storefront isolation E2E passed');
  }
}

main();
