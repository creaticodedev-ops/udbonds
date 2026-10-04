/**
 * Seed / upsert the platform Super Admin.
 * Usage: npm run seed:superadmin
 * Env: SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { buildMongoUri } from '../configs/db.js';

const seed = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  const email = (process.env.SUPERADMIN_EMAIL || 'superadmin@americonfort.com').trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!';
  const name = process.env.SUPERADMIN_NAME || 'Super Admin';

  if (password.length < 8) {
    console.error('SUPERADMIN_PASSWORD must be at least 8 characters');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production' && password === 'SuperAdmin123!') {
    console.error('Refuse default SUPERADMIN_PASSWORD in production. Set a strong password.');
    process.exit(1);
  }

  await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));

  const existing = await User.findOne({ email });
  if (existing) {
    let changed = false;
    if (existing.role !== 'superadmin') {
      existing.role = 'superadmin';
      changed = true;
    }
    if (existing.accountStatus !== 'active') {
      existing.accountStatus = 'active';
      changed = true;
    }
    // Never leave license fields gating a superadmin
    if (changed) {
      await existing.save();
      console.log(`Updated Super Admin: ${email} (role=superadmin)`);
    } else {
      console.log(`Super Admin already exists: ${email}`);
    }
  } else {
    const hashed = await bcrypt.hash(password, 10);
    await User.create({
      name,
      email,
      password: hashed,
      role: 'superadmin',
      accountStatus: 'active',
      agencyName: 'HDN Car',
      licenseStatus: 'active',
      licensedAt: new Date(),
    });
    console.log(`Super Admin created: ${email}`);
    console.log('Change the default password after first login.');
  }

  console.log(`Login at: ${process.env.CLIENT_URL || 'http://localhost:5173'}/superadmin/login`);
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
