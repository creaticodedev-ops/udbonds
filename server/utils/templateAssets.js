import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanupUploadedFile } from '../middleware/multer.js';
import { moveUploadedFile } from './fileMove.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ASSET_ROOT = path.join(__dirname, '..', 'uploads', 'templates');
const MAX_INLINE_BYTES = 1.5 * 1024 * 1024;

const ownerSegment = (ownerId) => {
  const id = String(ownerId || '').trim();
  if (!id) return '_orphan';
  return id.replace(/[^a-fA-F0-9]/g, '') || '_orphan';
};

const templateDirForOwner = (ownerId) => path.join(TEMPLATE_ASSET_ROOT, ownerSegment(ownerId));

const ensureTemplateAssetDir = (ownerId) => {
  const dir = templateDirForOwner(ownerId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const mimeFromExt = (ext = '') => {
  const lower = String(ext).toLowerCase();
  if (lower === '.png') return 'image/png';
  if (lower === '.webp') return 'image/webp';
  if (lower === '.gif') return 'image/gif';
  if (lower === '.svg') return 'image/svg+xml';
  return 'image/jpeg';
};

/** Read a local image file as a data URI (for durable Mongo persistence). */
export const fileToDataUri = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_INLINE_BYTES) return null;
  const ext = path.extname(filePath);
  const buf = fs.readFileSync(filePath);
  return `data:${mimeFromExt(ext)};base64,${buf.toString('base64')}`;
};

/**
 * Persist a template logo/signature for production reliability:
 * 1) Prefer ImageKit CDN URL (survives deploys)
 * 2) Otherwise store a data URI in Mongo (survives ephemeral local disk)
 * Local files are still written when possible for admin preview convenience.
 *
 * Paths: uploads/templates/<ownerId>/<kind>-<templateId>.<ext>
 */
export const persistDurableTemplateAsset = async (templateId, uploadedFile, kind, opts = {}) => {
  if (!uploadedFile?.path) throw new Error('No uploaded file');

  const hasImageKit =
    process.env.IMAGEKIT_PUBLIC_KEY &&
    process.env.IMAGEKIT_PRIVATE_KEY &&
    process.env.IMAGEKIT_URL_ENDPOINT;

  if (hasImageKit) {
    const { storeDocumentImage } = await import('../services/documentStore.js');
    const url = await storeDocumentImage(uploadedFile, `/export-templates/${kind}`, {
      ownerId: opts.ownerId,
    });
    return { url, storage: 'imagekit' };
  }

  const dir = ensureTemplateAssetDir(opts.ownerId);
  const ext = path.extname(uploadedFile.originalname || '') || '.png';
  const safeExt = ext.includes('.') ? ext : '.png';
  const nonce = crypto.randomBytes(4).toString('hex');
  const fileName = `${kind}-${templateId}-${nonce}${safeExt}`;
  const destPath = path.join(dir, fileName);
  moveUploadedFile(uploadedFile.path, destPath);

  const dataUri = fileToDataUri(destPath);
  if (dataUri) {
    return { url: dataUri, storage: 'data-uri', localPath: destPath };
  }

  const seg = ownerSegment(opts.ownerId);
  const base = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  return {
    url: `${base}/uploads/templates/${seg}/${fileName}`,
    storage: 'local',
    localPath: destPath,
  };
};

export const clearLocalTemplateAsset = (templateId, kind, opts = {}) => {
  try {
    const dir = ensureTemplateAssetDir(opts.ownerId);
    if (!fs.existsSync(dir)) return;
    const prefix = `${kind}-${templateId}`;
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith(prefix)) {
        fs.unlinkSync(path.join(dir, name));
      }
    }
    // Legacy flat path (pre-P0)
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp', '.gif']) {
      const candidate = path.join(TEMPLATE_ASSET_ROOT, `${kind}-${templateId}${ext}`);
      if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
    }
  } catch (error) {
    console.warn('[templateAssets] clearLocalTemplateAsset:', error.message);
  }
};

export const cleanupFailedUpload = (file) => {
  try {
    cleanupUploadedFile(file);
  } catch {
    /* ignore */
  }
};

export default {
  persistDurableTemplateAsset,
  fileToDataUri,
  clearLocalTemplateAsset,
  cleanupFailedUpload,
};
