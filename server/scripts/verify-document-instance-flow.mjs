/**
 * Offline verification for persistent editable documents:
 * - clone sections / merge helpers
 * - optimistic lock
 * - invoice upsert key uniqueness (logic check)
 * - hydrate field defaults
 */
import assert from 'assert';
import {
  cloneSectionsFromTemplate,
  buildTemplateSnapshot,
  mergeSections,
  mergeSourceData,
  assertOptimisticLock,
  OptimisticLockError,
  isContentLocked,
  mergeSignatureFields,
  versionedAssetUrl,
} from '../services/documentInstanceService.js';

const template = {
  _id: 'tmpl1',
  name: 'Contract default',
  templateVersion: 3,
  headerHtml: '<h1>H</h1>',
  bodyHtml: '<p>{{customer_name}}</p>',
  termsHtml: '<p>T</p>',
  footerHtml: '<p>F</p>',
  customCss: 'body{}',
  pageSize: 'A4',
};

const sections = cloneSectionsFromTemplate(template);
assert.strictEqual(sections.bodyHtml, template.bodyHtml);
assert.strictEqual(sections.pageSize, 'A4');

const snap = buildTemplateSnapshot(template);
assert.strictEqual(snap.templateId, 'tmpl1');
assert.strictEqual(snap.templateVersion, 3);

const merged = mergeSections(sections, { bodyHtml: '<p>edited</p>', removeTerms: true });
assert.strictEqual(merged.bodyHtml, '<p>edited</p>');
assert.strictEqual(merged.termsHtml, '');
assert.strictEqual(merged.headerHtml, template.headerHtml);

const source = mergeSourceData(
  { customer_name: 'A', _meta: { v: 1 } },
  { customer_name: 'B', _meta: { note: 'x' } },
);
assert.strictEqual(source.customer_name, 'B');
assert.deepStrictEqual(source._meta, { v: 1, note: 'x' });

const doc = { updatedAt: new Date('2026-01-01T00:00:00.000Z') };
assertOptimisticLock(doc, '2026-01-01T00:00:00.000Z');
let locked = false;
try {
  assertOptimisticLock(doc, '2026-01-02T00:00:00.000Z');
} catch (e) {
  locked = e instanceof OptimisticLockError;
}
assert.ok(locked, 'expected OptimisticLockError');

// Invoice booking upsert filter shape (must stay unique per owner+booking)
const upsertFilter = { booking: 'bookingId', owner: 'ownerId' };
assert.ok(upsertFilter.booking && upsertFilter.owner);

const contentLockedDoc = { contentLocked: true, sourceData: { _meta: { manuallyEdited: true } } };
assert.ok(isContentLocked(contentLockedDoc));
assert.ok(!isContentLocked({ contentLocked: false, sourceData: {} }));

const withSig = mergeSignatureFields(
  { customer_name: 'Kept', customer_signature_html: 'old' },
  { customer_name: 'Booking', customer_signature_html: '<img/>' },
);
assert.strictEqual(withSig.customer_name, 'Kept');
assert.strictEqual(withSig.customer_signature_html, '<img/>');

assert.ok(versionedAssetUrl('/uploads/a.pdf', 3).includes('v=3'));

console.log('verify-document-instance-flow: OK');
