import mongoose from 'mongoose';
import { agencyIdField } from '../utils/tenantScope.js';

const documentRevisionSchema = new mongoose.Schema({
  agencyId: agencyIdField,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  documentType: {
    type: String,
    enum: ['contract', 'invoice'],
    required: true,
    index: true,
  },
  document: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  version: { type: Number, required: true },
  snapshot: {
    sourceData: { type: mongoose.Schema.Types.Mixed, default: {} },
    sections: { type: mongoose.Schema.Types.Mixed, default: {} },
    renderedHtml: { type: String, default: '' },
    pdfUrl: { type: String, default: '' },
    pdfPath: { type: String, default: '' },
    status: { type: String, default: 'final' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  note: {
    type: String,
    enum: ['generate', 'save', 'regenerate', 'restore', 'hydrate'],
    default: 'save',
  },
}, { timestamps: { createdAt: true, updatedAt: false } });

documentRevisionSchema.index({ documentType: 1, document: 1, version: 1 }, { unique: true });
documentRevisionSchema.index({ owner: 1, documentType: 1, document: 1, createdAt: -1 });

const DocumentRevision = mongoose.model('DocumentRevision', documentRevisionSchema);

export default DocumentRevision;
