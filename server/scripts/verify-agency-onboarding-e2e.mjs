/**
 * End-to-end P1 agency onboarding + isolation verification.
 *
 * Uses MONGODB_URI when set; otherwise starts mongodb-memory-server.
 *
 *   node scripts/verify-agency-onboarding-e2e.mjs
 *   npm run test:onboarding:e2e
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-onboarding-test-secret-min-32-chars!!';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'https://kririder.com';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

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

const unique = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function connectDb() {
  if (process.env.MONGODB_URI) {
    const { buildMongoUri } = await import('../configs/db.js');
    await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
    console.log('Connected via MONGODB_URI');
    return { stop: async () => mongoose.disconnect() };
  }

  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = await import('mongodb-memory-server'));
  } catch {
    console.error(
      'No MONGODB_URI and mongodb-memory-server is not installed.\n' +
        'Run: npm i -D mongodb-memory-server',
    );
    process.exit(1);
  }

  const mem = await MongoMemoryServer.create();
  const uri = mem.getUri('car-rental-e2e');
  await mongoose.connect(uri);
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
  const { default: Booking } = await import('../models/Booking.js');
  const { default: PickupLocation } = await import('../models/PickupLocation.js');
  const { default: GuestCustomer } = await import('../models/GuestCustomer.js');
  const { default: Contract } = await import('../models/Contract.js');
  const { default: ExportTemplate } = await import('../models/ExportTemplate.js');
  const { default: AgencySettings } = await import('../models/AgencySettings.js');
  const {
    createAgency,
    listAgencies,
    getAgencyById,
    setAgencyStatus,
    resendAgencyInvite,
  } = await import('../controllers/superAdminController.js');
  const {
    getInvitePreview,
    setPasswordFromInvite,
    getOnboardingSession,
    updateOnboardingSession,
    completeOnboarding,
  } = await import('../controllers/agencyOnboardingController.js');
  const { loginUser, getUserData } = await import('../controllers/userController.js');
  const { requireOwner } = await import('../middleware/ownerAuth.js');
  const { requireOnboardingSession } = await import('../middleware/onboardingAuth.js');
  const { protect } = await import('../middleware/auth.js');
  const { andTenant } = await import('../utils/tenantScope.js');
  const { hashInviteToken, buildOnboardingUrl } = await import('../services/agencyInviteToken.js');

  const tag = unique();
  const created = {
    users: [],
    agencies: [],
    cars: [],
    bookings: [],
    locations: [],
    customers: [],
    contracts: [],
    templates: [],
    settings: [],
  };

  const asSuperAdmin = async () => {
    const sa = await User.create({
      name: 'E2E Super',
      email: `sa-${tag}@e2e.test`,
      password: await bcrypt.hash('SuperAdminPass123!', 10),
      role: 'superadmin',
      accountStatus: 'active',
    });
    created.users.push(sa._id);
    return sa;
  };

  const authReq = (user, extras = {}) => ({
    user,
    headers: {
      authorization: `Bearer ${jwt.sign(
        { _id: user._id.toString(), tv: user.tokenVersion || 0 },
        process.env.JWT_SECRET,
        { expiresIn: '7d' },
      )}`,
    },
    body: {},
    params: {},
    query: {},
    ...extras,
  });

  const runGate = async (middlewares, req) => {
    const res = mockRes();
    for (const mw of middlewares) {
      let proceeded = false;
      await new Promise((resolve, reject) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const next = (err) => {
          if (err) {
            if (!settled) {
              settled = true;
              reject(err);
            }
            return;
          }
          proceeded = true;
          done();
        };
        Promise.resolve()
          .then(() => mw(req, res, next))
          .then(() => {
            // Terminal middleware (sent response or ended without next)
            if (!proceeded) done();
          })
          .catch(reject);
      });
      if (res.body || (res.statusCode && res.statusCode >= 400)) break;
      if (!proceeded) break;
    }
    return res;
  };

  try {
    const superAdmin = await asSuperAdmin();

    // ── 1) Create Agency A without password ───────────────────────────
    const createA = await call(createAgency, {
      user: superAdmin,
      body: {
        name: `Agency A ${tag}`,
        slug: `agency-a-${tag}`,
        ownerName: `Owner A ${tag}`,
        ownerEmail: `owner-a-${tag}@e2e.test`,
        phone: '+212600000001',
        whatsapp: '+212600000001',
        address: '1 Rue A',
        city: 'Casablanca',
        country: 'Morocco',
        logoUrl: 'https://cdn.example.com/a-logo.png',
        startTrial: true,
      },
    });

    if (createA.statusCode === 201 && createA.body?.success) {
      pass('Super Admin creates Agency A without password');
    } else {
      fail(`create Agency A failed: ${createA.statusCode} ${JSON.stringify(createA.body)}`);
      return;
    }

    if (!createA.body.onboardingUrl || !createA.body.inviteExpiresAt) {
      fail('Invitation URL / expiry missing from create response');
    } else if (
      createA.body.onboardingUrl ===
      `https://kririder.com/activate-account/${createA.body.onboardingUrl.split('/').pop()}`
    ) {
      pass('Invitation URL generated correctly');
    } else if (createA.body.onboardingUrl.includes('/activate-account/')) {
      pass('Invitation URL generated correctly');
    } else {
      fail(`Unexpected onboarding URL: ${createA.body.onboardingUrl}`);
    }

    if (createA.body.agency?.primaryOwner?.password || createA.body.ownerPassword) {
      fail('Create response leaked a password');
    } else {
      pass('Create response does not expose owner password');
    }

    const agencyAId = createA.body.agency._id;
    const ownerAId = createA.body.agency.primaryOwner._id;
    created.agencies.push(agencyAId);
    created.users.push(ownerAId);

    const agencyADoc = await Agency.findById(agencyAId);
    const ownerADoc = await User.findById(ownerAId);
    if (agencyADoc?.status === 'pending' && ownerADoc?.accountStatus === 'pending') {
      pass('Agency A and owner created as pending');
    } else {
      fail(`pending status mismatch agency=${agencyADoc?.status} owner=${ownerADoc?.accountStatus}`);
    }

    if (!ownerADoc.passwordSetAt && ownerADoc.inviteTokenHash) {
      pass('Owner has invite hash and no passwordSetAt yet');
    } else fail('Owner invite state incorrect at create');

    const tokenA1 = createA.body.onboardingUrl.split('/').pop();
    if (hashInviteToken(tokenA1) === ownerADoc.inviteTokenHash) {
      pass('Stored invite hash matches generated token');
    } else fail('Invite hash mismatch');

    // ── 2) Preview + set password ─────────────────────────────────────
    const preview = await call(getInvitePreview, { params: { token: tokenA1 } });
    if (preview.statusCode === 200 && preview.body?.invite?.ownerEmail?.includes('owner-a-')) {
      pass('Owner can open /activate-account/:token (invite preview)');
    } else fail(`invite preview failed ${preview.statusCode}`);

    const setPw = await call(setPasswordFromInvite, {
      params: { token: tokenA1 },
      body: { password: 'OwnerA-Pass123!', name: `Owner A ${tag}` },
    });
    if (setPw.statusCode === 200 && setPw.body?.token && setPw.body?.onboardingRequired) {
      pass('Owner sets their own password');
    } else fail(`set-password failed ${setPw.statusCode} ${JSON.stringify(setPw.body)}`);

    const reuse = await call(setPasswordFromInvite, {
      params: { token: tokenA1 },
      body: { password: 'OwnerA-Pass123!', name: `Owner A ${tag}` },
    });
    if (reuse.statusCode === 410 && reuse.body?.code === 'INVITE_USED') {
      pass('Invite is single-use (second set-password → INVITE_USED)');
    } else {
      fail(`single-use expected 410 INVITE_USED, got ${reuse.statusCode} ${reuse.body?.code}`);
    }

    const reusePreview = await call(getInvitePreview, { params: { token: tokenA1 } });
    if (reusePreview.statusCode === 410 && reusePreview.body?.code === 'INVITE_USED') {
      pass('Used invite preview returns INVITE_USED');
    } else fail(`used preview expected INVITE_USED, got ${reusePreview.statusCode} ${reusePreview.body?.code}`);

    // Pending owner cannot use dashboard gate
    const ownerAAfterPw = await User.findById(ownerAId);
    const dashBlock = await runGate([protect, requireOwner], authReq(ownerAAfterPw));
    if (dashBlock.statusCode === 403) {
      pass('Pending owner cannot access protected agency dashboard APIs');
    } else fail(`expected dashboard 403 for pending, got ${dashBlock.statusCode}`);

    // Onboarding session works
    const onboardingReq = authReq(ownerAAfterPw);
    const gateRes = await runGate(requireOnboardingSession, onboardingReq);
    if (gateRes.statusCode && gateRes.statusCode >= 400) {
      fail(`onboarding gate blocked session: ${gateRes.statusCode} ${JSON.stringify(gateRes.body)}`);
    } else {
      const session = await call(getOnboardingSession, onboardingReq);
      if (session.statusCode === 200 && session.body?.agency?._id) {
        pass('Owner can load /agency-setup session after password');
      } else fail(`session load failed ${session.statusCode}`);
    }

    // ── 3) Save agency info + branding, then complete ─────────────────
    const saveInfo = await call(updateOnboardingSession, {
      ...onboardingReq,
      body: {
        agencyName: `Agency A Ready ${tag}`,
        phone: '+212611111111',
        whatsapp: '+212611111111',
        address: 'Avenue Hassan II',
        city: 'Rabat',
        country: 'Morocco',
        logoUrl: 'https://cdn.example.com/a-logo-final.png',
        primaryBrandColor: '#0e7490',
        contractBranding: {
          companyName: `Agency A Ready ${tag}`,
          logoUrl: 'https://cdn.example.com/a-contract.png',
          showLogoOnPdf: true,
          footerNote: 'Thank you',
        },
        whatsappReservationNumber: '+212611111111',
        whatsappConfirmationNumber: '+212622222222',
      },
    });
    if (saveInfo.statusCode === 200 && saveInfo.body?.agency?.logoUrl?.includes('a-logo-final')) {
      pass('Logo and agency information saved correctly');
    } else fail(`save onboarding info failed ${saveInfo.statusCode} ${JSON.stringify(saveInfo.body)}`);

    const complete = await call(completeOnboarding, {
      ...onboardingReq,
      body: {
        agencyName: `Agency A Ready ${tag}`,
        ownerName: `Owner A ${tag}`,
      },
    });
    if (
      complete.statusCode === 200 &&
      complete.body?.agency?.status === 'active' &&
      complete.body?.user?.accountStatus === 'active' &&
      complete.body?.redirectTo === '/owner'
    ) {
      pass('Agency + owner become active; redirectTo=/owner');
    } else {
      fail(`complete onboarding failed ${complete.statusCode} ${JSON.stringify(complete.body)}`);
    }

    const agencyAFinal = await Agency.findById(agencyAId);
    const ownerAFinal = await User.findById(ownerAId);
    if (
      agencyAFinal.status === 'active' &&
      ownerAFinal.accountStatus === 'active' &&
      agencyAFinal.logoUrl.includes('a-logo-final') &&
      agencyAFinal.city === 'Rabat' &&
      agencyAFinal.onboardingCompletedAt
    ) {
      pass('Persisted agency activation + saved profile fields');
    } else fail('Agency final state incorrect after complete');

    // ── 4) Logout/login normally ──────────────────────────────────────
    const loginOk = await call(loginUser, {
      body: { email: `owner-a-${tag}@e2e.test`, password: 'OwnerA-Pass123!' },
    });
    if (loginOk.statusCode === 200 && loginOk.body?.token && !loginOk.body?.onboardingRequired) {
      pass('Owner can login normally after onboarding');
    } else fail(`post-onboarding login failed ${loginOk.statusCode} ${JSON.stringify(loginOk.body)}`);

    const ownerFresh = await User.findById(ownerAId);
    const dataOk = await call(getUserData, authReq(ownerFresh));
    if (dataOk.statusCode === 200 && dataOk.body?.user?.role === 'owner' && !dataOk.body?.onboardingRequired) {
      pass('Owner /api/user/data works after activation');
    } else fail(`getUserData failed ${dataOk.statusCode}`);

    const dashOk = await runGate([protect, requireOwner], authReq(ownerFresh));
    if (!dashOk.statusCode || dashOk.statusCode < 400) {
      pass('Owner can access dashboard gate after activation');
    } else fail(`dashboard gate failed ${dashOk.statusCode} ${JSON.stringify(dashOk.body)}`);

    // ── 5) Create Agency B + isolation ────────────────────────────────
    const createB = await call(createAgency, {
      user: superAdmin,
      body: {
        name: `Agency B ${tag}`,
        slug: `agency-b-${tag}`,
        ownerName: `Owner B ${tag}`,
        ownerEmail: `owner-b-${tag}@e2e.test`,
        city: 'Marrakech',
        country: 'Morocco',
      },
    });
    if (createB.statusCode !== 201) {
      fail(`create Agency B failed ${createB.statusCode}`);
      return;
    }
    pass('Super Admin creates Agency B');
    const agencyBId = createB.body.agency._id;
    const ownerBId = createB.body.agency.primaryOwner._id;
    created.agencies.push(agencyBId);
    created.users.push(ownerBId);
    const tokenB = createB.body.onboardingUrl.split('/').pop();

    await call(setPasswordFromInvite, {
      params: { token: tokenB },
      body: { password: 'OwnerB-Pass123!', name: `Owner B ${tag}` },
    });
    const ownerBPending = await User.findById(ownerBId);
    const onboardingB = authReq(ownerBPending);
    await runGate(requireOnboardingSession, onboardingB);
    await call(completeOnboarding, {
      ...onboardingB,
      body: { agencyName: `Agency B ${tag}`, ownerName: `Owner B ${tag}` },
    });

    const ownerA = await User.findById(ownerAId);
    const ownerB = await User.findById(ownerBId);
    const agencyA = await Agency.findById(agencyAId);
    const agencyB = await Agency.findById(agencyBId);

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
      description: 'Agency A car',
      status: 'available',
      isAvaliable: true,
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
      description: 'Agency B car',
      status: 'available',
      isAvaliable: true,
    });
    created.cars.push(carA._id, carB._id);

    const bookingA = await Booking.create({
      car: carA._id,
      agencyId: agencyA._id,
      owner: ownerA._id,
      pickupDate: new Date(),
      returnDate: new Date(Date.now() + 86400000),
      status: 'confirmed',
      price: 300,
      customerName: 'Cust A',
      customerEmail: `cust-a-${tag}@e2e.test`,
    });
    const bookingB = await Booking.create({
      car: carB._id,
      agencyId: agencyB._id,
      owner: ownerB._id,
      pickupDate: new Date(),
      returnDate: new Date(Date.now() + 86400000),
      status: 'confirmed',
      price: 200,
      customerName: 'Cust B',
      customerEmail: `cust-b-${tag}@e2e.test`,
    });
    created.bookings.push(bookingA._id, bookingB._id);

    const locA = await PickupLocation.create({
      agencyId: agencyA._id,
      owner: ownerA._id,
      name: `Loc A ${tag}`,
      city: 'Rabat',
      address: 'A',
      isActive: true,
    });
    const locB = await PickupLocation.create({
      agencyId: agencyB._id,
      owner: ownerB._id,
      name: `Loc B ${tag}`,
      city: 'Marrakech',
      address: 'B',
      isActive: true,
    });
    created.locations.push(locA._id, locB._id);

    const custA = await GuestCustomer.create({
      agencyId: agencyA._id,
      owner: ownerA._id,
      email: `guest-a-${tag}@e2e.test`,
      name: 'Guest A',
    });
    const custB = await GuestCustomer.create({
      agencyId: agencyB._id,
      owner: ownerB._id,
      email: `guest-b-${tag}@e2e.test`,
      name: 'Guest B',
    });
    created.customers.push(custA._id, custB._id);

    const tmplA = await ExportTemplate.create({
      agencyId: agencyA._id,
      owner: ownerA._id,
      name: `Tmpl A ${tag}`,
      type: 'contract',
    });
    const tmplB = await ExportTemplate.create({
      agencyId: agencyB._id,
      owner: ownerB._id,
      name: `Tmpl B ${tag}`,
      type: 'contract',
    });
    created.templates.push(tmplA._id, tmplB._id);

    const contractA = await Contract.create({
      agencyId: agencyA._id,
      owner: ownerA._id,
      booking: bookingA._id,
      contractNumber: `CA-${tag}`,
    });
    const contractB = await Contract.create({
      agencyId: agencyB._id,
      owner: ownerB._id,
      booking: bookingB._id,
      contractNumber: `CB-${tag}`,
    });
    created.contracts.push(contractA._id, contractB._id);

    const reqA = {
      user: ownerA,
      agencyId: agencyA._id,
      agencyLegacyOwnerId: agencyA.legacyOwnerId,
      agency: agencyA.toObject(),
    };
    const reqB = {
      user: ownerB,
      agencyId: agencyB._id,
      agencyLegacyOwnerId: agencyB.legacyOwnerId,
      agency: agencyB.toObject(),
    };

    const carsSeenByA = await Car.find(andTenant(reqA)).select('model').lean();
    const carsSeenByB = await Car.find(andTenant(reqB)).select('model').lean();
    const aSeesOnlyA =
      carsSeenByA.some((c) => c.model.includes(`A-${tag}`)) &&
      !carsSeenByA.some((c) => c.model.includes(`B-${tag}`));
    const bSeesOnlyB =
      carsSeenByB.some((c) => c.model.includes(`B-${tag}`)) &&
      !carsSeenByB.some((c) => c.model.includes(`A-${tag}`));
    if (aSeesOnlyA && bSeesOnlyB) pass('Agency A cannot see Agency B cars (and vice versa)');
    else fail(`car isolation failed A=${carsSeenByA.map((c) => c.model)} B=${carsSeenByB.map((c) => c.model)}`);

    const bookingsA = await Booking.find(andTenant(reqA)).select('_id').lean();
    const bookingsB = await Booking.find(andTenant(reqB)).select('_id').lean();
    if (
      bookingsA.some((b) => String(b._id) === String(bookingA._id)) &&
      !bookingsA.some((b) => String(b._id) === String(bookingB._id)) &&
      bookingsB.some((b) => String(b._id) === String(bookingB._id)) &&
      !bookingsB.some((b) => String(b._id) === String(bookingA._id))
    ) {
      pass('Booking isolation holds across agencies');
    } else fail('booking isolation failed');

    const locsA = await PickupLocation.find(andTenant(reqA)).select('name').lean();
    const locsB = await PickupLocation.find(andTenant(reqB)).select('name').lean();
    if (
      locsA.some((l) => l.name.includes('Loc A')) &&
      !locsA.some((l) => l.name.includes('Loc B')) &&
      locsB.some((l) => l.name.includes('Loc B')) &&
      !locsB.some((l) => l.name.includes('Loc A'))
    ) {
      pass('Location isolation holds across agencies');
    } else fail('location isolation failed');

    const guestsA = await GuestCustomer.find(andTenant(reqA)).select('email').lean();
    const guestsB = await GuestCustomer.find(andTenant(reqB)).select('email').lean();
    if (
      guestsA.some((g) => g.email.includes('guest-a-')) &&
      !guestsA.some((g) => g.email.includes('guest-b-')) &&
      guestsB.some((g) => g.email.includes('guest-b-')) &&
      !guestsB.some((g) => g.email.includes('guest-a-'))
    ) {
      pass('Customer isolation holds across agencies');
    } else fail('customer isolation failed');

    const tmplsA = await ExportTemplate.find(andTenant(reqA)).select('name').lean();
    const tmplsB = await ExportTemplate.find(andTenant(reqB)).select('name').lean();
    if (
      tmplsA.some((t) => t.name.includes('Tmpl A')) &&
      !tmplsA.some((t) => t.name.includes('Tmpl B')) &&
      tmplsB.some((t) => t.name.includes('Tmpl B')) &&
      !tmplsB.some((t) => t.name.includes('Tmpl A'))
    ) {
      pass('Template isolation holds across agencies');
    } else fail('template isolation failed');

    const contractsSeenA = await Contract.find(andTenant(reqA)).select('contractNumber').lean();
    const contractsSeenB = await Contract.find(andTenant(reqB)).select('contractNumber').lean();
    if (
      contractsSeenA.some((c) => c.contractNumber.startsWith('CA-')) &&
      !contractsSeenA.some((c) => c.contractNumber.startsWith('CB-')) &&
      contractsSeenB.some((c) => c.contractNumber.startsWith('CB-')) &&
      !contractsSeenB.some((c) => c.contractNumber.startsWith('CA-'))
    ) {
      pass('Contract isolation holds across agencies');
    } else fail('contract isolation failed');

    // Super Admin sees both
    const listed = await call(listAgencies, {
      user: superAdmin,
      query: { q: tag, limit: 50 },
    });
    const ids = (listed.body?.agencies || []).map((a) => String(a._id));
    if (ids.includes(String(agencyAId)) && ids.includes(String(agencyBId))) {
      pass('Super Admin can list/manage both agencies');
    } else fail(`SA list missing agencies: ${ids.join(',')}`);

    const detailB = await call(getAgencyById, {
      user: superAdmin,
      params: { id: String(agencyBId) },
    });
    if (detailB.statusCode === 200 && detailB.body?.agency?.slug?.includes('agency-b-')) {
      pass('Super Admin can open Agency B details');
    } else fail('SA agency detail failed');

    // ── 6) Suspend Agency A ───────────────────────────────────────────
    const suspend = await call(setAgencyStatus, {
      user: superAdmin,
      params: { id: String(agencyAId) },
      body: { status: 'suspended' },
    });
    if (suspend.statusCode === 200) pass('Super Admin suspends Agency A');
    else fail(`suspend failed ${suspend.statusCode}`);

    const loginSuspended = await call(loginUser, {
      body: { email: `owner-a-${tag}@e2e.test`, password: 'OwnerA-Pass123!' },
    });
    if (loginSuspended.statusCode === 403 && loginSuspended.body?.code === 'ACCOUNT_LOCKED') {
      pass('Suspended Agency A owner cannot log in');
    } else {
      fail(
        `suspended login expected ACCOUNT_LOCKED, got ${loginSuspended.statusCode} ${loginSuspended.body?.code}`,
      );
    }

    const ownerASuspended = await User.findById(ownerAId);
    const dashSuspended = await runGate([protect, requireOwner], authReq(ownerASuspended));
    if (dashSuspended.statusCode === 403) {
      pass('Suspended owner cannot access dashboard APIs');
    } else fail(`suspended dashboard expected 403, got ${dashSuspended.statusCode}`);

    const stillCarA = await Car.findById(carA._id);
    const stillBookingA = await Booking.findById(bookingA._id);
    if (stillCarA && stillBookingA) pass('Suspend does not delete Agency A data');
    else fail('data deleted on suspend');

    // Restore A for remaining invite tests on a fresh agency
    await call(setAgencyStatus, {
      user: superAdmin,
      params: { id: String(agencyAId) },
      body: { status: 'active' },
    });

    // ── 7) Invite expiration ──────────────────────────────────────────
    const createC = await call(createAgency, {
      user: superAdmin,
      body: {
        name: `Agency C ${tag}`,
        slug: `agency-c-${tag}`,
        ownerName: `Owner C ${tag}`,
        ownerEmail: `owner-c-${tag}@e2e.test`,
      },
    });
    const agencyCId = createC.body.agency._id;
    const ownerCId = createC.body.agency.primaryOwner._id;
    created.agencies.push(agencyCId);
    created.users.push(ownerCId);
    const tokenC = createC.body.onboardingUrl.split('/').pop();
    await User.updateOne({ _id: ownerCId }, { $set: { inviteExpiresAt: new Date(Date.now() - 1000) } });

    const expiredPreview = await call(getInvitePreview, { params: { token: tokenC } });
    if (expiredPreview.statusCode === 410 && expiredPreview.body?.code === 'INVITE_EXPIRED') {
      pass('Expired invite is rejected (INVITE_EXPIRED)');
    } else {
      fail(`expiry expected INVITE_EXPIRED, got ${expiredPreview.statusCode} ${expiredPreview.body?.code}`);
    }

    const expiredSet = await call(setPasswordFromInvite, {
      params: { token: tokenC },
      body: { password: 'OwnerC-Pass123!' },
    });
    if (expiredSet.statusCode === 410 && expiredSet.body?.code === 'INVITE_EXPIRED') {
      pass('Expired invite cannot set password');
    } else fail(`expired set-password expected 410, got ${expiredSet.statusCode}`);

    // ── 8) Resend invite invalidates old token ────────────────────────
    const createD = await call(createAgency, {
      user: superAdmin,
      body: {
        name: `Agency D ${tag}`,
        slug: `agency-d-${tag}`,
        ownerName: `Owner D ${tag}`,
        ownerEmail: `owner-d-${tag}@e2e.test`,
      },
    });
    const agencyDId = createD.body.agency._id;
    const ownerDId = createD.body.agency.primaryOwner._id;
    created.agencies.push(agencyDId);
    created.users.push(ownerDId);
    const oldTokenD = createD.body.onboardingUrl.split('/').pop();

    const resent = await call(resendAgencyInvite, {
      user: superAdmin,
      params: { id: String(agencyDId) },
    });
    if (resent.statusCode === 200 && resent.body?.onboardingUrl) {
      pass('resend-invite generates a new onboarding URL');
    } else fail(`resend-invite failed ${resent.statusCode}`);

    const newTokenD = resent.body.onboardingUrl.split('/').pop();
    if (newTokenD && newTokenD !== oldTokenD) pass('Resent invite token differs from old token');
    else fail('resend did not rotate token');

    const oldAfterResend = await call(getInvitePreview, { params: { token: oldTokenD } });
    if (oldAfterResend.statusCode === 404 && oldAfterResend.body?.code === 'INVITE_INVALID') {
      pass('Old invite becomes invalid after resend');
    } else {
      fail(
        `old invite after resend expected INVITE_INVALID, got ${oldAfterResend.statusCode} ${oldAfterResend.body?.code}`,
      );
    }

    const newPreview = await call(getInvitePreview, { params: { token: newTokenD } });
    if (newPreview.statusCode === 200) pass('New resent invite is valid');
    else fail(`new invite invalid ${newPreview.statusCode}`);

    // Expected URL helper still matches product path
    const sampleUrl = buildOnboardingUrl('abc');
    if (sampleUrl.endsWith('/activate-account/abc')) {
      pass('buildOnboardingUrl keeps /activate-account/:token path');
    } else fail(`URL helper wrong: ${sampleUrl}`);

    // Settings dual-write exists for A
    const settingsA = await AgencySettings.findOne({ agencyId: agencyAId });
    if (settingsA) {
      created.settings.push(settingsA._id);
      pass('Agency settings document created for onboarded agency');
    } else {
      // may exist via owner
      const byOwner = await AgencySettings.findOne({ owner: ownerAId });
      if (byOwner) {
        created.settings.push(byOwner._id);
        pass('Agency settings document created for onboarded agency');
      } else fail('Agency settings missing after onboarding');
    }
  } catch (error) {
    console.error('E2E error:', error);
    process.exitCode = 1;
  } finally {
    try {
      if (created.contracts.length) await Contract.deleteMany({ _id: { $in: created.contracts } });
      if (created.bookings.length) await Booking.deleteMany({ _id: { $in: created.bookings } });
      if (created.cars.length) await Car.deleteMany({ _id: { $in: created.cars } });
      if (created.locations.length) await PickupLocation.deleteMany({ _id: { $in: created.locations } });
      if (created.customers.length) await GuestCustomer.deleteMany({ _id: { $in: created.customers } });
      if (created.templates.length) await ExportTemplate.deleteMany({ _id: { $in: created.templates } });
      if (created.settings.length) await AgencySettings.deleteMany({ _id: { $in: created.settings } });
      // Also cleanup settings by owner for seeded createAgency
      if (created.users.length) {
        await AgencySettings.deleteMany({ owner: { $in: created.users } });
      }
      if (created.agencies.length) await Agency.deleteMany({ _id: { $in: created.agencies } });
      if (created.users.length) await User.deleteMany({ _id: { $in: created.users } });
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }
    await db.stop();
    console.log(process.exitCode ? 'DONE WITH FAILURES' : 'DONE — onboarding E2E passed');
  }
}

main();
