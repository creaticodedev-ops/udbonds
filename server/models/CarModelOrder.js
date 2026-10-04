import mongoose from 'mongoose';
import { agencyIdField } from '../utils/tenantScope.js';

/**
 * Manual catalog display order for a vehicle model/group (not a physical unit).
 * Keyed the same way public catalog grouping works: agency + brand + model,
 * scoped per category so admins can reorder within each category section.
 */
const carModelOrderSchema = new mongoose.Schema(
  {
    agencyId: agencyIdField,
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: { type: String, required: true, trim: true },
    brandKey: { type: String, required: true, trim: true, lowercase: true },
    modelKey: { type: String, required: true, trim: true, lowercase: true },
    /** Display labels captured at save time (case preserved from fleet data). */
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    displayOrder: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

carModelOrderSchema.index(
  { owner: 1, category: 1, brandKey: 1, modelKey: 1 },
  { unique: true }
);
carModelOrderSchema.index({ owner: 1, category: 1, displayOrder: 1 });

const CarModelOrder = mongoose.model('CarModelOrder', carModelOrderSchema);

export default CarModelOrder;
