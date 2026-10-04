/**
 * Offline unit checks for availability overlap / merge helpers.
 * Run: node server/scripts/verify-availability-logic.mjs
 */
import assert from 'node:assert/strict'
import {
  mergeUnavailablePeriods,
  rangesOverlap,
} from '../services/availabilityService.js'
import { assertBookingRules, DEFAULT_BOOKING_SETTINGS } from '../services/bookingSettingsService.js'

const check = (name, fn) => {
  try {
    fn()
    console.log(`ok  ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

check('exact date overlap', () => {
  assert.equal(
    rangesOverlap(
      new Date('2026-08-12T10:00:00Z'),
      new Date('2026-08-16T10:00:00Z'),
      new Date('2026-08-12T10:00:00Z'),
      new Date('2026-08-16T10:00:00Z'),
    ),
    true,
  )
})

check('pickup inside existing', () => {
  assert.equal(
    rangesOverlap(
      new Date('2026-08-13T10:00:00Z'),
      new Date('2026-08-20T10:00:00Z'),
      new Date('2026-08-12T10:00:00Z'),
      new Date('2026-08-16T10:00:00Z'),
    ),
    true,
  )
})

check('return inside existing', () => {
  assert.equal(
    rangesOverlap(
      new Date('2026-08-01T10:00:00Z'),
      new Date('2026-08-14T10:00:00Z'),
      new Date('2026-08-12T10:00:00Z'),
      new Date('2026-08-16T10:00:00Z'),
    ),
    true,
  )
})

check('existing contains selection', () => {
  assert.equal(
    rangesOverlap(
      new Date('2026-08-13T10:00:00Z'),
      new Date('2026-08-14T10:00:00Z'),
      new Date('2026-08-12T10:00:00Z'),
      new Date('2026-08-16T10:00:00Z'),
    ),
    true,
  )
})

check('selection contains existing', () => {
  assert.equal(
    rangesOverlap(
      new Date('2026-08-01T10:00:00Z'),
      new Date('2026-08-30T10:00:00Z'),
      new Date('2026-08-12T10:00:00Z'),
      new Date('2026-08-16T10:00:00Z'),
    ),
    true,
  )
})

check('boundary start collision', () => {
  assert.equal(
    rangesOverlap(
      new Date('2026-08-16T10:00:00Z'),
      new Date('2026-08-20T10:00:00Z'),
      new Date('2026-08-12T10:00:00Z'),
      new Date('2026-08-16T10:00:00Z'),
    ),
    true,
  )
})

check('no overlap after return', () => {
  assert.equal(
    rangesOverlap(
      new Date('2026-08-16T14:00:00Z'),
      new Date('2026-08-20T10:00:00Z'),
      new Date('2026-08-12T10:00:00Z'),
      new Date('2026-08-16T10:00:00Z'),
    ),
    false,
  )
})

check('merge adjacent periods', () => {
  const merged = mergeUnavailablePeriods([
    { startDate: '2026-08-12', endDate: '2026-08-14' },
    { startDate: '2026-08-15', endDate: '2026-08-16' },
    { startDate: '2026-09-01', endDate: '2026-09-02' },
  ])
  assert.deepEqual(merged, [
    { startDate: '2026-08-12', endDate: '2026-08-16' },
    { startDate: '2026-09-01', endDate: '2026-09-02' },
  ])
})

check('past pickup rejected', () => {
  const r = assertBookingRules(
    DEFAULT_BOOKING_SETTINGS,
    '2020-01-01T10:00',
    '2020-01-05T10:00',
  )
  assert.equal(r.ok, false)
  assert.equal(r.code, 'PAST_PICKUP')
})

check('return before pickup rejected', () => {
  const r = assertBookingRules(
    DEFAULT_BOOKING_SETTINGS,
    '2026-09-10T10:00',
    '2026-09-09T10:00',
  )
  assert.equal(r.ok, false)
  assert.equal(r.code, 'INVALID_DATES')
})

check('min rental rejected', () => {
  const r = assertBookingRules(
    { ...DEFAULT_BOOKING_SETTINGS, minRentalDays: 3 },
    '2030-06-10T10:00',
    '2030-06-11T10:00',
  )
  assert.equal(r.ok, false)
  assert.equal(r.code, 'MIN_RENTAL_DAYS')
})

check('pickup hours rejected', () => {
  const pickup = new Date()
  pickup.setDate(pickup.getDate() + 7)
  pickup.setHours(6, 0, 0, 0)
  const returned = new Date(pickup)
  returned.setDate(returned.getDate() + 2)
  returned.setHours(10, 0, 0, 0)
  const toLocal = (d) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const r = assertBookingRules(
    { ...DEFAULT_BOOKING_SETTINGS, pickupHoursStart: '08:00', pickupHoursEnd: '20:00' },
    toLocal(pickup),
    toLocal(returned),
  )
  assert.equal(r.ok, false)
  assert.equal(r.code, 'PICKUP_HOURS')
})

console.log('\nAll availability logic checks passed.')
