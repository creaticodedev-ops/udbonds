import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

/** Shared agencyId field for business collections (canonical tenant key). */
export const agencyIdField = {
  type: ObjectId,
  ref: 'Agency',
  index: true,
  default: null,
};

/**
 * Strict read filter once migration has stamped agencyId.
 * @param {import('express').Request} req
 */
export const tenantFilter = (req) => {
  const agencyId = req.agencyId;
  if (!agencyId) {
    const err = new Error('Agency context missing');
    err.status = 500;
    err.code = 'AGENCY_CONTEXT_MISSING';
    throw err;
  }
  return { agencyId };
};

/**
 * Dual-read during migration: prefer agencyId, also match legacy owner rows
 * that have not been stamped yet (agencyId null/missing).
 */
export const tenantFilterCompat = (req) => {
  const agencyId = req.agencyId;
  const legacyOwnerId = req.agencyLegacyOwnerId || req.user?._id;
  if (!agencyId) {
    return { owner: legacyOwnerId };
  }
  return {
    $or: [
      { agencyId },
      {
        owner: legacyOwnerId,
        $or: [{ agencyId: null }, { agencyId: { $exists: false } }],
      },
    ],
  };
};

/**
 * Fields to stamp on every tenant-scoped create/update.
 * owner remains the legacy primary owner user id for upload paths + P0 compat.
 */
export const tenantWriteFields = (req) => {
  const agencyId = req.agencyId;
  const owner = req.agencyLegacyOwnerId || req.user?._id;
  if (!agencyId || !owner) {
    const err = new Error('Agency context missing for write');
    err.status = 500;
    err.code = 'AGENCY_CONTEXT_MISSING';
    throw err;
  }
  return { agencyId, owner };
};

/** Merge tenant write fields into a plain payload object. */
export const withTenant = (req, payload = {}) => ({
  ...payload,
  ...tenantWriteFields(req),
});

/**
 * Build a public-catalog filter for a resolved agency.
 * @param {{ agencyId: string|import('mongoose').Types.ObjectId, legacyOwnerId?: string|import('mongoose').Types.ObjectId, ownerOnlyFallback?: boolean }} agency
 */
export const publicAgencyFilter = (agency) => {
  if (!agency) return { _id: null };
  if (agency.ownerOnlyFallback && agency.legacyOwnerId) {
    return { owner: agency.legacyOwnerId };
  }
  if (!agency.agencyId) return { _id: null };
  return {
    $or: [
      { agencyId: agency.agencyId },
      {
        owner: agency.legacyOwnerId,
        $or: [{ agencyId: null }, { agencyId: { $exists: false } }],
      },
    ],
  };
};

/** Combine tenant scope with additional predicates (safe with $or compat filters). */
export const andTenant = (req, query = {}) => {
  const tf = tenantFilterCompat(req);
  const extraKeys = Object.keys(query || {});
  if (!extraKeys.length) return tf;
  if (tf.$or) return { $and: [tf, query] };
  return { ...tf, ...query };
};

export const idsEqual = (a, b) => {
  if (!a || !b) return false;
  return String(a) === String(b);
};

export default {
  agencyIdField,
  tenantFilter,
  tenantFilterCompat,
  tenantWriteFields,
  withTenant,
  publicAgencyFilter,
  andTenant,
  idsEqual,
};
