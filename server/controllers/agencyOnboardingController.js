import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Agency from '../models/Agency.js';
import { cleanupUploadedFile } from '../middleware/multer.js';
import {
  hashInviteToken,
  isInviteExpired,
} from '../services/agencyInviteToken.js';
import {
  getOrCreateAgencySettings,
  updateWhatsAppSettings,
  serializeAgencySettings,
} from '../services/agencySettingsService.js';
import { serializeLicense, syncLicenseStatus } from '../services/licenseService.js';
import { syncOwnerPermissions } from '../utils/ownerPermissions.js';
import { persistDurableTemplateAsset } from '../utils/templateAssets.js';

const generateToken = (user) =>
  jwt.sign(
    { _id: user._id.toString(), tv: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );

const publicInvitePayload = (user, agency) => ({
  ownerName: user.name,
  ownerEmail: user.email,
  agencyName: agency.name,
  agencySlug: agency.slug,
  logoUrl: agency.logoUrl || '',
  phone: agency.phone || '',
  whatsapp: agency.whatsapp || '',
  address: agency.address || '',
  city: agency.city || '',
  country: agency.country || '',
  inviteExpiresAt: user.inviteExpiresAt,
  passwordAlreadySet: Boolean(user.passwordSetAt),
});

const findInviteUser = async (rawToken) => {
  const token = String(rawToken || '').trim();
  if (!token || token.length < 32) return { error: 'INVALID' };
  const tokenHash = hashInviteToken(token);
  const user = await User.findOne({ inviteTokenHash: tokenHash, role: 'owner' });
  if (!user) return { error: 'INVALID' };
  if (user.inviteUsedAt) return { error: 'USED', user };
  if (isInviteExpired(user.inviteExpiresAt)) return { error: 'EXPIRED', user };
  if (user.accountStatus === 'suspended' || user.accountStatus === 'disabled') {
    return { error: 'LOCKED', user };
  }
  const agency = user.agencyId ? await Agency.findById(user.agencyId) : null;
  if (!agency) return { error: 'INVALID', user };
  if (agency.status === 'suspended' || agency.status === 'disabled') {
    return { error: 'LOCKED', user, agency };
  }
  return { user, agency };
};

export const getInvitePreview = async (req, res) => {
  try {
    const result = await findInviteUser(req.params.token);
    if (result.error === 'USED') {
      return res.status(410).json({
        success: false,
        code: 'INVITE_USED',
        message: 'This invitation link has already been used. Sign in to continue setup if needed.',
      });
    }
    if (result.error === 'EXPIRED') {
      return res.status(410).json({
        success: false,
        code: 'INVITE_EXPIRED',
        message: 'This invitation link has expired. Ask your platform admin for a new link.',
      });
    }
    if (result.error === 'LOCKED') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'This agency account has been suspended or disabled',
      });
    }
    if (result.error || !result.user || !result.agency) {
      return res.status(404).json({
        success: false,
        code: 'INVITE_INVALID',
        message: 'Invalid invitation link',
      });
    }

    res.json({
      success: true,
      invite: publicInvitePayload(result.user, result.agency),
    });
  } catch (error) {
    console.error('[getInvitePreview]', error.message);
    res.status(500).json({ success: false, message: 'Failed to verify invitation' });
  }
};

export const setPasswordFromInvite = async (req, res) => {
  try {
    const { password, name } = req.body || {};
    if (!password || String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const result = await findInviteUser(req.params.token);
    if (result.error === 'USED') {
      return res.status(410).json({
        success: false,
        code: 'INVITE_USED',
        message: 'This invitation link has already been used',
      });
    }
    if (result.error === 'EXPIRED') {
      return res.status(410).json({
        success: false,
        code: 'INVITE_EXPIRED',
        message: 'This invitation link has expired',
      });
    }
    if (result.error === 'LOCKED') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'This agency account has been suspended or disabled',
      });
    }
    if (result.error || !result.user || !result.agency) {
      return res.status(404).json({
        success: false,
        code: 'INVITE_INVALID',
        message: 'Invalid invitation link',
      });
    }

    const user = result.user;
    const agency = result.agency;

    if (name !== undefined && String(name).trim()) {
      user.name = String(name).trim();
    }

    user.password = await bcrypt.hash(String(password), 10);
    user.passwordSetAt = new Date();
    user.inviteUsedAt = new Date();
    // Keep inviteTokenHash so reused links resolve to INVITE_USED (not a silent 404).
    // Resend-invite replaces the hash, which invalidates this token.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.accountStatus = 'pending';
    await user.save();

    // Never log password
    const token = generateToken(user);
    res.json({
      success: true,
      message: 'Password saved. Continue agency setup.',
      token,
      onboardingRequired: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        agencyId: user.agencyId,
        agencyName: user.agencyName,
        passwordSetAt: user.passwordSetAt,
      },
      agency: {
        _id: agency._id,
        name: agency.name,
        slug: agency.slug,
        status: agency.status,
      },
    });
  } catch (error) {
    console.error('[setPasswordFromInvite]', error.message);
    res.status(500).json({ success: false, message: 'Failed to set password' });
  }
};

export const getOnboardingSession = async (req, res) => {
  try {
    const user = req.user;
    const agency = req.agency;
    if (!user?._id || !agency?._id || !req.agencyId) {
      return res.status(403).json({
        success: false,
        code: 'ONBOARDING_FORBIDDEN',
        message: 'Onboarding session required',
      });
    }
    const settings = await serializeAgencySettings(
      req.agencyLegacyOwnerId,
      await getOrCreateAgencySettings(req.agencyLegacyOwnerId, req.agencyId),
      req.agencyId,
    );

    res.json({
      success: true,
      onboardingRequired: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        agencyId: user.agencyId,
        agencyName: user.agencyName,
        passwordSetAt: user.passwordSetAt,
      },
      agency: {
        _id: agency._id,
        name: agency.name,
        slug: agency.slug,
        status: agency.status,
        logoUrl: agency.logoUrl || '',
        phone: agency.phone || '',
        whatsapp: agency.whatsapp || '',
        address: agency.address || '',
        city: agency.city || '',
        country: agency.country || '',
        primaryBrandColor: agency.primaryBrandColor || '',
        contractBranding: agency.contractBranding || {},
      },
      settings: {
        whatsappReservationNumber: settings.whatsappReservationNumber || '',
        whatsappConfirmationNumber: settings.whatsappConfirmationNumber || '',
      },
    });
  } catch (error) {
    console.error('[getOnboardingSession]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load onboarding session' });
  }
};

export const updateOnboardingSession = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const agency = await Agency.findById(req.agencyId);
    if (!user || !agency) {
      return res.status(404).json({ success: false, message: 'Onboarding session not found' });
    }

    const body = req.body || {};

    if (body.ownerName !== undefined && String(body.ownerName).trim()) {
      user.name = String(body.ownerName).trim();
    }

    if (body.agencyName !== undefined && String(body.agencyName).trim()) {
      agency.name = String(body.agencyName).trim();
      user.agencyName = agency.name;
    }
    if (body.logoUrl !== undefined) agency.logoUrl = String(body.logoUrl || '').trim();
    if (body.phone !== undefined) agency.phone = String(body.phone || '').trim();
    if (body.whatsapp !== undefined) agency.whatsapp = String(body.whatsapp || '').trim();
    if (body.address !== undefined) agency.address = String(body.address || '').trim();
    if (body.city !== undefined) agency.city = String(body.city || '').trim();
    if (body.country !== undefined) agency.country = String(body.country || '').trim();
    if (body.primaryBrandColor !== undefined) {
      agency.primaryBrandColor = String(body.primaryBrandColor || '').trim();
    }
    if (body.contractBranding && typeof body.contractBranding === 'object') {
      const cb = body.contractBranding;
      agency.contractBranding = {
        companyName:
          cb.companyName !== undefined
            ? String(cb.companyName || '').trim()
            : agency.contractBranding?.companyName || '',
        logoUrl:
          cb.logoUrl !== undefined
            ? String(cb.logoUrl || '').trim()
            : agency.contractBranding?.logoUrl || '',
        showLogoOnPdf:
          cb.showLogoOnPdf !== undefined
            ? Boolean(cb.showLogoOnPdf)
            : agency.contractBranding?.showLogoOnPdf !== false,
        footerNote:
          cb.footerNote !== undefined
            ? String(cb.footerNote || '').trim().slice(0, 500)
            : agency.contractBranding?.footerNote || '',
      };
      if (!agency.contractBranding.logoUrl && agency.logoUrl) {
        agency.contractBranding.logoUrl = agency.logoUrl;
      }
      if (!agency.contractBranding.companyName) {
        agency.contractBranding.companyName = agency.name;
      }
    }

    await agency.save();
    await user.save();

    if (
      body.whatsappReservationNumber !== undefined ||
      body.whatsappConfirmationNumber !== undefined ||
      body.whatsapp !== undefined
    ) {
      const wa = body.whatsapp !== undefined ? String(body.whatsapp || '').trim() : undefined;
      await updateWhatsAppSettings(
        req.agencyLegacyOwnerId,
        {
          whatsappReservationNumber:
            body.whatsappReservationNumber !== undefined
              ? body.whatsappReservationNumber
              : wa,
          whatsappConfirmationNumber:
            body.whatsappConfirmationNumber !== undefined
              ? body.whatsappConfirmationNumber
              : wa,
        },
        req.agencyId,
      );
    }

    res.json({
      success: true,
      message: 'Saved',
      agency: {
        _id: agency._id,
        name: agency.name,
        slug: agency.slug,
        status: agency.status,
        logoUrl: agency.logoUrl,
        phone: agency.phone,
        whatsapp: agency.whatsapp,
        address: agency.address,
        city: agency.city,
        country: agency.country,
        primaryBrandColor: agency.primaryBrandColor,
        contractBranding: agency.contractBranding,
      },
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        agencyName: user.agencyName,
      },
    });
  } catch (error) {
    console.error('[updateOnboardingSession]', error.message);
    res.status(500).json({ success: false, message: 'Failed to save onboarding data' });
  }
};

export const uploadOnboardingLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Logo file is required' });
    }
    const agency = await Agency.findById(req.agencyId);
    if (!agency) {
      cleanupUploadedFile(req.file);
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const kind = req.body?.kind === 'contract' ? 'contract-logo' : 'agency-logo';
    const stored = await persistDurableTemplateAsset(
      String(agency._id),
      req.file,
      kind,
      { ownerId: req.agencyLegacyOwnerId },
    );

    if (kind === 'contract-logo') {
      agency.contractBranding = {
        ...(agency.contractBranding?.toObject?.() || agency.contractBranding || {}),
        logoUrl: stored.url,
        companyName: agency.contractBranding?.companyName || agency.name,
        showLogoOnPdf: agency.contractBranding?.showLogoOnPdf !== false,
        footerNote: agency.contractBranding?.footerNote || '',
      };
    } else {
      agency.logoUrl = stored.url;
      if (!agency.contractBranding?.logoUrl) {
        agency.contractBranding = {
          ...(agency.contractBranding?.toObject?.() || agency.contractBranding || {}),
          logoUrl: stored.url,
          companyName: agency.contractBranding?.companyName || agency.name,
          showLogoOnPdf: agency.contractBranding?.showLogoOnPdf !== false,
          footerNote: agency.contractBranding?.footerNote || '',
        };
      }
    }
    await agency.save();

    res.json({
      success: true,
      logoUrl: stored.url,
      agency: {
        logoUrl: agency.logoUrl,
        contractBranding: agency.contractBranding,
      },
    });
  } catch (error) {
    cleanupUploadedFile(req.file);
    console.error('[uploadOnboardingLogo]', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload logo' });
  }
};

export const completeOnboarding = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const agency = await Agency.findById(req.agencyId);
    if (!user || !agency) {
      return res.status(404).json({ success: false, message: 'Onboarding session not found' });
    }

    if (agency.status === 'suspended' || agency.status === 'disabled') {
      return res.status(403).json({
        success: false,
        code: 'AGENCY_LOCKED',
        message: 'This agency has been suspended or disabled',
      });
    }

    // Apply any final body fields before activation
    const body = req.body || {};
    if (body.agencyName) {
      agency.name = String(body.agencyName).trim();
      user.agencyName = agency.name;
    }
    if (body.ownerName) user.name = String(body.ownerName).trim();
    if (body.phone !== undefined) agency.phone = String(body.phone || '').trim();
    if (body.whatsapp !== undefined) agency.whatsapp = String(body.whatsapp || '').trim();
    if (body.address !== undefined) agency.address = String(body.address || '').trim();
    if (body.city !== undefined) agency.city = String(body.city || '').trim();
    if (body.country !== undefined) agency.country = String(body.country || '').trim();
    if (body.primaryBrandColor !== undefined) {
      agency.primaryBrandColor = String(body.primaryBrandColor || '').trim();
    }
    if (body.logoUrl !== undefined) agency.logoUrl = String(body.logoUrl || '').trim();
    if (body.contractBranding && typeof body.contractBranding === 'object') {
      agency.contractBranding = {
        companyName: String(body.contractBranding.companyName || agency.name).trim(),
        logoUrl: String(body.contractBranding.logoUrl || agency.logoUrl || '').trim(),
        showLogoOnPdf: body.contractBranding.showLogoOnPdf !== false,
        footerNote: String(body.contractBranding.footerNote || '').trim().slice(0, 500),
      };
    }
    if (!agency.contractBranding?.companyName) {
      agency.contractBranding = {
        ...(agency.contractBranding?.toObject?.() || agency.contractBranding || {}),
        companyName: agency.name,
      };
    }

    const now = new Date();
    agency.status = 'active';
    agency.onboardingCompletedAt = now;
    user.accountStatus = 'active';
    user.onboardingCompletedAt = now;
    user.agencyName = agency.name;
    user.lastLoginAt = now;

    await agency.save();
    await user.save();

    if (agency.whatsapp || body.whatsappReservationNumber || body.whatsappConfirmationNumber) {
      const wa = agency.whatsapp;
      await updateWhatsAppSettings(
        req.agencyLegacyOwnerId,
        {
          whatsappReservationNumber: body.whatsappReservationNumber ?? wa,
          whatsappConfirmationNumber: body.whatsappConfirmationNumber ?? wa,
        },
        req.agencyId,
      );
    }

    await syncLicenseStatus(user);
    await syncOwnerPermissions(user);
    await user.save();

    const token = generateToken(user);
    res.json({
      success: true,
      message: 'Agency is ready',
      token,
      onboardingRequired: false,
      license: serializeLicense(user),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        agencyId: user.agencyId,
        agencyName: user.agencyName,
      },
      agency: {
        _id: agency._id,
        name: agency.name,
        slug: agency.slug,
        status: agency.status,
        onboardingCompletedAt: agency.onboardingCompletedAt,
      },
      redirectTo: '/owner',
    });
  } catch (error) {
    console.error('[completeOnboarding]', error.message);
    res.status(500).json({ success: false, message: 'Failed to complete onboarding' });
  }
};

/** Used by tests / ops — not mounted publicly. */
export const __test = {
  findInviteUser,
  hashInviteToken,
  generateUnusablePasswordHash: async () =>
    bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
};

export default {
  getInvitePreview,
  setPasswordFromInvite,
  getOnboardingSession,
  updateOnboardingSession,
  uploadOnboardingLogo,
  completeOnboarding,
};
