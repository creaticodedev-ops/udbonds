import mongoose from 'mongoose';
import { agencyIdField } from '../utils/tenantScope.js';
const { ObjectId } = mongoose.Schema.Types;

const auditLogSchema = new mongoose.Schema({
  agencyId: agencyIdField,
  owner: { type: ObjectId, ref: 'User', required: true, index: true },
  actor: { type: ObjectId, ref: 'User', default: null },
  action: { type: String, required: true },
  entityType: { type: String, default: '' },
  entityId: { type: String, default: '' },
  details: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

auditLogSchema.index({ owner: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
