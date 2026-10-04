import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_TMP = path.join(__dirname, '..', 'uploads', 'tmp');

/** Ensure upload temp dir exists on the same volume as permanent uploads */
export const ensureUploadTmpDir = () => {
  if (!fs.existsSync(UPLOAD_TMP)) fs.mkdirSync(UPLOAD_TMP, { recursive: true });
  return UPLOAD_TMP;
};

/**
 * Move a multer temp file to destPath.
 * Uses copy+unlink when rename fails (Windows EXDEV across drives).
 */
export const moveUploadedFile = (srcPath, destPath) => {
  if (!srcPath) throw new Error('Missing source file path');
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  try {
    fs.renameSync(srcPath, destPath);
  } catch (err) {
    if (err?.code === 'EXDEV') {
      fs.copyFileSync(srcPath, destPath);
      try { fs.unlinkSync(srcPath); } catch { /* ignore */ }
    } else {
      throw err;
    }
  }
  return destPath;
};

export default { ensureUploadTmpDir, moveUploadedFile };
