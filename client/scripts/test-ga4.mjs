/**
 * Offline checks mirroring client/src/analytics/ga4.js sanitizers.
 * Run: node scripts/test-ga4.mjs
 */
import assert from 'assert'

const BLOCKED_PARAM_KEYS = new Set([
  'token', 'email', 'phone', 'password', 'name', 'customer', 'session_id', 'contract',
])

const sanitizePathForAnalytics = (pathname = '', search = '') => {
  const path = String(pathname || '/')
  if (!search) return path
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const safe = new URLSearchParams()
  params.forEach((value, key) => {
    const k = String(key).toLowerCase()
    if (BLOCKED_PARAM_KEYS.has(k) || k.includes('token') || k.includes('password')) return
    if (['pickuplocation', 'pickupdate', 'returndate', 'category'].includes(k)) {
      safe.set(key, value)
    }
  })
  const qs = safe.toString()
  return qs ? `${path}?${qs}` : path
}

const isBlockedParamKey = (key) => {
  const k = String(key || '').toLowerCase()
  if (!k) return true
  if (BLOCKED_PARAM_KEYS.has(k)) return true
  if (
    k.includes('token')
    || k.includes('password')
    || k.includes('email')
    || k.includes('phone')
    || k.includes('customer')
    || k.includes('signature')
    || k.includes('address')
    || (k.includes('name') && k !== 'car_name' && k !== 'page_title')
  ) {
    return true
  }
  return false
}

const scrubEventParams = (params = {}) => {
  const out = {}
  Object.entries(params || {}).forEach(([key, value]) => {
    if (isBlockedParamKey(key)) return
    if (typeof value === 'string') {
      if (value.includes('@') && value.includes('.')) return
      if (value.startsWith('data:')) return
      if (value.length > 120) return
      out[key] = value
      return
    }
    if (typeof value === 'number' || typeof value === 'boolean') out[key] = value
  })
  return out
}

assert.equal(
  sanitizePathForAnalytics('/cars', '?pickupLocation=Safi&token=SECRET&email=a@b.com'),
  '/cars?pickupLocation=Safi',
)

const scrubbed = scrubEventParams({
  brand: 'Dacia',
  email: 'user@example.com',
  phone: '+212600000000',
  token: 'abc',
  customerName: 'John',
  reservation_id: 'RES-123',
  car_name: 'Dacia Duster',
  signature: 'data:image/png;base64,xxxx',
  value: 500,
})
assert.deepEqual(scrubbed, {
  brand: 'Dacia',
  reservation_id: 'RES-123',
  car_name: 'Dacia Duster',
  value: 500,
})

console.log('test-ga4: all assertions passed')
