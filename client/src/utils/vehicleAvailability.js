/**
 * Client-side vehicle / date availability helpers.
 * Mirror server rules for guidance only — backend remains authoritative.
 */

import { calcRentalDays } from './pricing'
import { validateRentalDuration } from './bookingDuration'

const pad = (n) => String(n).padStart(2, '0')

export const toISODateOnly = (value) => {
  if (!value) return ''
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return ''
}

export const parseISODateOnly = (value) => {
  const iso = toISODateOnly(value)
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setHours(0, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

const addDays = (date, count) => {
  const d = new Date(date)
  d.setDate(d.getDate() + Number(count || 0))
  d.setHours(0, 0, 0, 0)
  return d
}

const hmToMinutes = (hm) => {
  if (!hm || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(String(hm))) return null
  const [h, m] = String(hm).split(':').map(Number)
  return h * 60 + m
}

const withinHours = (timeHm, startHm, endHm) => {
  const mins = hmToMinutes(timeHm)
  const start = hmToMinutes(startHm)
  const end = hmToMinutes(endHm)
  if (mins == null || start == null || end == null) return true
  if (start <= end) return mins >= start && mins <= end
  return mins >= start || mins <= end
}

const splitDateTime = (value) => {
  if (!value) return { date: '', time: '' }
  const local = String(value).slice(0, 16)
  if (local.includes('T')) {
    const [date, time] = local.split('T')
    return { date, time: time || '' }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(local)) return { date: local, time: '' }
  return { date: '', time: '' }
}

/** Inclusive calendar-day overlap between [aStart,aEnd] and [bStart,bEnd] (ISO dates). */
export const dateRangesOverlap = (aStart, aEnd, bStart, bEnd) => {
  if (!aStart || !aEnd || !bStart || !bEnd) return false
  return aStart <= bEnd && aEnd >= bStart
}

export const mergeUnavailablePeriods = (periods = []) => {
  const sorted = [...periods]
    .map((p) => ({
      startDate: toISODateOnly(p.startDate || p.start),
      endDate: toISODateOnly(p.endDate || p.end),
    }))
    .filter((p) => p.startDate && p.endDate && p.startDate <= p.endDate)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))

  if (!sorted.length) return []
  const merged = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i]
    const last = merged[merged.length - 1]
    const lastEnd = parseISODateOnly(last.endDate)
    const nextDay = lastEnd ? toISODateOnly(addDays(lastEnd, 1)) : ''
    if (cur.startDate <= nextDay) {
      if (cur.endDate > last.endDate) last.endDate = cur.endDate
    } else {
      merged.push({ ...cur })
    }
  }
  return merged
}

/** True if ISO calendar day falls inside any unavailable period (inclusive). */
export const isDateUnavailable = (isoDate, periods = []) => {
  const day = toISODateOnly(isoDate)
  if (!day) return false
  return mergeUnavailablePeriods(periods).some((p) => day >= p.startDate && day <= p.endDate)
}

/** True if selected rental window overlaps any unavailable period. */
export const selectionOverlapsUnavailable = (startIso, endIso, periods = []) => {
  const start = toISODateOnly(startIso)
  const end = toISODateOnly(endIso)
  if (!start || !end) return false
  return mergeUnavailablePeriods(periods).some((p) => dateRangesOverlap(start, end, p.startDate, p.endDate))
}

/** Periods that intersect the customer's selection (for messaging). */
export const conflictingPeriods = (startIso, endIso, periods = []) => {
  const start = toISODateOnly(startIso)
  const end = toISODateOnly(endIso)
  if (!start || !end) return []
  return mergeUnavailablePeriods(periods).filter((p) => dateRangesOverlap(start, end, p.startDate, p.endDate))
}

const formatPeriodShort = (iso, language) => {
  const d = parseISODateOnly(iso)
  if (!d) return iso
  const locale = language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-GB'
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Build a customer-facing unavailability message (no private booking data).
 * Uses i18n `t` when provided.
 */
export const formatUnavailableMessage = (t, periods = [], language = 'en') => {
  const list = mergeUnavailablePeriods(periods)
  if (!list.length) {
    return t ? t('carDetails.datesUnavailable') : 'This vehicle is not available for the selected dates.'
  }
  if (list.length === 1) {
    const p = list[0]
    const from = formatPeriodShort(p.startDate, language)
    const to = formatPeriodShort(p.endDate, language)
    if (t) return t('carDetails.unavailablePeriod', { from, to })
    return `This vehicle is unavailable from ${from} to ${to}. Please select different dates.`
  }
  const parts = list
    .slice(0, 3)
    .map((p) => {
      const from = formatPeriodShort(p.startDate, language)
      const to = formatPeriodShort(p.endDate, language)
      return from === to ? from : `${from} – ${to}`
    })
  const extra = list.length > 3 ? ` (+${list.length - 3})` : ''
  if (t) return t('carDetails.unavailablePeriods', { periods: `${parts.join('; ')}${extra}` })
  return `This vehicle is unavailable during: ${parts.join('; ')}${extra}. Please select different dates.`
}

/**
 * Full client-side booking date validation (guidance only).
 */
export const validateBookingDates = (
  pickupDateTime,
  returnDateTime,
  {
    minRentalDays = 1,
    maxRentalDays = 365,
    advanceBookingDays = 365,
    pickupHoursStart = '08:00',
    pickupHoursEnd = '20:00',
    returnHoursStart = '08:00',
    returnHoursEnd = '20:00',
    unavailablePeriods = [],
  } = {},
) => {
  if (!pickupDateTime || !returnDateTime) {
    return { ok: true, code: null, days: 0 }
  }

  const pickup = new Date(pickupDateTime)
  const returned = new Date(returnDateTime)
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(returned.getTime())) {
    return { ok: false, code: 'INVALID_DATES', days: 0 }
  }
  if (returned <= pickup) {
    return { ok: false, code: 'INVALID_DATES', days: 0 }
  }

  const now = new Date()
  if (pickup < now) {
    return { ok: false, code: 'PAST_PICKUP', days: 0 }
  }

  const duration = validateRentalDuration(pickupDateTime, returnDateTime, {
    minRentalDays,
    maxRentalDays,
  })
  if (!duration.ok) return duration

  const maxAdvance = new Date(now.getTime() + Math.max(1, Number(advanceBookingDays) || 365) * 86400000)
  if (pickup > maxAdvance) {
    return {
      ok: false,
      code: 'ADVANCE_BOOKING',
      days: duration.days,
      advanceBookingDays: Math.max(1, Number(advanceBookingDays) || 365),
    }
  }

  const pickupParts = splitDateTime(pickupDateTime)
  const returnParts = splitDateTime(returnDateTime)
  if (pickupParts.time && !withinHours(pickupParts.time, pickupHoursStart, pickupHoursEnd)) {
    return {
      ok: false,
      code: 'PICKUP_HOURS',
      days: duration.days,
      hoursStart: pickupHoursStart,
      hoursEnd: pickupHoursEnd,
    }
  }
  if (returnParts.time && !withinHours(returnParts.time, returnHoursStart, returnHoursEnd)) {
    return {
      ok: false,
      code: 'RETURN_HOURS',
      days: duration.days,
      hoursStart: returnHoursStart,
      hoursEnd: returnHoursEnd,
    }
  }

  const conflicts = conflictingPeriods(pickupParts.date, returnParts.date, unavailablePeriods)
  if (conflicts.length) {
    return {
      ok: false,
      code: 'DATES_UNAVAILABLE',
      days: duration.days,
      unavailablePeriods: conflicts,
    }
  }

  return { ok: true, code: null, days: duration.days || calcRentalDays(pickupDateTime, returnDateTime) }
}

export const bookingDateMessageFromCode = (t, language, result = {}) => {
  const {
    code,
    minRentalDays,
    maxRentalDays,
    advanceBookingDays,
    hoursStart,
    hoursEnd,
    unavailablePeriods,
    fallback,
  } = result

  if (!code) return fallback || ''
  if (code === 'INVALID_DATES') return t('carDetails.invalidDates')
  if (code === 'PAST_PICKUP') return t('carDetails.pastPickup')
  if (code === 'MIN_RENTAL_DAYS') return t('carDetails.minRentalDays', { days: minRentalDays || 1 })
  if (code === 'MAX_RENTAL_DAYS') return t('carDetails.maxRentalDays', { days: maxRentalDays || 365 })
  if (code === 'ADVANCE_BOOKING') {
    return t('carDetails.advanceBooking', { days: advanceBookingDays || 365 })
  }
  if (code === 'PICKUP_HOURS') {
    return t('carDetails.pickupHours', { start: hoursStart || '08:00', end: hoursEnd || '20:00' })
  }
  if (code === 'RETURN_HOURS') {
    return t('carDetails.returnHours', { start: hoursStart || '08:00', end: hoursEnd || '20:00' })
  }
  if (code === 'DATES_UNAVAILABLE') {
    return formatUnavailableMessage(t, unavailablePeriods, language)
  }
  return fallback || ''
}

/** Filter HH:mm options to booking-settings hours window. */
export const filterTimeOptions = (options, startHm, endHm) => {
  const start = hmToMinutes(startHm)
  const end = hmToMinutes(endHm)
  if (start == null || end == null) return options
  return options.filter((slot) => withinHours(slot, startHm, endHm))
}

export const maxPickupDateFromAdvance = (advanceBookingDays = 365) => {
  const days = Math.max(1, Math.round(Number(advanceBookingDays) || 365))
  return addDays(new Date(), days)
}
