/**
 * Single-agency license / trial helpers.
 * licenseStatus:
 *   - trial   → full access until trialEndsAt
 *   - active  → permanent full access (ignores trialEndsAt)
 *   - expired → admin dashboard locked; data untouched
 */

export const TRIAL_DAYS = Math.max(1, Number(process.env.TRIAL_DAYS) || 7);

export const LICENSE_STATUS = Object.freeze({
  TRIAL: 'trial',
  ACTIVE: 'active',
  EXPIRED: 'expired',
});

export const LICENSE_EXPIRED_CODE = 'LICENSE_EXPIRED';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const addDays = (from, days) => {
  const base = from instanceof Date ? new Date(from) : new Date(from || Date.now());
  base.setTime(base.getTime() + days * MS_PER_DAY);
  return base;
};

/** Defaults for a brand-new admin account */
export const createTrialDefaults = (from = new Date()) => {
  const trialStartedAt = new Date(from);
  return {
    licenseStatus: LICENSE_STATUS.TRIAL,
    trialStartedAt,
    trialEndsAt: addDays(trialStartedAt, TRIAL_DAYS),
    licensedAt: null,
  };
};

/**
 * Evaluate access without mutating.
 * Returns { allowed, status, trialEndsAt, daysRemaining, reason }
 */
export const evaluateLicense = (user) => {
  if (!user || user.role !== 'owner') {
    return { allowed: false, status: null, reason: 'not_owner' };
  }

  const status = user.licenseStatus || LICENSE_STATUS.TRIAL;
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const now = new Date();

  if (status === LICENSE_STATUS.ACTIVE) {
    return {
      allowed: true,
      status: LICENSE_STATUS.ACTIVE,
      trialEndsAt,
      daysRemaining: null,
      reason: null,
    };
  }

  if (status === LICENSE_STATUS.EXPIRED) {
    return {
      allowed: false,
      status: LICENSE_STATUS.EXPIRED,
      trialEndsAt,
      daysRemaining: 0,
      reason: 'expired',
    };
  }

  // trial (or legacy accounts without status)
  if (trialEndsAt && now > trialEndsAt) {
    return {
      allowed: false,
      status: LICENSE_STATUS.EXPIRED,
      trialEndsAt,
      daysRemaining: 0,
      reason: 'trial_ended',
    };
  }

  const daysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / MS_PER_DAY))
    : TRIAL_DAYS;

  return {
    allowed: true,
    status: LICENSE_STATUS.TRIAL,
    trialEndsAt,
    daysRemaining,
    reason: null,
  };
};

/**
 * Persist auto-expiry when trial date has passed.
 * Does not delete or alter business data — only licenseStatus.
 */
export const syncLicenseStatus = async (user) => {
  if (!user || user.role !== 'owner') return user;

  // Backfill missing trial fields for legacy owners (one-time)
  if (!user.trialEndsAt && user.licenseStatus !== LICENSE_STATUS.ACTIVE) {
    const defaults = createTrialDefaults(user.createdAt || new Date());
    user.licenseStatus = user.licenseStatus || defaults.licenseStatus;
    user.trialStartedAt = user.trialStartedAt || defaults.trialStartedAt;
    user.trialEndsAt = defaults.trialEndsAt;
    await user.save();
  }

  const evaluation = evaluateLicense(user);
  if (
    evaluation.status === LICENSE_STATUS.EXPIRED &&
    user.licenseStatus !== LICENSE_STATUS.EXPIRED
  ) {
    user.licenseStatus = LICENSE_STATUS.EXPIRED;
    await user.save();
  }

  return user;
};

/** Safe payload for API / client (no secrets) */
export const serializeLicense = (user) => {
  const evaluation = evaluateLicense(user);
  return {
    licenseStatus: evaluation.status || user.licenseStatus || LICENSE_STATUS.TRIAL,
    trialStartedAt: user.trialStartedAt || null,
    trialEndsAt: evaluation.trialEndsAt || user.trialEndsAt || null,
    licensedAt: user.licensedAt || null,
    daysRemaining: evaluation.daysRemaining,
    allowed: evaluation.allowed,
  };
};

/** Apply permanent full license */
export const activateLicense = async (user) => {
  user.licenseStatus = LICENSE_STATUS.ACTIVE;
  user.licensedAt = new Date();
  await user.save();
  return user;
};

/** Start a fresh N-day trial from now */
export const startTrial = async (user, days = TRIAL_DAYS) => {
  const defaults = createTrialDefaults();
  defaults.trialEndsAt = addDays(defaults.trialStartedAt, days);
  Object.assign(user, defaults);
  user.licensedAt = null;
  await user.save();
  return user;
};

/** Extend trial from max(now, current end) by N days */
export const extendTrial = async (user, days = TRIAL_DAYS) => {
  const now = new Date();
  const currentEnd =
    user.trialEndsAt && new Date(user.trialEndsAt) > now
      ? new Date(user.trialEndsAt)
      : now;
  user.trialEndsAt = addDays(currentEnd, days);
  user.licenseStatus = LICENSE_STATUS.TRIAL;
  if (!user.trialStartedAt) user.trialStartedAt = now;
  user.licensedAt = null;
  await user.save();
  return user;
};

/** Force expired (dashboard lock, data preserved) */
export const expireLicense = async (user) => {
  user.licenseStatus = LICENSE_STATUS.EXPIRED;
  if (!user.trialEndsAt || new Date(user.trialEndsAt) > new Date()) {
    user.trialEndsAt = new Date();
  }
  await user.save();
  return user;
};
