/**
 * Diagnose contract PDF generation (Admin path + signature embedding).
 * Usage: node --env-file=.env.example scripts/diagnose-contract-pdf.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { buildMongoUri } from '../configs/db.js';
import Booking from '../models/Booking.js';
import ExportTemplate from '../models/ExportTemplate.js';
import User from '../models/User.js';
import { ensureDefaultTemplates } from '../controllers/exportTemplateController.js';
import {
  getDefaultContractTemplate,
  resolveContractTemplate,
  resolveOwnerId,
} from '../utils/resolveExportTemplate.js';
import { generateContractPdf } from '../services/templatePdfExport.js';
import { storeDataUrlImage } from '../services/documentStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK:', msg);
};

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
console.log('Connecting…');
await mongoose.connect(buildMongoUri(uri));

try {
  const owner = await User.findOne({ role: 'owner' }).sort({ createdAt: 1 });
  assert(owner, 'Found owner account');

  await ensureDefaultTemplates(owner._id);
  await ensureDefaultTemplates(owner); // populated-style call
  const tplA = await getDefaultContractTemplate(owner._id);
  const tplB = await getDefaultContractTemplate(owner);
  assert(tplA, 'Default contract template by ObjectId');
  assert(tplB, 'Default contract template by populated owner');
  assert(String(tplA._id) === String(tplB._id), 'Same template for both owner forms');
  assert((tplA.bodyHtml || '').length > 20, 'Template has body HTML');

  const booking = await Booking.findOne({
    owner: owner._id,
    status: { $ne: 'cancelled' },
  })
    .sort({ createdAt: -1 })
    .populate('car')
    .populate('owner');

  assert(booking, 'Found a booking to generate against');
  console.log('Booking:', booking.reservationId, 'status:', booking.status);

  // Simulate signature URL shapes that break PDF img src construction
  const localFull =
    `${(process.env.API_PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '')}/uploads/documents/files/fake-sig.png`;
  booking.completion = booking.completion || {};
  booking.completion.signatureUrl = localFull;

  // Probe buildImageHtml via template variables path — import side effect through generate
  const template = await resolveContractTemplate(owner._id);
  assert(template, 'resolveContractTemplate returns default');

  console.log('Generating Admin-style PDF…');
  const adminPdf = await generateContractPdf({
    template,
    booking: booking.toObject(),
    contractNumber: `TEST-ADMIN-${Date.now().toString().slice(-6)}`,
    owner,
    includeCompanyStamp: true,
  });
  assert(fs.existsSync(adminPdf.filePath), 'Admin PDF file exists');
  assert(fs.statSync(adminPdf.filePath).size > 1000, 'Admin PDF has content');
  console.log('Admin PDF:', adminPdf.filePath, 'bytes:', fs.statSync(adminPdf.filePath).size);

  // Real signature storage path (ImageKit or local)
  console.log('Storing test signature…');
  let sigUrl;
  try {
    sigUrl = await storeDataUrlImage(tinyPng, `diag-sig-${Date.now()}.png`);
  } catch (e) {
    console.warn('storeDataUrlImage failed, using synthetic local URL:', e.message);
    const dir = path.join(__dirname, '..', 'uploads', 'documents', 'files');
    fs.mkdirSync(dir, { recursive: true });
    const name = `diag-sig-${Date.now()}.png`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(tinyPng.split(',')[1], 'base64'));
    const base = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
    sigUrl = `${base}/uploads/documents/files/${name}`;
  }
  console.log('Signature URL:', sigUrl);

  booking.completion.signatureUrl = sigUrl;
  booking.completion.signatureSignedAt = new Date();
  booking.completion.signatureComplete = true;
  booking.completion.documentsComplete = true;

  console.log('Generating signature-complete PDF…');
  const signedPdf = await generateContractPdf({
    template,
    booking: booking.toObject(),
    contractNumber: `TEST-SIGN-${Date.now().toString().slice(-6)}`,
    owner: booking.owner || owner,
    includeCompanyStamp: true,
  });
  assert(fs.existsSync(signedPdf.filePath), 'Signed PDF file exists');
  assert(fs.statSync(signedPdf.filePath).size > 1000, 'Signed PDF has content');
  assert(
    signedPdf.renderedHtml.includes('Customer signature') ||
      signedPdf.renderedHtml.includes('signature') ||
      signedPdf.variables?.customer_signature_html,
    'Rendered HTML includes signature markup',
  );
  console.log('Signed PDF:', signedPdf.filePath, 'bytes:', fs.statSync(signedPdf.filePath).size);
  console.log('customer_signature_html preview:', String(signedPdf.variables?.customer_signature_html || '').slice(0, 180));

  console.log('\nALL DIAGNOSTICS PASSED');
} catch (err) {
  console.error('\nDIAGNOSTIC FAILED:', err.message);
  console.error(err.stack);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
