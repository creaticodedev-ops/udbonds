import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { findStaffInviteUser, sanitizeStaffMember } from '../services/staffService.js';
import Agency from '../models/Agency.js';

const signToken = (user) =>
  jwt.sign(
    { _id: user._id, tv: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );

export const getStaffInvitePreview = async (req, res) => {
  try {
    const { user, error } = await findStaffInviteUser(req.params.token);
    if (error === 'INVALID') {
      return res.status(404).json({ success: false, code: 'INVALID', message: 'Invite not found' });
    }
    if (error === 'USED') {
      return res.status(410).json({ success: false, code: 'USED', message: 'Invite already used' });
    }
    if (error === 'EXPIRED') {
      return res.status(410).json({ success: false, code: 'EXPIRED', message: 'Invite expired' });
    }
    if (error === 'LOCKED') {
      return res.status(403).json({ success: false, code: 'LOCKED', message: 'Account locked' });
    }

    const agency = user.agencyId
      ? await Agency.findById(user.agencyId).select('name slug status').lean()
      : null;

    res.json({
      success: true,
      invite: {
        name: user.name,
        email: user.email,
        staffRole: user.staffRole || 'agent',
        agencyName: agency?.name || user.agencyName || '',
        agencySlug: agency?.slug || '',
        expiresAt: user.inviteExpiresAt,
      },
    });
  } catch (error) {
    console.error('[getStaffInvitePreview]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load invite' });
  }
};

export const activateStaffFromInvite = async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const { user, error } = await findStaffInviteUser(req.params.token);
    if (error === 'INVALID') {
      return res.status(404).json({ success: false, code: 'INVALID', message: 'Invite not found' });
    }
    if (error === 'USED') {
      return res.status(410).json({ success: false, code: 'USED', message: 'Invite already used' });
    }
    if (error === 'EXPIRED') {
      return res.status(410).json({ success: false, code: 'EXPIRED', message: 'Invite expired' });
    }
    if (error === 'LOCKED') {
      return res.status(403).json({ success: false, code: 'LOCKED', message: 'Account locked' });
    }

    const agency = user.agencyId ? await Agency.findById(user.agencyId).lean() : null;
    if (!agency || agency.status !== 'active') {
      return res.status(403).json({
        success: false,
        code: 'AGENCY_LOCKED',
        message: 'Agency is not active',
      });
    }

    user.password = await bcrypt.hash(String(password), 10);
    user.passwordSetAt = new Date();
    user.inviteUsedAt = new Date();
    user.accountStatus = 'active';
    user.onboardingCompletedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);
    res.json({
      success: true,
      message: 'Staff account activated',
      token,
      user: sanitizeStaffMember(user),
      redirectTo: '/owner',
    });
  } catch (error) {
    console.error('[activateStaffFromInvite]', error.message);
    res.status(500).json({ success: false, message: 'Failed to activate staff account' });
  }
};

export default { getStaffInvitePreview, activateStaffFromInvite };
