import { protect } from './auth.js';
import Agency from '../models/Agency.js';

/**
 * Allows pending owners who have set a password to continue the setup wizard.
 * Blocks normal dashboard access (requireOwner still requires accountStatus=active).
 */
export const requireOnboardingSession = [
  protect,
  async (req, res, next) => {
    try {
      const user = req.user;
      if (!user || user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          code: 'ONBOARDING_FORBIDDEN',
          message: 'Owner onboarding session required',
        });
      }

      if (user.accountStatus === 'suspended' || user.accountStatus === 'disabled') {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_LOCKED',
          message: 'This admin account has been suspended or disabled',
        });
      }

      if (user.accountStatus !== 'pending') {
        return res.status(403).json({
          success: false,
          code: 'ONBOARDING_NOT_REQUIRED',
          message: 'Onboarding is not required for this account',
        });
      }

      if (!user.passwordSetAt) {
        return res.status(403).json({
          success: false,
          code: 'PASSWORD_NOT_SET',
          message: 'Set your password via the invitation link first',
        });
      }

      if (!user.agencyId) {
        return res.status(500).json({
          success: false,
          code: 'AGENCY_CONTEXT_MISSING',
          message: 'Agency context missing for this account',
        });
      }

      const agency = await Agency.findById(user.agencyId).lean();
      if (!agency) {
        return res.status(500).json({
          success: false,
          code: 'AGENCY_CONTEXT_MISSING',
          message: 'Agency not found for this account',
        });
      }

      if (agency.status === 'suspended' || agency.status === 'disabled') {
        return res.status(403).json({
          success: false,
          code: 'AGENCY_LOCKED',
          message: 'This agency has been suspended or disabled',
        });
      }

      if (agency.status !== 'pending' && !agency.onboardingCompletedAt) {
        // Defensive: treat non-pending incomplete as still onboardable only if pending
      }

      if (agency.onboardingCompletedAt || user.onboardingCompletedAt) {
        return res.status(403).json({
          success: false,
          code: 'ONBOARDING_ALREADY_COMPLETE',
          message: 'Onboarding already completed',
        });
      }

      if (agency.status !== 'pending') {
        return res.status(403).json({
          success: false,
          code: 'AGENCY_LOCKED',
          message: 'Agency is not awaiting onboarding',
        });
      }

      req.agency = agency;
      req.agencyId = agency._id;
      req.agencyLegacyOwnerId = agency.legacyOwnerId || agency.primaryOwnerUserId || user._id;
      return next();
    } catch (error) {
      console.error('[onboardingAuth]', error.message);
      return res.status(500).json({ success: false, message: 'Onboarding auth failed' });
    }
  },
];

export default requireOnboardingSession;
