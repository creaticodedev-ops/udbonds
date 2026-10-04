import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User, { OWNER_PERMISSIONS } from '../models/User.js';
import Car from '../models/Car.js';
import Booking from '../models/Booking.js';
import AuditLog from '../models/AuditLog.js';
import GuestCustomer from '../models/GuestCustomer.js';
import { logAudit } from '../utils/adminOps.js';
import {
  createTrialDefaults,
  serializeLicense,
  syncLicenseStatus,
  activateLicense,
  startTrial,
  extendTrial,
  expireLicense,
  TRIAL_DAYS,
} from '../services/licenseService.js';
import { escapeRegex } from '../utils/helpers.js';
import { normalizeEmail, findUserByEmail } from '../utils/emailUtils.js';
import { clearPublicTenantCache } from '../services/publicTenant.js';
import Agency from '../models/Agency.js';
import { ensureAgencyForOwner } from '../services/agencyMigration.js';
import {
  generateInviteToken,
  buildOnboardingUrl,
} from '../services/agencyInviteToken.js';
import { getOrCreateAgencySettings, updateWhatsAppSettings } from '../services/agencySettingsService.js';
import { buildAgencyAccessUrls } from '../services/agencyAccessUrls.js';
import {
  approveAgencyRequest,
  rejectAgencyRequest,
  retryAgencyNotifications,
  softDeleteAgencyRequest,
  notDeleted,
} from '../services/agencyApprovalService.js';

const AGENCY_STATUSES = ['pending', 'active', 'suspended', 'disabled', 'rejected'];
const OWNER_ACCOUNT_STATUSES = ['pending', 'active', 'suspended', 'disabled'];

const mapAgencyStatusToOwnerStatus = (status) => {
  if (status === 'pending') return 'pending';
  if (status === 'active') return 'active';
  if (status === 'suspended') return 'suspended';
  if (status === 'disabled') return 'disabled';
  if (status === 'rejected') return 'disabled';
};

const inviteMetaForOwner = (owner) => {
  if (!owner) return { invitePending: false, inviteExpiresAt: null };
  const invitePending =
    owner.accountStatus === 'pending' &&
    Boolean(owner.inviteTokenHash) &&
    !owner.inviteUsedAt &&
    owner.inviteExpiresAt &&
    new Date(owner.inviteExpiresAt).getTime() > Date.now();
  return {
    invitePending,
    inviteExpiresAt: owner.inviteExpiresAt || null,
    passwordSetAt: owner.passwordSetAt || null,
    onboardingCompletedAt: owner.onboardingCompletedAt || null,
  };
};

const generateToken = (user) =>
  jwt.sign(
    { _id: user._id.toString(), tv: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

const sanitizeAdmin = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.inviteTokenHash;
  return {
    ...obj,
    license: serializeLicense(user),
    permissions: Array.isArray(obj.permissions) ? obj.permissions : [],
  };
};

const findOwnerOrFail = async (id) => {
  if (!mongoose.isValidObjectId(id)) return null;
  return User.findOne({ _id: id, role: 'owner' });
};

const audit = (superAdmin, target, action, details, meta = {}) =>
  logAudit({
    owner: target?._id || superAdmin._id,
    actor: superAdmin._id,
    action,
    entityType: 'User',
    entityId: target?._id,
    details,
    meta: { ...meta, via: 'superadmin' },
  });

// ─── Auth ───────────────────────────────────────────────

export const superAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await findUserByEmail(User, normalizedEmail);
    if (!user || user.role !== 'superadmin') {
      return res.status(401).json({ success: false, message: 'Invalid Super Admin credentials' });
    }

    if (user.accountStatus && user.accountStatus !== 'active') {
      return res.status(403).json({ success: false, message: 'This Super Admin account is locked' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid Super Admin credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);
    res.json({
      success: true,
      token,
      user: sanitizeAdmin(user),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

export const getSuperAdminProfile = async (req, res) => {
  try {
    res.json({ success: true, user: sanitizeAdmin(req.user) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
};

// ─── Dashboard overview ─────────────────────────────────

export const getPlatformOverview = async (req, res) => {
  try {
    const [
      totalAdmins,
      activeAdmins,
      suspendedAdmins,
      trialAdmins,
      licensedAdmins,
      expiredAdmins,
      totalCars,
      totalBookings,
      totalCustomers,
      totalAgencies,
      activeAgencies,
      pendingAgencies,
      rejectedAgencies,
      suspendedAgencies,
    ] = await Promise.all([
      User.countDocuments({ role: 'owner' }),
      User.countDocuments({ role: 'owner', accountStatus: 'active' }),
      User.countDocuments({ role: 'owner', accountStatus: { $in: ['suspended', 'disabled'] } }),
      User.countDocuments({ role: 'owner', licenseStatus: 'trial' }),
      User.countDocuments({ role: 'owner', licenseStatus: 'active' }),
      User.countDocuments({ role: 'owner', licenseStatus: 'expired' }),
      Car.countDocuments({ owner: { $ne: null } }),
      Booking.countDocuments({}),
      GuestCustomer.countDocuments({}),
      Agency.countDocuments(notDeleted),
      Agency.countDocuments({ ...notDeleted, status: 'active' }),
      Agency.countDocuments({ ...notDeleted, status: 'pending' }),
      Agency.countDocuments({ ...notDeleted, status: 'rejected' }),
      Agency.countDocuments({ ...notDeleted, status: 'suspended' }),
    ]);

    const agencyPreview = (docs) =>
      docs.map((a) => ({
        _id: a._id,
        name: a.name,
        slug: a.slug,
        email: a.email,
        status: a.status,
        createdAt: a.createdAt,
        approvedAt: a.approvedAt || null,
      }));

    const [recentPending, recentApproved, recentSuspended, recentAdmins] = await Promise.all([
      Agency.find({ ...notDeleted, status: 'pending' })
        .select('name slug email status createdAt')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      Agency.find({ ...notDeleted, status: 'active', approvedAt: { $ne: null } })
        .select('name slug email status createdAt approvedAt')
        .sort({ approvedAt: -1 })
        .limit(6)
        .lean(),
      Agency.find({ ...notDeleted, status: 'suspended' })
        .select('name slug email status createdAt')
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean(),
      User.find({ role: 'owner' }).select('-password').sort({ createdAt: -1 }).limit(8),
    ]);

    res.json({
      success: true,
      overview: {
        totalAdmins,
        activeAdmins,
        suspendedAdmins,
        trialAdmins,
        licensedAdmins,
        expiredAdmins,
        totalCars,
        totalBookings,
        totalCustomers,
        totalAgencies,
        activeAgencies,
        pendingAgencies,
        rejectedAgencies,
        suspendedAgencies,
        approvedAgencies: activeAgencies,
      },
      recentPending: agencyPreview(recentPending),
      recentApproved: agencyPreview(recentApproved),
      recentSuspended: agencyPreview(recentSuspended),
      recentAdmins: recentAdmins.map(sanitizeAdmin),
      permissionCatalog: OWNER_PERMISSIONS,
      trialDaysDefault: TRIAL_DAYS,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load overview' });
  }
};

// ─── Admin account CRUD ─────────────────────────────────

export const listAdmins = async (req, res) => {
  try {
    const { search = '', status = '', license = '', page = 1, limit = 20 } = req.query;
    const filter = { role: 'owner' };

    if (status) filter.accountStatus = status;
    if (license) filter.licenseStatus = license;
    if (search.trim()) {
      const q = escapeRegex(search.trim());
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { agencyName: new RegExp(q, 'i') },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * lim;

    const [admins, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(lim),
      User.countDocuments(filter),
    ]);

    // Sync license status for listed accounts (non-blocking best-effort)
    for (const admin of admins) {
      await syncLicenseStatus(admin);
    }

    res.json({
      success: true,
      admins: admins.map(sanitizeAdmin),
      pagination: {
        total,
        page: pageNum,
        limit: lim,
        totalPages: Math.max(1, Math.ceil(total / lim)),
      },
      permissionCatalog: OWNER_PERMISSIONS,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to list admins' });
  }
};

export const getAdminById = async (req, res) => {
  try {
    const admin = await findOwnerOrFail(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    await syncLicenseStatus(admin);

    const [cars, bookings, customers] = await Promise.all([
      Car.countDocuments({ owner: admin._id }),
      Booking.countDocuments({ owner: admin._id }),
      GuestCustomer.countDocuments({ owner: admin._id }),
    ]);

    res.json({
      success: true,
      admin: sanitizeAdmin(admin),
      stats: { cars, bookings, customers },
      permissionCatalog: OWNER_PERMISSIONS,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load admin' });
  }
};

export const createAdmin = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      agencyName = '',
      accountStatus = 'active',
      permissions = [],
      startTrial: shouldStartTrial = true,
      notes = '',
    } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const trial = shouldStartTrial ? createTrialDefaults() : {
      licenseStatus: 'expired',
      trialStartedAt: null,
      trialEndsAt: null,
      licensedAt: null,
    };

    const perms = Array.isArray(permissions)
      ? permissions.filter((p) => OWNER_PERMISSIONS.includes(p))
      : [];

    const admin = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashed,
      role: 'owner',
      agencyName: agencyName.trim(),
      accountStatus: OWNER_ACCOUNT_STATUSES.includes(accountStatus) ? accountStatus : 'active',
      permissions: perms,
      notes: String(notes || ''),
      passwordSetAt: new Date(),
      ...trial,
    });

    const agency = await ensureAgencyForOwner(admin);
    clearPublicTenantCache();
    await audit(req.user, admin, 'superadmin.admin.create', `Created admin ${admin.email}`);
    try {
      const { pushInbox } = await import('../services/platformInbox.js');
      await pushInbox({
        category: 'users',
        type: 'users.created',
        title: 'New admin user',
        body: `${admin.name} (${admin.email}) was created`,
        href: `/superadmin/admins/${admin._id}`,
        agencyId: agency?._id || null,
        agencyName: agency?.name || admin.agencyName || '',
        severity: 'info',
      });
    } catch {
      /* inbox must never block admin creation */
    }

    const fresh = await User.findById(admin._id);
    res.status(201).json({
      success: true,
      message: 'Admin account created',
      admin: sanitizeAdmin(fresh || admin),
      agency: agency
        ? {
            _id: agency._id,
            name: agency.name,
            slug: agency.slug,
            status: agency.status,
            isPublicStorefront: agency.isPublicStorefront,
          }
        : null,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to create admin' });
  }
};

const sanitizeAgency = (agency, owner = null) => {
  const obj = agency.toObject ? agency.toObject() : { ...agency };
  delete obj.customDomainVerifyToken;
  delete obj.__v;
  const invite = inviteMetaForOwner(owner);
  const access = buildAgencyAccessUrls(obj);
  return {
    ...obj,
    access,
    dashboardUrl: access.dashboardUrl,
    primaryOwner: owner
      ? {
          _id: owner._id,
          name: owner.name,
          email: owner.email,
          accountStatus: owner.accountStatus,
          licenseStatus: owner.licenseStatus,
          agencyName: owner.agencyName,
          passwordSetAt: owner.passwordSetAt || null,
          onboardingCompletedAt: owner.onboardingCompletedAt || null,
        }
      : null,
    invitePending: invite.invitePending,
    inviteExpiresAt: invite.inviteExpiresAt,
  };
};

export const listAgencies = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const q = String(req.query.q || req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const createdVia = String(req.query.createdVia || '').trim();
    const clauses = [notDeleted];
    if (q) {
      clauses.push({
        $or: [
          { name: new RegExp(escapeRegex(q), 'i') },
          { slug: new RegExp(escapeRegex(q), 'i') },
          { email: new RegExp(escapeRegex(q), 'i') },
          { city: new RegExp(escapeRegex(q), 'i') },
          { phone: new RegExp(escapeRegex(q), 'i') },
        ],
      });
    }
    if (AGENCY_STATUSES.includes(status)) {
      clauses.push({ status });
    }
    if (['self_serve', 'superadmin_invite', 'admin', 'migration'].includes(createdVia)) {
      clauses.push({ createdVia });
    }
    const filter = clauses.length === 1 ? clauses[0] : { $and: clauses };

    const [total, agencies] = await Promise.all([
      Agency.countDocuments(filter),
      Agency.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    const ownerIds = agencies.map((a) => a.primaryOwnerUserId).filter(Boolean);
    const owners = await User.find({ _id: { $in: ownerIds } })
      .select(
        'name email accountStatus licenseStatus agencyName inviteTokenHash inviteExpiresAt inviteUsedAt passwordSetAt onboardingCompletedAt',
      )
      .lean();
    const ownerMap = new Map(owners.map((o) => [String(o._id), o]));

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit) || 1,
        total,
        limit,
      },
      agencies: agencies.map((a) => sanitizeAgency(a, ownerMap.get(String(a.primaryOwnerUserId)))),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to list agencies' });
  }
};

/**
 * Create Agency + pending primary owner with single-use onboarding invite.
 * Body: name, slug?, ownerName, ownerEmail, phone?, whatsapp?, address?, city?, country?,
 *       logoUrl?, startTrial?, notes?, isPublicStorefront?
 * Never accepts or returns an owner password.
 */
export const createAgency = async (req, res) => {
  try {
    const {
      name,
      slug: requestedSlug = '',
      ownerName,
      ownerEmail,
      phone = '',
      whatsapp = '',
      address = '',
      city = '',
      country = '',
      logoUrl = '',
      startTrial: shouldStartTrial = true,
      notes = '',
      isPublicStorefront = false,
    } = req.body || {};

    if (!String(name || '').trim()) {
      return res.status(400).json({ success: false, message: 'Agency name is required' });
    }
    if (!String(ownerName || '').trim() || !String(ownerEmail || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'Owner name and email are required',
      });
    }

    const normalizedEmail = String(ownerEmail).trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const agencyName = String(name).trim();
    // Unusable random secret — owner sets their own password via invite link
    const hashed = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const invite = generateInviteToken();
    const trial = shouldStartTrial
      ? createTrialDefaults()
      : {
          licenseStatus: 'expired',
          trialStartedAt: null,
          trialEndsAt: null,
          licensedAt: null,
        };

    const admin = await User.create({
      name: String(ownerName).trim(),
      email: normalizedEmail,
      password: hashed,
      role: 'owner',
      agencyName,
      accountStatus: 'pending',
      permissions: [],
      notes: String(notes || ''),
      inviteTokenHash: invite.tokenHash,
      inviteExpiresAt: invite.expiresAt,
      inviteUsedAt: null,
      passwordSetAt: null,
      onboardingCompletedAt: null,
      ...trial,
    });

    const slugBase = String(requestedSlug || '').trim() || agencyName;
    const slug = await Agency.ensureUniqueSlug(slugBase);

    const agency = await Agency.create({
      name: agencyName,
      slug,
      status: 'pending',
      createdVia: 'superadmin_invite',
      primaryOwnerUserId: admin._id,
      legacyOwnerId: admin._id,
      isPublicStorefront: false,
      logoUrl: String(logoUrl || '').trim(),
      phone: String(phone || '').trim(),
      whatsapp: String(whatsapp || '').trim(),
      address: String(address || '').trim(),
      city: String(city || '').trim(),
      country: String(country || '').trim(),
      onboardingCompletedAt: null,
      contractBranding: {
        companyName: agencyName,
        logoUrl: String(logoUrl || '').trim(),
        showLogoOnPdf: true,
        footerNote: '',
      },
    });

    admin.agencyId = agency._id;
    await admin.save();

    if (isPublicStorefront) {
      await Agency.updateMany(
        { _id: { $ne: agency._id }, isPublicStorefront: true },
        { $set: { isPublicStorefront: false } },
      );
      agency.isPublicStorefront = true;
      await agency.save();
    }

    try {
      await getOrCreateAgencySettings(admin._id, agency._id);
      if (agency.whatsapp || agency.phone) {
        const wa = agency.whatsapp || agency.phone;
        await updateWhatsAppSettings(
          admin._id,
          {
            whatsappReservationNumber: wa,
            whatsappConfirmationNumber: wa,
          },
          agency._id,
        );
      }
    } catch (settingsErr) {
      console.error('[createAgency] settings seed', settingsErr.message);
    }

    try {
      const { ensureAgencySubscription } = await import('../services/billingService.js');
      await ensureAgencySubscription(agency._id, {
        planCode: 'free_trial',
        status: shouldStartTrial ? 'trialing' : 'expired',
        trialStartedAt: trial.trialStartedAt || null,
        trialEndsAt: trial.trialEndsAt || null,
        actorType: 'superadmin',
        actorId: req.user._id,
        notes: 'Created with agency',
      });
    } catch (billingErr) {
      console.error('[createAgency] billing seed', billingErr.message);
    }

    clearPublicTenantCache();
    await audit(
      req.user,
      admin,
      'superadmin.agency.create',
      `Created pending agency ${agency.slug} with owner ${admin.email}`,
      { agencyId: agency._id },
    );

    const owner = await User.findById(admin._id)
      .select(
        'name email accountStatus licenseStatus agencyName inviteTokenHash inviteExpiresAt inviteUsedAt passwordSetAt onboardingCompletedAt',
      )
      .lean();
    const onboardingUrl = buildOnboardingUrl(invite.token);

    res.status(201).json({
      success: true,
      message: 'Agency created. Share the onboarding link with the owner.',
      agency: sanitizeAgency(agency, owner),
      onboardingUrl,
      inviteExpiresAt: invite.expiresAt,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to create agency' });
  }
};

/**
 * Regenerate a single-use onboarding invite for a pending agency owner.
 */
export const resendAgencyInvite = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid agency id' });
    }
    const agency = await Agency.findById(req.params.id);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }
    if (agency.onboardingCompletedAt || agency.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Agency onboarding is already complete',
      });
    }
    if (agency.status === 'suspended' || agency.status === 'disabled') {
      return res.status(403).json({
        success: false,
        code: 'AGENCY_LOCKED',
        message: 'Cannot invite owners for a suspended or disabled agency',
      });
    }

    const owner = await User.findById(agency.primaryOwnerUserId);
    if (!owner || owner.role !== 'owner') {
      return res.status(404).json({ success: false, message: 'Primary owner not found' });
    }

    const invite = generateInviteToken();
    owner.inviteTokenHash = invite.tokenHash;
    owner.inviteExpiresAt = invite.expiresAt;
    owner.inviteUsedAt = null;
    owner.accountStatus = 'pending';
    // Keep passwordSetAt if they already chose a password — they can still use a fresh invite to reset entry
    owner.tokenVersion = (owner.tokenVersion || 0) + 1;
    agency.status = 'pending';
    await owner.save();
    await agency.save();

    await audit(
      req.user,
      owner,
      'superadmin.agency.invite_resend',
      `Resent onboarding invite for ${agency.slug}`,
      { agencyId: agency._id },
    );

    const onboardingUrl = buildOnboardingUrl(invite.token);
    res.json({
      success: true,
      message: 'Onboarding invite regenerated',
      onboardingUrl,
      inviteExpiresAt: invite.expiresAt,
      agency: sanitizeAgency(agency, owner),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to resend invite' });
  }
};

/**
 * Edit agency profile fields (name, slug, public storefront, locale stubs).
 */
export const updateAgency = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid agency id' });
    }
    const agency = await Agency.findById(req.params.id);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const {
      name,
      slug,
      isPublicStorefront,
      timezone,
      currency,
      locale,
      status,
      phone,
      whatsapp,
      address,
      city,
      country,
      logoUrl,
      faviconUrl,
      email,
      primaryBrandColor,
      secondaryBrandColor,
      postalCode,
      addressRegion,
      legalName,
      taxId,
      socials,
      seo,
      hero,
      contractBranding,
    } = req.body || {};

    if (name !== undefined) {
      agency.name = String(name).trim() || agency.name;
      if (agency.primaryOwnerUserId) {
        await User.updateOne(
          { _id: agency.primaryOwnerUserId },
          { $set: { agencyName: agency.name } },
        );
      }
    }

    if (slug !== undefined && String(slug).trim()) {
      agency.slug = await Agency.ensureUniqueSlug(String(slug).trim(), agency._id);
    }

    if (timezone !== undefined) agency.timezone = String(timezone || '').trim() || agency.timezone;
    if (currency !== undefined) agency.currency = String(currency || '').trim() || agency.currency;
    if (locale !== undefined) agency.locale = String(locale || '').trim() || agency.locale;
    if (phone !== undefined) agency.phone = String(phone || '').trim();
    if (whatsapp !== undefined) agency.whatsapp = String(whatsapp || '').trim();
    if (email !== undefined) agency.email = String(email || '').trim().toLowerCase();
    if (address !== undefined) agency.address = String(address || '').trim();
    if (city !== undefined) agency.city = String(city || '').trim();
    if (country !== undefined) agency.country = String(country || '').trim();
    if (postalCode !== undefined) agency.postalCode = String(postalCode || '').trim();
    if (addressRegion !== undefined) agency.addressRegion = String(addressRegion || '').trim();
    if (legalName !== undefined) agency.legalName = String(legalName || '').trim();
    if (taxId !== undefined) agency.taxId = String(taxId || '').trim();
    if (logoUrl !== undefined) agency.logoUrl = String(logoUrl || '').trim();
    if (faviconUrl !== undefined) agency.faviconUrl = String(faviconUrl || '').trim();
    if (primaryBrandColor !== undefined) {
      agency.primaryBrandColor = String(primaryBrandColor || '').trim();
    }
    if (secondaryBrandColor !== undefined) {
      agency.secondaryBrandColor = String(secondaryBrandColor || '').trim();
    }
    if (socials && typeof socials === 'object') {
      agency.socials = {
        ...(agency.socials?.toObject?.() || agency.socials || {}),
        instagram: String(socials.instagram || '').trim(),
        facebook: String(socials.facebook || '').trim(),
        tiktok: String(socials.tiktok || '').trim(),
        youtube: String(socials.youtube || '').trim(),
        website: String(socials.website || '').trim(),
      };
    }
    if (seo && typeof seo === 'object') {
      agency.seo = {
        title: String(seo.title || '').trim().slice(0, 120),
        description: String(seo.description || '').trim().slice(0, 320),
        ogImageUrl: String(seo.ogImageUrl || '').trim(),
      };
    }
    if (hero && typeof hero === 'object') {
      agency.hero = {
        headline: String(hero.headline || '').trim().slice(0, 160),
        subheadline: String(hero.subheadline || '').trim().slice(0, 320),
        badgeText: String(hero.badgeText || '').trim().slice(0, 80),
        imageUrl: String(hero.imageUrl || '').trim(),
      };
    }
    if (contractBranding && typeof contractBranding === 'object') {
      agency.contractBranding = {
        companyName: String(contractBranding.companyName || agency.name).trim(),
        logoUrl: String(contractBranding.logoUrl || agency.logoUrl || '').trim(),
        showLogoOnPdf: contractBranding.showLogoOnPdf !== false,
        footerNote: String(contractBranding.footerNote || '').trim().slice(0, 500),
      };
    }

    if (status !== undefined) {
      if (!AGENCY_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid agency status' });
      }
      agency.status = status;
      if (agency.primaryOwnerUserId) {
        const ownerStatus = mapAgencyStatusToOwnerStatus(status);
        await User.updateOne(
          { _id: agency.primaryOwnerUserId, role: 'owner' },
          {
            $set: { accountStatus: ownerStatus },
            ...(status === 'active' ? {} : { $inc: { tokenVersion: 1 } }),
          },
        );
      }
    }

    if (isPublicStorefront !== undefined) {
      const wantPublic = Boolean(isPublicStorefront);
      if (wantPublic) {
        await Agency.updateMany(
          { _id: { $ne: agency._id }, isPublicStorefront: true },
          { $set: { isPublicStorefront: false } },
        );
      }
      agency.isPublicStorefront = wantPublic;
    }

    await agency.save();
    clearPublicTenantCache();
    await audit(
      req.user,
      { _id: agency.primaryOwnerUserId },
      'superadmin.agency.update',
      `Updated agency ${agency.slug}`,
      { agencyId: agency._id },
    );

    const owner = await User.findById(agency.primaryOwnerUserId)
      .select(
        'name email accountStatus licenseStatus agencyName inviteTokenHash inviteExpiresAt inviteUsedAt passwordSetAt onboardingCompletedAt',
      )
      .lean();

    res.json({
      success: true,
      message: 'Agency updated',
      agency: sanitizeAgency(agency, owner),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update agency' });
  }
};

export const getAgencyById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid agency id' });
    }
    const agency = await Agency.findById(req.params.id).lean();
    if (!agency || agency.deletedAt) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }
    const owner = await User.findById(agency.primaryOwnerUserId)
      .select('-password')
      .lean();
    const [cars, bookings, customers, recentCars, recentBookings] = await Promise.all([
      Car.countDocuments({ agencyId: agency._id }),
      Booking.countDocuments({ agencyId: agency._id }),
      GuestCustomer.countDocuments({ agencyId: agency._id }),
      Car.find({ agencyId: agency._id })
        .select('brand model category pricePerDay isAvaliable createdAt')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Booking.find({ agencyId: agency._id })
        .select('reservationId customerName status paymentStatus price pickupDate createdAt')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
    ]);
    res.json({
      success: true,
      agency: sanitizeAgency(agency, owner),
      stats: { cars, bookings, customers },
      recentCars,
      recentBookings,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load agency' });
  }
};

/** Super Admin: force-verify or clear custom domain (ops). */
export const verifyAgencyDomain = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid agency id' });
    }
    const { verifyAgencyCustomDomain, serializeDomainState, setAgencyCustomDomain, clearAgencyCustomDomain } =
      await import('../services/agencyDomainService.js');

    if (req.body?.customDomain) {
      await setAgencyCustomDomain(req.params.id, req.body.customDomain);
    }
    if (req.body?.clear === true) {
      const cleared = await clearAgencyCustomDomain(req.params.id);
      return res.json({ success: true, domains: serializeDomainState(cleared) });
    }

    const agency = await verifyAgencyCustomDomain(req.params.id, { force: 'superadmin' });
    const owner = await User.findById(agency.primaryOwnerUserId).select('-password').lean();
    res.json({
      success: true,
      message: 'Custom domain verified',
      domains: serializeDomainState(agency),
      agency: sanitizeAgency(agency, owner),
    });
  } catch (error) {
    console.error('[verifyAgencyDomain]', error.message);
    res.status(error.status || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed to verify domain',
    });
  }
};

export const setAgencyStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid agency id' });
    }
    const { status } = req.body;
    if (!['active', 'suspended', 'disabled', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid agency status' });
    }
    const agency = await Agency.findById(req.params.id);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }
    agency.status = status;
    await agency.save();

    // Mirror onto primary owner account lock for dashboard access (never deletes data)
    if (agency.primaryOwnerUserId) {
      const ownerStatus = mapAgencyStatusToOwnerStatus(status);
      await User.updateOne(
        { _id: agency.primaryOwnerUserId, role: 'owner' },
        {
          $set: { accountStatus: ownerStatus },
          ...(status === 'active' ? {} : { $inc: { tokenVersion: 1 } }),
        },
      );
    }

    clearPublicTenantCache();
    await audit(
      req.user,
      { _id: agency.primaryOwnerUserId },
      'superadmin.agency.status',
      `Set agency ${agency.slug} status=${status}`,
      { agencyId: agency._id, status },
    );

    try {
      const { pushInbox } = await import('../services/platformInbox.js');
      if (status === 'suspended') {
        await pushInbox({
          category: 'agency',
          type: 'agency.suspended',
          title: 'Agency suspended',
          body: `${agency.name} can no longer access the workspace`,
          href: `/superadmin/agencies/${agency._id}`,
          agencyId: agency._id,
          agencyName: agency.name,
          severity: 'warn',
        });
      } else if (status === 'active') {
        await pushInbox({
          category: 'agency',
          type: 'agency.reactivated',
          title: 'Agency reactivated',
          body: `${agency.name} is active again`,
          href: `/superadmin/agencies/${agency._id}`,
          agencyId: agency._id,
          agencyName: agency.name,
          severity: 'info',
        });
      }
    } catch {
      /* inbox must never block status changes */
    }

    res.json({ success: true, message: `Agency ${status}`, agency: sanitizeAgency(agency) });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update agency status' });
  }
};

const approvalPayload = (result) => ({
  success: true,
  agency: sanitizeAgency(result.agency, result.owner),
  access: result.urls || buildAgencyAccessUrls(result.agency),
  notifications: result.notifications || result.agency.notifications || {},
  whatsappUrl: result.whatsappUrl || result.notifications?.whatsapp?.waMeUrl || '',
});

export const approveAgency = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid agency id' });
    }
    const result = await approveAgencyRequest(req.params.id, req.user);
    res.json({
      ...approvalPayload(result),
      message: result.alreadyApproved ? 'Agency is already approved' : 'Agency approved',
      alreadyApproved: Boolean(result.alreadyApproved),
    });
  } catch (error) {
    console.error('[approveAgency]', error.message);
    res.status(error.status || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed to approve agency',
    });
  }
};

export const rejectAgency = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid agency id' });
    }
    const result = await rejectAgencyRequest(req.params.id, req.user, req.body?.reason);
    res.json({
      ...approvalPayload(result),
      message: 'Agency request rejected',
    });
  } catch (error) {
    console.error('[rejectAgency]', error.message);
    res.status(error.status || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed to reject agency',
    });
  }
};

export const deleteAgencyRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid agency id' });
    }
    const result = await softDeleteAgencyRequest(req.params.id, req.user);
    res.json({
      success: true,
      message: 'Agency request deleted',
      agency: sanitizeAgency(result.agency, result.owner),
    });
  } catch (error) {
    console.error('[deleteAgencyRequest]', error.message);
    res.status(error.status || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed to delete agency request',
    });
  }
};

export const notifyAgency = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid agency id' });
    }
    const result = await retryAgencyNotifications(req.params.id, req.user, {
      reject: req.body?.kind === 'reject',
    });
    res.json({
      ...approvalPayload(result),
      message: 'Notification retry complete',
    });
  } catch (error) {
    console.error('[notifyAgency]', error.message);
    res.status(error.status || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed to retry notifications',
    });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const admin = await findOwnerOrFail(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const { name, email, agencyName, notes, permissions } = req.body;

    if (name !== undefined) admin.name = String(name).trim();
    if (agencyName !== undefined) {
      admin.agencyName = String(agencyName).trim();
      if (admin.agencyId) {
        await Agency.updateOne(
          { _id: admin.agencyId },
          { $set: { name: admin.agencyName || admin.name } },
        );
      }
    }
    if (notes !== undefined) admin.notes = String(notes);
    if (email !== undefined) {
      const normalized = String(email).trim().toLowerCase();
      if (normalized !== admin.email) {
        const clash = await User.findOne({ email: normalized, _id: { $ne: admin._id } });
        if (clash) {
          return res.status(409).json({ success: false, message: 'Email already in use' });
        }
        admin.email = normalized;
      }
    }
    if (permissions !== undefined) {
      const normalizedPermissions = Array.isArray(permissions)
        ? permissions.filter((p) => OWNER_PERMISSIONS.includes(p))
        : [];

      const oldPermissions = Array.isArray(admin.permissions) ? admin.permissions : [];
      const permissionsChanged =
        normalizedPermissions.length !== oldPermissions.length ||
        normalizedPermissions.some((p) => !oldPermissions.includes(p)) ||
        oldPermissions.some((p) => !normalizedPermissions.includes(p));

      admin.permissions = normalizedPermissions;
      if (permissionsChanged) {
        admin.tokenVersion = (admin.tokenVersion || 0) + 1;
      }
    }

    await admin.save();
    await audit(req.user, admin, 'superadmin.admin.update', `Updated admin ${admin.email}`);

    res.json({ success: true, message: 'Admin updated', admin: sanitizeAdmin(admin) });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update admin' });
  }
};

export const setAccountStatus = async (req, res) => {
  try {
    const admin = await findOwnerOrFail(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const { status } = req.body;
    if (!OWNER_ACCOUNT_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid account status' });
    }

    admin.accountStatus = status;
    // Revoke existing sessions when locking an account
    if (status === 'suspended' || status === 'disabled') {
      admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    }
    await admin.save();
    if (admin.agencyId) {
      await Agency.updateOne(
        { _id: admin.agencyId },
        { $set: { status: mapAgencyStatusToOwnerStatus(status) } },
      );
    }
    clearPublicTenantCache();
    await audit(
      req.user,
      admin,
      'superadmin.admin.status',
      `Set accountStatus=${status} for ${admin.email}`,
      { status }
    );

    res.json({
      success: true,
      message: `Account ${status}`,
      admin: sanitizeAdmin(admin),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

export const resetAdminPassword = async (req, res) => {
  try {
    const admin = await findOwnerOrFail(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const { password } = req.body;
    if (!password || String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    admin.password = await bcrypt.hash(password, 10);
    admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    await admin.save();
    await audit(req.user, admin, 'superadmin.admin.password_reset', `Password reset for ${admin.email}`);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};

export const setAdminPermissions = async (req, res) => {
  try {
    const admin = await findOwnerOrFail(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const { permissions } = req.body;
    const normalizedPermissions = Array.isArray(permissions)
      ? permissions.filter((p) => OWNER_PERMISSIONS.includes(p))
      : [];

    const oldPermissions = Array.isArray(admin.permissions) ? admin.permissions : [];
    const permissionsChanged =
      normalizedPermissions.length !== oldPermissions.length ||
      normalizedPermissions.some((p) => !oldPermissions.includes(p)) ||
      oldPermissions.some((p) => !normalizedPermissions.includes(p));

    admin.permissions = normalizedPermissions;
    if (permissionsChanged) {
      admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    }

    await admin.save();
    await audit(
      req.user,
      admin,
      'superadmin.admin.permissions',
      `Updated permissions for ${admin.email}`,
      { permissions: admin.permissions }
    );
    if (permissionsChanged) {
      try {
        const { pushInbox } = await import('../services/platformInbox.js');
        await pushInbox({
          category: 'users',
          type: 'users.role_changed',
          title: 'Access changed',
          body: `Permissions updated for ${admin.name || admin.email}`,
          href: `/superadmin/admins/${admin._id}`,
          agencyName: admin.agencyName || '',
          severity: 'info',
        });
      } catch {
        /* ignore */
      }
    }

    res.json({
      success: true,
      message: 'Permissions updated',
      admin: sanitizeAdmin(admin),
      note: 'Empty permissions list means full access',
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update permissions' });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    const admin = await findOwnerOrFail(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const email = admin.email;
    // Soft-lock instead of hard-delete by default if they have data
    const [cars, bookings] = await Promise.all([
      Car.countDocuments({ owner: admin._id }),
      Booking.countDocuments({ owner: admin._id }),
    ]);

    if (cars > 0 || bookings > 0) {
      admin.accountStatus = 'disabled';
      admin.licenseStatus = 'expired';
      await admin.save();
      clearPublicTenantCache();
      await audit(
        req.user,
        admin,
        'superadmin.admin.disable',
        `Disabled admin ${email} (has ${cars} cars / ${bookings} bookings — data preserved)`,
        { cars, bookings }
      );
      return res.json({
        success: true,
        message: 'Admin has existing data and was disabled instead of deleted. All data preserved.',
        admin: sanitizeAdmin(admin),
        softDeleted: true,
      });
    }

    await User.deleteOne({ _id: admin._id });
    clearPublicTenantCache();
    await audit(req.user, { _id: admin._id }, 'superadmin.admin.delete', `Deleted admin ${email}`);

    res.json({ success: true, message: 'Admin account deleted', softDeleted: false });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to delete admin' });
  }
};

// ─── License management ─────────────────────────────────

export const manageLicense = async (req, res) => {
  try {
    const admin = await findOwnerOrFail(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const { action, days } = req.body;
    const n = Math.max(1, Number(days) || TRIAL_DAYS);

    // Bridge to AgencySubscription when agency exists (P4 source of truth)
    let agencyId = admin.agencyId;
    if (!agencyId) {
      try {
        const ensured = await ensureAgencyForOwner(admin);
        agencyId = ensured?._id || null;
      } catch {
        /* legacy owner without agency */
      }
    }

    if (agencyId) {
      const billing = await import('../services/billingService.js');
      switch (action) {
        case 'activate':
          await billing.assignPlan(agencyId, 'legacy_grandfathered', {
            actorType: 'superadmin',
            actorId: req.user._id,
            notes: 'Via admins/:id/license activate',
          });
          break;
        case 'trial':
          await billing.assignPlan(agencyId, 'free_trial', {
            actorType: 'superadmin',
            actorId: req.user._id,
            trialDays: n,
            notes: 'Via admins/:id/license trial',
          });
          break;
        case 'extend':
          await billing.extendTrial(agencyId, n, {
            actorType: 'superadmin',
            actorId: req.user._id,
          });
          break;
        case 'expire':
          await billing.expireSubscription(agencyId, {
            actorType: 'superadmin',
            actorId: req.user._id,
            notes: 'Via admins/:id/license expire',
          });
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid action. Use activate | trial | extend | expire',
          });
      }
      const refreshed = await User.findById(admin._id);
      await audit(
        req.user,
        refreshed,
        `superadmin.license.${action}`,
        `License ${action} for ${admin.email} (agency billing)`,
        { days: n, licenseStatus: refreshed.licenseStatus, agencyId },
      );
      return res.json({
        success: true,
        message: `License ${action} applied`,
        admin: sanitizeAdmin(refreshed),
      });
    }

    switch (action) {
      case 'activate':
        await activateLicense(admin);
        break;
      case 'trial':
        await startTrial(admin, n);
        break;
      case 'extend':
        await extendTrial(admin, n);
        break;
      case 'expire':
        await expireLicense(admin);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Use activate | trial | extend | expire',
        });
    }

    await audit(
      req.user,
      admin,
      `superadmin.license.${action}`,
      `License ${action} for ${admin.email}`,
      { days: n, licenseStatus: admin.licenseStatus }
    );

    res.json({
      success: true,
      message: `License ${action} applied`,
      admin: sanitizeAdmin(admin),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update license' });
  }
};

// ─── System activity ────────────────────────────────────

export const getPlatformAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 30, search = '', agencyId = '' } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.min(100, Math.max(1, Number(limit) || 30));
    const filter = {};
    if (agencyId && mongoose.isValidObjectId(agencyId)) {
      filter.agencyId = agencyId;
    }

    if (search.trim()) {
      const q = escapeRegex(search.trim());
      filter.$or = [
        { action: new RegExp(q, 'i') },
        { details: new RegExp(q, 'i') },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('owner', 'name email agencyName role')
        .populate('actor', 'name email role')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * lim)
        .limit(lim),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: lim,
        totalPages: Math.max(1, Math.ceil(total / lim)),
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load audit logs' });
  }
};

export const getPlatformActivity = async (req, res) => {
  try {
    const recentBookings = await Booking.find({})
      .populate('car', 'brand model')
      .populate('owner', 'name email agencyName')
      .sort({ createdAt: -1 })
      .limit(15)
      .select('reservationId customerName status paymentStatus price pickupDate createdAt owner car');

    const recentCars = await Car.find({ owner: { $ne: null } })
      .populate('owner', 'name email agencyName')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('brand model category pricePerDay isAvaliable owner createdAt');

    res.json({
      success: true,
      recentBookings,
      recentCars,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load activity' });
  }
};
