/**
 * Offline checks for durable template assets + edit-safe signature merge.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logoToDataUri } from '../utils/uploadPaths.js';
import { buildImageHtml, buildDocumentHtml } from '../services/templateEngine.js';
import {
  cloneSectionsFromTemplate,
  enrichSourceDataWithSectionAssets,
  mergeSourceData,
} from '../services/documentInstanceService.js';
import {
  DEFAULT_CONTRACT_BODY,
  DEFAULT_CONTRACT_HEADER,
  DEFAULT_CONTRACT_FOOTER,
  DEFAULT_CONTRACT_CUSTOM_CSS,
} from '../services/defaultTemplates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

assert.strictEqual(logoToDataUri(tinyPng), tinyPng, 'data URI logos pass through');

const companyHtml = buildImageHtml(tinyPng, 'Company signature');
assert.ok(companyHtml.includes('data:image/png'), 'company signature embeds data URI');

const template = {
  name: 'Asset Test',
  headerHtml: DEFAULT_CONTRACT_HEADER,
  bodyHtml: DEFAULT_CONTRACT_BODY,
  footerHtml: DEFAULT_CONTRACT_FOOTER,
  customCss: DEFAULT_CONTRACT_CUSTOM_CSS,
  pageSize: 'A4',
  logoUrl: tinyPng,
  companySignatureUrl: tinyPng,
};

const sections = cloneSectionsFromTemplate(template);
assert.ok(sections.logoUrl, 'clone keeps logo');
assert.ok(sections.companySignatureUrl, 'clone keeps company signature');

const wiped = mergeSourceData(
  { company_signature_html: companyHtml, customer_signature_html: '<img src="x"/>' },
  { company_signature_html: '', customer_name: 'Ada' },
);
assert.ok(wiped.company_signature_html.includes('data:image'), 'empty patch does not wipe signature HTML');
assert.strictEqual(wiped.customer_name, 'Ada');

const enriched = enrichSourceDataWithSectionAssets(
  sections,
  { company_signature_html: '' },
  { includeCompanyStamp: true },
);
assert.ok(enriched.company_signature_html.includes('data:image'), 'sections heal blank company signature');

const html = buildDocumentHtml(template, enriched);
assert.ok(html.includes('data:image/png'), 'document HTML includes durable logo');

// Local file path still works
const tmpDir = path.join(__dirname, '..', 'uploads', 'templates');
fs.mkdirSync(tmpDir, { recursive: true });
const localFile = path.join(tmpDir, `persist-test-${Date.now()}.png`);
fs.writeFileSync(localFile, Buffer.from(tinyPng.split(',')[1], 'base64'));
process.env.API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'http://localhost:3000';
const localUrl = `${process.env.API_PUBLIC_URL.replace(/\/$/, '')}/uploads/templates/${path.basename(localFile)}`;
assert.ok(logoToDataUri(localUrl), 'local template file resolves to data URI');
fs.unlinkSync(localFile);

console.log('test-contract-asset-persistence: all assertions passed');
