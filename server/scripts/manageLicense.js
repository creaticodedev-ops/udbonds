/**
 * Manage the single-agency license / trial for the admin account.
 *
 * Usage:
 *   node scripts/manageLicense.js status
 *   node scripts/manageLicense.js activate
 *   node scripts/manageLicense.js trial [--days 7]
 *   node scripts/manageLicense.js extend [--days 7]
 *   node scripts/manageLicense.js expire
 *
 * Optional env: ADMIN_EMAIL (defaults to first owner or admin@americonfort.com)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { buildMongoUri } from '../configs/db.js';
import {
  createTrialDefaults,
  addDays,
  evaluateLicense,
  serializeLicense,
  TRIAL_DAYS,
  LICENSE_STATUS,
} from '../services/licenseService.js';

const usage = () => {
  console.log(`
HDN Car — License Manager (single agency)

  status              Show current license / trial
  activate            Grant permanent full access (licenseStatus=active)
  trial [--days N]    Start a fresh N-day trial from now (default ${TRIAL_DAYS})
  extend [--days N]   Extend trialEndsAt by N days from max(now, current end)
  expire              Force licenseStatus=expired (locks dashboard, keeps data)

Examples:
  node scripts/manageLicense.js activate
  node scripts/manageLicense.js extend --days 14
  node scripts/manageLicense.js trial --days 7
`);
};

const parseDays = (argv) => {
  const idx = argv.indexOf('--days');
  if (idx === -1) return TRIAL_DAYS;
  const n = Number(argv[idx + 1]);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('--days must be a positive number');
  }
  return Math.floor(n);
};

const printLicense = (user) => {
  const license = serializeLicense(user);
  const evaluation = evaluateLicense(user);
  console.log('─────────────────────────────────────');
  console.log(` Admin:     ${user.name} <${user.email}>`);
  console.log(` Status:    ${license.licenseStatus}`);
  console.log(` Allowed:   ${evaluation.allowed ? 'YES' : 'NO (dashboard locked)'}`);
  console.log(` Trial from:${license.trialStartedAt ? new Date(license.trialStartedAt).toISOString() : '—'}`);
  console.log(` Trial ends:${license.trialEndsAt ? new Date(license.trialEndsAt).toISOString() : '—'}`);
  console.log(` Days left: ${license.daysRemaining ?? '∞ (active)'}`);
  console.log(` Licensed:  ${license.licensedAt ? new Date(license.licensedAt).toISOString() : '—'}`);
  console.log('─────────────────────────────────────');
  console.log('Business data (cars, bookings, customers) is never deleted.');
};

const main = async () => {
  const [, , command, ...rest] = process.argv;
  if (!command || command === 'help' || command === '-h') {
    usage();
    process.exit(0);
  }

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));

  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const user = email
    ? await User.findOne({ email, role: 'owner' })
    : await User.findOne({ role: 'owner' }).sort({ createdAt: 1 });

  if (!user) {
    console.error('No owner/admin account found. Run: npm run seed:admin');
    await mongoose.disconnect();
    process.exit(1);
  }

  switch (command) {
    case 'status': {
      printLicense(user);
      break;
    }
    case 'activate': {
      user.licenseStatus = LICENSE_STATUS.ACTIVE;
      user.licensedAt = new Date();
      await user.save();
      console.log('✓ License activated — full permanent access.');
      printLicense(user);
      break;
    }
    case 'trial': {
      const days = parseDays(rest);
      const defaults = createTrialDefaults();
      defaults.trialEndsAt = addDays(defaults.trialStartedAt, days);
      Object.assign(user, defaults);
      user.licensedAt = null;
      await user.save();
      console.log(`✓ Fresh ${days}-day trial started.`);
      printLicense(user);
      break;
    }
    case 'extend': {
      const days = parseDays(rest);
      const now = new Date();
      const currentEnd = user.trialEndsAt && new Date(user.trialEndsAt) > now
        ? new Date(user.trialEndsAt)
        : now;
      user.trialEndsAt = addDays(currentEnd, days);
      user.licenseStatus = LICENSE_STATUS.TRIAL;
      if (!user.trialStartedAt) user.trialStartedAt = now;
      user.licensedAt = null;
      await user.save();
      console.log(`✓ Trial extended by ${days} day(s).`);
      printLicense(user);
      break;
    }
    case 'expire': {
      user.licenseStatus = LICENSE_STATUS.EXPIRED;
      if (!user.trialEndsAt || new Date(user.trialEndsAt) > new Date()) {
        user.trialEndsAt = new Date();
      }
      await user.save();
      console.log('✓ License marked expired — dashboard locked. Data preserved.');
      printLicense(user);
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      usage();
      await mongoose.disconnect();
      process.exit(1);
  }

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
