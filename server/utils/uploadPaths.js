import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.join(__dirname, '..');

/** Resolve a public upload URL to a local filesystem path when stored under server/uploads */
export const resolveLocalUploadPath = (publicUrl) => {
  if (!publicUrl) return null;
  const base = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

  let rel = publicUrl;
  if (publicUrl.startsWith(base)) {
    rel = publicUrl.slice(base.length).replace(/^\//, '');
  } else if (publicUrl.startsWith('/uploads/')) {
    rel = publicUrl.replace(/^\//, '');
  } else if (!publicUrl.includes('://')) {
    rel = publicUrl.replace(/^\//, '');
  } else {
    return null;
  }

  const abs = path.join(SERVER_ROOT, rel.replace(/\//g, path.sep));
  return fs.existsSync(abs) ? abs : null;
};

/** Read logo file as data URI for reliable HTML/PDF embedding (mtime-aware cache). */
const dataUriCache = new Map();

export const logoToDataUri = (logoUrl) => {
  if (!logoUrl) return null;
  // Durable Mongo-stored assets and already-inlined images
  if (String(logoUrl).startsWith('data:image')) {
    return String(logoUrl);
  }
  const filePath = resolveLocalUploadPath(logoUrl);
  if (!filePath) return null;
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
  const cacheKey = `${filePath}|${mtimeMs}`;
  const cached = dataUriCache.get(cacheKey);
  if (cached) return cached;

  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const buf = fs.readFileSync(filePath);
  const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
  if (dataUriCache.size > 48) {
    const first = dataUriCache.keys().next().value;
    if (first) dataUriCache.delete(first);
  }
  dataUriCache.set(cacheKey, dataUri);
  return dataUri;
};

export default { resolveLocalUploadPath, logoToDataUri };
