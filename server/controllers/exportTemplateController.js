import mongoose from 'mongoose';
import ExportTemplate from '../models/ExportTemplate.js';
import { TEMPLATE_VARIABLES } from '../services/templateEngine.js';
import {
  DEFAULT_CONTRACT_BODY,
  DEFAULT_CONTRACT_HEADER,
  DEFAULT_CONTRACT_FOOTER,
  DEFAULT_CONTRACT_CUSTOM_CSS,
  DEFAULT_CONTRACT_TERMS_HTML,
  DEFAULT_INVOICE_BODY,
} from '../services/defaultTemplates.js';
import { resolveOwnerId } from '../utils/resolveExportTemplate.js';
import { cleanupUploadedFile } from '../middleware/multer.js';
import {
  clearLocalTemplateAsset,
  persistDurableTemplateAsset,
} from '../utils/templateAssets.js';

const BUILTIN_CONTRACT_VERSION = 5;
const BUILTIN_INVOICE_VERSION = 2;

/**
 * Ensure each owner has seed contract + invoice templates.
 * Admin Export Templates are the single source of truth: never overwrite
 * existing template HTML after the initial seed (Admin edits must stick).
 */
export const ensureDefaultTemplates = async (ownerId) => {
  const owner = resolveOwnerId(ownerId);
  if (!owner) return;

  const contractDefaults = {
    name: 'Contrat de Location',
    type: 'contract',
    headerHtml: DEFAULT_CONTRACT_HEADER,
    bodyHtml: DEFAULT_CONTRACT_BODY,
    termsHtml: DEFAULT_CONTRACT_TERMS_HTML,
    footerHtml: DEFAULT_CONTRACT_FOOTER,
    customCss: DEFAULT_CONTRACT_CUSTOM_CSS,
    pageSize: 'A4',
    isDefault: true,
    isActive: true,
    templateVersion: BUILTIN_CONTRACT_VERSION,
    systemKey: 'builtin_contract',
  };

  const invoiceDefaults = {
    name: 'Facture Standard',
    type: 'invoice',
    headerHtml: DEFAULT_CONTRACT_HEADER,
    bodyHtml: DEFAULT_INVOICE_BODY,
    footerHtml: DEFAULT_CONTRACT_FOOTER,
    customCss: DEFAULT_CONTRACT_CUSTOM_CSS,
    pageSize: 'A4',
    isDefault: true,
    isActive: true,
    templateVersion: BUILTIN_INVOICE_VERSION,
    systemKey: 'builtin_invoice',
  };

  const { resolveAgencyIdFromOwner } = await import('../utils/resolveAgencyId.js');
  const agencyId = await resolveAgencyIdFromOwner(owner);

  const upsertBuiltin = async (systemKey, defaults) => {
    const doc = await ExportTemplate.findOne({ owner, systemKey });
    if (!doc) {
      await ExportTemplate.create({ owner, agencyId, ...defaults });
    } else if (agencyId && !doc.agencyId) {
      doc.agencyId = agencyId;
      await doc.save();
    }
  };

  await upsertBuiltin('builtin_contract', contractDefaults);
  await upsertBuiltin('builtin_invoice', invoiceDefaults);

  // Ensure exactly one active default per document type.
  const normalizeDefaults = async (type, builtinKey) => {
    const activeDefaults = await ExportTemplate.find({ owner, type, isDefault: true, isActive: true }).sort({ updatedAt: -1 }).lean();
    if (activeDefaults.length === 0) {
      await ExportTemplate.updateOne(
        { owner, type, systemKey: builtinKey },
        { $set: { isDefault: true } }
      );
      return;
    }

    const userDefaults = activeDefaults.filter((item) => item.systemKey !== builtinKey);
    const keep = userDefaults.length > 0 ? userDefaults[0] : activeDefaults[0];
    const disableIds = activeDefaults
      .filter((item) => item._id.toString() !== keep._id.toString())
      .map((item) => item._id);

    if (disableIds.length > 0) {
      await ExportTemplate.updateMany(
        { _id: { $in: disableIds } },
        { $set: { isDefault: false } }
      );
    }

    if (keep.systemKey === builtinKey) {
      await ExportTemplate.updateOne(
        { owner, type, systemKey: builtinKey },
        { $set: { isDefault: true } }
      );
    }
  };

  await normalizeDefaults('contract', 'builtin_contract');
  await normalizeDefaults('invoice', 'builtin_invoice');
};

export const listExportTemplates = async (req, res) => {
  try {
    const ownerId = req.user._id;
    await ensureDefaultTemplates(ownerId);

    const { type } = req.query;
    const query = { owner: ownerId, isActive: true };
    if (type && ['contract', 'invoice', 'custom'].includes(type)) {
      query.type = type;
    }

    const templates = await ExportTemplate.find(query).sort({ isDefault: -1, name: 1 }).lean();
    res.json({ success: true, templates });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load templates' });
  }
};

export const getExportTemplate = async (req, res) => {
  try {
    const template = await ExportTemplate.findOne({
      _id: req.params.id,
      owner: req.user._id,
    }).lean();

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    res.json({ success: true, template });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load template' });
  }
};

export const createExportTemplate = async (req, res) => {
  try {
    const { name, type, headerHtml, bodyHtml, termsHtml, footerHtml, customCss, pageSize, isDefault } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Template name is required' });
    }

    const templateType = ['contract', 'invoice', 'custom'].includes(type) ? type : 'custom';

    if (isDefault) {
      await ExportTemplate.updateMany(
        { owner: req.user._id, type: templateType },
        { $set: { isDefault: false } }
      );
    }

    const template = await ExportTemplate.create({
      agencyId: req.agencyId || null,
      owner: req.agencyLegacyOwnerId || req.user._id,
      name: name.trim(),
      type: templateType,
      headerHtml: headerHtml || '',
      bodyHtml: bodyHtml || '',
      termsHtml: termsHtml || '',
      footerHtml: footerHtml || '',
      customCss: customCss || '',
      pageSize: pageSize === 'Letter' ? 'Letter' : 'A4',
      isDefault: Boolean(isDefault),
    });

    res.status(201).json({ success: true, message: 'Template created', template });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to create template' });
  }
};

export const updateExportTemplate = async (req, res) => {
  try {
    const template = await ExportTemplate.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const { name, type, headerHtml, bodyHtml, termsHtml, footerHtml, customCss, pageSize, isDefault, isActive } = req.body;

    if (name !== undefined) template.name = String(name).trim();
    if (type !== undefined && ['contract', 'invoice', 'custom'].includes(type)) template.type = type;
    if (headerHtml !== undefined) template.headerHtml = headerHtml;
    if (bodyHtml !== undefined) template.bodyHtml = bodyHtml;
    if (termsHtml !== undefined) template.termsHtml = termsHtml;
    if (footerHtml !== undefined) template.footerHtml = footerHtml;
    if (customCss !== undefined) template.customCss = customCss;
    if (pageSize !== undefined) template.pageSize = pageSize === 'Letter' ? 'Letter' : 'A4';
    if (isActive !== undefined) template.isActive = Boolean(isActive);

    if (isDefault) {
      await ExportTemplate.updateMany(
        { owner: req.user._id, type: template.type, _id: { $ne: template._id } },
        { $set: { isDefault: false } }
      );
      template.isDefault = true;
    } else if (isDefault === false) {
      template.isDefault = false;
    }

    await template.save();
    res.json({ success: true, message: 'Template updated', template });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update template' });
  }
};

export const deleteExportTemplate = async (req, res) => {
  try {
    const template = await ExportTemplate.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    template.isActive = false;
    await template.save();

    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to delete template' });
  }
};

export const uploadTemplateLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Logo image is required' });
    }

    const template = await ExportTemplate.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!template) {
      cleanupUploadedFile(req.file);
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const stored = await persistDurableTemplateAsset(template._id, req.file, 'logo', {
      ownerId: req.user._id,
    });
    template.logoUrl = stored.url;
    await template.save();

    res.json({
      success: true,
      message: 'Logo uploaded',
      logoUrl: template.logoUrl,
      storage: stored.storage,
      template,
    });
  } catch (error) {
    cleanupUploadedFile(req.file);
    console.error('[uploadTemplateLogo]', error?.code || '', error.message);
    res.status(500).json({ success: false, message: 'Failed to upload logo' });
  }
};

export const uploadTemplateSignature = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Signature image is required' });
    }

    const template = await ExportTemplate.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!template) {
      cleanupUploadedFile(req.file);
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const stored = await persistDurableTemplateAsset(template._id, req.file, 'signature', {
      ownerId: req.user._id,
    });
    template.companySignatureUrl = stored.url;
    await template.save();

    res.json({
      success: true,
      message: 'Signature uploaded',
      companySignatureUrl: template.companySignatureUrl,
      storage: stored.storage,
      template,
    });
  } catch (error) {
    cleanupUploadedFile(req.file);
    console.error('[uploadTemplateSignature]', error?.code || '', error.message);
    res.status(500).json({ success: false, message: 'Failed to upload signature' });
  }
};

export const clearTemplateLogo = async (req, res) => {
  try {
    const template = await ExportTemplate.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    clearLocalTemplateAsset(template._id, 'logo', { ownerId: req.user._id });
    template.logoUrl = '';
    await template.save();
    res.json({ success: true, message: 'Logo removed', template });
  } catch (error) {
    console.error('[clearTemplateLogo]', error.message);
    res.status(500).json({ success: false, message: 'Failed to remove logo' });
  }
};

export const clearTemplateSignature = async (req, res) => {
  try {
    const template = await ExportTemplate.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    clearLocalTemplateAsset(template._id, 'signature', { ownerId: req.user._id });
    template.companySignatureUrl = '';
    await template.save();
    res.json({ success: true, message: 'Signature removed', template });
  } catch (error) {
    console.error('[clearTemplateSignature]', error.message);
    res.status(500).json({ success: false, message: 'Failed to remove signature' });
  }
};

export const getTemplateVariables = async (_req, res) => {
  res.json({ success: true, variables: TEMPLATE_VARIABLES });
};

export const previewTemplate = async (req, res) => {
  try {
    const { templateId, bookingId } = req.body;
    if (!mongoose.isValidObjectId(templateId)) {
      return res.status(400).json({ success: false, message: 'Invalid template ID' });
    }

    const template = await ExportTemplate.findOne({
      _id: templateId,
      owner: req.user._id,
    }).lean();

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    let booking = null;
    if (bookingId && mongoose.isValidObjectId(bookingId)) {
      const Booking = (await import('../models/Booking.js')).default;
      booking = await Booking.findOne({ _id: bookingId, owner: req.user._id }).populate('car').lean();
    }

    const { buildTemplateVariables, buildDocumentHtml } = await import('../services/templateEngine.js');
    const { withAgencyForDocuments } = await import('../services/documentBrandContext.js');
    const agency = await withAgencyForDocuments({ booking, owner: req.user });
    const brandedTemplate = {
      ...template,
      logoUrl: template?.logoUrl || agency?.logoUrl || '',
    };
    const variables = buildTemplateVariables(booking || {}, {
      owner: req.user,
      agency,
      template: brandedTemplate,
    });
    const html = buildDocumentHtml(brandedTemplate, variables);

    res.json({ success: true, html, variables });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to preview template' });
  }
};

export default {
  listExportTemplates,
  getExportTemplate,
  createExportTemplate,
  updateExportTemplate,
  deleteExportTemplate,
  uploadTemplateLogo,
  uploadTemplateSignature,
  clearTemplateLogo,
  clearTemplateSignature,
  getTemplateVariables,
  previewTemplate,
  ensureDefaultTemplates,
};
