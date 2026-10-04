/**
 * P5 E2E: Staff / members isolation + maxStaff + permissions.
 *
 *   npm run test:staff:e2e
 */
import 'dotenv/config';
import assert from 'assert';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-staff-test-secret-min-32-chars!!!!';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'https://kririder.com';
process.env.BILLING_ENFORCEMENT = 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
// Prefer in-memory DB for isolation tests unless explicitly forced
if (process.env.E2E_USE_PROD !== 'true' && process.env.STAFF_E2E_USE_PROD !== 'true') {
  delete process.env.MONGODB_URI;
}
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

const unique = () => `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function connectDb() {
  if (process.env.MONGODB_URI) {
    const { buildMongoUri } = await import('../configs/db.js');
    await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
    console.log('Connected via MONGODB_URI');
    return { stop: async () => mongoose.disconnect() };
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('car-rental-staff-e2e'));
  console.log('Connected via mongodb-memory-server');
  return {
    stop: async () => {
      await mongoose.disconnect();
      await mem.stop();
    },
  };
}

async function seedAgency(tag, suffix, { planCode = 'pro' } = {}) {
  const User = (await import('../models/User.js')).default;
  const Agency = (await import('../models/Agency.js')).default;
  const { createTrialDefaults } = await import('../services/licenseService.js');
  const { ensureDefaultPlans } = await import('../services/planCatalog.js');
  const { assignPlan, ensureAgencySubscription } = await import('../services/billingService.js');

  await ensureDefaultPlans();
  const trial = createTrialDefaults();
  const user = await User.create({
    name: `Owner ${suffix}`,
    email: `${tag}-${suffix}@staff-e2e.test`,
    password: await bcrypt.hash('TestPass123!', 10),
    role: 'owner',
    accountStatus: 'active',
    agencyName: `Agency ${suffix}`,
    permissions: [],
    ...trial,
    licenseStatus: 'active',
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
  await ensureAgencySubscription(agency._id, {
    planCode: 'free_trial',
    status: 'trialing',
  });
  await assignPlan(agency._id, planCode, { actorType: 'system' });
  return { user, agency };
}

async function main() {
  const db = await connectDb();
  const tag = unique();
  const created = { users: [], agencies: [] };

  try {
    const {
      inviteStaffMember,
      listAgencyStaff,
      removeStaffMember,
      countAgencyStaffSeats,
      findStaffInviteUser,
    } = await import('../services/staffService.js');
    const { activateStaffFromInvite, getStaffInvitePreview } = await import(
      '../controllers/staffOnboardingController.js'
    );
    const { getOwnerStaff } = await import('../controllers/staffController.js');
    const { requirePermission } = await import('../middleware/requirePermission.js');

    const A = await seedAgency(tag, 'a', { planCode: 'basic' }); // maxStaff 2
    const B = await seedAgency(tag, 'b', { planCode: 'pro' }); // maxStaff 5
    created.users.push(A.user._id, B.user._id);
    created.agencies.push(A.agency._id, B.agency._id);

    assert.equal(await countAgencyStaffSeats(A.agency._id), 1);
    pass('owner alone counts as 1 seat');

    const invA = await inviteStaffMember(A.agency._id, {
      name: 'Agent A',
      email: `${tag}-agent-a@staff-e2e.test`,
      staffRole: 'agent',
      actorUser: A.user,
    });
    created.users.push(invA.member._id);
    assert.ok(invA.inviteUrl.includes('/activate-staff/'));
    assert.equal(await countAgencyStaffSeats(A.agency._id), 2);
    pass('invite creates pending staff seat');

    // basic maxStaff=2 → cannot add another
    let blocked = false;
    try {
      await inviteStaffMember(A.agency._id, {
        name: 'Extra',
        email: `${tag}-extra@staff-e2e.test`,
        staffRole: 'viewer',
      });
    } catch (e) {
      blocked = e.code === 'LIMIT_REACHED' || e.message?.includes('limit');
    }
    assert.ok(blocked);
    pass('maxStaff blocks invite beyond plan');

    // Cross-agency isolation: A staff list ≠ B
    const listA = await listAgencyStaff(A.agency._id);
    const listB = await listAgencyStaff(B.agency._id);
    assert.equal(listA.length, 1);
    assert.equal(listB.length, 0);
    assert.equal(String(listA[0].agencyId), String(A.agency._id));
    pass('staff list scoped to agency');

    // Owner B cannot see A members via controller with B agencyId
    const resB = await call(getOwnerStaff, {
      agencyId: B.agency._id,
      agency: B.agency,
      user: B.user,
    });
    assert.equal(resB.body.members.length, 0);
    pass('owner B staff API does not include A members');

    // Activate staff A
    const rawToken = invA.inviteUrl.split('/activate-staff/')[1];
    const preview = await call(getStaffInvitePreview, { params: { token: rawToken } });
    assert.equal(preview.statusCode, 200);
    assert.equal(preview.body.invite.email, `${tag}-agent-a@staff-e2e.test`);

    const act = await call(activateStaffFromInvite, {
      params: { token: rawToken },
      body: { password: 'StaffPass123!' },
    });
    assert.equal(act.statusCode, 200);
    assert.ok(act.body.token);
    assert.equal(act.body.user.role, 'staff');
    pass('staff activation sets password and returns JWT');

    const User = (await import('../models/User.js')).default;
    const staffUser = await User.findById(invA.member._id);
    assert.equal(staffUser.accountStatus, 'active');
    assert.ok(staffUser.permissions.includes('bookings'));
    assert.ok(!staffUser.permissions.includes('audit') || staffUser.staffRole === 'manager');
    pass('agent preset has bookings permission');

    // Permission middleware: staff without fleet cannot pass
    const denied = await new Promise((resolve) => {
      const mw = requirePermission('fleet');
      const req = {
        user: {
          role: 'staff',
          permissions: ['dashboard', 'bookings'],
        },
      };
      const res = mockRes();
      mw(req, res, () => resolve('next'));
      if (res.statusCode === 403) resolve('denied');
    });
    assert.equal(denied, 'denied');
    pass('staff missing permission is denied');

    const allowed = await new Promise((resolve) => {
      const mw = requirePermission('bookings');
      const req = { user: staffUser };
      const res = mockRes();
      mw(req, res, () => resolve('next'));
      if (res.statusCode === 403) resolve('denied');
    });
    assert.equal(allowed, 'next');
    pass('staff with permission is allowed');

    // Owner full access with empty perms
    const ownerOk = await new Promise((resolve) => {
      const mw = requirePermission('audit');
      const req = { user: { role: 'owner', permissions: [] } };
      const res = mockRes();
      mw(req, res, () => resolve('next'));
      if (res.statusCode === 403) resolve('denied');
    });
    assert.equal(ownerOk, 'next');
    pass('owner empty permissions = full access');

    // Used invite cannot activate again (before remove clears hash)
    const reused = await findStaffInviteUser(rawToken);
    assert.equal(reused.error, 'USED');
    pass('used staff invite cannot be reused');

    await removeStaffMember(A.agency._id, staffUser._id, { actorUser: A.user });
    const seatsAfter = await countAgencyStaffSeats(A.agency._id);
    assert.equal(seatsAfter, 1);
    pass('remove staff frees a seat');

    // Invite on B does not affect A
    const invB = await inviteStaffMember(B.agency._id, {
      name: 'Agent B',
      email: `${tag}-agent-b@staff-e2e.test`,
      staffRole: 'viewer',
    });
    created.users.push(invB.member._id);
    assert.equal(await countAgencyStaffSeats(A.agency._id), 1);
    assert.equal(await countAgencyStaffSeats(B.agency._id), 2);
    pass('invite on B does not change A seat count');

    // Owner-only: staff role blocked by requireAgencyOwnerRole
    const { requireAgencyOwnerRole } = await import('../middleware/ownerAuth.js');
    const ownerGate = await new Promise((resolve) => {
      const req = { user: staffUser };
      const res = mockRes();
      requireAgencyOwnerRole(req, res, () => resolve('next'));
      if (res.statusCode === 403) resolve(res.body.code);
    });
    assert.equal(ownerGate, 'OWNER_ONLY');
    pass('staff blocked from owner-only actions');

    console.log('\nStaff E2E complete.');
  } catch (error) {
    fail(error.stack || error.message);
  } finally {
    try {
      const User = (await import('../models/User.js')).default;
      const Agency = (await import('../models/Agency.js')).default;
      const AgencySubscription = (await import('../models/AgencySubscription.js')).default;
      const BillingEvent = (await import('../models/BillingEvent.js')).default;
      if (created.agencies.length) {
        await AgencySubscription.deleteMany({ agencyId: { $in: created.agencies } });
        await BillingEvent.deleteMany({ agencyId: { $in: created.agencies } });
        await User.deleteMany({
          $or: [{ _id: { $in: created.users } }, { agencyId: { $in: created.agencies } }],
        });
        await Agency.deleteMany({ _id: { $in: created.agencies } });
      }
    } catch (cleanupErr) {
      console.warn('cleanup', cleanupErr.message);
    }
    await db.stop();
  }
}

main();
