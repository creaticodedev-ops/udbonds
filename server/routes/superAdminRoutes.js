import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/superAdminAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  superAdminLogin,
  getSuperAdminProfile,
  getPlatformOverview,
  listAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  setAccountStatus,
  resetAdminPassword,
  setAdminPermissions,
  deleteAdmin,
  manageLicense,
  getPlatformAuditLogs,
  getPlatformActivity,
  listAgencies,
  getAgencyById,
  createAgency,
  updateAgency,
  setAgencyStatus,
  approveAgency,
  rejectAgency,
  deleteAgencyRequest,
  notifyAgency,
  resendAgencyInvite,
  verifyAgencyDomain,
} from '../controllers/superAdminController.js';
import {
  getControlSummary,
  getInbox,
  markInboxItemRead,
  markInboxAllRead,
  getNotificationDeliveryLog,
  searchPlatform,
  getHealth,
  getSettingsSnapshot,
} from '../controllers/superAdminControlController.js';
import {
  getSuperAdminAgencyBilling,
  assignSuperAdminAgencyPlan,
  extendSuperAdminAgencyTrial,
  suspendSuperAdminAgencyBilling,
  reactivateSuperAdminAgencyBilling,
  cancelSuperAdminAgencyBilling,
  expireSuperAdminAgencyBilling,
  getBillingOverview,
  listPublicPlans,
} from '../controllers/billingController.js';
import {
  getSuperAdminAgencyStaff,
  inviteSuperAdminAgencyStaff,
  updateSuperAdminAgencyStaff,
  removeSuperAdminAgencyStaff,
} from '../controllers/staffController.js';

const superAdminRouter = express.Router();

superAdminRouter.post(
  '/login',
  rateLimit({ windowMs: 60_000, max: 8, message: 'Too many login attempts' }),
  superAdminLogin
);

const gate = [protect, requireSuperAdmin];

superAdminRouter.get('/me', ...gate, getSuperAdminProfile);
superAdminRouter.get('/overview', ...gate, getPlatformOverview);
superAdminRouter.get('/summary', ...gate, getControlSummary);
superAdminRouter.get('/search', ...gate, searchPlatform);
superAdminRouter.get('/inbox', ...gate, getInbox);
superAdminRouter.patch('/inbox/read-all', ...gate, markInboxAllRead);
superAdminRouter.patch('/inbox/:id/read', ...gate, markInboxItemRead);
superAdminRouter.get('/notification-log', ...gate, getNotificationDeliveryLog);
superAdminRouter.get('/health', ...gate, getHealth);
superAdminRouter.get('/settings', ...gate, getSettingsSnapshot);

superAdminRouter.get('/agencies', ...gate, listAgencies);
superAdminRouter.post('/agencies', ...gate, createAgency);
superAdminRouter.get('/agencies/:id', ...gate, getAgencyById);
superAdminRouter.patch('/agencies/:id', ...gate, updateAgency);
superAdminRouter.patch('/agencies/:id/status', ...gate, setAgencyStatus);
superAdminRouter.post('/agencies/:id/approve', ...gate, approveAgency);
superAdminRouter.post('/agencies/:id/reject', ...gate, rejectAgency);
superAdminRouter.delete('/agencies/:id', ...gate, deleteAgencyRequest);
superAdminRouter.post('/agencies/:id/notify', ...gate, notifyAgency);
superAdminRouter.post('/agencies/:id/resend-invite', ...gate, resendAgencyInvite);
superAdminRouter.post('/agencies/:id/domains/verify', ...gate, verifyAgencyDomain);

superAdminRouter.get('/billing/overview', ...gate, getBillingOverview);
superAdminRouter.get('/billing/plans', ...gate, listPublicPlans);
superAdminRouter.get('/agencies/:id/billing', ...gate, getSuperAdminAgencyBilling);
superAdminRouter.post('/agencies/:id/billing/assign-plan', ...gate, assignSuperAdminAgencyPlan);
superAdminRouter.post('/agencies/:id/billing/extend-trial', ...gate, extendSuperAdminAgencyTrial);
superAdminRouter.post('/agencies/:id/billing/suspend', ...gate, suspendSuperAdminAgencyBilling);
superAdminRouter.post('/agencies/:id/billing/reactivate', ...gate, reactivateSuperAdminAgencyBilling);
superAdminRouter.post('/agencies/:id/billing/cancel', ...gate, cancelSuperAdminAgencyBilling);
superAdminRouter.post('/agencies/:id/billing/expire', ...gate, expireSuperAdminAgencyBilling);

superAdminRouter.get('/agencies/:id/staff', ...gate, getSuperAdminAgencyStaff);
superAdminRouter.post('/agencies/:id/staff', ...gate, inviteSuperAdminAgencyStaff);
superAdminRouter.patch('/agencies/:id/staff/:memberId', ...gate, updateSuperAdminAgencyStaff);
superAdminRouter.delete('/agencies/:id/staff/:memberId', ...gate, removeSuperAdminAgencyStaff);

superAdminRouter.get('/admins', ...gate, listAdmins);
superAdminRouter.post('/admins', ...gate, createAdmin);
superAdminRouter.get('/admins/:id', ...gate, getAdminById);
superAdminRouter.patch('/admins/:id', ...gate, updateAdmin);
superAdminRouter.patch('/admins/:id/status', ...gate, setAccountStatus);
superAdminRouter.post('/admins/:id/password', ...gate, resetAdminPassword);
superAdminRouter.patch('/admins/:id/permissions', ...gate, setAdminPermissions);
superAdminRouter.delete('/admins/:id', ...gate, deleteAdmin);
superAdminRouter.post('/admins/:id/license', ...gate, manageLicense);

superAdminRouter.get('/audit-logs', ...gate, getPlatformAuditLogs);
superAdminRouter.get('/activity', ...gate, getPlatformActivity);

export default superAdminRouter;
