/**
 * UI metadata for owner admin permissions.
 * Keys MUST stay in sync with server/models/User.js OWNER_PERMISSIONS —
 * never rename or invent new permission strings here.
 */
import { OWNER_PERMISSIONS } from './ownerPermissions'

/** @typedef {'dashboard'|'analytics'|'fleet'|'bookings'|'customers'|'locations'|'calendar'|'maintenance'|'reports'|'audit'|'contracts'|'templates'} OwnerPermission */

/**
 * Capability chips are informational only (what the module unlocks).
 * They are NOT separate API permissions.
 */
export const PERMISSION_MODULES = [
  {
    id: 'overview',
    labelKey: 'superadmin.perms.groups.overview',
    permissions: [
      {
        key: 'dashboard',
        labelKey: 'superadmin.perms.keys.dashboard',
        descKey: 'superadmin.perms.desc.dashboard',
        actions: ['view', 'manage'],
        sensitive: false,
      },
      {
        key: 'analytics',
        labelKey: 'superadmin.perms.keys.analytics',
        descKey: 'superadmin.perms.desc.analytics',
        actions: ['view', 'export'],
        sensitive: false,
      },
    ],
  },
  {
    id: 'bookings',
    labelKey: 'superadmin.perms.groups.bookings',
    permissions: [
      {
        key: 'bookings',
        labelKey: 'superadmin.perms.keys.bookings',
        descKey: 'superadmin.perms.desc.bookings',
        actions: ['view', 'create', 'edit', 'manage'],
        sensitive: false,
      },
      {
        key: 'calendar',
        labelKey: 'superadmin.perms.keys.calendar',
        descKey: 'superadmin.perms.desc.calendar',
        actions: ['view', 'manage'],
        sensitive: false,
      },
      {
        key: 'customers',
        labelKey: 'superadmin.perms.keys.customers',
        descKey: 'superadmin.perms.desc.customers',
        actions: ['view', 'edit', 'manage'],
        sensitive: false,
      },
    ],
  },
  {
    id: 'fleet',
    labelKey: 'superadmin.perms.groups.fleet',
    permissions: [
      {
        key: 'fleet',
        labelKey: 'superadmin.perms.keys.fleet',
        descKey: 'superadmin.perms.desc.fleet',
        actions: ['view', 'create', 'edit', 'delete', 'manage'],
        sensitive: false,
      },
      {
        key: 'maintenance',
        labelKey: 'superadmin.perms.keys.maintenance',
        descKey: 'superadmin.perms.desc.maintenance',
        actions: ['view', 'create', 'edit', 'manage'],
        sensitive: false,
      },
      {
        key: 'locations',
        labelKey: 'superadmin.perms.keys.locations',
        descKey: 'superadmin.perms.desc.locations',
        actions: ['view', 'create', 'edit', 'manage'],
        sensitive: false,
      },
    ],
  },
  {
    id: 'documents',
    labelKey: 'superadmin.perms.groups.documents',
    permissions: [
      {
        key: 'contracts',
        labelKey: 'superadmin.perms.keys.contracts',
        descKey: 'superadmin.perms.desc.contracts',
        actions: ['view', 'create', 'edit', 'export', 'manage'],
        sensitive: true,
      },
      {
        key: 'templates',
        labelKey: 'superadmin.perms.keys.templates',
        descKey: 'superadmin.perms.desc.templates',
        actions: ['view', 'edit', 'manage'],
        sensitive: true,
      },
    ],
  },
  {
    id: 'reporting',
    labelKey: 'superadmin.perms.groups.reporting',
    permissions: [
      {
        key: 'reports',
        labelKey: 'superadmin.perms.keys.reports',
        descKey: 'superadmin.perms.desc.reports',
        actions: ['view', 'export'],
        sensitive: true,
      },
      {
        key: 'audit',
        labelKey: 'superadmin.perms.keys.audit',
        descKey: 'superadmin.perms.desc.audit',
        actions: ['view', 'export'],
        sensitive: true,
      },
    ],
  },
]

export const SENSITIVE_PERMISSIONS = PERMISSION_MODULES.flatMap((g) =>
  g.permissions.filter((p) => p.sensitive).map((p) => p.key),
)

export const ALL_ACTION_TYPES = ['view', 'create', 'edit', 'delete', 'manage', 'export']

/** Normalize catalog from API; fall back to known OWNER_PERMISSIONS. */
export const resolveCatalog = (catalog) => {
  const list = Array.isArray(catalog) && catalog.length
    ? catalog.filter((k) => OWNER_PERMISSIONS.includes(k))
    : [...OWNER_PERMISSIONS]
  return list.length ? list : [...OWNER_PERMISSIONS]
}

/** Empty array = full access (server contract). */
export const isFullAccess = (permissions) => !Array.isArray(permissions) || permissions.length === 0

export const grantedSet = (permissions, catalog) => {
  const cat = resolveCatalog(catalog)
  if (isFullAccess(permissions)) return new Set(cat)
  return new Set(permissions.filter((p) => cat.includes(p)))
}

export const countGranted = (permissions, catalog) => grantedSet(permissions, catalog).size

export const summarizeAccess = (permissions, catalog) => {
  const cat = resolveCatalog(catalog)
  if (isFullAccess(permissions)) {
    return { mode: 'full', granted: cat.length, total: cat.length }
  }
  const granted = permissions.filter((p) => cat.includes(p)).length
  return { mode: 'restricted', granted, total: cat.length }
}

export const samePermissions = (a, b) => {
  const aa = Array.isArray(a) ? [...a].sort() : []
  const bb = Array.isArray(b) ? [...b].sort() : []
  if (aa.length !== bb.length) return false
  return aa.every((v, i) => v === bb[i])
}

export const diffPermissions = (from, to, catalog) => {
  const cat = resolveCatalog(catalog)
  const a = grantedSet(from, cat)
  const b = grantedSet(to, cat)
  const added = cat.filter((k) => b.has(k) && !a.has(k))
  const removed = cat.filter((k) => a.has(k) && !b.has(k))
  return { added, removed }
}

export const hasSensitiveChange = (from, to) => {
  const a = new Set(isFullAccess(from) ? SENSITIVE_PERMISSIONS : (from || []).filter((p) => SENSITIVE_PERMISSIONS.includes(p)))
  const b = new Set(isFullAccess(to) ? SENSITIVE_PERMISSIONS : (to || []).filter((p) => SENSITIVE_PERMISSIONS.includes(p)))
  // Full access grants all sensitive modules
  if (isFullAccess(from) !== isFullAccess(to)) return true
  return SENSITIVE_PERMISSIONS.some((k) => a.has(k) !== b.has(k))
}

/** Modules metadata filtered to keys present in catalog */
export const modulesForCatalog = (catalog) => {
  const cat = new Set(resolveCatalog(catalog))
  return PERMISSION_MODULES.map((group) => ({
    ...group,
    permissions: group.permissions.filter((p) => cat.has(p.key)),
  })).filter((g) => g.permissions.length > 0)
}

export default {
  PERMISSION_MODULES,
  SENSITIVE_PERMISSIONS,
  resolveCatalog,
  isFullAccess,
  grantedSet,
  countGranted,
  summarizeAccess,
  samePermissions,
  diffPermissions,
  hasSensitiveChange,
  modulesForCatalog,
}
