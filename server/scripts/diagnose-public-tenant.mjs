/**
 * Print public-tenant resolution hints for ops (local / staging).
 *
 *   npm run diagnose:public-tenant
 *
 * Reads server/.env (MONGODB_URI) — does not modify data.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { buildMongoUri } from '../configs/db.js';

const main = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in server/.env');
    process.exit(1);
  }

  await mongoose.connect(buildMongoUri(uri));
  const { default: Agency } = await import('../models/Agency.js');
  const { default: User } = await import('../models/User.js');

  const agencies = await Agency.find({})
    .select(
      'name slug status isPublicStorefront primaryOwnerUserId legacyOwnerId customDomain customDomainStatus createdAt',
    )
    .sort({ createdAt: 1 })
    .lean();

  const active = agencies.filter((a) => a.status === 'active');
  const flagged = active.filter((a) => a.isPublicStorefront);

  console.log('\n=== Public tenant diagnosis ===\n');
  console.log(`Total agencies: ${agencies.length} (active: ${active.length})`);
  console.log(`isPublicStorefront: ${flagged.length} active flagged`);
  console.log(`PUBLIC_AGENCY_ID env: ${process.env.PUBLIC_AGENCY_ID || '(not set)'}`);
  console.log(`PUBLIC_OWNER_ID env: ${process.env.PUBLIC_OWNER_ID || '(not set)'}`);
  console.log(`PLATFORM_BASE_DOMAIN env: ${process.env.PLATFORM_BASE_DOMAIN || '(not set)'}`);

  console.log('\n--- Agencies ---');
  for (const a of agencies) {
    const ownerId = a.primaryOwnerUserId || a.legacyOwnerId;
    const o = ownerId
      ? await User.findById(ownerId).select('email accountStatus agencyId').lean()
      : null;
    const ownerLinkOk = o && String(o.agencyId || '') === String(a._id);
    console.log(
      `- ${a.name} | slug=${a.slug} | status=${a.status}` +
        `${a.isPublicStorefront ? ' | PUBLIC' : ''}` +
        `${a.customDomain ? ` | domain=${a.customDomain} (${a.customDomainStatus})` : ''}`,
    );
    console.log(
      `    id=${a._id} owner=${ownerId || 'MISSING'} owner.agencyId link=${ownerLinkOk ? 'OK' : 'BROKEN'}` +
        `${o ? ` (${o.email}, ${o.accountStatus})` : ''}`,
    );
  }

  console.log('\n--- Recommended configuration (multi-agency kririder.com) ---');
  if (flagged.length === 1) {
    const pub = flagged[0];
    console.log(`Server (api.kririder.com): PUBLIC_AGENCY_ID=${pub._id}`);
    console.log(`Server: PLATFORM_BASE_DOMAIN=kririder.com`);
    console.log(`Client (Vercel build): VITE_PLATFORM_BASE_DOMAIN=kririder.com`);
    console.log(`Client (Vercel build): VITE_DEFAULT_STOREFRONT_SLUG=${pub.slug}`);
  } else if (active.length === 1) {
    const only = active[0];
    console.log('Single active agency — auto-resolution works without env vars.');
    console.log(`Optional client apex slug: VITE_DEFAULT_STOREFRONT_SLUG=${only.slug}`);
  } else if (active.length > 1) {
    console.log('Multiple active agencies — set exactly one as "Public storefront" in Super Admin,');
    console.log('or set PUBLIC_AGENCY_ID on the API server + VITE_DEFAULT_STOREFRONT_SLUG on the client build.');
    if (flagged.length > 1) {
      console.log('WARNING: more than one isPublicStorefront=true — migration should keep only one.');
    }
    if (flagged.length === 0 && active.length) {
      const pick = active[0];
      console.log(`Suggested primary (oldest active): slug=${pick.slug} id=${pick._id}`);
    }
  } else {
    console.log('No active agencies — activate an agency before the public catalog can load.');
  }

  console.log('');
  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
