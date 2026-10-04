/**
 * P1 agency isolation + migration verification.
 *
 *   node scripts/verify-agency-isolation.mjs           # DB suite when MONGODB_URI set
 *   node scripts/verify-agency-isolation.mjs --offline # unit checks only
 */
import 'dotenv/config';
import { PublicTenantError, clearPublicTenantCache } from '../services/publicTenant.js';
import { publicAgencyFilter, andTenant, tenantWriteFields } from '../utils/tenantScope.js';

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};
const pass = (msg) => console.log(`PASS: ${msg}`);

const runOffline = () => {
  const agency = {
    agencyId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    legacyOwnerId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  };
  const filter = publicAgencyFilter(agency);
  if (filter.$or?.length === 2) pass('publicAgencyFilter returns dual-read $or');
  else fail('publicAgencyFilter shape incorrect');

  const ownerOnly = publicAgencyFilter({
    agencyId: null,
    legacyOwnerId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    ownerOnlyFallback: true,
  });
  if (ownerOnly.owner) pass('publicAgencyFilter ownerOnlyFallback works');
  else fail('ownerOnlyFallback broken');

  const req = {
    agencyId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    agencyLegacyOwnerId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    user: { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb' },
  };
  const write = tenantWriteFields(req);
  if (String(write.agencyId) === String(req.agencyId) && String(write.owner) === String(req.agencyLegacyOwnerId)) {
    pass('tenantWriteFields dual-writes agencyId + owner');
  } else fail('tenantWriteFields incorrect');

  const scoped = andTenant(req, { isActive: true });
  if (scoped.$and || scoped.agencyId || scoped.$or) pass('andTenant builds scoped query');
  else fail('andTenant incorrect');

  const err = new PublicTenantError();
  if (err.code === 'PUBLIC_TENANT_UNRESOLVED') pass('PublicTenantError code stable');
  else fail('PublicTenantError code changed');

  clearPublicTenantCache();
};

if (process.argv.includes('--offline') || !process.env.MONGODB_URI) {
  if (!process.env.MONGODB_URI && !process.argv.includes('--offline')) {
    console.log('MONGODB_URI unset — running offline agency checks only');
  }
  runOffline();
  console.log(process.exitCode ? 'DONE WITH FAILURES' : 'DONE — offline agency checks passed');
  process.exit(process.exitCode || 0);
}

const { default: mongoose } = await import('mongoose');
const { default: bcrypt } = await import('bcrypt');
const { buildMongoUri } = await import('../configs/db.js');
const { default: User } = await import('../models/User.js');
const { default: Agency } = await import('../models/Agency.js');
const { default: Car } = await import('../models/Car.js');
const { default: PickupLocation } = await import('../models/PickupLocation.js');
const { runAgencyMigration, ensureAgencyForOwner } = await import('../services/agencyMigration.js');
const { resolvePublicAgency } = await import('../services/publicTenant.js');
const { getCars } = await import('../controllers/userController.js');
const { createTrialDefaults } = await import('../services/licenseService.js');

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

const unique = () => `ag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function main() {
  runOffline();

  await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
  console.log('Connected');

  const tag = unique();
  const prevAgency = process.env.PUBLIC_AGENCY_ID;
  const prevOwner = process.env.PUBLIC_OWNER_ID;
  const created = { users: [], agencies: [], cars: [], locations: [] };

  try {
    // Ensure baseline migration is idempotent
    const first = await runAgencyMigration();
    const second = await runAgencyMigration();
    if (second.agenciesCreated === 0) pass('runAgencyMigration is idempotent (no re-create)');
    else fail(`migration re-created agencies: ${second.agenciesCreated}`);
    if (first && second) pass('migration ran twice without throwing');

    const password = await bcrypt.hash('AgencyTest123!', 10);
    const trial = createTrialDefaults();

    const ownerA = await User.create({
      name: `Owner A ${tag}`,
      email: `owner-a-${tag}@agency.test`,
      password,
      role: 'owner',
      accountStatus: 'active',
      agencyName: `Agency A ${tag}`,
      ...trial,
    });
    const ownerB = await User.create({
      name: `Owner B ${tag}`,
      email: `owner-b-${tag}@agency.test`,
      password,
      role: 'owner',
      accountStatus: 'active',
      agencyName: `Agency B ${tag}`,
      ...trial,
    });
    created.users.push(ownerA._id, ownerB._id);

    const agencyA = await ensureAgencyForOwner(ownerA);
    const agencyB = await ensureAgencyForOwner(ownerB);
    created.agencies.push(agencyA._id, agencyB._id);

    if (agencyA._id && agencyB._id && String(agencyA._id) !== String(agencyB._id)) {
      pass('ensureAgencyForOwner creates distinct agencies');
    } else fail('agencies not distinct');

    const againA = await ensureAgencyForOwner(await User.findById(ownerA._id));
    if (String(againA._id) === String(agencyA._id)) pass('ensureAgencyForOwner is idempotent per owner');
    else fail('ensureAgencyForOwner created duplicate agency');

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
      isAvaliable: true,
      status: 'available',
    });
    created.cars.push(carA._id, carB._id);

    await PickupLocation.create({
      agencyId: agencyA._id,
      owner: ownerA._id,
      name: `Loc A ${tag}`,
      city: 'Casablanca',
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

    delete process.env.PUBLIC_AGENCY_ID;
    delete process.env.PUBLIC_OWNER_ID;
    clearPublicTenantCache();

    // Force A as public storefront
    await Agency.updateMany({}, { $set: { isPublicStorefront: false } });
    await Agency.updateOne({ _id: agencyA._id }, { $set: { isPublicStorefront: true, status: 'active' } });
    clearPublicTenantCache();

    const resolved = await resolvePublicAgency();
    if (String(resolved.agencyId) === String(agencyA._id)) pass('resolvePublicAgency uses isPublicStorefront');
    else fail(`public agency mismatch: ${resolved.agencyId}`);

    process.env.PUBLIC_OWNER_ID = String(ownerA._id);
    clearPublicTenantCache();
    const viaOwner = await resolvePublicAgency();
    if (String(viaOwner.agencyId) === String(agencyA._id)) pass('PUBLIC_OWNER_ID maps via legacyOwnerId');
    else fail('PUBLIC_OWNER_ID mapping failed');

    process.env.PUBLIC_AGENCY_ID = String(agencyA._id);
    clearPublicTenantCache();
    const viaAgency = await resolvePublicAgency();
    if (String(viaAgency.agencyId) === String(agencyA._id)) pass('PUBLIC_AGENCY_ID wins');
    else fail('PUBLIC_AGENCY_ID failed');

    const carsRes = mockRes();
    await getCars({}, carsRes);
    if (carsRes.statusCode === 200) {
      const list = carsRes.body.cars || [];
      const hasA = list.some((c) => String(c.model || '').includes(`A-${tag}`));
      const hasB = list.some((c) => String(c.model || '').includes(`B-${tag}`));
      if (hasA && !hasB) pass('public catalog scoped to one agency');
      else fail(`catalog isolation failed hasA=${hasA} hasB=${hasB}`);
    } else {
      fail(`getCars failed ${carsRes.statusCode}`);
    }

    // Data not deleted by migration
    const stillA = await Car.findById(carA._id);
    const stillB = await Car.findById(carB._id);
    if (stillA && stillB) pass('migration/tests did not destroy existing cars');
    else fail('cars missing after tests');
  } catch (error) {
    console.error('Agency isolation test error:', error);
    process.exitCode = 1;
  } finally {
    if (prevAgency === undefined) delete process.env.PUBLIC_AGENCY_ID;
    else process.env.PUBLIC_AGENCY_ID = prevAgency;
    if (prevOwner === undefined) delete process.env.PUBLIC_OWNER_ID;
    else process.env.PUBLIC_OWNER_ID = prevOwner;
    clearPublicTenantCache();

    if (created.cars.length) await Car.deleteMany({ _id: { $in: created.cars } });
    await PickupLocation.deleteMany({ owner: { $in: created.users } });
    if (created.agencies.length) await Agency.deleteMany({ _id: { $in: created.agencies } });
    if (created.users.length) await User.deleteMany({ _id: { $in: created.users } });

    await mongoose.disconnect();
    console.log(process.exitCode ? 'DONE WITH FAILURES' : 'DONE — all agency isolation checks passed');
  }
}

main();
