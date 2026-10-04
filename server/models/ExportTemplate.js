import mongoose from 'mongoose';
import { agencyIdField } from '../utils/tenantScope.js';

const exportTemplateSchema = new mongoose.Schema({
  agencyId: agencyIdField,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['contract', 'invoice', 'custom'],
    default: 'contract',
    index: true,
  },
  logoUrl: { type: String, default: '' },
  companySignatureUrl: { type: String, default: '' },
  headerHtml: { type: String, default: '' },
  bodyHtml: { type: String, default: '' },
  termsHtml: { type: String, default: '' },
  footerHtml: { type: String, default: '' },
  customCss: { type: String, default: '' },
  pageSize: { type: String, enum: ['A4', 'Letter'], default: 'A4' },
  /** Built-in seed key — created once per owner; Admin edits are never auto-overwritten */
  systemKey: { type: String, default: '', index: true },
  templateVersion: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

exportTemplateSchema.index({ owner: 1, type: 1, isDefault: 1 });

const ExportTemplate = mongoose.model('ExportTemplate', exportTemplateSchema);

export default ExportTemplate;
