/**
 * Offline contract PDF smoke test (no MongoDB).
 * Validates Admin-style generation + signature image embedding/PDF render.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateContractPdf } from '../services/templatePdfExport.js';
import {
  DEFAULT_CONTRACT_BODY,
  DEFAULT_CONTRACT_HEADER,
  DEFAULT_CONTRACT_FOOTER,
  DEFAULT_CONTRACT_CUSTOM_CSS,
  DEFAULT_CONTRACT_TERMS_HTML,
} from '../services/defaultTemplates.js';
import { logoToDataUri, resolveLocalUploadPath } from '../utils/uploadPaths.js';
import { appendSignedQuery } from '../middleware/uploadAccess.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'uploads', 'contracts', '_diag');

const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK:', msg);
};

fs.mkdirSync(OUT, { recursive: true });

// Create a real local signature file under protected documents path
const docsDir = path.join(__dirname, '..', 'uploads', 'documents', 'files');
fs.mkdirSync(docsDir, { recursive: true });
const sigName = `offline-sig-${Date.now()}.png`;
const sigPath = path.join(docsDir, sigName);
fs.writeFileSync(sigPath, Buffer.from(tinyPng.split(',')[1], 'base64'));

process.env.API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'http://localhost:3000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'diag-test-secret-at-least-32-characters!!';
const base = process.env.API_PUBLIC_URL.replace(/\/$/, '');
const fullSigUrl = `${base}/uploads/documents/files/${sigName}`;
const relativeSigUrl = `/uploads/documents/files/${sigName}`;

console.log('Testing local path resolution…');
assert(Boolean(resolveLocalUploadPath(fullSigUrl)), 'resolveLocalUploadPath full URL');
assert(Boolean(resolveLocalUploadPath(relativeSigUrl)), 'resolveLocalUploadPath relative URL');
assert(Boolean(logoToDataUri(fullSigUrl)), 'logoToDataUri embeds local signature');

const signed = appendSignedQuery(fullSigUrl);
assert(signed.includes('exp=') && signed.includes('sig='), 'appendSignedQuery adds auth params');
assert(!signed.startsWith(`${base}${base}`), 'appendSignedQuery does not double-prefix base');

// Reproduce buggy pattern currently in buildImageHtml
const buggy = `${base}${fullSigUrl}?exp=1&sig=abc`;
assert(buggy.startsWith(`${base}${base}`) || buggy.includes(`${base}http`), 'Current buggy concat doubles base (reproduced)');

const template = {
  _id: 'tmpl1',
  name: 'Diag Contract',
  type: 'contract',
  systemKey: 'builtin_contract',
  headerHtml: DEFAULT_CONTRACT_HEADER,
  bodyHtml: DEFAULT_CONTRACT_BODY,
  termsHtml: DEFAULT_CONTRACT_TERMS_HTML,
  footerHtml: DEFAULT_CONTRACT_FOOTER,
  customCss: DEFAULT_CONTRACT_CUSTOM_CSS,
  pageSize: 'A4',
  logoUrl: '',
  companySignatureUrl: '',
};

const owner = { _id: 'diagowner', businessName: 'Diag Agency', email: 'diag@test.com', phone: '0600000000' };

const bookingBase = {
  _id: 'diagbooking',
  reservationId: 'RES-DIAGTEST',
  customerName: 'Diag Customer',
  customerEmail: 'customer@test.com',
  customerPhone: '+212600000000',
  nationality: 'Marocaine',
  dateOfBirth: '1990-01-01',
  customerAddress: '1 Test St',
  pickupDate: new Date('2026-08-10T10:00:00Z'),
  returnDate: new Date('2026-08-12T10:00:00Z'),
  pickupLocation: 'Casablanca Airport',
  returnLocation: 'Casablanca Airport',
  price: 900,
  paymentStatus: 'pending',
  channel: 'whatsapp',
  car: { brand: 'Dacia', model: 'Logan', year: 2024, licensePlate: '12345-A-6', category: 'Economy' },
  priceBreakdown: { rentalPrice: 900, pickupDeliveryFee: 0, dropoffDeliveryFee: 0, discountTotal: 0, days: 2 },
  completion: {},
};

console.log('\n1) Admin generate (no signature)…');
const admin = await generateContractPdf({
  template,
  booking: bookingBase,
  contractNumber: 'CTR-DIAG-ADMIN',
  owner,
  includeCompanyStamp: true,
});
assert(fs.existsSync(admin.filePath), 'Admin PDF written');
assert(fs.statSync(admin.filePath).size > 1500, `Admin PDF size ok (${fs.statSync(admin.filePath).size})`);

console.log('\n2) Customer signature finalize PDF (full absolute upload URL)…');
const signedBooking = {
  ...bookingBase,
  completion: {
    signatureUrl: fullSigUrl,
    signatureSignedAt: new Date(),
    signatureComplete: true,
    documentsComplete: true,
  },
};
const signedPdf = await generateContractPdf({
  template,
  booking: signedBooking,
  contractNumber: 'CTR-DIAG-SIGN',
  owner,
  includeCompanyStamp: true,
});
assert(fs.existsSync(signedPdf.filePath), 'Signed PDF written');
assert(fs.statSync(signedPdf.filePath).size > 1500, `Signed PDF size ok (${fs.statSync(signedPdf.filePath).size})`);

const sigHtml = String(signedPdf.variables?.customer_signature_html || '');
console.log('signature html:', sigHtml.slice(0, 220));
assert(sigHtml.includes('<img'), 'Signature variable contains img tag');

// Detect broken double-base src if present
if (sigHtml.includes(`${base}http`)) {
  console.error('BUG CONFIRMED: signature img src has doubled base URL');
  process.exitCode = 1;
} else if (sigHtml.startsWith('<img') && sigHtml.includes('src="data:')) {
  console.log('OK: signature embedded as data URI (best path)');
} else {
  console.log('INFO: signature uses network URL:', sigHtml.match(/src="([^"]+)"/)?.[1]?.slice(0, 120));
}

console.log('\nOffline smoke finished');
console.log('Admin PDF:', admin.filePath);
console.log('Signed PDF:', signedPdf.filePath);
