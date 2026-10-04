/**
 * Self-contained checks mirroring permissionMeta helpers + OWNER_PERMISSIONS contract.
 */
import assert from 'assert'

const OWNER_PERMISSIONS = [
  'dashboard', 'analytics', 'fleet', 'bookings', 'customers', 'locations',
  'calendar', 'maintenance', 'reports', 'audit', 'contracts', 'templates',
]

const SENSITIVE = ['contracts', 'templates', 'reports', 'audit']

const isFullAccess = (permissions) => !Array.isArray(permissions) || permissions.length === 0
const samePermissions = (a, b) => {
  const aa = Array.isArray(a) ? [...a].sort() : []
  const bb = Array.isArray(b) ? [...b].sort() : []
  return aa.length === bb.length && aa.every((v, i) => v === bb[i])
}
const summarizeAccess = (permissions, catalog) => {
  if (isFullAccess(permissions)) return { mode: 'full', granted: catalog.length, total: catalog.length }
  const granted = permissions.filter((p) => catalog.includes(p)).length
  return { mode: 'restricted', granted, total: catalog.length }
}
const hasSensitiveChange = (from, to) => {
  if (isFullAccess(from) !== isFullAccess(to)) return true
  const a = new Set(isFullAccess(from) ? SENSITIVE : (from || []).filter((p) => SENSITIVE.includes(p)))
  const b = new Set(isFullAccess(to) ? SENSITIVE : (to || []).filter((p) => SENSITIVE.includes(p)))
  return SENSITIVE.some((k) => a.has(k) !== b.has(k))
}

assert.strictEqual(isFullAccess([]), true)
assert.strictEqual(isFullAccess(['fleet']), false)
assert.ok(samePermissions(['fleet', 'bookings'], ['bookings', 'fleet']))
assert.strictEqual(summarizeAccess([], OWNER_PERMISSIONS).mode, 'full')
assert.strictEqual(summarizeAccess(['fleet'], OWNER_PERMISSIONS).granted, 1)
assert.ok(hasSensitiveChange([], ['fleet']))
assert.ok(hasSensitiveChange(['fleet'], ['fleet', 'contracts']))
assert.ok(!hasSensitiveChange(['fleet', 'bookings'], ['bookings', 'fleet']))
assert.strictEqual(OWNER_PERMISSIONS.length, 12)

console.log('test-permission-meta: all assertions passed')
