import { calcRentalDays } from './pricing'

const pad = (n) => String(n).padStart(2, '0')

const parseISODate = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(String(value))) return null
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setHours(0, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

const toISODate = (date) => {
  if (!date) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Calendar offset so equal clock-times yield at least `minRentalDays` rental days. */
export const minReturnCalendarOffset = (minRentalDays = 1) => {
  const min = Math.max(1, Math.round(Number(minRentalDays) || 1))
  return min > 1 ? min : 0
}

export const addCalendarDaysIso = (isoDate, days) => {
  const d = parseISODate(isoDate)
  if (!d) return ''
  d.setDate(d.getDate() + Number(days || 0))
  return toISODate(d)
}

export const earliestReturnIsoDate = (pickupIsoDate, minRentalDays = 1) => {
  if (!pickupIsoDate) return ''
  return addCalendarDaysIso(pickupIsoDate, minReturnCalendarOffset(minRentalDays))
}

/**
 * Client-side duration check mirroring server assertBookingRules (days only).
 * Server remains the final authority.
 */
export const validateRentalDuration = (
  pickupDateTime,
  returnDateTime,
  { minRentalDays = 1, maxRentalDays = 365 } = {},
) => {
  const min = Math.max(1, Math.round(Number(minRentalDays) || 1))
  const max = Math.max(min, Math.round(Number(maxRentalDays) || 365))
  const days = calcRentalDays(pickupDateTime, returnDateTime)
  if (days <= 0) {
    return { ok: false, code: 'INVALID_DATES', days: 0, minRentalDays: min, maxRentalDays: max }
  }
  if (days < min) {
    return { ok: false, code: 'MIN_RENTAL_DAYS', days, minRentalDays: min, maxRentalDays: max }
  }
  if (days > max) {
    return { ok: false, code: 'MAX_RENTAL_DAYS', days, minRentalDays: min, maxRentalDays: max }
  }
  return { ok: true, days, minRentalDays: min, maxRentalDays: max }
}

export const durationMessageFromCode = (t, { code, minRentalDays, maxRentalDays, fallback } = {}) => {
  if (code === 'MIN_RENTAL_DAYS') {
    return t('carDetails.minRentalDays', { days: minRentalDays || 1 })
  }
  if (code === 'MAX_RENTAL_DAYS') {
    return t('carDetails.maxRentalDays', { days: maxRentalDays || 365 })
  }
  if (code === 'INVALID_DATES') {
    return t('carDetails.invalidDates')
  }
  return fallback || ''
}
