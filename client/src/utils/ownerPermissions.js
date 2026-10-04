/** Keep in sync with server/models/User.js OWNER_PERMISSIONS */
export const OWNER_PERMISSIONS = [
  'dashboard',
  'analytics',
  'fleet',
  'bookings',
  'customers',
  'locations',
  'calendar',
  'maintenance',
  'reports',
  'audit',
  'contracts',
  'templates',
];

export const resolveOwnerPermissions = (permissions) => {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return permissions;
  }

  return Array.from(new Set(permissions.filter((p) => OWNER_PERMISSIONS.includes(p))));
};

export const ownerHasPermission = (user, permission) => {
  if (!permission) return true;
  const perms = resolveOwnerPermissions(user?.permissions);
  if (user?.role === 'staff') {
    if (!Array.isArray(perms) || perms.length === 0) return false;
    return perms.includes(permission);
  }
  if (!Array.isArray(perms) || perms.length === 0) return true;
  return perms.includes(permission);
};

/** Agency dashboard access (owner or staff). */
export const isAgencyDashboardUser = (user) =>
  user?.role === 'owner' || user?.role === 'staff';

export const isAgencyOwnerUser = (user) => user?.role === 'owner';
