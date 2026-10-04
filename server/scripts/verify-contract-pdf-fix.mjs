/**
 * Full offline verification of contract PDF after signature-image fix.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateContractPdf } from '../services/templatePdfExport.js';
import { buildTemplateVariables } from '../services/templateEngine.js';
import {
  DEFAULT_CONTRACT_BODY,
  DEFAULT_CONTRACT_HEADER,
  DEFAULT_CONTRACT_FOOTER,
  DEFAULT_CONTRACT_CUSTOM_CSS,
  DEFAULT_CONTRACT_TERMS_HTML,
} from '../services/defaultTemplates.js';
import { appendSignedQuery } from '../middleware/uploadAccess.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK:', msg);
};

process.env.API_PUBLIC_URL = 'https://other-host.example.com';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'diag-test-secret-at-least-32-characters!!';

const docsDir = path.join(__dirname, '..', 'uploads', 'documents', 'files');
fs.mkdirSync(docsDir, { recursive: true });
const missingHostUrl = 'https://other-host.example.com/uploads/documents/files/does-not-exist-locally.png';

console.log('1) Previously crashing path (remote host, /uploads/documents)…');
const vars = buildTemplateVariables(
  {
    reservationId: 'RES-FIX',
    customerName: 'Fixed Customer',
    completion: { signatureUrl: missingHostUrl },
    car: { brand: 'Dacia', model: 'Logan', year: 2024 },
  },
  { contractNumber: 'CTR-FIX', owner: { _id: 'ownerfix' }, template: {} },
);
assert(typeof vars.customer_signature_html === 'string', 'buildTemplateVariables no longer throws');
assert(vars.customer_signature_html.includes('<img'), 'signature html still produced');
assert(!vars.customer_signature_html.includes('https://other-host.example.comhttps://'), 'no doubled host');
const signed = appendSignedQuery(missingHostUrl);
assert(signed.includes('exp=') && signed.includes('sig='), 'appendSignedQuery works');
assert(vars.customer_signature_html.includes('exp=') || vars.customer_signature_html.includes('sig='), 'protected src is signed');

const template = {
  name: 'Fix Contract',
  type: 'contract',
  systemKey: 'builtin_contract',
  headerHtml: DEFAULT_CONTRACT_HEADER,
  bodyHtml: DEFAULT_CONTRACT_BODY,
  termsHtml: DEFAULT_CONTRACT_TERMS_HTML,
  footerHtml: DEFAULT_CONTRACT_FOOTER,
  customCss: DEFAULT_CONTRACT_CUSTOM_CSS,
  pageSize: 'A4',
};

const owner = { _id: 'ownerfix', businessName: 'Fix Agency' };

console.log('2) Admin contract PDF…');
const adminPdf = await generateContractPdf({
  template,
  booking: {
    reservationId: 'RES-ADMIN-FIX',
    customerName: 'Admin Customer',
    customerEmail: 'a@b.c',
    customerPhone: '+212600000000',
    pickupDate: new Date(),
    returnDate: new Date(Date.now() + 86400000),
    pickupLocation: 'Casa',
    returnLocation: 'Casa',
    price: 500,
    channel: 'online',
    car: { brand: 'Renault', model: 'Clio', year: 2023, licensePlate: '1-A-1' },
    completion: {},
  },
  contractNumber: 'CTR-ADMIN-FIX',
  owner,
});
assert(fs.existsSync(adminPdf.filePath) && fs.statSync(adminPdf.filePath).size > 1500, 'Admin PDF generated');

console.log('3) Signature finalize PDF with local file embed…');
const localName = `fix-sig-${Date.now()}.png`;
const localPath = path.join(docsDir, localName);
fs.writeFileSync(localPath, Buffer.from(tinyPng.split(',')[1], 'base64'));
process.env.API_PUBLIC_URL = 'http://localhost:3000';
const localUrl = `http://localhost:3000/uploads/documents/files/${localName}`;

const signedPdf = await generateContractPdf({
  template,
  booking: {
    reservationId: 'RES-SIGN-FIX',
    customerName: 'Signed Customer',
    customerEmail: 's@b.c',
    customerPhone: '+212611111111',
    pickupDate: new Date(),
    returnDate: new Date(Date.now() + 86400000),
    pickupLocation: 'Rabat',
    returnLocation: 'Rabat',
    price: 700,
    channel: 'whatsapp',
    car: { brand: 'Dacia', model: 'Duster', year: 2022, licensePlate: '2-B-2' },
    completion: {
      signatureUrl: localUrl,
      signatureSignedAt: new Date(),
      signatureComplete: true,
      documentsComplete: true,
    },
  },
  contractNumber: 'CTR-SIGN-FIX',
  owner,
});
assert(fs.existsSync(signedPdf.filePath) && fs.statSync(signedPdf.filePath).size > 1500, 'Signed PDF generated');
assert(String(signedPdf.variables.customer_signature_html).includes('data:image'), 'local signature embedded as data URI');

console.log('4) Signature finalize PDF with non-local protected URL (signed query path)…');
process.env.API_PUBLIC_URL = 'https://other-host.example.com';
const remoteProtectedPdf = await generateContractPdf({
  template,
  booking: {
    reservationId: 'RES-REMOTE-FIX',
    customerName: 'Remote Customer',
    customerEmail: 'r@b.c',
    customerPhone: '+212622222222',
    pickupDate: new Date(),
    returnDate: new Date(Date.now() + 86400000),
    price: 800,
    channel: 'online',
    car: { brand: 'Peugeot', model: '208', year: 2021 },
    completion: {
      signatureUrl: missingHostUrl,
      signatureSignedAt: new Date(),
      signatureComplete: true,
      documentsComplete: true,
    },
  },
  contractNumber: 'CTR-REMOTE-FIX',
  owner,
});
assert(fs.existsSync(remoteProtectedPdf.filePath) && fs.statSync(remoteProtectedPdf.filePath).size > 1500, 'Remote-protected PDF generated without crash');

console.log('\nALL CONTRACT GENERATION FIX VERIFICATIONS PASSED');
console.log(adminPdf.filePath);
console.log(signedPdf.filePath);
console.log(remoteProtectedPdf.filePath);
