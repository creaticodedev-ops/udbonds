import { escapeRegex } from './helpers.js';

/** Normalize city/location names into a unique, trimmed list. */
export const normalizeLocations = (...sources) => {
  const raw = [];
  for (const src of sources) {
    if (!src) continue;
    if (Array.isArray(src)) raw.push(...src);
    else if (typeof src === 'string') raw.push(src);
  }
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const value = String(item || '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
};

/** Effective locations for a car document (supports legacy `location`). */
export const getCarLocations = (car = {}) =>
  normalizeLocations(car.locations, car.location);

export const formatLocationsDisplay = (car) => {
  const list = getCarLocations(car);
  if (!list.length) return '—';
  if (list.length <= 2) return list.join(', ');
  return `${list.slice(0, 2).join(', ')} +${list.length - 2}`;
};

/** Case-insensitive city membership check. */
export const carServesCity = (car, city) => {
  const target = String(city || '').trim().toLowerCase();
  if (!target) return false;
  return getCarLocations(car).some((c) => c.toLowerCase() === target);
};

/**
 * Mongo filter: car is assigned to this pickup city.
 * Matches `locations[]` and legacy scalar `location`.
 */
export const locationAvailabilityFilter = (city) => {
  const value = String(city || '').trim();
  if (!value) return {};
  const exact = new RegExp(`^${escapeRegex(value)}$`, 'i');
  return {
    $or: [
      { locations: exact },
      { location: exact },
    ],
  };
};

/** Apply normalized locations onto a mongoose car doc / plain object for save. */
export const applyLocationsToCar = (car, locationsInput) => {
  const locations = normalizeLocations(locationsInput);
  car.locations = locations;
  // Keep legacy scalar in sync for older UI / indexes
  car.location = locations[0] || '';
  return locations;
};
