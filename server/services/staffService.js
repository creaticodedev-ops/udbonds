import bcrypt from 'bcrypt';
import crypto from 'crypto';
import User from '../models/User.js';
import Agency from '../models/Agency.js';
import {
  generateInviteToken,
  hashInviteToken,
  isInviteExpired,
  buildStaffInviteUrl as buildStaffInviteUrlFromToken,
} from './agencyInviteToken.js';
import { resolveStaffPermissions, STAFF_ROLE_CODES } from '../utils/staffRoles.js';
import { assertWithinLimit } from './entitlementsService.js';
import { logAudit } from '../utils/adminOps.js';

export const buildStaffInviteUrl = buildStaffInviteUrlFromToken;

/** Seats used = primary owner (1) + pending/active staff. */
export const countAgencyStaffSeats = async (agencyId) => {
  if (!agencyId) return 1;
  const staff = await User.countDocuments({
    agencyId,
    role: 'staff',
    accountStatus: { $in: ['pending', 'active'] },
  });
  return 1 + staff;
};

export const assertCanAddStaff = async (agencyId) => {
  const seats = await countAgencyStaffSeats(agencyId);
  return assertWithinLimit(agencyId, 'maxStaff', seats);
};

export const sanitizeStaffMember = (user, { inviteUrl = null } = {}) => {
  if (!user) return null;
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.inviteTokenHash;
  const invitePending =
    obj.accountStatus === 'pending' &&
    Boolean(user.inviteTokenHash) &&
    !obj.inviteUsedAt &&
    obj.inviteExpiresAt &&
    !isInviteExpired(obj.inviteExpiresAt);

  return {
    _id: obj._id,
    name: obj.name,
    email: obj.email,
    role: obj.role,
    staffRole: obj.staffRole || 'agent',
    agencyId: obj.agencyId,
    agencyName: obj.agencyName,
    accountStatus: obj.accountStatus,
    permissions: obj.permissions || [],
    invitePending,
    inviteExpiresAt: obj.inviteExpiresAt || null,
    inviteUsedAt: obj.inviteUsedAt || null,
    passwordSetAt: obj.passwordSetAt || null,
    lastLoginAt: obj.lastLoginAt || null,
    createdAt: obj.createdAt,
    inviteUrl,
  };
};

export const listAgencyStaff = async (agencyId) => {
  const members = await User.find({ agencyId, role: 'staff' })
    .select('-password -inviteTokenHash')
    .sort({ createdAt: -1 })
    .lean();
  return members.map((m) => sanitizeStaffMember({ ...m, inviteTokenHash: null }));
};

/**
 * Invite a new staff member (or re-invite pending).
 * Owner remains role=owner; staff are role=staff.
 */
export const inviteStaffMember = async (
  agencyId,
  {
    name,
    email,
    staffRole = 'agent',
    permissions = null,
    actorUser = null,
  } = {},
) => {
  const agency = await Agency.findById(agencyId);
  if (!agency) {
    const err = new Error('Agency not found');
    err.status = 404;
    throw err;
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const displayName = String(name || '').trim();
  if (!normalizedEmail || !displayName) {
    const err = new Error('Name and email are required');
    err.status = 400;
    throw err;
  }

  if (!STAFF_ROLE_CODES.includes(String(staffRole))) {
    const err = new Error(`Invalid staffRole. Use: ${STAFF_ROLE_CODES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    if (String(existing.agencyId) === String(agencyId) && existing.role === 'staff') {
      // Re-invite pending staff (does not consume an extra seat)
      if (existing.accountStatus === 'active' && existing.passwordSetAt) {
        const err = new Error('This person is already an active staff member');
        err.status = 409;
        throw err;
      }
      const invite = generateInviteToken();
      existing.name = displayName;
      existing.staffRole = staffRole;
      existing.permissions = resolveStaffPermissions(staffRole, permissions);
      existing.inviteTokenHash = invite.tokenHash;
      existing.inviteExpiresAt = invite.expiresAt;
      existing.inviteUsedAt = null;
      existing.accountStatus = 'pending';
      existing.tokenVersion = (existing.tokenVersion || 0) + 1;
      await existing.save();

      if (actorUser) {
        await logAudit({
          owner: agency.legacyOwnerId || agency.primaryOwnerUserId,
          agencyId,
          actor: actorUser._id,
          action: 'staff.invite_resend',
          entityType: 'User',
          entityId: existing._id,
          details: `Re-invited staff ${normalizedEmail}`,
        });
      }

      return {
        member: sanitizeStaffMember(existing, {
          inviteUrl: buildStaffInviteUrl(invite.token),
        }),
        inviteUrl: buildStaffInviteUrl(invite.token),
        inviteExpiresAt: invite.expiresAt,
      };
    }
    const err = new Error('An account with this email already exists');
    err.status = 409;
    throw err;
  }

  await assertCanAddStaff(agencyId);

  const invite = generateInviteToken();
  const hashed = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const perms = resolveStaffPermissions(staffRole, permissions);

  const member = await User.create({
    name: displayName,
    email: normalizedEmail,
    password: hashed,
    role: 'staff',
    staffRole,
    agencyId,
    agencyName: agency.name,
    accountStatus: 'pending',
    permissions: perms,
    licenseStatus: 'active',
    inviteTokenHash: invite.tokenHash,
    inviteExpiresAt: invite.expiresAt,
    inviteUsedAt: null,
    passwordSetAt: null,
    onboardingCompletedAt: null,
  });

  if (actorUser) {
    await logAudit({
      owner: agency.legacyOwnerId || agency.primaryOwnerUserId,
      agencyId,
      actor: actorUser._id,
      action: 'staff.invite',
      entityType: 'User',
      entityId: member._id,
      details: `Invited staff ${normalizedEmail} as ${staffRole}`,
      meta: { staffRole, permissions: perms },
    });
  }

  return {
    member: sanitizeStaffMember(member, { inviteUrl: buildStaffInviteUrl(invite.token) }),
    inviteUrl: buildStaffInviteUrl(invite.token),
    inviteExpiresAt: invite.expiresAt,
  };
};

export const updateStaffMember = async (
  agencyId,
  memberId,
  { name, staffRole, permissions, accountStatus, actorUser = null } = {},
) => {
  const member = await User.findOne({ _id: memberId, agencyId, role: 'staff' });
  if (!member) {
    const err = new Error('Staff member not found');
    err.status = 404;
    throw err;
  }

  if (name != null) member.name = String(name).trim() || member.name;
  if (staffRole != null) {
    if (!STAFF_ROLE_CODES.includes(String(staffRole))) {
      const err = new Error(`Invalid staffRole. Use: ${STAFF_ROLE_CODES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    member.staffRole = staffRole;
    if (permissions == null) {
      member.permissions = resolveStaffPermissions(staffRole, null);
    }
  }
  if (permissions != null) {
    member.permissions = resolveStaffPermissions(member.staffRole || 'agent', permissions);
    member.tokenVersion = (member.tokenVersion || 0) + 1;
  }
  if (accountStatus != null) {
    if (!['active', 'suspended', 'disabled', 'pending'].includes(accountStatus)) {
      const err = new Error('Invalid accountStatus');
      err.status = 400;
      throw err;
    }
    if (accountStatus !== member.accountStatus) {
      member.accountStatus = accountStatus;
      member.tokenVersion = (member.tokenVersion || 0) + 1;
    }
  }

  await member.save();

  if (actorUser) {
    const agency = await Agency.findById(agencyId).lean();
    await logAudit({
      owner: agency?.legacyOwnerId || agency?.primaryOwnerUserId,
      agencyId,
      actor: actorUser._id,
      action: 'staff.update',
      entityType: 'User',
      entityId: member._id,
      details: `Updated staff ${member.email}`,
    });
  }

  return sanitizeStaffMember(member);
};

export const removeStaffMember = async (agencyId, memberId, { actorUser = null } = {}) => {
  const member = await User.findOne({ _id: memberId, agencyId, role: 'staff' });
  if (!member) {
    const err = new Error('Staff member not found');
    err.status = 404;
    throw err;
  }

  const agency = await Agency.findById(agencyId).lean();
  if (
    agency?.primaryOwnerUserId &&
    String(agency.primaryOwnerUserId) === String(member._id)
  ) {
    const err = new Error('Cannot remove the primary owner');
    err.status = 400;
    throw err;
  }

  const email = member.email;
  const neverActivated = !member.passwordSetAt;

  if (actorUser) {
    await logAudit({
      owner: agency?.legacyOwnerId || agency?.primaryOwnerUserId,
      agencyId,
      actor: actorUser._id,
      action: 'staff.remove',
      entityType: 'User',
      entityId: memberId,
      details: `Removed staff ${email}`,
    });
  }

  if (neverActivated) {
    await User.deleteOne({ _id: member._id });
  } else {
    member.accountStatus = 'disabled';
    member.tokenVersion = (member.tokenVersion || 0) + 1;
    member.inviteTokenHash = null;
    await member.save();
  }

  return { removed: true, memberId: String(memberId) };
};

export const findStaffInviteUser = async (rawToken) => {
  const token = String(rawToken || '').trim();
  if (token.length < 32) return { error: 'INVALID' };
  const user = await User.findOne({
    inviteTokenHash: hashInviteToken(token),
    role: 'staff',
  });
  if (!user) return { error: 'INVALID' };
  if (user.accountStatus === 'suspended' || user.accountStatus === 'disabled') {
    return { error: 'LOCKED', user };
  }
  if (user.inviteUsedAt || user.passwordSetAt) return { error: 'USED', user };
  if (isInviteExpired(user.inviteExpiresAt)) return { error: 'EXPIRED', user };
  return { user };
};

export default {
  buildStaffInviteUrl,
  countAgencyStaffSeats,
  assertCanAddStaff,
  listAgencyStaff,
  inviteStaffMember,
  updateStaffMember,
  removeStaffMember,
  sanitizeStaffMember,
  findStaffInviteUser,
};
