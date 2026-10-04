import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

/** Prefixes that require signed URL or owner-scoped JWT / superadmin */
const PROTECTED_PREFIXES = ['documents', 'contracts', 'templates', 'tmp'];

const hmacSecret = () => process.env.JWT_SECRET || 'dev';

/**
 * Create a time-limited signature for a path under /uploads.
 * relPath example: "documents/<ownerId>/files/contract.pdf"
 */
export const signUploadAccess = (relPath, expiresInSec = 60 * 60 * 24 * 7) => {
  const normalized = String(relPath || '').replace(/^\/+/, '').replace(/\\/g, '/');
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const sig = crypto
    .createHmac('sha256', hmacSecret())
    .update(`${normalized}:${exp}`)
    .digest('hex');
  return { path: normalized, exp, sig };
};

export const verifyUploadAccess = (relPath, exp, sig) => {
  const normalized = String(relPath || '').replace(/^\/+/, '').replace(/\\/g, '/');
  const expNum = Number(exp);
  if (!normalized || !sig || !Number.isFinite(expNum)) return false;
  if (expNum < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto
    .createHmac('sha256', hmacSecret())
    .update(`${normalized}:${expNum}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(sig)));
  } catch {
    return false;
  }
};

export const appendSignedQuery = (absoluteOrPublicUrl) => {
  if (!absoluteOrPublicUrl) return absoluteOrPublicUrl;
  try {
    const base = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
    const url = new URL(
      absoluteOrPublicUrl.startsWith('http')
        ? absoluteOrPublicUrl
        : `${base}${absoluteOrPublicUrl.startsWith('/') ? '' : '/'}${absoluteOrPublicUrl}`
    );
    const marker = '/uploads/';
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return absoluteOrPublicUrl;
    const rel = url.pathname.slice(idx + marker.length);
    const { exp, sig } = signUploadAccess(rel);
    url.searchParams.set('exp', String(exp));
    url.searchParams.set('sig', sig);
    return url.toString();
  } catch {
    return absoluteOrPublicUrl;
  }
};

const normalizeUploadRelPath = (rawPath) => {
  let decoded;
  try {
    decoded = decodeURIComponent(String(rawPath || ''));
  } catch {
    return null;
  }
  return decoded.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
};

const isProtectedUploadPath = (rel) => {
  if (!rel) return false;
  return PROTECTED_PREFIXES.some(
    (prefix) => rel === prefix || rel.startsWith(`${prefix}/`),
  );
};

/**
 * Owner JWT may only access paths namespaced under their own id.
 * Legacy flat trees (documents/files/*, templates/* without owner) require a signed URL.
 * Superadmin retains full access for support.
 */
export const ownerMayAccessUploadPath = (relNormalized, ownerId) => {
  if (!relNormalized || !ownerId) return false;
  const id = String(ownerId).toLowerCase();
  const prefixes = [
    `contracts/${id}/`,
    `documents/${id}/`,
    `templates/${id}/`,
    `tmp/${id}/`,
  ];
  return prefixes.some((p) => relNormalized.startsWith(p));
};

/**
 * Protect sensitive /uploads trees — requires signed query OR scoped owner/superadmin JWT.
 * Decodes percent-encoding before the prefix check (blocks /uploads/%64ocuments bypass).
 */
export const protectDocumentUploads = async (req, res, next) => {
  const relNormalized = normalizeUploadRelPath(req.path);
  if (relNormalized === null) {
    return res.status(400).json({ success: false, message: 'Bad path' });
  }
  if (!isProtectedUploadPath(relNormalized)) {
    return next();
  }

  // Verify signatures against the decoded relative path (same form used by express.static).
  let relForSig;
  try {
    relForSig = decodeURIComponent(String(req.path || '')).replace(/\\/g, '/').replace(/^\/+/, '');
  } catch {
    return res.status(400).json({ success: false, message: 'Bad path' });
  }

  const { sig, exp } = req.query;
  if (verifyUploadAccess(relForSig, exp, sig)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded?._id || decoded).select('role accountStatus tokenVersion');
      if (
        user &&
        ['owner', 'superadmin'].includes(user.role) &&
        (!user.accountStatus || user.accountStatus === 'active')
      ) {
        const tv = decoded.tv ?? 0;
        if ((user.tokenVersion || 0) === tv) {
          if (user.role === 'superadmin') {
            return next();
          }
          if (ownerMayAccessUploadPath(relNormalized, user._id)) {
            return next();
          }
        }
      }
    } catch {
      /* fall through */
    }
  }

  return res.status(401).json({ success: false, message: 'Document access denied' });
};

/** Safe send of a file under uploads (path traversal guard) */
export const resolveUploadFile = (relPath) => {
  const normalized = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  const absolute = path.join(UPLOADS_ROOT, normalized);
  if (!absolute.startsWith(UPLOADS_ROOT)) return null;
  if (!fs.existsSync(absolute)) return null;
  return absolute;
};

export default {
  signUploadAccess,
  verifyUploadAccess,
  appendSignedQuery,
  protectDocumentUploads,
  ownerMayAccessUploadPath,
};
