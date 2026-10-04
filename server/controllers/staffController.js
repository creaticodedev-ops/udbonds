import {
  listAgencyStaff,
  inviteStaffMember,
  updateStaffMember,
  removeStaffMember,
  countAgencyStaffSeats,
} from '../services/staffService.js';
import { STAFF_ROLE_PRESETS } from '../utils/staffRoles.js';
import { getAgencyEntitlements } from '../services/entitlementsService.js';
import Agency from '../models/Agency.js';
import User from '../models/User.js';

export const listStaffRoles = (_req, res) => {
  res.json({
    success: true,
    roles: Object.entries(STAFF_ROLE_PRESETS).map(([code, meta]) => ({
      code,
      label: meta.label,
      description: meta.description,
      permissions: meta.permissions,
    })),
  });
};

export const getOwnerStaff = async (req, res) => {
  try {
    const [members, seats, ent] = await Promise.all([
      listAgencyStaff(req.agencyId),
      countAgencyStaffSeats(req.agencyId),
      getAgencyEntitlements(req.agencyId),
    ]);
    const agency = req.agency || (await Agency.findById(req.agencyId).lean());
    const owner = agency?.primaryOwnerUserId
      ? await User.findById(agency.primaryOwnerUserId)
          .select('name email accountStatus role')
          .lean()
      : null;

    res.json({
      success: true,
      owner: owner
        ? {
            _id: owner._id,
            name: owner.name,
            email: owner.email,
            accountStatus: owner.accountStatus,
            role: 'owner',
            isPrimaryOwner: true,
          }
        : null,
      members,
      usage: {
        seats,
        maxStaff: ent.limits?.maxStaff ?? null,
      },
      roles: Object.entries(STAFF_ROLE_PRESETS).map(([code, meta]) => ({
        code,
        label: meta.label,
        description: meta.description,
        permissions: meta.permissions,
      })),
    });
  } catch (error) {
    console.error('[getOwnerStaff]', error.message);
    res.status(500).json({ success: false, message: 'Failed to list staff' });
  }
};

export const inviteOwnerStaff = async (req, res) => {
  try {
    const result = await inviteStaffMember(req.agencyId, {
      name: req.body?.name,
      email: req.body?.email,
      staffRole: req.body?.staffRole || 'agent',
      permissions: req.body?.permissions,
      actorUser: req.user,
    });
    res.status(201).json({
      success: true,
      message: 'Staff invite created. Share the activation link.',
      ...result,
    });
  } catch (error) {
    console.error('[inviteOwnerStaff]', error.message);
    res.status(error.status || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed to invite staff',
      meta: error.meta,
    });
  }
};

export const updateOwnerStaff = async (req, res) => {
  try {
    const member = await updateStaffMember(req.agencyId, req.params.id, {
      name: req.body?.name,
      staffRole: req.body?.staffRole,
      permissions: req.body?.permissions,
      accountStatus: req.body?.accountStatus,
      actorUser: req.user,
    });
    res.json({ success: true, message: 'Staff updated', member });
  } catch (error) {
    console.error('[updateOwnerStaff]', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to update staff',
    });
  }
};

export const removeOwnerStaff = async (req, res) => {
  try {
    const result = await removeStaffMember(req.agencyId, req.params.id, {
      actorUser: req.user,
    });
    res.json({ success: true, message: 'Staff removed', ...result });
  } catch (error) {
    console.error('[removeOwnerStaff]', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to remove staff',
    });
  }
};

/** Super Admin: list members for an agency */
export const getSuperAdminAgencyStaff = async (req, res) => {
  try {
    const agencyId = req.params.id;
    const agency = await Agency.findById(agencyId).lean();
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }
    const [members, seats, ent] = await Promise.all([
      listAgencyStaff(agencyId),
      countAgencyStaffSeats(agencyId),
      getAgencyEntitlements(agencyId),
    ]);
    res.json({
      success: true,
      agencyId,
      members,
      usage: { seats, maxStaff: ent.limits?.maxStaff ?? null },
    });
  } catch (error) {
    console.error('[getSuperAdminAgencyStaff]', error.message);
    res.status(500).json({ success: false, message: 'Failed to list agency staff' });
  }
};

export const inviteSuperAdminAgencyStaff = async (req, res) => {
  try {
    const result = await inviteStaffMember(req.params.id, {
      name: req.body?.name,
      email: req.body?.email,
      staffRole: req.body?.staffRole || 'agent',
      permissions: req.body?.permissions,
      actorUser: req.user,
    });
    res.status(201).json({
      success: true,
      message: 'Staff invite created',
      ...result,
    });
  } catch (error) {
    console.error('[inviteSuperAdminAgencyStaff]', error.message);
    res.status(error.status || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed to invite staff',
      meta: error.meta,
    });
  }
};

export const updateSuperAdminAgencyStaff = async (req, res) => {
  try {
    const member = await updateStaffMember(req.params.id, req.params.memberId, {
      name: req.body?.name,
      staffRole: req.body?.staffRole,
      permissions: req.body?.permissions,
      accountStatus: req.body?.accountStatus,
      actorUser: req.user,
    });
    res.json({ success: true, member });
  } catch (error) {
    console.error('[updateSuperAdminAgencyStaff]', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to update staff',
    });
  }
};

export const removeSuperAdminAgencyStaff = async (req, res) => {
  try {
    const result = await removeStaffMember(req.params.id, req.params.memberId, {
      actorUser: req.user,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[removeSuperAdminAgencyStaff]', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to remove staff',
    });
  }
};

export default {
  listStaffRoles,
  getOwnerStaff,
  inviteOwnerStaff,
  updateOwnerStaff,
  removeOwnerStaff,
  getSuperAdminAgencyStaff,
  inviteSuperAdminAgencyStaff,
  updateSuperAdminAgencyStaff,
  removeSuperAdminAgencyStaff,
};
