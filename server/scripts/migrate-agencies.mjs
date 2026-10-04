/**
 * Manual / CI entrypoint for the idempotent Agency migration.
 *   node scripts/migrate-agencies.mjs
 *   node scripts/migrate-agencies.mjs --dry-run
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { buildMongoUri } from '../configs/db.js';
import { runAgencyMigration } from '../services/agencyMigration.js';

const dryRun = process.argv.includes('--dry-run');

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}

await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
const summary = await runAgencyMigration({ dryRun });
console.log(JSON.stringify(summary, null, 2));
await mongoose.disconnect();
process.exit(0);
