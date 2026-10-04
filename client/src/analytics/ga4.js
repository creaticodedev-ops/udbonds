/**
 * Google Analytics 4 helpers for the RSZ CAR SPA.
 * - Manual page_view (send_page_view: false) to avoid duplicates with React Router
 * - Business events only; never send PII, tokens, passwords, payments, or contract HTML
 */

export const GA_MEASUREMENT_ID =
  (typeof window !== 'undefined' && window.__HDN_GA_ID__)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GA_MEASUREMENT_ID)
  || 'G-M4SR5C4KGH'

const BLOCKED_PARAM_KEYS = new Set([
  'token',
  'email',
  'phone',
  'password',
  'name',
  'customer',
  'customername',
  'customeremail',
  'customerphone',
  'fullname',
  'signature',
  'session_id',
  'sessionid',
  'payment',
  'card',
  'cvv',
  'contract',
  'address',
  'notes',
  'authorization',
  'cookie',
])

let initialized = false
let lastPageKey = ''
const recentEventKeys = new Map()

const isBrowser = () => typeof window !== 'undefined'

export const isGaDebugMode = () => {
  if (!isBrowser()) return false
  if (import.meta.env?.VITE_GA_DEBUG === 'true') return true
  try {
    return new URLSearchParams(window.location.search).get('debug_mode') === '1'
  } catch {
    return false
  }
}

/** Strip query keys that must never reach GA (tokens, PII, payments). */
export const sanitizePathForAnalytics = (pathname = '', search = '') => {
  const path = String(pathname || '/')
  if (!search) return path
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    const safe = new URLSearchParams()
    params.forEach((value, key) => {
      const k = String(key).toLowerCase()
      if (BLOCKED_PARAM_KEYS.has(k) || k.includes('token') || k.includes('password')) return
      // Keep coarse search facets only (city / category / date presence), not free text.
      if (['pickuplocation', 'pickupdate', 'returndate', 'category'].includes(k)) {
        safe.set(key, value)
      }
    })
    const qs = safe.toString()
    return qs ? `${path}?${qs}` : path
  } catch {
    return path
  }
}

const shouldTrackRoute = (pathname = '') => {
  if (!pathname) return false
  if (pathname.startsWith('/owner')) return false
  if (pathname.startsWith('/superadmin')) return false
  if (pathname.startsWith('/complete-booking')) return false
  return true
}

/** Remove unsafe keys from event params (defense in depth). */
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
    || k.includes('passport')
    || k.includes('license')
    || (k.includes('name') && k !== 'car_name' && k !== 'page_title')
  ) {
    return true
  }
  return false
}

export const scrubEventParams = (params = {}) => {
  const out = {}
  Object.entries(params || {}).forEach(([key, value]) => {
    if (isBlockedParamKey(key)) return
    if (value === undefined || value === null) return
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return
      // Never send emails / long free text / data URLs
      if (trimmed.includes('@') && trimmed.includes('.')) return
      if (trimmed.startsWith('data:')) return
      if (trimmed.length > 120) return
      out[key] = trimmed
      return
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
    }
  })
  return out
}

const dedupeEvent = (name, params, windowMs = 1500) => {
  const key = `${name}:${JSON.stringify(params)}`
  const now = Date.now()
  const prev = recentEventKeys.get(key)
  if (prev && now - prev < windowMs) return false
  recentEventKeys.set(key, now)
  if (recentEventKeys.size > 80) {
    const oldest = [...recentEventKeys.entries()].sort((a, b) => a[1] - b[1]).slice(0, 40)
    oldest.forEach(([k]) => recentEventKeys.delete(k))
  }
  return true
}

const ensureGtagStub = () => {
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      // Google’s stub must push the Arguments object (not a plain array).
      window.dataLayer.push(arguments)
    }
  }
}

const injectGtagScript = (measurementId) => {
  if (document.getElementById('ga4-gtag')) return
  const existing = document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)
  if (existing) {
    existing.id = existing.id || 'ga4-gtag'
    return
  }
  const script = document.createElement('script')
  script.id = 'ga4-gtag'
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  document.head.appendChild(script)
}

/**
 * Bootstrap gtag.js + config. Safe to call multiple times.
 * Prefer the early snippet in index.html; this is the SPA fallback.
 */
export const initGa4 = (measurementId = GA_MEASUREMENT_ID) => {
  if (!isBrowser()) return
  if (!measurementId || !String(measurementId).startsWith('G-')) return

  ensureGtagStub()
  injectGtagScript(measurementId)

  if (!initialized) {
    window.gtag('js', new Date())
    const config = {
      send_page_view: false,
      anonymize_ip: true,
      cookie_domain: 'auto',
    }
    if (isGaDebugMode()) config.debug_mode = true
    window.gtag('config', measurementId, config)
    initialized = true
    return
  }

  // Late ?debug_mode=1 after first init — upgrade into DebugView without a second page_view.
  if (isGaDebugMode()) {
    window.gtag('config', measurementId, {
      send_page_view: false,
      debug_mode: true,
    })
  }
}

const withSendTo = (payload = {}) => ({
  ...payload,
  send_to: GA_MEASUREMENT_ID,
})

export const trackPageView = (pathname, search = '') => {
  if (!isBrowser() || !shouldTrackRoute(pathname)) return
  initGa4()
  const pagePath = sanitizePathForAnalytics(pathname, search)
  if (pagePath === lastPageKey) return
  lastPageKey = pagePath

  const payload = withSendTo({
    page_path: pagePath,
    page_title: document.title || 'RSZ CAR',
    // Full browser URL (origin + path + safe query), not a reconstructed guess
    page_location: `${window.location.origin}${pagePath}`,
  })
  if (isGaDebugMode()) payload.debug_mode = true

  window.gtag('event', 'page_view', payload)
}

export const trackEvent = (name, params = {}) => {
  if (!isBrowser() || !name) return
  if (!shouldTrackRoute(window.location.pathname)) return
  initGa4()
  const scrubbed = withSendTo(scrubEventParams(params))
  if (!dedupeEvent(name, scrubbed)) return
  if (isGaDebugMode()) scrubbed.debug_mode = true
  window.gtag('event', name, scrubbed)
}

export const trackCarView = (car) => {
  if (!car) return
  trackEvent('car_view', {
    car_id: car._id ? String(car._id) : undefined,
    brand: car.brand,
    model: car.model,
    category: car.category,
    year: car.year,
  })
}

export const trackSearch = ({
  location,
  category,
  result_count,
  source = 'site',
  has_dates,
} = {}) => {
  trackEvent('search', {
    search_location: location || undefined,
    category: category || undefined,
    result_count: typeof result_count === 'number' ? result_count : undefined,
    has_dates: typeof has_dates === 'boolean' ? has_dates : undefined,
    source,
  })
}

export const trackReservationStarted = ({ channel, car_id, category } = {}) => {
  trackEvent('reservation_started', {
    channel: channel || 'whatsapp',
    car_id: car_id ? String(car_id) : undefined,
    category,
  })
}

export const trackReservationCompleted = ({
  channel,
  reservation_id,
  car_name,
  days,
  value,
  currency,
} = {}) => {
  trackEvent('reservation_completed', {
    channel: channel || 'whatsapp',
    // Public booking reference only — not a secret token
    reservation_id: reservation_id || undefined,
    car_name: car_name || undefined,
    rental_days: typeof days === 'number' ? days : undefined,
    value: typeof value === 'number' ? value : undefined,
    currency: currency ? String(currency).replace(/\s/g, '') : undefined,
  })
}

export const trackWhatsAppClick = ({ source } = {}) => {
  trackEvent('whatsapp_click', { source: source || 'unknown' })
}

export const trackPhoneClick = ({ source } = {}) => {
  trackEvent('phone_click', { source: source || 'unknown' })
}

export const trackContactClick = ({ source, method } = {}) => {
  trackEvent('contact_click', {
    source: source || 'unknown',
    method: method || 'other',
  })
}

/**
 * Capture tel: / mailto: / wa.me clicks without requiring every link to wire handlers.
 * Deduped against explicit track* calls via the shared recentEventKeys window.
 */
export const bindOutboundContactTracking = () => {
  if (!isBrowser()) return () => {}
  const onClick = (event) => {
    const anchor = event.target?.closest?.('a[href]')
    if (!anchor) return
    const href = String(anchor.getAttribute('href') || '')
    if (!href || href === '#') return
    const source = anchor.dataset?.analyticsSource || 'link'

    if (href.startsWith('tel:')) {
      trackPhoneClick({ source })
      trackContactClick({ source, method: 'phone' })
      return
    }
    if (href.startsWith('mailto:')) {
      trackContactClick({ source, method: 'email' })
      return
    }
    if (href.includes('wa.me/') || href.includes('api.whatsapp.com/') || href.includes('whatsapp.com/send')) {
      trackWhatsAppClick({ source })
      trackContactClick({ source, method: 'whatsapp' })
    }
  }
  document.addEventListener('click', onClick, true)
  return () => document.removeEventListener('click', onClick, true)
}

export default {
  initGa4,
  trackPageView,
  trackEvent,
  trackCarView,
  trackSearch,
  trackReservationStarted,
  trackReservationCompleted,
  trackWhatsAppClick,
  trackPhoneClick,
  trackContactClick,
  bindOutboundContactTracking,
}
