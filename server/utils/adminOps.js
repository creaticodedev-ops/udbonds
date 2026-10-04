import AuditLog from '../models/AuditLog.js';
import AdminNotification from '../models/AdminNotification.js';
import Agency from '../models/Agency.js';

const resolveAgencyId = async (ownerId, explicitAgencyId = null) => {
  if (explicitAgencyId) return explicitAgencyId;
  if (!ownerId) return null;
  const agency = await Agency.findOne({ legacyOwnerId: ownerId }).select('_id').lean();
  return agency?._id || null;
};

export const logAudit = async ({
  owner,
  agencyId = null,
  actor,
  action,
  entityType = '',
  entityId = '',
  details = '',
  meta = {},
}) => {
  try {
    const resolvedAgencyId = await resolveAgencyId(owner, agencyId);
    await AuditLog.create({
      agencyId: resolvedAgencyId,
      owner,
      actor: actor || owner,
      action,
      entityType,
      entityId: entityId?.toString?.() || String(entityId || ''),
      details,
      meta,
    });
  } catch (error) {
    console.error('Audit log failed:', error.message);
  }
};

export const createNotification = async ({
  owner,
  agencyId = null,
  type = 'system',
  title,
  message = '',
  link = '/owner',
  meta = {},
}) => {
  try {
    const resolvedAgencyId = await resolveAgencyId(owner, agencyId);
    await AdminNotification.create({
      agencyId: resolvedAgencyId,
      owner,
      type,
      title,
      message,
      link,
      meta,
    });
  } catch (error) {
    console.error('Notification create failed:', error.message);
  }
};
