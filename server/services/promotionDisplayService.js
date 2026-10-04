/**
 * Presentation-only helpers for customer-facing promotion badges.
 * Does not calculate booking totals or reserve usage.
 */
import Promotion from '../models/Promotion.js';

const vehicleAllowed = (promo, car) => {
  const cats = (promo.vehicleCategories || []).map((c) => String(c).toLowerCase());
  if (cats.length) {
    if (!cats.includes(String(car?.category || '').toLowerCase())) return false;
  }
  const models = (promo.vehicleModels || []).map((m) => String(m).toLowerCase().trim()).filter(Boolean);
  if (models.length) {
    const full = `${car?.brand || ''} ${car?.model || ''}`.toLowerCase().trim();
    const modelOnly = String(car?.model || '').toLowerCase().trim();
    const ok = models.some((m) => full === m || modelOnly === m || full.includes(m));
    if (!ok) return false;
  }
  return true;
};

const toMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
};

/**
 * Pick the best active promotion to showcase on a vehicle card.
 */
export const pickDisplayPromotion = (car, promotions = []) => {
  if (!car || !promotions.length) return null;
  const matches = promotions
    .filter((p) => p && p.isActive && vehicleAllowed(p, car))
    .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
  return matches[0] || null;
};

export const serializeDisplayPromotion = (promo, car) => {
  if (!promo) return null;
  const pricePerDay = toMoney(car?.pricePerDay);
  const discountType = promo.discountType === 'fixed' ? 'fixed' : 'percentage';
  const discountValue = toMoney(promo.discountValue);
  let discountedPricePerDay = null;
  if (discountType === 'percentage' && pricePerDay > 0) {
    discountedPricePerDay = toMoney(pricePerDay * (1 - discountValue / 100));
  }

  return {
    id: String(promo._id),
    name: promo.name || '',
    code: promo.code || '',
    occasion: promo.occasion || 'custom',
    discountType,
    discountValue,
    requirePromoCode: Boolean(promo.requirePromoCode || promo.code),
    priority: Number(promo.priority) || 0,
    startAt: promo.startAt,
    endAt: promo.endAt,
    pricePerDay,
    discountedPricePerDay,
  };
};

/**
 * Attach `displayPromotion` onto car objects for catalog / detail responses.
 */
export const attachDisplayPromotions = async (carsInput) => {
  const single = !Array.isArray(carsInput);
  const cars = single ? [carsInput] : carsInput;
  if (!cars.length) return single ? carsInput : cars;

  const ownerIds = [
    ...new Set(
      cars
        .map((c) => c?.owner)
        .filter(Boolean)
        .map((id) => String(id)),
    ),
  ];
  if (!ownerIds.length) return single ? { ...cars[0], displayPromotion: null } : cars.map((c) => ({ ...c, displayPromotion: null }));

  const now = new Date();
  const promos = await Promotion.find({
    owner: { $in: ownerIds },
    isActive: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
  })
    .sort({ priority: -1 })
    .lean();

  const byOwner = new Map();
  for (const p of promos) {
    const key = String(p.owner);
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key).push(p);
  }

  const enriched = cars.map((car) => {
    const plain = car?.toObject ? car.toObject() : { ...car };
    const list = byOwner.get(String(plain.owner)) || [];
    const picked = pickDisplayPromotion(plain, list);
    return {
      ...plain,
      displayPromotion: serializeDisplayPromotion(picked, plain),
    };
  });

  return single ? enriched[0] : enriched;
};

export default {
  pickDisplayPromotion,
  serializeDisplayPromotion,
  attachDisplayPromotions,
};
