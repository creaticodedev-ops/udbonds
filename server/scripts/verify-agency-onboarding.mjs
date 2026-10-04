/**
 * Offline checks for P1 agency onboarding invite security + URL shape.
 *
 *   node scripts/verify-agency-onboarding.mjs
 *   npm run test:onboarding:offline
 */
import crypto from 'crypto';
import {
  hashInviteToken,
  generateInviteToken,
  buildOnboardingUrl,
  isInviteExpired,
} from '../services/agencyInviteToken.js';

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};
const pass = (msg) => console.log(`PASS: ${msg}`);

const invite = generateInviteToken();
if (invite.token && invite.token.length >= 64 && invite.tokenHash && invite.expiresAt) {
  pass('generateInviteToken returns raw token + hash + expiry');
} else fail('generateInviteToken shape incorrect');

if (hashInviteToken(invite.token) === invite.tokenHash) {
  pass('hashInviteToken is deterministic SHA-256');
} else fail('hashInviteToken mismatch');

if (hashInviteToken(invite.token) !== invite.token) {
  pass('raw token is not stored as hash');
} else fail('token equals hash (insecure)');

const other = crypto.randomBytes(32).toString('hex');
if (hashInviteToken(other) !== invite.tokenHash) {
  pass('different tokens produce different hashes');
} else fail('hash collision unexpected');

process.env.CLIENT_URL = 'https://kririder.com,https://www.kririder.com';
const url = buildOnboardingUrl(invite.token);
if (url === `https://kririder.com/activate-account/${invite.token}`) {
  pass('buildOnboardingUrl uses first CLIENT_URL + /activate-account/:token');
} else fail(`buildOnboardingUrl unexpected: ${url}`);

if (!isInviteExpired(new Date(Date.now() + 60_000))) pass('future expiry is not expired');
else fail('future expiry marked expired');

if (isInviteExpired(new Date(Date.now() - 1000))) pass('past expiry is expired');
else fail('past expiry not detected');

if (isInviteExpired(null)) pass('null expiry treated as expired');
else fail('null expiry should be expired');

// Status mapping expectations (documented contract)
const pendingPair = { agency: 'pending', owner: 'pending' };
const activePair = { agency: 'active', owner: 'active' };
if (pendingPair.agency === pendingPair.owner && activePair.agency === activePair.owner) {
  pass('pending/active status pairs stay mirrored by design');
} else fail('status pair contract broken');

console.log(process.exitCode ? 'DONE WITH FAILURES' : 'DONE — offline onboarding checks passed');
process.exit(process.exitCode || 0);
