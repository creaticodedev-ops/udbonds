/**
 * P2 branding isolation E2E — Agency A vs B.
 * Verifies storefront profile, PDF template vars, email identity, WhatsApp dials,
 * and no HDN/Safi/Americonfort leaks on tenant surfaces.
 *
 *   npm run test:branding:e2e
 */
import 'dotenv/config';
// Isolation e2e defaults to memory DB (set E2E_USE_PROD=true to hit MONGODB_URI)
if (process.env.E2E_USE_PROD !== 'true') delete process.env.MONGODB_URI;
import assert from 'assert';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-branding-test-secret-min-32-chars!!';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'https://kririder.com';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PLATFORM_NAME = 'RSZ CAR';
delete process.env.PUBLIC_AGENCY_ID;
delete process.env.PUBLIC_OWNER_ID;
delete process.env.AGENCY_NAME;

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

const unique = () => `br-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const LEAK_RE = /HDN\s*Car|Safi\s*NAP|Americonfort|haddane_car|haddanecar|212665330116|AB IBN BATTOUTA/i;

async function connectDb() {
  if (process.env.MONGODB_URI) {
    const { buildMongoUri } = await import('../configs/db.js');
    await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
    console.log('Connected via MONGODB_URI');
    return { stop: async () => mongoose.disconnect() };
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('car-rental-branding-e2e'));
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
  const { getPublicStorefront } = await import('../controllers/publicStorefrontController.js');
  const { createTrialDefaults } = await import('../services/licenseService.js');
  const { clearPublicTenantCache } = await import('../services/publicTenant.js');
  const { buildTemplateVariables, buildDocumentHtml } = await import('../services/templateEngine.js');
  const { resolveAgencyBrand } = await import('../services/agencyBrand.js');
  const { resolveFromAddress } = await import('../services/emailService.js');
  const {
    buildReservationWhatsAppMessage,
    buildWaMeUrl,
    normalizeWhatsAppDial,
  } = await import('../services/whatsappNotify.js');
  const { resolveWhatsAppDials } = await import('../services/agencySettingsService.js');

  const tag = unique();
  const created = { users: [], agencies: [] };

  try {
    const password = await bcrypt.hash('BrandingTest123!', 10);
    const trial = createTrialDefaults();

    const mkAgency = async (letter, brand) => {
      const owner = await User.create({
        name: `Owner ${letter} ${tag}`,
        email: `br-${letter.toLowerCase()}-${tag}@e2e.test`,
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
        isPublicStorefront: false,
        logoUrl: brand.logoUrl,
        faviconUrl: brand.faviconUrl,
        phone: brand.phone,
        whatsapp: brand.whatsapp,
        email: brand.email,
        address: brand.address,
        city: brand.city,
        country: brand.country,
        primaryBrandColor: brand.primaryBrandColor,
        secondaryBrandColor: brand.secondaryBrandColor,
        socials: brand.socials,
        seo: brand.seo,
        hero: brand.hero,
        contractBranding: {
          companyName: brand.name,
          logoUrl: brand.logoUrl,
          showLogoOnPdf: true,
          footerNote: `${brand.name} contracts`,
        },
        onboardingCompletedAt: new Date(),
      });
      owner.agencyId = agency._id;
      await owner.save();
      created.agencies.push(agency._id);
      return { owner, agency };
    };

    const A = await mkAgency('A', {
      name: 'Atlas Drift Rentals',
      slug: 'atlas-drift',
      logoUrl: 'https://cdn.example.com/atlas-logo.png',
      faviconUrl: 'https://cdn.example.com/atlas-favicon.ico',
      phone: '+212611111111',
      whatsapp: '212611111111',
      email: 'hello@atlas-drift.test',
      address: '12 Rue Atlas',
      city: 'Agadir',
      country: 'MA',
      primaryBrandColor: '#0B6E4F',
      secondaryBrandColor: '#083D2F',
      socials: { instagram: 'https://instagram.com/atlas_drift_only' },
      seo: {
        title: 'Atlas Drift — Agadir car rental',
        description: 'Surf trips and airport pickups with Atlas Drift.',
        ogImageUrl: 'https://cdn.example.com/atlas-og.jpg',
      },
      hero: {
        headline: 'Drive the Atlantic',
        subheadline: 'Agadir-based fleet',
        badgeText: 'Atlas Drift',
      },
    });

    const B = await mkAgency('B', {
      name: 'Sahara Pulse Cars',
      slug: 'sahara-pulse',
      logoUrl: 'https://cdn.example.com/sahara-logo.png',
      faviconUrl: 'https://cdn.example.com/sahara-favicon.ico',
      phone: '+212622222222',
      whatsapp: '212622222222',
      email: 'book@sahara-pulse.test',
      address: '88 Avenue Medina',
      city: 'Marrakech',
      country: 'MA',
      primaryBrandColor: '#C45C26',
      secondaryBrandColor: '#8A3A12',
      socials: { instagram: 'https://instagram.com/sahara_pulse_only' },
      seo: {
        title: 'Sahara Pulse Cars — Marrakech',
        description: 'Desert-ready rentals with Sahara Pulse.',
        ogImageUrl: 'https://cdn.example.com/sahara-og.jpg',
      },
      hero: {
        headline: 'Pulse of the desert',
        subheadline: 'Marrakech departures',
        badgeText: 'Sahara Pulse',
      },
    });

    clearPublicTenantCache();

    const resA = await call(getPublicStorefront, {
      headers: { 'x-agency-slug': A.agency.slug },
      query: { agency: A.agency.slug },
    });
    const resB = await call(getPublicStorefront, {
      headers: { 'x-agency-slug': B.agency.slug },
      query: { agency: B.agency.slug },
    });

    assert.equal(resA.statusCode, 200);
    assert.equal(resB.statusCode, 200);
    const sfA = resA.body.storefront;
    const sfB = resB.body.storefront;

    assert.notEqual(sfA.name, sfB.name);
    assert.notEqual(sfA.logoUrl, sfB.logoUrl);
    assert.notEqual(sfA.primaryBrandColor, sfB.primaryBrandColor);
    assert.notEqual(sfA.whatsapp, sfB.whatsapp);
    assert.notEqual(sfA.email, sfB.email);
    assert.equal(sfA.name, 'Atlas Drift Rentals');
    assert.equal(sfB.name, 'Sahara Pulse Cars');
    assert.equal(sfA.seo.title, 'Atlas Drift — Agadir car rental');
    assert.equal(sfB.seo.title, 'Sahara Pulse Cars — Marrakech');
    assert.equal(sfA.faviconUrl, 'https://cdn.example.com/atlas-favicon.ico');
    assert.equal(sfB.socials.instagram, 'https://instagram.com/sahara_pulse_only');
    pass('storefront A ≠ storefront B (name/logo/colors/contact/WhatsApp/SEO)');

    for (const sf of [sfA, sfB]) {
      const blob = JSON.stringify(sf);
      if (LEAK_RE.test(blob)) fail(`storefront leak: ${sf.name}`);
    }
    pass('no HDN/Safi/Americonfort in storefront profiles');

    const brandA = await resolveAgencyBrand(A.agency);
    const brandB = await resolveAgencyBrand(B.agency);
    const bookingStub = {
      reservationId: 'RES-BRAND-1',
      customerName: 'Test Guest',
      customerEmail: 'guest@test.com',
      customerPhone: '+212600000000',
      pickupDate: new Date(),
      returnDate: new Date(Date.now() + 86400000),
      pickupLocation: 'Airport',
      returnLocation: 'Airport',
      price: 500,
      priceBreakdown: { rentalPrice: 500, total: 500, days: 1 },
      car: { brand: 'Dacia', model: 'Duster', year: 2024 },
      agencyId: A.agency._id,
    };

    const varsA = buildTemplateVariables(bookingStub, {
      contractNumber: 'CTR-A',
      owner: A.owner,
      agency: {
        name: brandA.contractBranding.companyName,
        email: brandA.email,
        phone: brandA.phone,
        address: brandA.address,
        primaryBrandColor: brandA.primaryBrandColor,
        logoUrl: brandA.logoUrl,
        contractBranding: brandA.contractBranding,
      },
      template: { name: 'Contract', headerHtml: '<h1>{{agency_name}}</h1>', bodyHtml: '<p>{{agency_phone}}</p>', footerHtml: '', logoUrl: brandA.logoUrl },
    });
    const varsB = buildTemplateVariables(
      { ...bookingStub, agencyId: B.agency._id },
      {
        contractNumber: 'CTR-B',
        owner: B.owner,
        agency: {
          name: brandB.contractBranding.companyName,
          email: brandB.email,
          phone: brandB.phone,
          address: brandB.address,
          primaryBrandColor: brandB.primaryBrandColor,
          logoUrl: brandB.logoUrl,
          contractBranding: brandB.contractBranding,
        },
        template: { name: 'Contract', headerHtml: '<h1>{{agency_name}}</h1>', bodyHtml: '<p>{{agency_phone}}</p>', footerHtml: '', logoUrl: brandB.logoUrl },
      },
    );

    assert.equal(varsA.agency_name, 'Atlas Drift Rentals');
    assert.equal(varsB.agency_name, 'Sahara Pulse Cars');
    assert.notEqual(varsA.agency_phone, varsB.agency_phone);
    assert.equal(varsA.agency_brand_color, '#0B6E4F');
    assert.equal(varsB.agency_brand_color, '#C45C26');
    pass('PDF/contract template variables use correct agency branding');

    const htmlA = buildDocumentHtml(
      { name: 'Contract', headerHtml: '<h1>{{agency_name}}</h1>', bodyHtml: '<p>{{agency_email}}</p>', footerHtml: '', logoUrl: brandA.logoUrl },
      varsA,
    );
    const htmlB = buildDocumentHtml(
      { name: 'Contract', headerHtml: '<h1>{{agency_name}}</h1>', bodyHtml: '<p>{{agency_email}}</p>', footerHtml: '', logoUrl: brandB.logoUrl },
      varsB,
    );
    assert.ok(htmlA.includes('Atlas Drift Rentals'));
    assert.ok(htmlB.includes('Sahara Pulse Cars'));
    assert.ok(htmlA.includes('#0B6E4F'));
    assert.ok(htmlB.includes('#C45C26'));
    assert.ok(!LEAK_RE.test(htmlA));
    assert.ok(!LEAK_RE.test(htmlB));
    pass('PDF HTML has agency colors/name and no platform leaks');

    const fromA = resolveFromAddress({ name: brandA.name, email: brandA.email });
    const fromB = resolveFromAddress({ name: brandB.name, email: brandB.email });
    assert.equal(fromA.name, 'Atlas Drift Rentals');
    assert.equal(fromB.name, 'Sahara Pulse Cars');
    assert.equal(fromA.replyTo, 'hello@atlas-drift.test');
    assert.equal(fromB.replyTo, 'book@sahara-pulse.test');
    pass('email From/replyTo use agency identity');

    const msgA = buildReservationWhatsAppMessage({
      reservationId: 'RES-1',
      agencyName: brandA.name,
    });
    const msgB = buildReservationWhatsAppMessage({
      reservationId: 'RES-2',
      agencyName: brandB.name,
    });
    assert.ok(msgA.includes('Atlas Drift Rentals'));
    assert.ok(msgB.includes('Sahara Pulse Cars'));
    assert.ok(!msgA.includes('HDN'));
    assert.ok(!msgB.includes('HDN'));

    const dialsA = await resolveWhatsAppDials(A.owner._id, A.agency._id);
    const dialsB = await resolveWhatsAppDials(B.owner._id, B.agency._id);
    assert.equal(normalizeWhatsAppDial(dialsA.reservationDial), '212611111111');
    assert.equal(normalizeWhatsAppDial(dialsB.reservationDial), '212622222222');
    const waA = buildWaMeUrl(msgA, dialsA.reservationDial);
    const waB = buildWaMeUrl(msgB, dialsB.reservationDial);
    assert.ok(waA.includes('212611111111'));
    assert.ok(waB.includes('212622222222'));
    assert.ok(!waA.includes('212665330116'));
    assert.ok(!waB.includes('212665330116'));
    pass('WhatsApp dials and copy are agency-specific');

    const emptyBrandVars = buildTemplateVariables(bookingStub, {
      contractNumber: 'CTR-X',
      owner: {},
      agency: {},
      template: {},
    });
    assert.equal(emptyBrandVars.agency_name, '—');
    assert.ok(!/HDN/i.test(emptyBrandVars.agency_name));
    pass('missing branding uses neutral fallback, not another agency');
  } catch (error) {
    fail(error.stack || error.message);
  } finally {
    try {
      await Agency.deleteMany({ _id: { $in: created.agencies } });
      await User.deleteMany({ _id: { $in: created.users } });
    } catch {
      /* ignore cleanup */
    }
    await db.stop();
  }
}

main();
