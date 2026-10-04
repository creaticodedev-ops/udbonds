/**
 * P0 cross-owner isolation verification.
 *
 * Usage (from server/):
 *   node scripts/verify-owner-isolation.mjs           # full DB suite (needs MONGODB_URI)
 *   node scripts/verify-owner-isolation.mjs --offline # ACL + helper checks only
 */
import 'dotenv/config';
import { ownerMayAccessUploadPath } from '../middleware/uploadAccess.js';
import { PublicTenantError, clearPublicTenantCache } from '../services/publicTenant.js';

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};

const pass = (msg) => console.log(`PASS: ${msg}`);

const runOfflineChecks = () => {
  const idA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const idB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  if (
    ownerMayAccessUploadPath(`contracts/${idA}/instances/x.pdf`, idA) &&
    !ownerMayAccessUploadPath(`contracts/${idB}/instances/x.pdf`, idA) &&
    ownerMayAccessUploadPath(`documents/${idA}/files/x.jpg`, idA) &&
    !ownerMayAccessUploadPath('documents/files/legacy.jpg', idA) &&
    !ownerMayAccessUploadPath('templates/logo-x.png', idA) &&
    ownerMayAccessUploadPath(`templates/${idA}/logo.png`, idA) &&
    !ownerMayAccessUploadPath(`tmp/${idB}/x`, idA) &&
    ownerMayAccessUploadPath(`tmp/${idA}/x`, idA)
  ) {
    pass('Upload path ACL allows only owner-namespaced paths');
  } else {
    fail('Upload path ACL checks failed');
  }

  const err = new PublicTenantError();
  if (err.code === 'PUBLIC_TENANT_UNRESOLVED' && err.status === 503) {
    pass('PublicTenantError shape is correct');
  } else {
    fail('PublicTenantError shape incorrect');
  }
  clearPublicTenantCache();
};

const offlineOnly = process.argv.includes('--offline');

if (offlineOnly || !process.env.MONGODB_URI) {
  if (!process.env.MONGODB_URI && !offlineOnly) {
    console.log('MONGODB_URI unset — running offline isolation checks only');
  }
  runOfflineChecks();
  console.log(process.exitCode ? 'DONE WITH FAILURES' : 'DONE — offline isolation checks passed');
  process.exit(process.exitCode || 0);
}

const { default: mongoose } = await import('mongoose');
const { default: bcrypt } = await import('bcrypt');
const { default: jwt } = await import('jsonwebtoken');
const { buildMongoUri } = await import('../configs/db.js');
const { default: User } = await import('../models/User.js');
const { default: Car } = await import('../models/Car.js');
const { default: PickupLocation } = await import('../models/PickupLocation.js');
const { resolvePublicOwnerId } = await import('../services/publicTenant.js');
const {
  getActivePickupLocations,
  getAllPickupLocations,
  updatePickupLocation,
  deletePickupLocation,
} = await import('../controllers/pickupLocationController.js');
const { getCars, getCarById } = await import('../controllers/userController.js');
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

const unique = () => `iso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function main() {
  runOfflineChecks();

  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-secret-for-isolation-script-only-32ch';
  }

  await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
  console.log('Connected');

  const tag = unique();
  const prevPublicOwner = process.env.PUBLIC_OWNER_ID;
  const created = { users: [], cars: [], locations: [] };

  try {
    const password = await bcrypt.hash('IsoTest123!', 10);
    const trial = createTrialDefaults();

    const ownerA = await User.create({
      name: `Owner A ${tag}`,
      email: `owner-a-${tag}@isolation.test`,
      password,
      role: 'owner',
      accountStatus: 'active',
      agencyName: `Agency A ${tag}`,
      ...trial,
    });
    const ownerB = await User.create({
      name: `Owner B ${tag}`,
      email: `owner-b-${tag}@isolation.test`,
      password,
      role: 'owner',
      accountStatus: 'active',
      agencyName: `Agency B ${tag}`,
      ...trial,
    });
    created.users.push(ownerA._id, ownerB._id);

    const carA = await Car.create({
      owner: ownerA._id,
      brand: 'Toyota',
      model: `Corolla-${tag}`,
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
      owner: ownerB._id,
      brand: 'Hyundai',
      model: `i10-${tag}`,
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

    const locA = await PickupLocation.create({
      owner: ownerA._id,
      name: `Desk A ${tag}`,
      city: 'Casablanca',
      address: 'A street',
      locationType: 'office',
      isActive: true,
    });
    const locB = await PickupLocation.create({
      owner: ownerB._id,
      name: `Desk B ${tag}`,
      city: 'Marrakech',
      address: 'B street',
      locationType: 'office',
      isActive: true,
    });
    created.locations.push(locA._id, locB._id);

    delete process.env.PUBLIC_OWNER_ID;
    clearPublicTenantCache();
    let threw = false;
    try {
      await resolvePublicOwnerId();
    } catch (e) {
      threw = e instanceof PublicTenantError;
    }
    const activeOwners = await User.countDocuments({
      role: 'owner',
      $or: [{ accountStatus: 'active' }, { accountStatus: { $exists: false } }, { accountStatus: null }],
    });
    if (activeOwners >= 2) {
      if (threw) pass('resolvePublicOwnerId fails closed with multiple owners');
      else fail('resolvePublicOwnerId should throw with multiple owners and no PUBLIC_OWNER_ID');
    }

    process.env.PUBLIC_OWNER_ID = String(ownerA._id);
    clearPublicTenantCache();

    const carsRes = mockRes();
    await getCars({}, carsRes);
    if (carsRes.statusCode === 200 && carsRes.body?.success) {
      const list = carsRes.body.cars || [];
      const hasA = list.some(
        (c) => String(c._id) === String(carA._id) || String(c.model || '').includes(`Corolla-${tag}`),
      );
      const leakedB = list.some(
        (c) =>
          String(c._id) === String(carB._id) ||
          String(c.model || '').includes(`i10-${tag}`) ||
          String(c.owner) === String(ownerB._id),
      );
      if (hasA && !leakedB) pass('GET cars includes only PUBLIC_OWNER fleet');
      else fail(`GET cars isolation failed hasA=${hasA} leakedB=${leakedB}`);
    } else {
      fail(`GET cars failed: ${carsRes.statusCode} ${JSON.stringify(carsRes.body)}`);
    }

    const otherCarRes = mockRes();
    await getCarById({ params: { id: String(carB._id) } }, otherCarRes);
    if (otherCarRes.statusCode === 404) pass('GET car by id 404 for other owner vehicle');
    else fail(`Expected 404 for owner B car, got ${otherCarRes.statusCode}`);

    const locRes = mockRes();
    await getActivePickupLocations({}, locRes);
    if (locRes.statusCode === 200 && locRes.body?.success) {
      const names = (locRes.body.locations || []).map((l) => l.name);
      const hasA = names.some((n) => String(n).includes(`Desk A ${tag}`));
      const hasB = names.some((n) => String(n).includes(`Desk B ${tag}`));
      if (hasA && !hasB) pass('Public pickup locations scoped to PUBLIC_OWNER');
      else fail(`Public locations leak: hasA=${hasA} hasB=${hasB}`);
    } else {
      fail(`Public locations failed: ${locRes.statusCode}`);
    }

    const updRes = mockRes();
    await updatePickupLocation(
      { user: { _id: ownerB._id }, body: { locationId: String(locA._id), name: 'Hacked' } },
      updRes,
    );
    if (updRes.statusCode === 404) pass('Owner B cannot update Owner A location');
    else fail(`Expected 404 on cross-owner update, got ${updRes.statusCode}`);

    const delRes = mockRes();
    await deletePickupLocation(
      { user: { _id: ownerB._id }, body: { locationId: String(locA._id) } },
      delRes,
    );
    if (delRes.statusCode === 404) pass('Owner B cannot delete Owner A location');
    else fail(`Expected 404 on cross-owner delete, got ${delRes.statusCode}`);

    const stillA = await PickupLocation.findById(locA._id);
    if (stillA && stillA.name === `Desk A ${tag}`) pass('Owner A location unchanged after cross-owner attempts');
    else fail('Owner A location was mutated');

    const allRes = mockRes();
    await getAllPickupLocations({ user: { _id: ownerB._id } }, allRes);
    if (allRes.statusCode === 200) {
      const leaked = (allRes.body.locations || []).some((l) => String(l._id) === String(locA._id));
      const hasOwn = (allRes.body.locations || []).some((l) => String(l._id) === String(locB._id));
      if (!leaked && hasOwn) pass('Owner B admin locations list is self-scoped');
      else fail(`Admin location list isolation failed leaked=${leaked} hasOwn=${hasOwn}`);
    } else {
      fail('getAllPickupLocations failed for owner B');
    }

    const token = jwt.sign({ _id: ownerA._id, tv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    if (token) pass('JWT mint works for isolation fixtures');
  } catch (error) {
    console.error('Isolation test error:', error);
    process.exitCode = 1;
  } finally {
    if (prevPublicOwner === undefined) delete process.env.PUBLIC_OWNER_ID;
    else process.env.PUBLIC_OWNER_ID = prevPublicOwner;
    clearPublicTenantCache();

    if (created.cars.length) await Car.deleteMany({ _id: { $in: created.cars } });
    if (created.locations.length) await PickupLocation.deleteMany({ _id: { $in: created.locations } });
    if (created.users.length) {
      await PickupLocation.deleteMany({ owner: { $in: created.users } });
      await User.deleteMany({ _id: { $in: created.users } });
    }

    await mongoose.disconnect();
    console.log(process.exitCode ? 'DONE WITH FAILURES' : 'DONE — all isolation checks passed');
  }
}

main();
