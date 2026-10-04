import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const routesFile = fs.readFileSync(path.join(root, 'server/routes/superAdminRoutes.js'), 'utf8');
const appFile = fs.readFileSync(path.join(root, 'client/src/App.jsx'), 'utf8');
const layoutFile = fs.readFileSync(path.join(root, 'client/src/pages/superadmin/Layout.jsx'), 'utf8');

const requiredApi = [
  '/overview',
  '/summary',
  '/search',
  '/inbox',
  '/notification-log',
  '/health',
  '/settings',
  '/agencies/:id/approve',
  '/agencies/:id/reject',
];

const requiredPages = [
  'path="requests"',
  'path="notifications"',
  'path="health"',
  'path="settings"',
  'path="activity"',
];

const requiredNav = [
  'Overview',
  'Agencies',
  'Agency Requests',
  'Users',
  'Subscriptions',
  'Notifications',
  'Activity Log',
  'System Health',
  'Settings',
];

const missingApi = requiredApi.filter((p) => !routesFile.includes(p));
const missingPages = requiredPages.filter((p) => !appFile.includes(p));
const missingNav = requiredNav.filter((label) => !layoutFile.includes(label));

if (missingApi.length || missingPages.length || missingNav.length) {
  console.error('Super Admin route verification failed');
  if (missingApi.length) console.error('Missing API:', missingApi);
  if (missingPages.length) console.error('Missing pages:', missingPages);
  if (missingNav.length) console.error('Missing nav:', missingNav);
  process.exit(1);
}

const healthMod = await import('../services/platformHealth.js');
const health = healthMod.getPlatformHealth();
if (!Array.isArray(health.checks) || health.checks.length < 4) {
  console.error('Health checks incomplete');
  process.exit(1);
}
if (health.checks.some((c) => /99\.99/.test(JSON.stringify(c)))) {
  console.error('Fake uptime detected');
  process.exit(1);
}

console.log('Super Admin control center routes verified');
console.log('API modules:', requiredApi.join(', '));
console.log('Health checks:', health.checks.map((c) => `${c.id}:${c.status}`).join(', '));
