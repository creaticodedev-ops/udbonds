import Car from '../models/Car.js';
import Booking from '../models/Booking.js';
import CarModelOrder from '../models/CarModelOrder.js';
import { normalizeCategory } from './fleetAssets.js';

/** Convert Mongoose doc or lean object to a plain JSON-safe car record. */
export const toPlainCar = (car) => {
  if (!car) return null;
  if (typeof car.toObject === 'function') {
    return car.toObject({ virtuals: false });
  }
  if (car._doc && typeof car._doc === 'object') {
    const { _doc, $__, unitCount, unitIds, ...rest } = car;
    return { ..._doc, ...rest };
  }
  return { ...car };
};

export const normalizeBrandKey = (brand) => String(brand || '').trim().toLowerCase();
export const normalizeModelKey = (model) => String(model || '').trim().toLowerCase();

export const buildModelKey = (car) => {
  const plain = toPlainCar(car) || {};
  return `${String(plain.owner || '')}|${normalizeBrandKey(plain.brand)}|${normalizeModelKey(plain.model)}`;
};

/** Stable lookup for persisted catalog order rows. */
export const buildOrderLookupKey = (owner, category, brand, model) =>
  `${String(owner || '')}|${normalizeCategory(category)}|${normalizeBrandKey(brand)}|${normalizeModelKey(model)}`;

const unitSortValue = (car) => {
  const t = car?.createdAt ? new Date(car.createdAt).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

/**
 * Group physical units into one public catalog entry per brand+model (per owner).
 * Representative unit is deterministic: oldest createdAt, then _id.
 */
export const groupCarsForCatalog = (cars = []) => {
  const sorted = cars
    .map((raw) => toPlainCar(raw))
    .filter((car) => car?._id)
    .sort((a, b) => {
      const byCreated = unitSortValue(a) - unitSortValue(b);
      if (byCreated !== 0) return byCreated;
      return String(a._id).localeCompare(String(b._id));
    });

  const map = new Map();

  for (const car of sorted) {
    const key = buildModelKey(car);
    const id = car._id;

    if (!map.has(key)) {
      map.set(key, {
        ...car,
        category: normalizeCategory(car.category),
        unitCount: 1,
        unitIds: [id],
      });
    } else {
      const entry = map.get(key);
      entry.unitCount += 1;
      entry.unitIds.push(id);
    }
  }

  return Array.from(map.values());
};

/** Stamp displayOrder onto grouped catalog entries from CarModelOrder docs. */
export const applyDisplayOrders = (groupedCars = [], orderDocs = []) => {
  const map = new Map(
    orderDocs.map((doc) => [
      buildOrderLookupKey(doc.owner, doc.category, doc.brandKey || doc.brand, doc.modelKey || doc.model),
      Number(doc.displayOrder),
    ])
  );

  return groupedCars.map((car) => {
    const key = buildOrderLookupKey(car.owner, car.category, car.brand, car.model);
    const displayOrder = map.has(key) ? map.get(key) : null;
    return { ...car, displayOrder };
  });
};

/** Load order rows for the owners present in grouped catalog cars and attach them. */
export const withCatalogDisplayOrders = async (groupedCars = []) => {
  if (!groupedCars.length) return groupedCars;

  const ownerIds = [
    ...new Set(
      groupedCars
        .map((car) => car.owner)
        .filter(Boolean)
        .map((id) => String(id))
    ),
  ];

  if (!ownerIds.length) {
    return groupedCars.map((car) => ({ ...car, displayOrder: null }));
  }

  const orderDocs = await CarModelOrder.find({ owner: { $in: ownerIds } }).lean();
  return applyDisplayOrders(groupedCars, orderDocs);
};

const ACTIVE_STATUSES = ['pending', 'confirmed', 'ready_for_pickup', 'active'];

export const isCarAvailableForDates = async (carId, pickupDate, returnDate, excludeBookingId = null) => {
  const query = {
    car: carId,
    status: { $in: ACTIVE_STATUSES },
    pickupDate: { $lte: returnDate },
    returnDate: { $gte: pickupDate },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };
  const overlap = await Booking.findOne(query).select('_id').lean();
  return !overlap;
};

/**
 * Pick an available physical unit for a model group.
 * Prefers preferredCarId when free; otherwise first free unit with same brand+model.
 */
export const resolveAvailableCarUnit = async ({
  ownerId,
  brand,
  model,
  pickupDate,
  returnDate,
  preferredCarId = null,
  excludeBookingId = null,
}) => {
  const baseQuery = {
    owner: ownerId,
    brand,
    model,
    isAvaliable: true,
    status: { $ne: 'maintenance' },
  };

  const units = await Car.find(baseQuery).sort({ createdAt: 1 }).lean();
  if (!units.length) return null;

  if (preferredCarId) {
    const preferred = units.find((u) => String(u._id) === String(preferredCarId));
    if (preferred) {
      const ok = await isCarAvailableForDates(preferred._id, pickupDate, returnDate, excludeBookingId);
      if (ok) return preferred;
    }
  }

  for (const unit of units) {
    const ok = await isCarAvailableForDates(unit._id, pickupDate, returnDate, excludeBookingId);
    if (ok) return unit;
  }

  return null;
};

export default {
  toPlainCar,
  buildModelKey,
  buildOrderLookupKey,
  normalizeBrandKey,
  normalizeModelKey,
  groupCarsForCatalog,
  applyDisplayOrders,
  withCatalogDisplayOrders,
  isCarAvailableForDates,
  resolveAvailableCarUnit,
};
