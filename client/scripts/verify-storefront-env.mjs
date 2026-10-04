/**
 * Verify production bundle bakes storefront env vars (post-build).
 *
 *   VITE_PLATFORM_BASE_DOMAIN=kririder.com \
 *   VITE_DEFAULT_STOREFRONT_SLUG=my-agency \
 *   npm run build && node scripts/verify-storefront-env.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distAssets = path.join(__dirname, '..', 'dist', 'assets');

const slug = process.env.VITE_DEFAULT_STOREFRONT_SLUG || '';
const domain = process.env.VITE_PLATFORM_BASE_DOMAIN || '';

if (!slug || !domain) {
  console.error('Set VITE_PLATFORM_BASE_DOMAIN and VITE_DEFAULT_STOREFRONT_SLUG before running.');
  process.exit(1);
}

if (!fs.existsSync(distAssets)) {
  console.error('dist/assets missing — run npm run build first.');
  process.exit(1);
}

let foundSlug = false;
let foundDomain = false;

for (const file of fs.readdirSync(distAssets).filter((f) => f.endsWith('.js'))) {
  const text = fs.readFileSync(path.join(distAssets, file), 'utf8');
  if (text.includes(slug)) foundSlug = true;
  if (text.includes(domain)) foundDomain = true;
}

if (foundSlug) console.log(`PASS: slug "${slug}" found in bundle`);
else {
  console.error(`FAIL: slug "${slug}" not found in bundle`);
  process.exitCode = 1;
}

if (foundDomain) console.log(`PASS: domain "${domain}" found in bundle`);
else {
  console.error(`FAIL: domain "${domain}" not found in bundle`);
  process.exitCode = 1;
}
