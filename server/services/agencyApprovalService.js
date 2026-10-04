import Agency from '../models/Agency.js';
import User from '../models/User.js';
import Car from '../models/Car.js';
import Booking from '../models/Booking.js';
import { logAudit } from '../utils/adminOps.js';
import { PLATFORM_SUPPORT_EMAIL } from '../utils/brand.js';
import { createTrialDefaults } from './licenseService.js';
import { getOrCreateAgencySettings } from './agencySettingsService.js';
import { ensureAgencySubscription } from './billingService.js';
import { ensureDefaultTemplates } from '../controllers/exportTemplateController.js';
import { ensureOwnerDefaultLocations } from '../controllers/pickupLocationController.js';
import { clearPublicTenantCache } from './publicTenant.js';
import { sendAgencyApprovedEmail, sendAgencyRejectedEmail } from './emailService.js';
import { buildWaMeUrl } from './whatsappNotify.js';
import { buildAgencyAccessUrls } from './agencyAccessUrls.js';
import { pushInbox, notifyDeliveryOutcome } from './platformInbox.js';

const fail = (status, message, code) => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
};

const emptyChannel = () => ({ status: 'idle', at: null, error: '', messageId: '', waMeUrl: '' });

const notificationsOf = (agency) => ({
  email: { ...emptyChannel(), ...(agency.notifications?.email?.toObject?.() || agency.notifications?.email || {}) },
  whatsapp: {
    ...emptyChannel(),
    ...(agency.notifications?.whatsapp?.toObject?.() || agency.notifications?.whatsapp || {}),
  },
});

export const notDeleted = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };

const audit = (superAdmin, agency, action, details, meta = {}) =>
  logAudit({
    owner: agency.primaryOwnerUserId || superAdmin._id,
    agencyId: agency._id,
    actor: superAdmin._id,
    action,
    entityType: 'Agency',
    entityId: agency._id,
    details,
    meta: { ...meta, via: 'superadmin' },
  });

const loadAgencyOrFail = async (id) => {
  const agency = await Agency.findById(id);
  if (!agency) throw fail(404, 'Agency not found', 'AGENCY_NOT_FOUND');
  if (agency.deletedAt) throw fail(404, 'Agency not found', 'AGENCY_DELETED');
  return agency;
};

const loadOwner = async (agency) => {
  if (!agency.primaryOwnerUserId) return null;
  return User.findById(agency.primaryOwnerUserId);
};

const buildWhatsAppBody = (agency, urls) => {
  const locale = String(agency.locale || '').toLowerCase();
  const french = locale.startsWith('fr');
  const name = agency.name || 'Agence';
  if (french) {
    return [
      `Bonjour ${name},`,
      '',
      'Votre espace agence RSZ CAR a été créé et approuvé avec succès.',
      '',
      'Vous pouvez maintenant accéder à votre dashboard:',
      urls.dashboardUrl,
      '',
      'Bienvenue sur RSZ CAR.',
    ].join('\n');
  }
  return [
    `Hello ${name},`,
    '',
    'Your RSZ CAR agency workspace has been created and approved.',
    '',
    'Access your dashboard:',
    urls.dashboardUrl,
    '',
    'Welcome to RSZ CAR.',
  ].join('\n');
};

export const deliverApprovalNotifications = async (agency, owner, { notifyReject = false } = {}) => {
  const urls = buildAgencyAccessUrls(agency);
  const to = String(owner?.email || agency.email || '').trim();
  const support = PLATFORM_SUPPORT_EMAIL;
  const next = notificationsOf(agency);

  try {
    const result = notifyReject
      ? await sendAgencyRejectedEmail({
          to,
          agencyName: agency.name,
          contactName: owner?.name,
          reason: agency.rejectionReason,
          supportEmail: support,
        })
      : await sendAgencyApprovedEmail({
          to,
          agencyName: agency.name,
          contactName: owner?.name,
          dashboardUrl: urls.dashboardUrl,
          supportEmail: support,
        });
    if (result?.success) {
      next.email = {
        status: 'sent',
        at: new Date(),
        error: '',
        messageId: result.messageId || '',
      };
    } else if (result?.skipped) {
      next.email = {
        status: 'not_configured',
        at: new Date(),
        error: result.reason || 'SMTP not configured',
        messageId: '',
      };
    } else {
      next.email = {
        status: 'failed',
        at: new Date(),
        error: result?.reason || 'Email send failed',
        messageId: result?.messageId || '',
      };
    }
  } catch (error) {
    next.email = {
      status: 'failed',
      at: new Date(),
      error: error.message || 'Email send failed',
      messageId: '',
    };
  }

  const dial = agency.whatsapp || agency.phone || '';
  const waUrl = buildWaMeUrl(buildWhatsAppBody(agency, urls), dial);
  if (!dial) {
    next.whatsapp = {
      status: 'not_configured',
      at: new Date(),
      error: 'No agency phone/WhatsApp number on file',
      waMeUrl: '',
    };
  } else if (!waUrl) {
    next.whatsapp = {
      status: 'not_configured',
      at: new Date(),
      error: 'WhatsApp API is not configured. RSZ CAR uses wa.me links only.',
      waMeUrl: '',
    };
  } else {
    next.whatsapp = {
      status: 'link_ready',
      at: new Date(),
      error: 'WhatsApp API is not configured. A wa.me message is ready for Super Admin to send.',
      waMeUrl: waUrl,
    };
  }

  agency.notifications = next;
  await agency.save();
  return { notifications: next, urls, whatsappUrl: next.whatsapp.waMeUrl || '' };
};

const activateWorkspace = async (agency, owner, superAdmin) => {
  const trial = createTrialDefaults();
  agency.status = 'active';
  agency.approvedAt = new Date();
  agency.approvedBy = superAdmin._id;
  agency.rejectedAt = null;
  agency.rejectedBy = null;
  agency.rejectionReason = '';
  if (!agency.onboardingCompletedAt) agency.onboardingCompletedAt = new Date();
  await agency.save();

  if (owner) {
    owner.accountStatus = 'active';
    if (!owner.passwordSetAt) owner.passwordSetAt = new Date();
    if (!owner.onboardingCompletedAt) owner.onboardingCompletedAt = new Date();
    if (!owner.trialEndsAt && owner.licenseStatus !== 'active') {
      Object.assign(owner, trial);
    }
    await owner.save();
  }

  try {
    await getOrCreateAgencySettings(owner?._id || agency.legacyOwnerId, agency._id);
  } catch (error) {
    console.error('[agencyApproval] settings', error.message);
  }
  try {
    await ensureAgencySubscription(agency._id, {
      planCode: 'free_trial',
      status: 'trialing',
      trialStartedAt: owner?.trialStartedAt || trial.trialStartedAt,
      trialEndsAt: owner?.trialEndsAt || trial.trialEndsAt,
      actorType: 'superadmin',
      actorId: superAdmin._id,
      notes: 'Started on Super Admin approval',
    });
  } catch (error) {
    console.error('[agencyApproval] billing', error.message);
  }
  if (owner?._id) {
    try {
      await ensureDefaultTemplates(owner._id);
      await ensureOwnerDefaultLocations(owner._id, agency._id);
    } catch (error) {
      console.error('[agencyApproval] seed', error.message);
    }
  }

  clearPublicTenantCache();
};

export const approveAgencyRequest = async (agencyId, superAdmin) => {
  const agency = await loadAgencyOrFail(agencyId);
  if (agency.status === 'active') {
    const owner = await loadOwner(agency);
    const urls = buildAgencyAccessUrls(agency);
    return {
      alreadyApproved: true,
      agency,
      owner,
      urls,
      notifications: notificationsOf(agency),
    };
  }
  if (agency.status !== 'pending') {
    throw fail(400, `Cannot approve an agency with status "${agency.status}"`, 'INVALID_STATUS');
  }

  const owner = await loadOwner(agency);
  if (!owner) throw fail(400, 'Primary owner is missing', 'OWNER_MISSING');
  if (!owner.passwordSetAt) {
    throw fail(
      400,
      'This owner has not set a password yet. Send the onboarding invite instead of approving.',
      'PASSWORD_NOT_SET',
    );
  }

  await activateWorkspace(agency, owner, superAdmin);
  await audit(superAdmin, agency, 'superadmin.agency.approve', `Approved agency ${agency.slug}`, {
    createdVia: agency.createdVia,
  });

  const notify = await deliverApprovalNotifications(agency, owner, { notifyReject: false });
  await pushInbox({
    category: 'agency',
    type: 'agency.approved',
    title: 'Agency approved',
    body: `${agency.name} is now active`,
    href: `/superadmin/agencies/${agency._id}`,
    agencyId: agency._id,
    agencyName: agency.name,
    severity: 'info',
  });
  await notifyDeliveryOutcome(agency, notify.notifications, { kind: 'approve' });
  return {
    alreadyApproved: false,
    agency,
    owner,
    urls: notify.urls,
    notifications: notify.notifications,
    whatsappUrl: notify.whatsappUrl,
  };
};

export const rejectAgencyRequest = async (agencyId, superAdmin, reason = '') => {
  const agency = await loadAgencyOrFail(agencyId);
  if (agency.status !== 'pending') {
    throw fail(400, `Cannot reject an agency with status "${agency.status}"`, 'INVALID_STATUS');
  }
  const owner = await loadOwner(agency);
  agency.status = 'rejected';
  agency.rejectedAt = new Date();
  agency.rejectedBy = superAdmin._id;
  agency.rejectionReason = String(reason || '').trim().slice(0, 500);
  await agency.save();

  if (owner) {
    owner.accountStatus = 'disabled';
    owner.tokenVersion = (owner.tokenVersion || 0) + 1;
    await owner.save();
  }

  clearPublicTenantCache();
  await audit(superAdmin, agency, 'superadmin.agency.reject', `Rejected agency ${agency.slug}`, {
    reason: agency.rejectionReason,
  });

  const notify = await deliverApprovalNotifications(agency, owner, { notifyReject: true });
  await pushInbox({
    category: 'agency',
    type: 'agency.rejected',
    title: 'Agency rejected',
    body: agency.rejectionReason
      ? `${agency.name} — ${agency.rejectionReason}`
      : `${agency.name} was not approved`,
    href: `/superadmin/requests`,
    agencyId: agency._id,
    agencyName: agency.name,
    severity: 'info',
  });
  await notifyDeliveryOutcome(agency, notify.notifications, { kind: 'reject' });
  return {
    agency,
    owner,
    urls: notify.urls,
    notifications: notify.notifications,
  };
};

export const softDeleteAgencyRequest = async (agencyId, superAdmin) => {
  const agency = await loadAgencyOrFail(agencyId);
  if (!['pending', 'rejected'].includes(agency.status)) {
    throw fail(
      400,
      'Only pending or rejected requests can be deleted from the approval center. Suspend or disable an active agency instead.',
      'DELETE_NOT_ALLOWED',
    );
  }

  const [cars, bookings] = await Promise.all([
    Car.countDocuments({ agencyId: agency._id }),
    Booking.countDocuments({ agencyId: agency._id }),
  ]);
  if (cars > 0 || bookings > 0) {
    throw fail(
      409,
      'This agency already has operational data and cannot be deleted from the request queue.',
      'HAS_OPERATIONAL_DATA',
    );
  }

  const owner = await loadOwner(agency);
  agency.deletedAt = new Date();
  if (agency.status === 'pending') agency.status = 'rejected';
  await agency.save();
  if (owner) {
    owner.accountStatus = 'disabled';
    owner.tokenVersion = (owner.tokenVersion || 0) + 1;
    await owner.save();
  }
  clearPublicTenantCache();
  await audit(superAdmin, agency, 'superadmin.agency.soft_delete', `Soft-deleted agency request ${agency.slug}`);
  await pushInbox({
    category: 'agency',
    type: 'agency.deleted',
    title: 'Agency request deleted',
    body: `${agency.name} was removed from the request queue`,
    href: '/superadmin/requests',
    agencyId: agency._id,
    agencyName: agency.name,
    severity: 'warn',
  });
  return { agency, owner };
};

export const retryAgencyNotifications = async (agencyId, superAdmin, { reject = false } = {}) => {
  const agency = await loadAgencyOrFail(agencyId);
  if (!['active', 'rejected'].includes(agency.status)) {
    throw fail(400, 'Notifications can be retried after approve or reject', 'INVALID_STATUS');
  }
  const owner = await loadOwner(agency);
  const notify = await deliverApprovalNotifications(agency, owner, {
    notifyReject: reject || agency.status === 'rejected',
  });
  await audit(superAdmin, agency, 'superadmin.agency.notify_retry', `Retried notifications for ${agency.slug}`);
  await notifyDeliveryOutcome(agency, notify.notifications, {
    kind: reject || agency.status === 'rejected' ? 'reject' : 'approve',
  });
  return { agency, owner, urls: notify.urls, notifications: notify.notifications, whatsappUrl: notify.whatsappUrl };
};

export default {
  approveAgencyRequest,
  rejectAgencyRequest,
  softDeleteAgencyRequest,
  retryAgencyNotifications,
  deliverApprovalNotifications,
  notDeleted,
};
