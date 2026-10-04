import ExportTemplate from '../models/ExportTemplate.js';

/** Accept raw ObjectId, string, or populated owner document. */
export const resolveOwnerId = (owner) => {
  if (!owner) return null;
  if (typeof owner === 'object' && owner._id) return owner._id;
  return owner;
};

const findActiveDefault = async (ownerId, type) => {
  const owner = resolveOwnerId(ownerId);
  if (!owner) return null;

  return ExportTemplate.findOne({
    owner,
    type,
    isDefault: true,
    isActive: true,
  })
    .sort({ updatedAt: -1 })
    .lean();
};

/**
 * Active default contract template from Admin Export Templates.
 * Admin DB document is the single source of truth for future contracts.
 */
export const getDefaultContractTemplate = async (ownerId) => {
  return findActiveDefault(ownerId, 'contract');
};

/**
 * Active default invoice template from Admin Export Templates.
 * Admin DB document is the single source of truth for future invoices.
 */
export const getDefaultInvoiceTemplate = async (ownerId) => {
  return findActiveDefault(ownerId, 'invoice');
};

/**
 * Resolve a specific template by id (must belong to owner), otherwise Admin default.
 */
export const resolveContractTemplate = async (ownerId, templateId = null) => {
  const owner = resolveOwnerId(ownerId);
  if (!owner) return null;

  if (templateId) {
    const specific = await ExportTemplate.findOne({
      _id: templateId,
      owner,
      type: 'contract',
      isActive: true,
    }).lean();
    if (specific) return specific;
  }

  return getDefaultContractTemplate(owner);
};

export default getDefaultContractTemplate;
