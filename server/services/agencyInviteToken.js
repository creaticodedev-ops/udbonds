import crypto from 'crypto';

const TOKEN_BYTES = 32;
const DEFAULT_TTL_DAYS = 7;

export const hashInviteToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

export const generateInviteToken = () => {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const ttlDays = Number(process.env.ONBOARDING_TOKEN_DAYS) || DEFAULT_TTL_DAYS;
  return {
    token,
    tokenHash: hashInviteToken(token),
    expiresAt: new Date(Date.now() + ttlDays * 86400000),
  };
};

export const buildOnboardingUrl = (token) => {
  const base = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');
  return `${base}/activate-account/${token}`;
};

export const buildStaffInviteUrl = (token) => {
  const base = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');
  return `${base}/activate-staff/${token}`;
};

export const isInviteExpired = (expiresAt) => {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
};

export default {
  hashInviteToken,
  generateInviteToken,
  buildOnboardingUrl,
  buildStaffInviteUrl,
  isInviteExpired,
};
