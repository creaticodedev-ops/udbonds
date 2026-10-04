import crypto from "crypto";

const TOKEN_BYTES = 32;
const DEFAULT_TTL_DAYS = 7;

export const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

export const generateCompletionToken = () => {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + (Number(process.env.COMPLETION_TOKEN_DAYS) || DEFAULT_TTL_DAYS) * 86400000),
  };
};

export const buildCompletionUrl = (token) => {
  const base = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");
  return `${base}/complete-booking/${token}`;
};

export const isTokenExpired = (expiresAt) => {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
};

export default {
  hashToken,
  generateCompletionToken,
  buildCompletionUrl,
  isTokenExpired,
};
