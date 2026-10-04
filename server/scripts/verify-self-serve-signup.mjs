/**
 * E2E: public self-serve signup creates a pending agency until Super Admin approval.
 *
 *   npm run test:signup:e2e
 */
import 'dotenv/config';
if (process.env.E2E_USE_PROD !== 'true') delete process.env.MONGODB_URI;
import mongoose from 'mongoose';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-self-serve-signup-secret-min-32-chars!!';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};
const pass = (msg) => console.log(`PASS: ${msg}`);

async function connectDb() {
  if (process.env.MONGODB_URI) {
    const { buildMongoUri } = await import('../configs/db.js');
    await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
    return { stop: async () => mongoose.disconnect() };
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('car-rental-signup-e2e'));
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
  const { TRIAL_DAYS } = await import('../services/licenseService.js');
  const { registerSelfServeAgency, getSignupInfo } = await import('../services/selfServeSignup.js');
  const { loginUser } = await import('../controllers/userController.js');

  const info = getSignupInfo();
  if (info.trialDays === TRIAL_DAYS) pass(`signup-info trialDays=${TRIAL_DAYS}`);
  else fail(`trialDays mismatch ${info.trialDays} vs ${TRIAL_DAYS}`);

  const tag = `sg-${Date.now()}`;
  const email = `${tag}@signup.test`;
  const payload = {
    name: 'Sara Owner',
    email,
    password: 'StrongPass9',
    confirmPassword: 'StrongPass9',
    agencyName: `${tag} Rentals`,
    phone: '212600000001',
    country: 'Morocco',
    city: 'Casablanca',
  };

  try {
    await registerSelfServeAgency({ ...payload, password: 'short' });
    fail('short password should be rejected');
  } catch (err) {
    if (err.status === 400) pass('short password rejected');
    else fail(`short password: ${err.message}`);
  }

  const created = await registerSelfServeAgency(payload);
  if (created.approvalPending && !created.token && created.user?.role === 'owner') {
    pass('signup returns pending request without JWT');
  } else fail('signup should not auto-activate');

  const user = await User.findById(created.user._id);
  const agency = await Agency.findById(created.agency._id);
  if (user.accountStatus === 'pending' && user.passwordSetAt) {
    pass('owner is pending with password set');
  } else fail('owner should be pending with password');

  if (
    String(agency.primaryOwnerUserId) === String(user._id) &&
    String(user.agencyId) === String(agency._id) &&
    agency.status === 'pending' &&
    agency.createdVia === 'self_serve' &&
    agency.isPublicStorefront === false
  ) {
    pass('pending agency owner relationship is correct');
  } else fail('agency/owner link incorrect');

  try {
    await registerSelfServeAgency(payload);
    fail('duplicate email should be rejected');
  } catch (err) {
    if (err.status === 409) pass('duplicate email rejected');
    else fail(`duplicate email: ${err.message}`);
  }

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

  const loginRes = mockRes();
  await loginUser({ body: { email, password: 'StrongPass9' } }, loginRes);
  if (loginRes.statusCode === 403 && loginRes.body?.code === 'APPROVAL_PENDING') {
    pass('new owner cannot log in until Super Admin approval');
  } else fail(`login after signup: ${loginRes.statusCode} ${JSON.stringify(loginRes.body)}`);

  await User.deleteOne({ _id: user._id });
  await Agency.deleteOne({ _id: agency._id });
  await db.stop();
  console.log('\nSelf-serve signup E2E complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
