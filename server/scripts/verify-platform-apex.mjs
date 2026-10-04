/**
 * E2E: platform apex (kririder.com/) must resolve via X-Agency-Slug or PUBLIC_AGENCY_ID
 * when multiple active agencies exist.
 *
 *   npm run test:platform-apex
 */
import 'dotenv/config';
if (process.env.E2E_USE_PROD !== 'true') delete process.env.MONGODB_URI;
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-platform-apex-test-secret-min-32-chars!';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'https://kririder.com';
process.env.PLATFORM_BASE_DOMAIN = 'kririder.com';
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

const unique = () => `apex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function connectDb() {
  if (process.env.MONGODB_URI) {
    const { buildMongoUri } = await import('../configs/db.js');
    await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
    return { stop: async () => mongoose.disconnect() };
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('car-rental-platform-apex-e2e'));
  return {
    stop: async () => {
      await mongoose.disconnect();
      await mem.stop();
    },
  };
};

async function main() {
  const db = await connectDb();
  const { default: User } = await import('../models/User.js');
  const { default: Agency } = await import('../models/Agency.js');
  const { getCars } = await import('../controllers/userController.js');
  const { getActivePickupLocations } = await import('../controllers/pickupLocationController.js');
  const { getPublicStorefront } = await import('../controllers/publicStorefrontController.js');
  const { clearPublicTenantCache, resolvePublicAgencyFromRequest } = await import(
    '../services/publicTenant.js'
  );

  const tag = unique();
  const slugA = `${tag}-a`;
  const slugB = `${tag}-b`;
  const hash = await bcrypt.hash('test-password-1234567890', 4);

  const ownerA = await User.create({
    name: 'Apex Owner A',
    email: `${tag}-a@test.local`,
    password: hash,
    role: 'owner',
    accountStatus: 'active',
  });
  const ownerB = await User.create({
    name: 'Apex Owner B',
    email: `${tag}-b@test.local`,
    password: hash,
    role: 'owner',
    accountStatus: 'active',
  });

  const agencyA = await Agency.create({
    name: 'Apex Agency A',
    slug: slugA,
    status: 'active',
    primaryOwnerUserId: ownerA._id,
    legacyOwnerId: ownerA._id,
    isPublicStorefront: false,
  });
  const agencyB = await Agency.create({
    name: 'Apex Agency B',
    slug: slugB,
    status: 'active',
    primaryOwnerUserId: ownerB._id,
    legacyOwnerId: ownerB._id,
    isPublicStorefront: false,
  });
  ownerA.agencyId = agencyA._id;
  ownerB.agencyId = agencyB._id;
  await ownerA.save();
  await ownerB.save();

  clearPublicTenantCache();

  // Simulate kririder.com hard refresh — no slug, no tenant host
  const apexReq = { headers: { host: 'kririder.com' }, query: {} };
  try {
    await resolvePublicAgencyFromRequest(apexReq);
    fail('multi-agency apex without slug should not resolve');
  } catch (err) {
    if (err.status === 503 && err.code === 'PUBLIC_TENANT_UNRESOLVED') {
      pass('multi-agency apex without slug fails closed (503)');
    } else {
      fail(`unexpected apex error: ${err.message}`);
    }
  }

  // Client fix: X-Agency-Slug from VITE_DEFAULT_STOREFRONT_SLUG
  const slugReq = {
    headers: { host: 'kririder.com', 'x-agency-slug': slugA },
    query: {},
  };
  const viaSlug = await resolvePublicAgencyFromRequest(slugReq);
  if (String(viaSlug.agencyId) === String(agencyA._id)) {
    pass('apex + X-Agency-Slug resolves correct agency');
  } else {
    fail('X-Agency-Slug resolution mismatch');
  }

  const carsSlug = await call(getCars, slugReq);
  if (carsSlug.statusCode === 200 && carsSlug.body?.success) {
    pass('GET /api/user/cars works with X-Agency-Slug on apex');
  } else {
    fail(`cars with slug header: ${carsSlug.statusCode}`);
  }

  const pickupSlug = await call(getActivePickupLocations, slugReq);
  if (pickupSlug.statusCode === 200 && pickupSlug.body?.success) {
    pass('GET /api/pickup-locations works with X-Agency-Slug on apex');
  } else {
    fail(`pickup-locations with slug header: ${pickupSlug.statusCode}`);
  }

  const storefrontSlug = await call(getPublicStorefront, slugReq);
  if (storefrontSlug.statusCode === 200 && storefrontSlug.body?.success) {
    pass('GET /api/public/storefront works with X-Agency-Slug on apex');
  } else {
    fail(`storefront with slug header: ${storefrontSlug.statusCode}`);
  }

  // Server defense-in-depth: PUBLIC_AGENCY_ID
  process.env.PUBLIC_AGENCY_ID = String(agencyA._id);
  clearPublicTenantCache();
  const viaEnv = await resolvePublicAgencyFromRequest(apexReq);
  if (String(viaEnv.agencyId) === String(agencyA._id)) {
    pass('PUBLIC_AGENCY_ID resolves apex without slug header');
  } else {
    fail('PUBLIC_AGENCY_ID resolution mismatch');
  }

  const carsEnv = await call(getCars, apexReq);
  if (carsEnv.statusCode === 200 && carsEnv.body?.success) {
    pass('GET /api/user/cars works with PUBLIC_AGENCY_ID on apex');
  } else {
    fail(`cars with PUBLIC_AGENCY_ID: ${carsEnv.statusCode}`);
  }

  delete process.env.PUBLIC_AGENCY_ID;
  clearPublicTenantCache();

  await Agency.deleteMany({ _id: { $in: [agencyA._id, agencyB._id] } });
  await User.deleteMany({ _id: { $in: [ownerA._id, ownerB._id] } });
  await db.stop();
  console.log('\nPlatform apex E2E complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
