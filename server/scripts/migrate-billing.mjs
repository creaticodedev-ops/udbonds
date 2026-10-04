/**
 * Idempotent P4 billing migration: seed plans + AgencySubscription per Agency.
 *
 *   npm run migrate:billing
 *   npm run migrate:billing:dry   ← read-only: never writes
 *
 * Dry-run prints a full preflight report (grandfathered, conflicts, expired, exact ops).
 */
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';

// Windows/Node sometimes refuses local recursive DNS for mongodb+srv SRV lookups.
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  /* ignore */
}
import { buildMongoUri } from '../configs/db.js';
import Agency from '../models/Agency.js';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import AgencySubscription from '../models/AgencySubscription.js';
import { ensureDefaultPlans, DEFAULT_PLANS } from '../services/planCatalog.js';
import {
  migrateAgencyBillingFromOwner,
  mapSubscriptionToUserLicense,
} from '../services/billingService.js';
import {
  LICENSE_STATUS,
  createTrialDefaults,
  TRIAL_DAYS,
} from '../services/licenseService.js';

const dryRun = process.argv.includes('--dry-run');

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required (production configuration)');
  process.exit(1);
}

/** Redact credentials from URI for report display */
const redactUri = (uri) => {
  try {
    const u = new URL(uri.replace(/^mongodb(\+srv)?:/, 'http$1:'));
    if (u.password) u.password = '***';
    if (u.username) u.username = u.username.slice(0, 2) + '***';
    return u.toString().replace(/^http(\+srv)?:/, 'mongodb$1:');
  } catch {
    return '[unparseable MONGODB_URI]';
  }
};

/**
 * Pure preview of what migrateAgencyBillingFromOwner would create (no writes).
 */
const previewMigrationForAgency = (agency, owner, existingSub) => {
  if (existingSub) {
    return {
      action: 'skip_existing',
      reason: 'AgencySubscription already exists (isCurrent=true)',
      existing: {
        planCode: existingSub.planCode,
        status: existingSub.status,
        provider: existingSub.provider,
        trialEndsAt: existingSub.trialEndsAt,
        _id: String(existingSub._id),
      },
    };
  }

  const defaults = createTrialDefaults(owner?.createdAt || agency.createdAt || new Date());
  let planCode = 'free_trial';
  let status = 'trialing';
  let trialStartedAt = owner?.trialStartedAt || defaults.trialStartedAt;
  let trialEndsAt = owner?.trialEndsAt || defaults.trialEndsAt;
  let mappingReason = 'default_trial';

  if (!owner) {
    mappingReason = 'no_owner_found_defaults_to_trial';
  } else if (owner.licenseStatus === LICENSE_STATUS.ACTIVE) {
    planCode = 'legacy_grandfathered';
    status = 'active';
    mappingReason = 'owner_licenseStatus=active → legacy_grandfathered';
  } else if (owner.licenseStatus === LICENSE_STATUS.EXPIRED) {
    planCode = 'free_trial';
    status = 'expired';
    mappingReason = 'owner_licenseStatus=expired → free_trial/expired';
  } else if (trialEndsAt && new Date(trialEndsAt) < new Date()) {
    status = 'expired';
    mappingReason = 'trialEndsAt in the past → free_trial/expired';
  } else if (owner.licenseStatus === LICENSE_STATUS.TRIAL || !owner.licenseStatus) {
    mappingReason = 'owner_licenseStatus=trial (or missing) → free_trial/trialing';
  }

  const plannedSub = {
    agencyId: String(agency._id),
    planCode,
    status,
    provider: 'manual',
    trialStartedAt,
    trialEndsAt,
    currentPeriodStart: status === 'active' ? '[now at migrate time]' : null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    isCurrent: true,
    notes: 'P4 migration from User.licenseStatus',
  };

  const licenseSync = mapSubscriptionToUserLicense(plannedSub);

  return {
    action: 'create_subscription',
    mappingReason,
    plannedSubscription: plannedSub,
    plannedUserLicenseSync: owner
      ? {
          userId: String(owner._id),
          email: owner.email,
          from: {
            licenseStatus: owner.licenseStatus,
            trialStartedAt: owner.trialStartedAt,
            trialEndsAt: owner.trialEndsAt,
            licensedAt: owner.licensedAt,
          },
          to: licenseSync,
        }
      : null,
  };
};

const detectConflicts = (agency, owner, existingSub, preview) => {
  const conflicts = [];
  if (!owner) {
    conflicts.push({
      type: 'missing_owner',
      detail: `Agency ${agency.slug} has no resolvable primaryOwnerUserId/legacyOwnerId user`,
    });
  }
  if (existingSub && owner) {
    if (
      owner.licenseStatus === LICENSE_STATUS.ACTIVE &&
      existingSub.planCode !== 'legacy_grandfathered' &&
      existingSub.status !== 'active'
    ) {
      conflicts.push({
        type: 'license_vs_subscription_mismatch',
        detail: `Owner license=active but existing sub plan=${existingSub.planCode} status=${existingSub.status}`,
      });
    }
    if (
      owner.licenseStatus === LICENSE_STATUS.EXPIRED &&
      ['trialing', 'active', 'past_due'].includes(existingSub.status)
    ) {
      conflicts.push({
        type: 'expired_license_active_subscription',
        detail: `Owner license=expired but subscription status=${existingSub.status}`,
      });
    }
    if (
      owner.licenseStatus === LICENSE_STATUS.TRIAL &&
      existingSub.status === 'expired'
    ) {
      conflicts.push({
        type: 'trial_license_expired_subscription',
        detail: `Owner license=trial but subscription already expired`,
      });
    }
  }
  if (agency.status === 'suspended' || agency.status === 'disabled') {
    conflicts.push({
      type: 'agency_ops_locked',
      detail: `Agency.status=${agency.status} (ops lock; billing migration still applies)`,
    });
  }
  if (preview.action === 'create_subscription' && preview.plannedSubscription.status === 'expired') {
    conflicts.push({
      type: 'will_be_expired',
      detail: 'Migration would create an expired subscription (owner read-only until reactivated)',
    });
  }
  return conflicts;
};

await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));

const dbName = mongoose.connection.name;
const hostHint = redactUri(process.env.MONGODB_URI);

const report = {
  mode: dryRun ? 'DRY_RUN_READ_ONLY' : 'LIVE_MIGRATE',
  generatedAt: new Date().toISOString(),
  database: { name: dbName, uriRedacted: hostHint },
  trialDaysDefault: TRIAL_DAYS,
  totals: {
    agenciesScanned: 0,
    agenciesAffected: 0,
    subscriptionsToCreate: 0,
    subscriptionsAlreadyPresent: 0,
    plansToUpsert: 0,
    plansAlreadyPresent: 0,
    grandfatheredCount: 0,
    willBeExpiredCount: 0,
    willBeTrialingCount: 0,
    willBeActiveNonLegacyCount: 0,
    missingOwnerCount: 0,
    conflictCount: 0,
  },
  planCatalogOps: [],
  grandfathered: [],
  willBeExpired: [],
  willBeTrialing: [],
  willBeActive: [],
  skippedExisting: [],
  missingOwner: [],
  conflicts: [],
  exactDatabaseChanges: [],
  perAgency: [],
  errors: [],
};

try {
  // Plan catalog preview / apply
  for (const plan of DEFAULT_PLANS) {
    const existing = await Plan.findOne({ code: plan.code }).lean();
    if (existing) {
      report.totals.plansAlreadyPresent += 1;
      report.planCatalogOps.push({
        op: dryRun ? 'would_upsert_plan' : 'upsert_plan',
        code: plan.code,
        existed: true,
        note: 'Idempotent $set of catalog fields',
      });
    } else {
      report.totals.plansToUpsert += 1;
      report.planCatalogOps.push({
        op: dryRun ? 'would_insert_plan' : 'insert_plan',
        code: plan.code,
        existed: false,
        name: plan.name,
      });
    }
    if (!dryRun) {
      // ensureDefaultPlans does all; defer to single call below
    }
  }

  if (!dryRun) {
    await ensureDefaultPlans();
  } else {
    report.exactDatabaseChanges.push({
      collection: 'plans',
      operation: 'findOneAndUpdate upsert × N',
      count: DEFAULT_PLANS.length,
      codes: DEFAULT_PLANS.map((p) => p.code),
      note: 'DRY RUN — not executed. Real migrate would upsert all DEFAULT_PLANS.',
    });
  }

  const agencies = await Agency.find({}).sort({ createdAt: 1 }).lean();
  report.totals.agenciesScanned = agencies.length;

  for (const agency of agencies) {
    try {
      const ownerId = agency.primaryOwnerUserId || agency.legacyOwnerId;
      const owner = ownerId
        ? await User.findById(ownerId)
            .select(
              'name email role licenseStatus trialStartedAt trialEndsAt licensedAt createdAt agencyId accountStatus',
            )
            .lean()
        : null;

      const existingSub = await AgencySubscription.findOne({
        agencyId: agency._id,
        isCurrent: true,
      }).lean();

      const preview = previewMigrationForAgency(agency, owner, existingSub);
      const agencyConflicts = detectConflicts(agency, owner, existingSub, preview);

      const row = {
        agencyId: String(agency._id),
        slug: agency.slug,
        name: agency.name,
        agencyStatus: agency.status,
        owner: owner
          ? {
              userId: String(owner._id),
              email: owner.email,
              name: owner.name,
              licenseStatus: owner.licenseStatus,
              trialEndsAt: owner.trialEndsAt,
              accountStatus: owner.accountStatus,
            }
          : null,
        preview,
        conflicts: agencyConflicts,
      };
      report.perAgency.push(row);

      if (agencyConflicts.length) {
        report.totals.conflictCount += agencyConflicts.length;
        report.conflicts.push({
          agencyId: row.agencyId,
          slug: row.slug,
          conflicts: agencyConflicts,
        });
      }

      if (!owner) {
        report.totals.missingOwnerCount += 1;
        report.missingOwner.push({
          agencyId: row.agencyId,
          slug: row.slug,
          name: row.name,
        });
      }

      if (preview.action === 'skip_existing') {
        report.totals.subscriptionsAlreadyPresent += 1;
        report.skippedExisting.push({
          agencyId: row.agencyId,
          slug: row.slug,
          existing: preview.existing,
          ownerLicense: owner?.licenseStatus || null,
        });
      } else {
        report.totals.subscriptionsToCreate += 1;
        report.totals.agenciesAffected += 1;

        const planned = preview.plannedSubscription;
        if (planned.planCode === 'legacy_grandfathered') {
          report.totals.grandfatheredCount += 1;
          report.grandfathered.push({
            agencyId: row.agencyId,
            slug: row.slug,
            name: row.name,
            userId: owner ? String(owner._id) : null,
            email: owner?.email || null,
            ownerLicenseStatus: owner?.licenseStatus,
            resultingStatus: planned.status,
          });
        }

        if (planned.status === 'expired') {
          report.totals.willBeExpiredCount += 1;
          report.willBeExpired.push({
            agencyId: row.agencyId,
            slug: row.slug,
            name: row.name,
            email: owner?.email || null,
            ownerLicenseStatus: owner?.licenseStatus,
            trialEndsAt: planned.trialEndsAt,
            mappingReason: preview.mappingReason,
          });
        } else if (planned.status === 'trialing') {
          report.totals.willBeTrialingCount += 1;
          report.willBeTrialing.push({
            agencyId: row.agencyId,
            slug: row.slug,
            email: owner?.email || null,
            trialEndsAt: planned.trialEndsAt,
          });
        } else if (planned.status === 'active') {
          report.totals.willBeActiveNonLegacyCount += 1;
          report.willBeActive.push({
            agencyId: row.agencyId,
            slug: row.slug,
            planCode: planned.planCode,
            email: owner?.email || null,
          });
        }

        report.exactDatabaseChanges.push({
          collection: 'agencysubscriptions',
          operation: 'insertOne',
          agencyId: row.agencyId,
          slug: row.slug,
          document: planned,
        });

        if (preview.plannedUserLicenseSync) {
          report.exactDatabaseChanges.push({
            collection: 'users',
            operation: 'updateOne',
            filter: {
              _id: preview.plannedUserLicenseSync.userId,
              role: 'owner',
            },
            $set: preview.plannedUserLicenseSync.to,
            note: 'Dual-write license sync from new AgencySubscription',
          });
        }

        if (!dryRun) {
          await migrateAgencyBillingFromOwner(agency);
        }
      }
    } catch (err) {
      report.errors.push({
        agencyId: String(agency._id),
        slug: agency.slug,
        message: err.message,
      });
    }
  }

  // Agencies with zero valid write-capable outcome
  report.atRisk = {
    expiredAfterMigrate: report.willBeExpired,
    missingOwner: report.missingOwner,
    note:
      'No agency is left without a subscription document after migrate (creates free_trial if needed). ' +
      '"Suspended" billing status is NOT produced by this migration — only Agency.status ops lock or later Super Admin actions.',
    agenciesWithOpsSuspendedOrDisabled: report.perAgency
      .filter((a) => a.agencyStatus === 'suspended' || a.agencyStatus === 'disabled')
      .map((a) => ({ agencyId: a.agencyId, slug: a.slug, agencyStatus: a.agencyStatus })),
  };
} finally {
  // Print human summary first, then full JSON
  console.log('\n========== P4 BILLING MIGRATION REPORT ==========');
  console.log(`Mode: ${report.mode}`);
  console.log(`DB: ${report.database.name}`);
  console.log(`URI: ${report.database.uriRedacted}`);
  console.log(`Generated: ${report.generatedAt}`);
  console.log('-------------------------------------------------');
  console.log(`Agencies scanned:              ${report.totals.agenciesScanned}`);
  console.log(`Agencies affected (new subs):  ${report.totals.agenciesAffected}`);
  console.log(`Subscriptions to create:       ${report.totals.subscriptionsToCreate}`);
  console.log(`Already have subscription:     ${report.totals.subscriptionsAlreadyPresent}`);
  console.log(`Plans missing (would insert):  ${report.totals.plansToUpsert}`);
  console.log(`Plans already present:         ${report.totals.plansAlreadyPresent}`);
  console.log(`→ legacy_grandfathered:        ${report.totals.grandfatheredCount}`);
  console.log(`→ will be trialing:            ${report.totals.willBeTrialingCount}`);
  console.log(`→ will be active (non-legacy): ${report.totals.willBeActiveNonLegacyCount}`);
  console.log(`→ will be expired:             ${report.totals.willBeExpiredCount}`);
  console.log(`Missing owner:                 ${report.totals.missingOwnerCount}`);
  console.log(`Conflict flags:                ${report.totals.conflictCount}`);
  console.log(`Errors:                        ${report.errors.length}`);
  console.log('=================================================\n');

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

process.exit(report.errors.length ? 1 : 0);
