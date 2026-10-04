/**
 * E2E: self-serve signup stays pending until Super Admin approval.
 *
 *   node scripts/verify-agency-approval.mjs
 */
import 'dotenv/config';
if (process.env.E2E_USE_PROD !== 'true') delete process.env.MONGODB_URI;
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-agency-approval-secret-min-32-chars!!';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'https://kririder.com';
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
  await mongoose.connect(mem.getUri('car-rental-approval-e2e'));
  return {
    stop: async () => {
      await mongoose.disconnect();
      await mem.stop();
    },
  };
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

async function main() {
  const db = await connectDb();
  const { default: User } = await import('../models/User.js');
  const { default: Agency } = await import('../models/Agency.js');
  const { default: PlatformNotification } = await import('../models/PlatformNotification.js');
  const { registerSelfServeAgency } = await import('../services/selfServeSignup.js');
  const { approveAgencyRequest, rejectAgencyRequest } = await import('../services/agencyApprovalService.js');
  const { buildOwnerDashboardUrl } = await import('../services/agencyAccessUrls.js');
  const { loginUser } = await import('../controllers/userController.js');

  const tag = `ap-${Date.now()}`;
  const email = `${tag}@approval.test`;
  const created = await registerSelfServeAgency({
    name: 'Nora Owner',
    email,
    password: 'StrongPass9',
    confirmPassword: 'StrongPass9',
    agencyName: `${tag} Fleet`,
    phone: '212600000009',
    country: 'Morocco',
    city: 'Rabat',
  });

  if (created.approvalPending && !created.token && created.agency?.status === 'pending') {
    pass('signup is pending without JWT');
  } else fail(`signup not pending: ${JSON.stringify(created.agency)}`);

  const signupNote = await PlatformNotification.findOne({ type: 'agency.signup', agencyId: created.agency._id });
  if (signupNote) pass('signup created a Super Admin inbox event');
  else fail('missing agency.signup inbox event');

  const loginBlocked = mockRes();
  await loginUser({ body: { email, password: 'StrongPass9' } }, loginBlocked);
  if (loginBlocked.statusCode === 403 && loginBlocked.body?.code === 'APPROVAL_PENDING') {
    pass('pending owner cannot open dashboard');
  } else fail(`login pending unexpected: ${loginBlocked.statusCode} ${JSON.stringify(loginBlocked.body)}`);

  const sa = await User.create({
    name: 'Super Admin',
    email: `sa-${tag}@kririder.test`,
    password: await bcrypt.hash('SuperPass99', 10),
    role: 'superadmin',
    accountStatus: 'active',
  });

  const approved = await approveAgencyRequest(created.agency._id, sa);
  const agency = await Agency.findById(created.agency._id);
  const owner = await User.findById(created.user._id);
  const expectedDash = buildOwnerDashboardUrl();

  if (agency.status === 'active' && owner.accountStatus === 'active') pass('approval activates agency + owner');
  else fail(`status after approve agency=${agency.status} owner=${owner.accountStatus}`);

  if (approved.urls.dashboardUrl === expectedDash && expectedDash.endsWith('/owner')) {
    pass(`dashboard URL is real owner workspace: ${expectedDash}`);
  } else fail(`dashboard URL unexpected ${approved.urls.dashboardUrl}`);

  const emailStatus = approved.notifications?.email?.status;
  if (['sent', 'failed', 'not_configured', 'skipped'].includes(emailStatus)) {
    pass(`email notification recorded as ${emailStatus} (approval still succeeded)`);
  } else fail(`email notification missing: ${JSON.stringify(approved.notifications)}`);

  const waStatus = approved.notifications?.whatsapp?.status;
  if (['link_ready', 'not_configured'].includes(waStatus)) {
    pass(`whatsapp recorded as ${waStatus} (no API send claimed)`);
  } else fail(`whatsapp unexpected ${waStatus}`);

  const approvedNote = await PlatformNotification.findOne({ type: 'agency.approved', agencyId: agency._id });
  if (approvedNote) pass('approval created a Super Admin inbox event');
  else fail('missing agency.approved inbox event');
  const smtpNote = await PlatformNotification.findOne({
    agencyId: agency._id,
    type: { $in: ['system.email_failed', 'system.smtp_not_configured'] },
  });
  if (emailStatus === 'not_configured' || emailStatus === 'failed') {
    if (smtpNote) pass('email delivery issue surfaced in Super Admin inbox');
    else fail('missing SMTP/email failure inbox event');
  }

  const loginOk = mockRes();
  await loginUser({ body: { email, password: 'StrongPass9' } }, loginOk);
  if (loginOk.statusCode === 200 && loginOk.body?.token && loginOk.body?.onboardingRequired === false) {
    pass('owner can log in after approval');
  } else fail(`login after approve: ${loginOk.statusCode} ${JSON.stringify(loginOk.body)}`);

  const tag2 = `rj-${Date.now()}`;
  const rejectedSignup = await registerSelfServeAgency({
    name: 'Rejected Owner',
    email: `${tag2}@approval.test`,
    password: 'StrongPass9',
    confirmPassword: 'StrongPass9',
    agencyName: `${tag2} Co`,
    phone: '212600000008',
    country: 'Morocco',
    city: 'Fes',
  });
  await rejectAgencyRequest(rejectedSignup.agency._id, sa, 'Incomplete information');
  const rejectedAgency = await Agency.findById(rejectedSignup.agency._id);
  if (rejectedAgency.status === 'rejected' && rejectedAgency.rejectionReason) {
    pass('reject sets rejected status with reason');
  } else fail(`reject failed ${rejectedAgency.status}`);

  const loginRejected = mockRes();
  await loginUser(
    { body: { email: `${tag2}@approval.test`, password: 'StrongPass9' } },
    loginRejected,
  );
  if (loginRejected.statusCode === 403) pass('rejected owner cannot log in');
  else fail(`rejected login ${loginRejected.statusCode}`);

  await User.deleteMany({ email: { $in: [email, sa.email, `${tag2}@approval.test`] } });
  await Agency.deleteMany({ _id: { $in: [created.agency._id, rejectedSignup.agency._id] } });
  await PlatformNotification.deleteMany({
    agencyId: { $in: [created.agency._id, rejectedSignup.agency._id] },
  });
  await db.stop();
  console.log('\nAgency approval E2E complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
