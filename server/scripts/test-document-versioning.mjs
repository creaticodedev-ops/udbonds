/**
 * Lightweight versioning sanity checks (no Mongo required).
 * Run: node scripts/test-document-versioning.mjs
 */
import assert from 'assert';
import {
  bumpDocumentVersion,
} from '../services/documentInstanceService.js';

// Mirror the fixed archiveRevision version resolution (without DB write)
const resolveArchiveVersion = (document, versionOverride) => {
  const version = Number(
    versionOverride != null ? versionOverride : (document.version ?? 1),
  );
  if (!Number.isFinite(version) || version < 1) {
    throw new Error(`Invalid revision version: ${versionOverride ?? document.version}`);
  }
  return version;
};

const simulateEditFlow = (liveVersion, archivedVersions) => {
  const doc = { _id: 'doc1', version: liveVersion, sourceData: {}, sections: {} };
  // OLD BUG: archive current tip before bump → duplicates generate's v1
  const wouldArchiveBefore = resolveArchiveVersion(doc);
  assert.ok(
    archivedVersions.has(wouldArchiveBefore),
    'precondition: current tip already archived (as after generate)',
  );

  // FIXED: bump then archive new tip
  bumpDocumentVersion(doc);
  const next = resolveArchiveVersion(doc);
  assert.strictEqual(next, liveVersion + 1);
  assert.ok(!archivedVersions.has(next), 'new tip must not already exist');
  archivedVersions.add(next);
  return { live: doc.version, archived: [...archivedVersions].sort((a, b) => a - b) };
};

const archived = new Set([1]); // after generate
let state = { live: 1, archived: [1] };

state = simulateEditFlow(state.live, archived);
assert.deepStrictEqual(state, { live: 2, archived: [1, 2] });

state = simulateEditFlow(state.live, archived);
assert.deepStrictEqual(state, { live: 3, archived: [1, 2, 3] });

// Restore: apply old snapshot, bump to new tip, archive new tip (never overwrite)
const restore = { _id: 'doc1', version: 3 };
bumpDocumentVersion(restore);
const restoredTip = resolveArchiveVersion(restore);
assert.strictEqual(restoredTip, 4);
assert.ok(!archived.has(4));
archived.add(4);
assert.deepStrictEqual([...archived].sort((a, b) => a - b), [1, 2, 3, 4]);
assert.strictEqual(restore.version, 4);

console.log('OK document versioning: generate→edit→edit→restore yields tips 1,2,3,4 without duplicates');
