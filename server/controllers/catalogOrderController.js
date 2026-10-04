import Car from '../models/Car.js';
import CarModelOrder from '../models/CarModelOrder.js';
import {
  applyDisplayOrders,
  buildOrderLookupKey,
  groupCarsForCatalog,
  normalizeBrandKey,
  normalizeModelKey,
} from '../utils/carCatalog.js';
import { normalizeCategory, VEHICLE_CATEGORIES } from '../utils/fleetAssets.js';

const categorySortIndex = (category) => {
  const i = VEHICLE_CATEGORIES.findIndex(
    (c) => c.toLowerCase() === String(category || '').toLowerCase()
  );
  return i === -1 ? VEHICLE_CATEGORIES.length : i;
};

const compareGroups = (a, b) => {
  const ao = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : Number.POSITIVE_INFINITY;
  const bo = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  const ap = Number(a.pricePerDay) || 0;
  const bp = Number(b.pricePerDay) || 0;
  if (ap !== bp) return ap - bp;
  return `${a.brand || ''} ${a.model || ''}`.localeCompare(`${b.brand || ''} ${b.model || ''}`);
};

const toGroupPayload = (car, index) => ({
  brand: car.brand,
  model: car.model,
  brandKey: normalizeBrandKey(car.brand),
  modelKey: normalizeModelKey(car.model),
  category: normalizeCategory(car.category),
  displayOrder: Number.isFinite(Number(car.displayOrder)) ? Number(car.displayOrder) : index,
  unitCount: car.unitCount || 1,
  pricePerDay: car.pricePerDay,
  image: car.image || '',
  representativeCarId: car._id,
});

/** List model/groups for this owner, bucketed by category with current display order. */
export const getCatalogOrder = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const cars = await Car.find({ owner: ownerId }).lean();
    const grouped = groupCarsForCatalog(cars);
    const orderDocs = await CarModelOrder.find({ owner: ownerId }).lean();
    const withOrder = applyDisplayOrders(grouped, orderDocs);

    const byCategory = new Map();
    for (const car of withOrder) {
      const category = normalizeCategory(car.category);
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push(car);
    }

    const sections = [...byCategory.entries()]
      .sort(([a], [b]) => categorySortIndex(a) - categorySortIndex(b))
      .map(([category, items]) => {
        const sorted = [...items].sort(compareGroups);
        return {
          category,
          groups: sorted.map((car, index) => toGroupPayload(car, index)),
        };
      });

    res.json({ success: true, sections });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load catalog order' });
  }
};

/**
 * Replace display order for one category.
 * Body: { category: 'SUV', items: [{ brand, model }, ...] }
 */
export const updateCatalogOrder = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const category = normalizeCategory(req.body?.category);
    const items = Array.isArray(req.body?.items) ? req.body.items : null;

    if (!category) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }
    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Order items are required' });
    }

    const cars = await Car.find({ owner: ownerId }).lean();
    const grouped = groupCarsForCatalog(cars).filter(
      (car) => normalizeCategory(car.category) === category
    );

    const groupByKey = new Map(
      grouped.map((car) => [
        buildOrderLookupKey(ownerId, category, car.brand, car.model),
        car,
      ])
    );

    const seen = new Set();
    const normalizedItems = [];

    for (const raw of items) {
      const brand = String(raw?.brand || '').trim();
      const model = String(raw?.model || '').trim();
      if (!brand || !model) {
        return res.status(400).json({
          success: false,
          message: 'Each order item needs brand and model',
        });
      }

      const key = buildOrderLookupKey(ownerId, category, brand, model);
      if (seen.has(key)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate model in order: ${brand} ${model}`,
        });
      }
      if (!groupByKey.has(key)) {
        return res.status(400).json({
          success: false,
          message: `Unknown model for ${category}: ${brand} ${model}`,
        });
      }
      seen.add(key);
      const group = groupByKey.get(key);
      normalizedItems.push({
        brand: group.brand,
        model: group.model,
        brandKey: normalizeBrandKey(group.brand),
        modelKey: normalizeModelKey(group.model),
      });
    }

    if (normalizedItems.length !== grouped.length) {
      return res.status(400).json({
        success: false,
        message: 'Order must include every model in this category',
      });
    }

    const ops = normalizedItems.map((item, index) => ({
      updateOne: {
        filter: {
          owner: ownerId,
          category,
          brandKey: item.brandKey,
          modelKey: item.modelKey,
        },
        update: {
          $set: {
            owner: ownerId,
            category,
            brandKey: item.brandKey,
            modelKey: item.modelKey,
            brand: item.brand,
            model: item.model,
            displayOrder: index,
          },
        },
        upsert: true,
      },
    }));

    if (ops.length) {
      await CarModelOrder.bulkWrite(ops, { ordered: true });
    }

    // Drop stale rows for this category that no longer match a live model group.
    const keepKeys = new Set(
      normalizedItems.map((item) => `${item.brandKey}|${item.modelKey}`)
    );
    const existing = await CarModelOrder.find({ owner: ownerId, category }).lean();
    const staleIds = existing
      .filter((doc) => !keepKeys.has(`${doc.brandKey}|${doc.modelKey}`))
      .map((doc) => doc._id);
    if (staleIds.length) {
      await CarModelOrder.deleteMany({ _id: { $in: staleIds } });
    }

    const groups = normalizedItems.map((item, index) => {
      const group = groupByKey.get(
        buildOrderLookupKey(ownerId, category, item.brand, item.model)
      );
      return toGroupPayload({ ...group, displayOrder: index }, index);
    });

    res.json({
      success: true,
      message: 'Catalog order updated',
      section: { category, groups },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update catalog order' });
  }
};
