/**
 * Flexible booking pricing engine.
 * Server is authoritative — client may preview, never trust client totals.
 *
 * Line items are extensible: add new types (insurance, extras, taxes)
 * without changing the core booking flow.
 */

import { calcRentalDays } from '../utils/helpers.js';

export const LINE_TYPES = {
  RENTAL: 'rental',
  PICKUP_DELIVERY: 'pickup_delivery',
  DROPOFF_DELIVERY: 'dropoff_delivery',
  EXTRA_DRIVER: 'extra_driver',
  DISCOUNT: 'discount',
};

const toMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
};

/**
 * @param {object} input
 * @param {number} input.pricePerDay
 * @param {Date|string} input.pickupDate
 * @param {Date|string} input.returnDate
 * @param {number} [input.pickupDeliveryFee=0]
 * @param {number} [input.dropoffDeliveryFee=0]
 * @param {number} [input.extraDriverFee=0] total fee for rental period (not per day)
 * @param {Array<{code?:string,label:string,amount:number}>} [input.discounts=[]]
 * @returns {object} price breakdown
 */
export const calculateBookingPrice = ({
  pricePerDay,
  pickupDate,
  returnDate,
  pickupDeliveryFee = 0,
  dropoffDeliveryFee = 0,
  extraDriverFee = 0,
  discounts = [],
} = {}) => {
  const picked = pickupDate instanceof Date ? pickupDate : new Date(pickupDate);
  const returned = returnDate instanceof Date ? returnDate : new Date(returnDate);
  const days = calcRentalDays(picked, returned);
  const daily = toMoney(pricePerDay);

  const rentalPrice = toMoney(daily * days);
  const pickupFee = toMoney(pickupDeliveryFee);
  const dropoffFee = toMoney(dropoffDeliveryFee);
  const driverFee = toMoney(extraDriverFee);

  const normalizedDiscounts = (Array.isArray(discounts) ? discounts : [])
    .map((d) => ({
      code: d.code || '',
      label: d.label || 'Discount',
      amount: toMoney(d.amount),
    }))
    .filter((d) => d.amount > 0);

  const discountTotal = toMoney(
    normalizedDiscounts.reduce((sum, d) => sum + d.amount, 0)
  );

  const lineItems = [
    {
      type: LINE_TYPES.RENTAL,
      label: 'Rental Price',
      amount: rentalPrice,
      meta: { days, pricePerDay: daily },
    },
  ];

  if (pickupFee > 0 || pickupDeliveryFee !== undefined) {
    lineItems.push({
      type: LINE_TYPES.PICKUP_DELIVERY,
      label: 'Pickup Delivery Fee',
      amount: pickupFee,
      meta: {},
    });
  }

  if (dropoffFee > 0 || dropoffDeliveryFee !== undefined) {
    lineItems.push({
      type: LINE_TYPES.DROPOFF_DELIVERY,
      label: 'Drop-off Delivery Fee',
      amount: dropoffFee,
      meta: {},
    });
  }

  if (driverFee > 0) {
    lineItems.push({
      type: LINE_TYPES.EXTRA_DRIVER,
      label: 'Extra Driver Fee',
      amount: driverFee,
      meta: { days },
    });
  }

  for (const d of normalizedDiscounts) {
    lineItems.push({
      type: LINE_TYPES.DISCOUNT,
      label: d.label,
      amount: -d.amount,
      meta: { code: d.code },
    });
  }

  const subtotal = toMoney(rentalPrice + pickupFee + dropoffFee + driverFee);
  const total = toMoney(Math.max(0, subtotal - discountTotal));

  return {
    days,
    pricePerDay: daily,
    rentalPrice,
    pickupDeliveryFee: pickupFee,
    dropoffDeliveryFee: dropoffFee,
    extraDriverFee: driverFee,
    discounts: normalizedDiscounts,
    discountTotal,
    subtotal,
    total,
    lineItems,
  };
};

/**
 * Resolve delivery fee for a location document (or 0).
 */
export const getLocationDeliveryFee = (location) =>
  toMoney(location?.deliveryFee ?? 0);

const normalizeCityKey = (city) => String(city || '').trim().toLowerCase();

/**
 * Pickup + drop-off delivery fees.
 * Same city (case-insensitive): charge pickup fee only; drop-off fee is 0.
 * Different cities: charge both location fees as usual.
 */
export const resolveLocationDeliveryFees = (pickupLoc, returnLoc) => {
  const pickupDeliveryFee = getLocationDeliveryFee(pickupLoc);
  const dropoffRaw = getLocationDeliveryFee(returnLoc);
  const pickupCity = normalizeCityKey(pickupLoc?.city);
  const returnCity = normalizeCityKey(returnLoc?.city);
  const sameCity = Boolean(pickupCity && returnCity && pickupCity === returnCity);

  return {
    pickupDeliveryFee,
    dropoffDeliveryFee: sameCity ? 0 : dropoffRaw,
    sameCity,
  };
};

/**
 * Format location label for booking storage / display.
 */
export const formatLocationLabel = (location) => {
  if (!location) return '';
  return `${location.name} - ${location.address}`;
};

export default calculateBookingPrice;
