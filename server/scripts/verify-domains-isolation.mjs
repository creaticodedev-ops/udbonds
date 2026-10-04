/**
 * P3 E2E: Host / subdomain / custom domain public tenancy isolation.
 *
 *   npm run test:domains:e2e
 */
import 'dotenv/config';
// Isolation e2e defaults to memory DB (set E2E_USE_PROD=true to hit MONGODB_URI)
if (process.env.E2E_USE_PROD !== 'true') delete process.env.MONGODB_URI;
import assert from 'assert';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-domains-test-secret-min-32-chars!!!';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'https://kririder.com';
process.env.PLATFORM_BASE_DOMAIN = 'kririder.com';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DOMAIN_ALLOW_TEST_VERIFY = 'true';
process.env.DOMAIN_DNS_VERIFY = 'false';
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

const unique = () => `dm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function connectDb() {
  if (process.env.MONGODB_URI) {
    const { buildMongoUri } = await import('../configs/db.js');
    await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
    console.log('Connected via MONGODB_URI');
    return { stop: async () => mongoose.disconnect() };
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('car-rental-domains-e2e'));
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
  const { getPublicStorefront } = await import('../controllers/publicStorefrontController.js');
  const { getCars } = await import('../controllers/userController.js');
  const { createTrialDefaults } = await import('../services/licenseService.js');
  const {
    clearPublicTenantCache,
    resolvePublicAgencyFromRequest,
    buildStorefrontUrl,
  } = await import('../services/publicTenant.js');
  const {
    extractSubdomainSlug,
    normalizeCustomDomain,
  } = await import('../utils/domainHost.js');
  const {
    setAgencyCustomDomain,
    verifyAgencyCustomDomain,
    serializeDomainState,
  } = await import('../services/agencyDomainService.js');

  const tag = unique();
  const created = { users: [], agencies: [], cars: [] };

  try {
    assert.equal(extractSubdomainSlug('atlas-drift.kririder.com'), 'atlas-drift');
    assert.equal(extractSubdomainSlug('www.kririder.com'), '');
    assert.equal(extractSubdomainSlug('api.kririder.com'), '');
    assert.equal(normalizeCustomDomain('https://WWW.Rentals.Example.com/path'), 'rentals.example.com');
    pass('host helpers normalize subdomain + custom domain');

    const password = await bcrypt.hash('DomainsTest123!', 10);
    const trial = createTrialDefaults();

    const mk = async (letter, brand) => {
      const owner = await User.create({
        name: `Owner ${letter} ${tag}`,
        email: `dm-${letter.toLowerCase()}-${tag}@e2e.test`,
        password,
        role: 'owner',
        accountStatus: 'active',
        agencyName: brand.name,
        passwordSetAt: new Date(),
        onboardingCompletedAt: new Date(),
        ...trial,
      });
      created.users.push(owner._id);
      const agency = await Agency.create({
        name: brand.name,
        slug: `${brand.slug}-${tag}`.slice(0, 64),
        status: 'active',
        primaryOwnerUserId: owner._id,
        legacyOwnerId: owner._id,
        subdomainEnabled: true,
        logoUrl: brand.logoUrl,
        primaryBrandColor: brand.color,
        onboardingCompletedAt: new Date(),
      });
      owner.agencyId = agency._id;
      await owner.save();
      created.agencies.push(agency._id);
      const car = await Car.create({
        owner: owner._id,
        agencyId: agency._id,
        brand: brand.carBrand,
        model: brand.carModel,
        image: 'https://cdn.example.com/car.jpg',
        year: 2024,
        category: 'SUV',
        seating_capacity: 5,
        fuel_type: 'Petrol',
        transmission: 'Automatic',
        pricePerDay: 400,
        location: 'City',
        description: 'test',
        isAvailable: true,
      });
      created.cars.push(car._id);
      return { owner, agency, car };
    };

    const A = await mk('A', {
      name: 'Atlas Drift Domains',
      slug: 'atlas-drift',
      logoUrl: 'https://cdn.example.com/a.png',
      color: '#0B6E4F',
      carBrand: 'Dacia',
      carModel: 'Duster-A',
    });
    const B = await mk('B', {
      name: 'Sahara Pulse Domains',
      slug: 'sahara-pulse',
      logoUrl: 'https://cdn.example.com/b.png',
      color: '#C45C26',
      carBrand: 'Renault',
      carModel: 'Clio-B',
    });

    clearPublicTenantCache();

    // Subdomain Host resolution
    const subA = await resolvePublicAgencyFromRequest({
      headers: { host: `${A.agency.slug}.kririder.com` },
      query: {},
    });
    const subB = await resolvePublicAgencyFromRequest({
      headers: { host: `${B.agency.slug}.kririder.com` },
      query: {},
    });
    assert.equal(String(subA.agencyId), String(A.agency._id));
    assert.equal(String(subB.agencyId), String(B.agency._id));
    assert.notEqual(String(subA.agencyId), String(subB.agencyId));
    pass('subdomain Host resolves Agency A ≠ B');

    const carsA = await call(getCars, {
      headers: { host: `${A.agency.slug}.kririder.com` },
      query: {},
    });
    const carsB = await call(getCars, {
      headers: { host: `${B.agency.slug}.kririder.com` },
      query: {},
    });
    assert.equal(carsA.statusCode, 200);
    assert.equal(carsB.statusCode, 200);
    const idsA = (carsA.body.cars || []).map((c) => String(c._id));
    const idsB = (carsB.body.cars || []).map((c) => String(c._id));
    assert.ok(idsA.includes(String(A.car._id)));
    assert.ok(idsB.includes(String(B.car._id)));
    assert.ok(!idsA.includes(String(B.car._id)));
    assert.ok(!idsB.includes(String(A.car._id)));
    pass('subdomain catalogs are agency-isolated');

    // Custom domain: set + force verify (test mode)
    await setAgencyCustomDomain(A.agency._id, 'rentals.atlas-e2e.test');
    await verifyAgencyCustomDomain(A.agency._id, { force: true });
    await setAgencyCustomDomain(B.agency._id, 'fleet.sahara-e2e.test');
    await verifyAgencyCustomDomain(B.agency._id, { force: true });
    clearPublicTenantCache();

    const domA = await resolvePublicAgencyFromRequest({
      headers: { 'x-agency-host': 'rentals.atlas-e2e.test' },
      query: {},
    });
    const domB = await resolvePublicAgencyFromRequest({
      headers: { host: 'www.fleet.sahara-e2e.test' },
      query: {},
    });
    assert.equal(String(domA.agencyId), String(A.agency._id));
    assert.equal(String(domB.agencyId), String(B.agency._id));
    pass('custom domain Host resolves Agency A ≠ B');

    // Slug path still works
    const slugRes = await call(getPublicStorefront, {
      headers: { 'x-agency-slug': A.agency.slug },
      query: { agency: A.agency.slug },
    });
    assert.equal(slugRes.statusCode, 200);
    assert.equal(slugRes.body.storefront?.slug, A.agency.slug);
    pass('/s/:slug resolution still works (P1 compat)');

    const freshA = await Agency.findById(A.agency._id).lean();
    const urls = serializeDomainState(freshA);
    assert.ok(urls.subdomainUrl.includes(A.agency.slug));
    assert.ok(urls.customDomainUrl.includes('rentals.atlas-e2e.test'));
    assert.ok(urls.slugStorefrontPath.startsWith('/s/'));
    const preferred = buildStorefrontUrl(A.agency.slug, freshA);
    assert.ok(preferred.includes('rentals.atlas-e2e.test'));
    pass('storefront URL prefers verified custom domain over slug path');

    // Domain clash rejected
    let clashOk = false;
    try {
      await setAgencyCustomDomain(B.agency._id, 'rentals.atlas-e2e.test');
    } catch (e) {
      clashOk = e.code === 'DOMAIN_IN_USE' || e.status === 409;
    }
    assert.ok(clashOk);
    pass('custom domain cannot be claimed by two agencies');
  } catch (error) {
    fail(error.stack || error.message);
  } finally {
    try {
      await Car.deleteMany({ _id: { $in: created.cars } });
      await Agency.deleteMany({ _id: { $in: created.agencies } });
      await User.deleteMany({ _id: { $in: created.users } });
    } catch {
      /* ignore */
    }
    await db.stop();
  }
}

main();
