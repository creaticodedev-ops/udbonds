import mongoose from 'mongoose';
import Promotion from '../models/Promotion.js';
import PromotionRedemption from '../models/PromotionRedemption.js';
import { serializePromotion } from '../services/promotionService.js';
import { calculateBookingPrice } from '../services/pricingEngine.js';
import { logAudit } from '../utils/adminOps.js';

const OCCASIONS = new Set([
  'custom', 'summer', 'winter', 'new_year', 'ramadan', 'eid',
  'black_friday', 'special_event', 'last_minute', 'long_stay',
]);

const parseDate = (value, field) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`Invalid ${field}`);
    err.status = 400;
    throw err;
  }
  return d;
};

const sanitizePayload = (body = {}) => {
  const discountType = body.discountType === 'fixed' ? 'fixed' : 'percentage';
  let discountValue = Number(body.discountValue);
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    const err = new Error('Invalid discount value');
    err.status = 400;
    throw err;
  }
  if (discountType === 'percentage' && discountValue > 100) {
    const err = new Error('Percentage discount cannot exceed 100');
    err.status = 400;
    throw err;
  }

  const startAt = parseDate(body.startAt, 'startAt');
  const endAt = parseDate(body.endAt, 'endAt');
  if (endAt < startAt) {
    const err = new Error('End date must be after start date');
    err.status = 400;
    throw err;
  }

  const code = String(body.code || '').trim().toUpperCase();
  const requirePromoCode = body.requirePromoCode !== undefined
    ? Boolean(body.requirePromoCode)
    : Boolean(code);

  return {
    name: String(body.name || '').trim(),
    description: String(body.description || '').trim().slice(0, 2000),
    code,
    discountType,
    discountValue,
    startAt,
    endAt,
    minRentalDays: Math.max(1, Math.round(Number(body.minRentalDays) || 1)),
    maxRentalDays: Math.max(0, Math.round(Number(body.maxRentalDays) || 0)),
    minBookingAmount: Math.max(0, Number(body.minBookingAmount) || 0),
    maxDiscountAmount: Math.max(0, Number(body.maxDiscountAmount) || 0),
    vehicleCategories: Array.isArray(body.vehicleCategories)
      ? body.vehicleCategories.map((c) => String(c).trim()).filter(Boolean)
      : [],
    vehicleModels: Array.isArray(body.vehicleModels)
      ? body.vehicleModels.map((m) => String(m).trim()).filter(Boolean)
      : [],
    globalUsageLimit: Math.max(0, Math.round(Number(body.globalUsageLimit) || 0)),
    perCustomerUsageLimit: Math.max(0, Math.round(Number(body.perCustomerUsageLimit) || 0)),
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    requirePromoCode,
    priority: Math.round(Number(body.priority) || 100),
    allowStacking: Boolean(body.allowStacking),
    occasion: OCCASIONS.has(body.occasion) ? body.occasion : 'custom',
  };
};

export const listPromotions = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { status, q } = req.query || {};
    const filter = { owner: ownerId };
    if (q) {
      filter.$or = [
        { name: new RegExp(String(q), 'i') },
        { code: new RegExp(String(q).toUpperCase(), 'i') },
      ];
    }
    const rows = await Promotion.find(filter).sort({ priority: -1, startAt: -1 }).lean();
    const now = Date.now();
    let list = rows.map(serializePromotion);
    if (status === 'active') list = list.filter((p) => p.lifecycle === 'active');
    if (status === 'scheduled') list = list.filter((p) => p.lifecycle === 'scheduled');
    if (status === 'expired') list = list.filter((p) => p.lifecycle === 'expired' || (!p.isActive && now > new Date(p.endAt).getTime()));
    if (status === 'inactive') list = list.filter((p) => !p.isActive);
    if (status === 'codes') list = list.filter((p) => Boolean(p.code));

    res.json({ success: true, promotions: list });
  } catch (error) {
    console.error('[listPromotions]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load promotions' });
  }
};

export const getPromotion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid promotion id' });
    }
    const doc = await Promotion.findOne({ _id: id, owner: req.user._id }).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Promotion not found' });
    const redemptions = await PromotionRedemption.countDocuments({ promotion: id, owner: req.user._id });
    res.json({
      success: true,
      promotion: serializePromotion(doc),
      stats: { redemptions, usageCount: doc.usageCount || 0 },
    });
  } catch (error) {
    console.error('[getPromotion]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load promotion' });
  }
};

export const createPromotion = async (req, res) => {
  try {
    try {
      const { assertFeature } = await import('../services/entitlementsService.js');
      await assertFeature(req.agencyId, 'promotions');
    } catch (entErr) {
      if (entErr?.status === 403 || entErr?.code) {
        return res.status(entErr.status || 403).json({
          success: false,
          code: entErr.code || 'FEATURE_LOCKED',
          message: entErr.message,
          meta: entErr.meta,
        });
      }
      throw entErr;
    }
    const payload = sanitizePayload(req.body || {});
    if (!payload.name) {
      return res.status(400).json({ success: false, message: 'Promotion name is required' });
    }
    if (payload.code) {
      const exists = await Promotion.findOne({
        owner: req.user._id,
        code: payload.code,
      }).lean();
      if (exists) {
        return res.status(409).json({ success: false, message: 'Promo code already exists' });
      }
    }
    const doc = await Promotion.create({
      ...payload,
      agencyId: req.agencyId || null,
      owner: req.agencyLegacyOwnerId || req.user._id,
    });
    await logAudit({
      owner: req.agencyLegacyOwnerId || req.user._id,
      agencyId: req.agencyId || null,
      actor: req.user._id,
      action: 'promotion.create',
      entityType: 'Promotion',
      entityId: doc._id,
      details: `Created promotion ${doc.name}`,
    }).catch(() => {});
    res.status(201).json({ success: true, promotion: serializePromotion(doc) });
  } catch (error) {
    console.error('[createPromotion]', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to create promotion',
    });
  }
};

export const updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid promotion id' });
    }
    const doc = await Promotion.findOne({ _id: id, owner: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: 'Promotion not found' });

    const payload = sanitizePayload({ ...doc.toObject(), ...req.body });
    if (!payload.name) {
      return res.status(400).json({ success: false, message: 'Promotion name is required' });
    }
    if (payload.code) {
      const exists = await Promotion.findOne({
        owner: req.user._id,
        code: payload.code,
        _id: { $ne: doc._id },
      }).lean();
      if (exists) {
        return res.status(409).json({ success: false, message: 'Promo code already exists' });
      }
    }

    Object.assign(doc, payload);
    await doc.save();
    await logAudit({
      owner: req.user._id,
      actor: req.user._id,
      action: 'promotion.update',
      entityType: 'Promotion',
      entityId: doc._id,
      details: `Updated promotion ${doc.name}`,
    }).catch(() => {});
    res.json({ success: true, promotion: serializePromotion(doc) });
  } catch (error) {
    console.error('[updatePromotion]', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to update promotion',
    });
  }
};

export const setPromotionActive = async (req, res) => {
  try {
    const { id } = req.params;
    const isActive = Boolean(req.body?.isActive);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid promotion id' });
    }
    const doc = await Promotion.findOneAndUpdate(
      { _id: id, owner: req.user._id },
      { $set: { isActive } },
      { new: true },
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Promotion not found' });
    res.json({ success: true, promotion: serializePromotion(doc) });
  } catch (error) {
    console.error('[setPromotionActive]', error.message);
    res.status(500).json({ success: false, message: 'Failed to update promotion status' });
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid promotion id' });
    }
    const doc = await Promotion.findOneAndDelete({ _id: id, owner: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: 'Promotion not found' });
    await logAudit({
      owner: req.user._id,
      actor: req.user._id,
      action: 'promotion.delete',
      entityType: 'Promotion',
      entityId: id,
      details: `Deleted promotion ${doc.name}`,
    }).catch(() => {});
    res.json({ success: true, message: 'Promotion deleted' });
  } catch (error) {
    console.error('[deletePromotion]', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete promotion' });
  }
};

/** Admin pricing preview helper */
export const previewPromotion = async (req, res) => {
  try {
    const {
      pricePerDay = 0,
      days = 3,
      pickupDeliveryFee = 0,
      dropoffDeliveryFee = 0,
      discountType = 'percentage',
      discountValue = 0,
      maxDiscountAmount = 0,
    } = req.body || {};

    const pickupDate = new Date();
    const returnDate = new Date(pickupDate.getTime() + Math.max(1, Number(days) || 1) * 24 * 60 * 60 * 1000);
    const base = calculateBookingPrice({
      pricePerDay,
      pickupDate,
      returnDate,
      pickupDeliveryFee,
      dropoffDeliveryFee,
      discounts: [],
    });
    const fakePromo = { discountType, discountValue, maxDiscountAmount };
    const { computeDiscountAmount } = await import('../services/promotionService.js');
    const discountAmount = computeDiscountAmount(fakePromo, base.subtotal);
    const finalPrice = Math.max(0, Math.round((base.subtotal - discountAmount) * 100) / 100);
    res.json({
      success: true,
      preview: {
        originalPrice: base.subtotal,
        discountAmount,
        finalPrice,
        label: `${base.subtotal} → -${discountAmount} → ${finalPrice}`,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Preview failed' });
  }
};

export default {
  listPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  setPromotionActive,
  deletePromotion,
  previewPromotion,
};
