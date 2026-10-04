/**
 * Public vehicle date-availability helpers (no customer PII).
 * Backend remains the authority; these helpers power calendar guidance
 * and structured conflict responses.
 */
import Booking from '../models/Booking.js';
import Car from '../models/Car.js';
import { AGENCY_TIMEZONE, parseAgencyDateTime } from '../utils/moroccoTime.js';

export const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'ready_for_pickup', 'active'];

const pad = (n) => String(n).padStart(2, '0');

const moroccoYmd = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: AGENCY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA → YYYY-MM-DD
  return fmt.format(d);
};

const parseYmd = (ymd) => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return null;
  const [y, m, d] = String(ymd).split('-').map(Number);
  return { y, m, d };
};

const addDaysYmd = (ymd, days) => {
  const p = parseYmd(ymd);
  if (!p) return null;
  const utc = new Date(Date.UTC(p.y, p.m - 1, p.d + Number(days || 0)));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
};

const ymdToIndex = (ymd) => {
  const p = parseYmd(ymd);
  if (!p) return NaN;
  return Date.UTC(p.y, p.m - 1, p.d) / 86400000;
};

const indexToYmd = (index) => {
  const utc = new Date(index * 86400000);
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
};

const startOfAgencyDay = (ymd) => parseAgencyDateTime(`${ymd}T00:00:00`);
const endOfAgencyDay = (ymd) => parseAgencyDateTime(`${ymd}T23:59:59`);

/**
 * Inclusive date overlap on calendar days (agency timezone).
 * A booking occupies every calendar day it touches.
 */
const bookingTouchesDay = (pickup, returned, ymd) => {
  const dayStart = startOfAgencyDay(ymd);
  const dayEnd = endOfAgencyDay(ymd);
  if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) return false;
  return pickup <= dayEnd && returned >= dayStart;
};

/**
 * Merge sorted inclusive { startDate, endDate } periods.
 */
export const mergeUnavailablePeriods = (periods = []) => {
  const sorted = [...periods]
    .filter((p) => p?.startDate && p?.endDate && p.startDate <= p.endDate)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));

  if (!sorted.length) return [];

  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    const lastEndNext = addDaysYmd(last.endDate, 1);
    if (cur.startDate <= lastEndNext) {
      if (cur.endDate > last.endDate) last.endDate = cur.endDate;
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
};

/**
 * True when [pickup, return] overlaps any active booking on a specific car.
 * Covers exact match, partial overlap, containment, and boundary collisions
 * (returnDate >= pickupDate && pickupDate <= returnDate).
 */
export const rangesOverlap = (aStart, aEnd, bStart, bEnd) =>
  aStart <= bEnd && aEnd >= bStart;

export const findOverlappingBooking = async (carId, pickupDate, returnDate, excludeBookingId = null) => {
  const query = {
    car: carId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    pickupDate: { $lte: returnDate },
    returnDate: { $gte: pickupDate },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };
  return Booking.findOne(query).select('_id pickupDate returnDate status').lean();
};

export const isCarAvailableForDates = async (carId, pickupDate, returnDate, excludeBookingId = null) => {
  const hit = await findOverlappingBooking(carId, pickupDate, returnDate, excludeBookingId);
  return !hit;
};

/**
 * List physical units for a catalog model (same brand + model under owner).
 */
export const listModelUnits = async (ownerId, brand, model) => {
  if (!ownerId || !brand || !model) return [];
  return Car.find({
    owner: ownerId,
    brand,
    model,
    isAvaliable: true,
    status: { $ne: 'maintenance' },
  })
    .select('_id')
    .lean();
};

/**
 * Periods where the entire model fleet is occupied (no free unit).
 * Returns date-only inclusive ranges — no customer names or booking ids.
 */
export const getModelUnavailablePeriods = async ({
  ownerId,
  brand,
  model,
  fromDate,
  toDate,
  preferredCarId = null,
} = {}) => {
  const fromYmd = moroccoYmd(fromDate) || fromDate;
  const toYmd = moroccoYmd(toDate) || toDate;
  if (!fromYmd || !toYmd || fromYmd > toYmd) {
    return { unitCount: 0, unavailablePeriods: [] };
  }

  let units = await listModelUnits(ownerId, brand, model);
  if (preferredCarId && !units.some((u) => String(u._id) === String(preferredCarId))) {
    // Preferred unit may be offline — still evaluate model fleet only.
  }
  if (!units.length && preferredCarId) {
    units = [{ _id: preferredCarId }];
  }
  if (!units.length) {
    return { unitCount: 0, unavailablePeriods: [{ startDate: fromYmd, endDate: toYmd }] };
  }

  const unitIds = units.map((u) => u._id);
  const windowStart = startOfAgencyDay(fromYmd);
  const windowEnd = endOfAgencyDay(toYmd);

  const bookings = await Booking.find({
    car: { $in: unitIds },
    status: { $in: ACTIVE_BOOKING_STATUSES },
    pickupDate: { $lte: windowEnd },
    returnDate: { $gte: windowStart },
  })
    .select('car pickupDate returnDate')
    .lean();

  const byCar = new Map();
  for (const id of unitIds) byCar.set(String(id), []);
  for (const b of bookings) {
    const key = String(b.car);
    if (!byCar.has(key)) byCar.set(key, []);
    byCar.get(key).push(b);
  }

  const startIdx = ymdToIndex(fromYmd);
  const endIdx = ymdToIndex(toYmd);
  const fullDays = [];

  for (let idx = startIdx; idx <= endIdx; idx += 1) {
    const ymd = indexToYmd(idx);
    let occupied = 0;
    for (const id of unitIds) {
      const list = byCar.get(String(id)) || [];
      const busy = list.some((b) => bookingTouchesDay(b.pickupDate, b.returnDate, ymd));
      if (busy) occupied += 1;
    }
    if (occupied >= unitIds.length) fullDays.push(ymd);
  }

  const periods = [];
  for (const ymd of fullDays) {
    const last = periods[periods.length - 1];
    if (last && addDaysYmd(last.endDate, 1) === ymd) {
      last.endDate = ymd;
    } else {
      periods.push({ startDate: ymd, endDate: ymd });
    }
  }

  return {
    unitCount: unitIds.length,
    unavailablePeriods: mergeUnavailablePeriods(periods),
  };
};

/**
 * Whether the selected rental window can be fulfilled by any unit of the model.
 */
export const isModelAvailableForDates = async ({
  ownerId,
  brand,
  model,
  pickupDate,
  returnDate,
  preferredCarId = null,
  excludeBookingId = null,
}) => {
  const units = await listModelUnits(ownerId, brand, model);
  const list = units.length
    ? units
    : preferredCarId
      ? [{ _id: preferredCarId }]
      : [];

  if (!list.length) return { available: false, unavailablePeriods: [] };

  // Prefer checking preferred unit first, then others.
  const ordered = preferredCarId
    ? [
        ...list.filter((u) => String(u._id) === String(preferredCarId)),
        ...list.filter((u) => String(u._id) !== String(preferredCarId)),
      ]
    : list;

  for (const unit of ordered) {
    const ok = await isCarAvailableForDates(unit._id, pickupDate, returnDate, excludeBookingId);
    if (ok) return { available: true, carId: unit._id };
  }

  // Build conflicting periods from overlapping bookings (public dates only).
  const unitIds = list.map((u) => u._id);
  const bookings = await Booking.find({
    car: { $in: unitIds },
    status: { $in: ACTIVE_BOOKING_STATUSES },
    pickupDate: { $lte: returnDate },
    returnDate: { $gte: pickupDate },
  })
    .select('pickupDate returnDate')
    .lean();

  const periods = bookings.map((b) => ({
    startDate: moroccoYmd(b.pickupDate),
    endDate: moroccoYmd(b.returnDate),
  })).filter((p) => p.startDate && p.endDate);

  return {
    available: false,
    unavailablePeriods: mergeUnavailablePeriods(periods),
  };
};

export const publicUnavailablePayload = (periods = []) =>
  mergeUnavailablePeriods(periods).map(({ startDate, endDate }) => ({ startDate, endDate }));

export default {
  ACTIVE_BOOKING_STATUSES,
  mergeUnavailablePeriods,
  rangesOverlap,
  findOverlappingBooking,
  isCarAvailableForDates,
  listModelUnits,
  getModelUnavailablePeriods,
  isModelAvailableForDates,
  publicUnavailablePayload,
};
