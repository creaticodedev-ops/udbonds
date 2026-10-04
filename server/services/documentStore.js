import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getImageKit } from "../configs/imageKit.js";
import { cleanupUploadedFile } from "../middleware/multer.js";
import { moveUploadedFile } from "../utils/fileMove.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ownerSegment = (ownerId) => {
  const id = String(ownerId || "").trim();
  if (!id) return "_orphan";
  // Prevent path traversal via crafted owner ids
  return id.replace(/[^a-fA-F0-9]/g, "") || "_orphan";
};

/**
 * Upload image to ImageKit when configured; otherwise store locally under /uploads.
 * Local paths are namespaced: uploads/documents/<ownerId>/files/<file>
 *
 * @param {object} file multer file
 * @param {string} folder ImageKit folder hint
 * @param {{ ownerId?: string|import('mongoose').Types.ObjectId }} [opts]
 */
export const storeDocumentImage = async (file, folder = "/booking-docs", opts = {}) => {
  console.log('[STORE_DOC_IMAGE] Storing image, folder:', folder, 'file:', file?.originalname);
  if (!file?.path) throw new Error("No file provided");

  const imagekit = getImageKit();
  console.log('[STORE_DOC_IMAGE] ImageKit available:', !!imagekit);

  if (imagekit) {
    try {
      const fileBuffer = fs.readFileSync(file.path);
      const response = await imagekit.upload({
        file: fileBuffer,
        fileName: file.originalname || `doc-${Date.now()}.jpg`,
        folder,
      });
      cleanupUploadedFile(file);
      return imagekit.url({
        path: response.filePath,
        transformation: [{ width: "1600" }, { quality: "auto" }],
      });
    } catch (error) {
      console.error("ImageKit document upload failed, falling back to local:", error.message);
    }
  }

  const seg = ownerSegment(opts.ownerId);
  const reservationFolder = path.join(__dirname, "..", "uploads", "documents", seg, "files");
  if (!fs.existsSync(reservationFolder)) fs.mkdirSync(reservationFolder, { recursive: true });
  const ext = path.extname(file.originalname || "") || ".jpg";
  const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  const dest = path.join(reservationFolder, name);
  console.log('[STORE_DOC_IMAGE] Moving file from', file.path, 'to', dest);
  moveUploadedFile(file.path, dest);

  const base = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");
  const url = `${base}/uploads/documents/${seg}/files/${name}`;
  console.log('[STORE_DOC_IMAGE] Returning URL:', url);
  return url;
};

export const storeDataUrlImage = async (dataUrl, fileName = "signature.png", opts = {}) => {
  console.log('[STORE_DATA_URL] Storing image:', fileName);
  if (!dataUrl?.startsWith("data:image")) throw new Error("Invalid image data");
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid data URL");
  console.log('[STORE_DATA_URL] Decoded data URL, buffer size:', matches[2].length);
  const buffer = Buffer.from(matches[2], "base64");
  const tmpDir = path.join(__dirname, "..", "uploads", "tmp", ownerSegment(opts.ownerId));
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `${Date.now()}-${fileName}`);
  fs.writeFileSync(tmpPath, buffer);
  console.log('[STORE_DATA_URL] Written to temp:', tmpPath);
  const fakeFile = { path: tmpPath, originalname: fileName };
  const result = await storeDocumentImage(fakeFile, "/booking-signatures", opts);
  console.log('[STORE_DATA_URL] Final URL returned:', result);
  return result;
};

export default { storeDocumentImage, storeDataUrlImage };
