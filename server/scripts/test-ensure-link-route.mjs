/**
 * Live HTTP check (server must be running). Verifies ensure-link is registered.
 * Usage: node server/scripts/test-ensure-link-route.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const API = (process.env.API_BASE_URL || 'http://127.0.0.1:3000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

const paths = [
  '/api/booking-completion/owner/ensure-link',
  '/api/bookings/owner/completion/ensure-link',
];

for (const p of paths) {
  const res = await fetch(`${API}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: '507f1f77bcf86cd799439011' }),
  });
  const body = await res.json();
  const kind =
    res.status === 404
      ? 'ROUTE_MISSING'
      : res.status === 401 || res.status === 403
        ? 'ROUTE_OK (auth required)'
        : res.status >= 500
          ? 'ROUTE_OK (handler reached; check body/auth)'
          : `HTTP ${res.status}`;
  console.log(`${p} → ${kind}`, body.message || '');
}

const bad = await fetch(`${API}/api/api/booking-completion/owner/ensure-link`, { method: 'POST' });
const badBody = await bad.json();
console.log(
  '/api/api/... (double prefix) →',
  bad.status === 404 ? '404 as expected' : bad.status,
  badBody.message?.slice(0, 80),
);
