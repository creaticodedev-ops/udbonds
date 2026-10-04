/**
 * Safely migrate PromotionRedemption indexes for existing databases:
 * - drop legacy unique index on `booking` alone (blocks stacked promos)
 * - ensure compound unique { booking, promotion }
 */
import mongoose from 'mongoose';
import PromotionRedemption from '../models/PromotionRedemption.js';
import PromotionCustomerUsage from '../models/PromotionCustomerUsage.js';

const log = (...args) => console.log('[ensurePromotionIndexes]', ...args);

export const ensurePromotionIndexes = async () => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected');
  }

  const coll = mongoose.connection.collection('promotionredemptions');
  let indexes = [];
  try {
    indexes = await coll.indexes();
  } catch (error) {
    // Collection may not exist yet — syncIndexes will create it
    if (error?.codeName !== 'NamespaceNotFound' && error?.code !== 26) {
      throw error;
    }
  }

  for (const idx of indexes) {
    const keys = idx.key || {};
    const keyNames = Object.keys(keys);
    const isLegacyBookingUnique =
      idx.unique === true &&
      keyNames.length === 1 &&
      keyNames[0] === 'booking';
    if (isLegacyBookingUnique) {
      log(`dropping legacy unique index ${idx.name} on booking`);
      try {
        await coll.dropIndex(idx.name);
      } catch (error) {
        if (error?.codeName !== 'IndexNotFound') throw error;
      }
    }
  }

  await PromotionRedemption.syncIndexes();
  await PromotionCustomerUsage.syncIndexes();

  const after = await coll.indexes();
  const compound = after.find(
    (idx) =>
      idx.unique === true &&
      idx.key?.booking === 1 &&
      idx.key?.promotion === 1,
  );
  if (!compound) {
    throw new Error('Compound unique index { booking, promotion } missing after sync');
  }
  log(`ok — compound unique index present (${compound.name})`);
  return { ok: true, compoundIndex: compound.name };
};

export default ensurePromotionIndexes;
