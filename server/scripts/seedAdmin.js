/**
 * Create an initial admin user with a 7-day trial.
 * Usage: node scripts/seedAdmin.js
 * Requires MONGODB_URI, and optionally ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, TRIAL_DAYS in env.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { createTrialDefaults, TRIAL_DAYS } from '../services/licenseService.js';
import { BRAND_NAME } from '../utils/brand.js';
import { buildMongoUri } from '../configs/db.js';

const seed = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  const email = (process.env.ADMIN_EMAIL || 'admin@americonfort.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';
  const name = process.env.ADMIN_NAME || 'Admin';

  if (process.env.NODE_ENV === 'production' && password === 'Admin123!') {
    console.error('Refuse default ADMIN_PASSWORD in production. Set a strong password.');
    process.exit(1);
  }

  await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === 'superadmin') {
      console.error(`Refusing to overwrite Super Admin account: ${email}`);
      console.error('Use a different ADMIN_EMAIL for the agency admin.');
      await mongoose.disconnect();
      process.exit(1);
    }
    let changed = false;
    if (existing.role !== 'owner') {
      existing.role = 'owner';
      changed = true;
    }
    if (!existing.accountStatus) {
      existing.accountStatus = 'active';
      changed = true;
    }
    if (!existing.trialEndsAt && existing.licenseStatus !== 'active') {
      Object.assign(existing, createTrialDefaults(existing.createdAt || new Date()));
      changed = true;
      console.log(`Initialized ${TRIAL_DAYS}-day trial for existing admin ${email}`);
      console.log(`  trialEndsAt: ${existing.trialEndsAt.toISOString()}`);
    }
    if (changed) {
      await existing.save();
      console.log(`Updated admin user: ${email}`);
    } else {
      console.log(`Admin user already exists: ${email}`);
      console.log(`  licenseStatus: ${existing.licenseStatus}`);
      console.log(`  trialEndsAt: ${existing.trialEndsAt || 'n/a'}`);
    }
  } else {
    const hashed = await bcrypt.hash(password, 10);
    const trial = createTrialDefaults();
    await User.create({
      name,
      email,
      password: hashed,
      role: 'owner',
      accountStatus: 'active',
      agencyName: BRAND_NAME,
      ...trial,
    });
    console.log(`Admin user created: ${email}`);
    console.log(`  ${TRIAL_DAYS}-day trial until ${trial.trialEndsAt.toISOString()}`);
    console.log('Change the default password after first login.');
  }

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
