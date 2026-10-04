/** Staff role presets → permission keys (P5). Keep in sync client/server. */
import { OWNER_PERMISSIONS } from '../models/User.js';

export const STAFF_ROLE_PRESETS = Object.freeze({
  manager: {
    label: 'Manager',
    description: 'Full agency dashboard access (except owner-only billing/staff admin).',
    permissions: [...OWNER_PERMISSIONS],
  },
  agent: {
    label: 'Agent',
    description: 'Day-to-day bookings, customers, fleet, and contracts.',
    permissions: [
      'dashboard',
      'fleet',
      'bookings',
      'customers',
      'locations',
      'calendar',
      'contracts',
      'maintenance',
    ],
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-oriented overview and reports.',
    permissions: ['dashboard', 'analytics', 'calendar', 'customers', 'reports'],
  },
});

export const STAFF_ROLE_CODES = Object.keys(STAFF_ROLE_PRESETS);

export const resolveStaffPermissions = (roleCode, permissionsOverride) => {
  if (Array.isArray(permissionsOverride) && permissionsOverride.length > 0) {
    return Array.from(
      new Set(permissionsOverride.filter((p) => OWNER_PERMISSIONS.includes(p))),
    );
  }
  const preset = STAFF_ROLE_PRESETS[String(roleCode || '').toLowerCase()];
  if (preset) return [...preset.permissions];
  return [...STAFF_ROLE_PRESETS.agent.permissions];
};

export default { STAFF_ROLE_PRESETS, STAFF_ROLE_CODES, resolveStaffPermissions };
