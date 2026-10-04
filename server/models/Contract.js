import mongoose from 'mongoose';
import { agencyIdField } from '../utils/tenantScope.js';

const documentSectionsSchema = new mongoose.Schema({
  headerHtml: { type: String, default: '' },
  bodyHtml: { type: String, default: '' },
  termsHtml: { type: String, default: '' },
  footerHtml: { type: String, default: '' },
  customCss: { type: String, default: '' },
  pageSize: { type: String, enum: ['A4', 'Letter'], default: 'A4' },
  logoUrl: { type: String, default: '' },
  /** Agency stamp/signature URL or data URI cloned from ExportTemplate */
  companySignatureUrl: { type: String, default: '' },
  name: { type: String, default: '' },
}, { _id: false });

const templateSnapshotSchema = new mongoose.Schema({
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportTemplate', default: null },
  name: { type: String, default: '' },
  templateVersion: { type: Number, default: 0 },
}, { _id: false });

const contractSchema = new mongoose.Schema({
  agencyId: agencyIdField,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportTemplate', default: null },
  contractNumber: { type: String, required: true, index: true },
  renderedHtml: { type: String, default: '' },
  pdfUrl: { type: String, default: '' },
  pdfPath: { type: String, default: '' },
  /** Frozen template variables + field map used for render/edit */
  sourceData: { type: mongoose.Schema.Types.Mixed, default: {} },
  /** Cloned template sections — edits never mutate ExportTemplate */
  sections: { type: documentSectionsSchema, default: () => ({}) },
  templateSnapshot: { type: templateSnapshotSchema, default: () => ({}) },
  version: { type: Number, default: 1 },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  includeCompanyStamp: { type: Boolean, default: true },
  /** When true, booking/completion/template sync must not overwrite sourceData/sections */
  contentLocked: { type: Boolean, default: false, index: true },
  status: {
    type: String,
    enum: ['draft', 'final'],
    default: 'final',
  },
}, { timestamps: true });

contractSchema.index({ owner: 1, contractNumber: 1 }, { unique: true });
contractSchema.index({ owner: 1, createdAt: -1 });
contractSchema.index({ owner: 1, booking: 1 });

const Contract = mongoose.model('Contract', contractSchema);

export default Contract;
export { documentSectionsSchema, templateSnapshotSchema };
