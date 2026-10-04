import mongoose from 'mongoose';
import Contract from '../models/Contract.js';
import Booking from '../models/Booking.js';
import Invoice from '../models/Invoice.js';
import ExportTemplate from '../models/ExportTemplate.js';
import { publicUploadUrl } from '../services/pdfDocuments.js';
import { generateContractPdf, generateDocumentFromTemplate } from '../services/templatePdfExport.js';
import { buildDocumentHtml, buildTemplateVariables } from '../services/templateEngine.js';
import { logAudit } from '../utils/adminOps.js';
import { ensureDefaultTemplates } from './exportTemplateController.js';
import {
  getDefaultInvoiceTemplate,
  getDefaultContractTemplate,
  resolveContractTemplate,
} from '../utils/resolveExportTemplate.js';
import {
  cloneSectionsFromTemplate,
  buildTemplateSnapshot,
  buildContractSourceData,
  persistPdfFromInstance,
  assertOptimisticLock,
  archiveRevision,
  bumpDocumentVersion,
  listRevisions,
  getRevision,
  mergeSections,
  mergeSourceData,
  OptimisticLockError,
  upsertContractFromCompletion,
  isContentLocked,
  markContentLocked,
  clearContentLock,
  renderInstance,
  versionedAssetUrl,
} from '../services/documentInstanceService.js';

const generateContractNumber = async (ownerId) => {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = `CTR-${year}-`;

  const last = await Contract.findOne({
    owner: ownerId,
    contractNumber: { $regex: `^${prefix}` },
  })
    .sort({ contractNumber: -1 })
    .select('contractNumber')
    .lean();

  let seq = 1;
  if (last?.contractNumber) {
    const parts = last.contractNumber.split('-');
    const n = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
};

const createInvoiceForBooking = async ({ owner, booking, user, includeCompanyStamp = true }) => {
  const invoiceNumber = booking.reservationId
    ? `INV-${booking.reservationId.replace(/^RES-/, '')}`
    : `INV-${booking._id.toString().slice(-8).toUpperCase()}`;

  const existingInvoice = await Invoice.findOne({
    booking: booking._id,
    owner: owner._id || owner,
  }).select('invoiceNumber contentLocked sourceData version').lean();

  if (isContentLocked(existingInvoice)) {
    return {
      invoiceNumber: existingInvoice.invoiceNumber || invoiceNumber,
      invoicePath: null,
      invoicePdfUrl: null,
      skipped: true,
      reason: 'content_locked',
    };
  }

  await ensureDefaultTemplates(owner._id || owner);
  const invoiceTemplate = await getDefaultInvoiceTemplate(owner._id || owner);

  if (!invoiceTemplate) {
    throw new Error('No invoice template found. Set a default invoice template in Admin → Export Templates.');
  }

  const invoiceResult = await generateDocumentFromTemplate({
    template: invoiceTemplate,
    booking: booking.toObject ? booking.toObject() : booking,
    owner: owner._id || owner,
    documentTitle: `Invoice ${invoiceNumber}`,
    includeCompanyStamp,
  });

  const invoicePath = invoiceResult.filePath;
  const invoicePdfUrl = invoiceResult.pdfUrl;
  const sections = cloneSectionsFromTemplate(invoiceTemplate);
  const sourceData = await buildContractSourceData({
    booking,
    owner,
    template: invoiceTemplate,
    contractNumber: invoiceNumber,
    includeCompanyStamp,
  });

  await Invoice.findOneAndUpdate(
    { booking: booking._id, owner: owner._id || owner },
    {
      owner: owner._id || owner,
      booking: booking._id,
      template: invoiceTemplate._id,
      invoiceNumber,
      renderedHtml: invoiceResult.renderedHtml || '',
      pdfUrl: invoicePdfUrl || publicUploadUrl(invoicePath),
      pdfPath: invoicePath,
      sourceData,
      sections,
      templateSnapshot: buildTemplateSnapshot(invoiceTemplate),
      generatedBy: user?._id || user || null,
      createdBy: user?._id || user || null,
      updatedBy: user?._id || user || null,
      includeCompanyStamp,
      contentLocked: false,
      status: 'final',
      version: existingInvoice ? Number(existingInvoice.version || 1) + 1 : 1,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { invoiceNumber, invoicePath, invoicePdfUrl };
};

/**
 * Ensure legacy contracts have sourceData + sections without mutating templates.
 */
export const hydrateContractIfNeeded = async (contract, user, { persist = true } = {}) => {
  if (!contract) return contract;
  const needsSource = !contract.sourceData || Object.keys(contract.sourceData).length === 0;
  const needsSections = !contract.sections || (!contract.sections.bodyHtml && !contract.sections.headerHtml);

  if (!needsSource && !needsSections) return contract;

  let booking = contract.booking;
  if (booking && !booking.customerName) {
    booking = await Booking.findById(contract.booking).populate('car').lean();
  } else if (booking?._id && !booking.car?.brand) {
    booking = await Booking.findById(booking._id || booking).populate('car').lean();
  }

  let template = null;
  if (contract.template) {
    template = await ExportTemplate.findById(contract.template._id || contract.template).lean();
  }
  if (!template) {
    template = await getDefaultContractTemplate(contract.owner);
  }

  const sections = needsSections
    ? cloneSectionsFromTemplate(template || {})
    : contract.sections;

  const sourceData = needsSource
    ? await buildContractSourceData({
        booking: booking || {},
        owner: user,
        template: template || {},
        contractNumber: contract.contractNumber,
        includeCompanyStamp: contract.includeCompanyStamp !== false,
      })
    : contract.sourceData;

  if (!persist) {
    return {
      ...contract,
      sourceData,
      sections,
      template: contract.template || template?._id || null,
      templateSnapshot: contract.templateSnapshot?.templateId
        ? contract.templateSnapshot
        : buildTemplateSnapshot(template || {}),
    };
  }

  const updated = await Contract.findOneAndUpdate(
    { _id: contract._id, owner: contract.owner },
    {
      $set: {
        sourceData,
        sections,
        template: contract.template || template?._id || null,
        templateSnapshot: contract.templateSnapshot?.templateId
          ? contract.templateSnapshot
          : buildTemplateSnapshot(template || {}),
        updatedBy: user?._id || user || null,
      },
    },
    { new: true }
  )
    .populate({
      path: 'booking',
      populate: { path: 'car' },
    })
    .populate('template')
    .lean();

  return updated || { ...contract, sourceData, sections };
};

export const listContracts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', customerName = '', cin = '', phone = '' } = req.query;
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pg - 1) * lim;

    const query = { owner: req.user._id };
    const bookingQuery = [];

    if (search?.trim()) {
      const term = search.trim();
      query.$or = [
        { contractNumber: { $regex: term, $options: 'i' } },
      ];
    }

    if (customerName?.trim()) {
      bookingQuery.push({ customerName: { $regex: customerName.trim(), $options: 'i' } });
    }

    if (cin?.trim()) {
      const term = cin.trim();
      bookingQuery.push({
        $or: [
          { identityDocumentNumber: { $regex: term, $options: 'i' } },
          { passportNumber: { $regex: term, $options: 'i' } },
          { driverLicenseNumber: { $regex: term, $options: 'i' } },
        ],
      });
    }

    if (phone?.trim()) {
      bookingQuery.push({ customerPhone: { $regex: phone.trim(), $options: 'i' } });
    }

    let bookingIds = [];
    if (bookingQuery.length) {
      bookingIds = (await Booking.find({ owner: req.user._id, $or: bookingQuery }).select('_id').lean()).map((b) => b._id);
      if (!bookingIds.length) {
        return res.json({ success: true, contracts: [], pagination: { total: 0, page: pg, limit: lim, totalPages: 1 } });
      }
    }

    if (bookingIds.length) {
      query.booking = { $in: bookingIds };
    }

    const [contracts, total] = await Promise.all([
      Contract.find(query)
        .populate({
          path: 'booking',
          select: 'reservationId customerName customerPhone pickupDate returnDate price status car',
          populate: { path: 'car', select: 'brand model year' },
        })
        .populate('template', 'name type')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      Contract.countDocuments(query),
    ]);

    res.json({
      success: true,
      contracts,
      pagination: {
        total,
        page: pg,
        limit: lim,
        totalPages: Math.ceil(total / lim) || 1,
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load contracts' });
  }
};

export const getContract = async (req, res) => {
  try {
    let contract = await Contract.findOne({
      _id: req.params.id,
      owner: req.user._id,
    })
      .populate({
        path: 'booking',
        populate: { path: 'car' },
      })
      .populate('template')
      .lean();

    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    contract = await hydrateContractIfNeeded(contract, req.user);

    res.json({ success: true, contract });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load contract' });
  }
};

export const generateContract = async (req, res) => {
  try {
    const { bookingId, templateId, includeCompanyStamp = true } = req.body;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      owner: req.user._id,
    }).populate('car');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    await ensureDefaultTemplates(req.user._id);

    const template = await resolveContractTemplate(
      req.user._id,
      templateId && mongoose.isValidObjectId(templateId) ? templateId : null,
    );
    if (!template) {
      return res.status(404).json({ success: false, message: 'No contract template found. Create one in Export Templates.' });
    }

    const contractNumber = await generateContractNumber(req.user._id);
    const { filePath, pdfUrl, renderedHtml, variables } = await generateContractPdf({
      template: template.toObject ? template.toObject() : template,
      booking: booking.toObject ? booking.toObject() : booking,
      contractNumber,
      owner: req.user,
      includeCompanyStamp,
    });

    const sections = cloneSectionsFromTemplate(template);
    const sourceData = {
      ...(variables || {}),
      _meta: {
        contractNumber,
        includeCompanyStamp: Boolean(includeCompanyStamp),
        bookingId: String(booking._id),
        reservationId: booking.reservationId || '',
      },
    };

    const contract = await Contract.create({
      agencyId: req.agencyId || booking.agencyId || null,
      owner: req.agencyLegacyOwnerId || req.user._id,
      booking: booking._id,
      template: template._id,
      contractNumber,
      renderedHtml,
      pdfUrl,
      pdfPath: filePath,
      sourceData,
      sections,
      templateSnapshot: buildTemplateSnapshot(template),
      generatedBy: req.user._id,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      includeCompanyStamp: Boolean(includeCompanyStamp),
      status: 'final',
      version: 1,
    });

    await archiveRevision({
      owner: req.user._id,
      documentType: 'contract',
      document: contract,
      user: req.user,
      note: 'generate',
    });

    await logAudit({
      owner: req.user._id,
      action: 'contract.generate',
      entityType: 'Contract',
      entityId: contract._id,
      details: `Contract ${contractNumber} generated for ${booking.reservationId}`,
    });

    res.status(201).json({
      success: true,
      message: 'Contract generated successfully',
      contract,
    });
  } catch (error) {
    console.error('Contract generation failed:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Contract number conflict, please retry' });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate contract',
    });
  }
};

export const updateContract = async (req, res) => {
  try {
    const {
      expectedUpdatedAt,
      sourceData,
      sections,
      regeneratePdf = true,
      status,
      includeCompanyStamp,
    } = req.body;

    const live = await Contract.findOne({ _id: req.params.id, owner: req.user._id });
    if (!live) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    assertOptimisticLock(live, expectedUpdatedAt);

    const hydrated = await hydrateContractIfNeeded(live.toObject(), req.user, { persist: false });
    if (!live.sourceData || Object.keys(live.sourceData || {}).length === 0) {
      live.sourceData = hydrated.sourceData;
    }
    if (!live.sections || (!live.sections.bodyHtml && !live.sections.headerHtml)) {
      live.sections = hydrated.sections;
      live.template = live.template || hydrated.template;
      live.templateSnapshot = live.templateSnapshot?.templateId
        ? live.templateSnapshot
        : hydrated.templateSnapshot;
    }

    if (sourceData && typeof sourceData === 'object') {
      live.sourceData = mergeSourceData(live.sourceData, sourceData);
    }
    if (sections && typeof sections === 'object') {
      live.sections = mergeSections(live.sections, sections);
    }
    if (typeof includeCompanyStamp === 'boolean') {
      live.includeCompanyStamp = includeCompanyStamp;
      live.sourceData = mergeSourceData(live.sourceData, {
        _meta: { ...(live.sourceData?._meta || {}), includeCompanyStamp },
      });
    }
    if (status === 'draft' || status === 'final') {
      live.status = status;
    }

    markContentLocked(live);
    bumpDocumentVersion(live);
    live.updatedBy = req.user._id;

    // Always refresh HTML from instance SSOT so preview/list reopen stay current
    live.renderedHtml = renderInstance({
      sections: live.sections,
      sourceData: live.sourceData,
      documentTitle: `Contract ${live.contractNumber}`,
    });

    if (regeneratePdf) {
      const pdf = await persistPdfFromInstance({
        sections: live.sections,
        sourceData: live.sourceData,
        owner: req.user,
        documentTitle: `Contract ${live.contractNumber}`,
        filePrefix: `contract-${live.contractNumber}`,
      });
      live.renderedHtml = pdf.renderedHtml;
      live.pdfPath = pdf.filePath;
      live.pdfUrl = pdf.pdfUrl;
    }

    await live.save();

    // Archive the NEW tip version after save (never re-archive the previous tip)
    await archiveRevision({
      owner: req.user._id,
      documentType: 'contract',
      document: live,
      user: req.user,
      note: 'save',
    });

    await logAudit({
      owner: req.user._id,
      action: 'contract.update',
      entityType: 'Contract',
      entityId: live._id,
      details: `Contract ${live.contractNumber} updated (v${live.version})`,
    });

    const populated = await Contract.findById(live._id)
      .populate({ path: 'booking', populate: { path: 'car' } })
      .populate('template')
      .lean();

    res.json({
      success: true,
      message: 'Contract updated',
      contract: {
        ...populated,
        pdfUrl: versionedAssetUrl(populated.pdfUrl, populated.version, populated.updatedAt),
      },
    });
  } catch (error) {
    if (error instanceof OptimisticLockError) {
      return res.status(409).json({ success: false, message: error.message, code: error.code });
    }
    console.error(error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to update contract' });
  }
};

export const regenerateContract = async (req, res) => {
  try {
    const { expectedUpdatedAt, fromBooking = false } = req.body || {};
    const doc = await Contract.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    if (expectedUpdatedAt) assertOptimisticLock(doc, expectedUpdatedAt);

    if (fromBooking) {
      const booking = await Booking.findById(doc.booking).populate('car').lean();
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Linked booking not found' });
      }
      let template = null;
      if (doc.template) {
        template = await ExportTemplate.findById(doc.template).lean();
      }
      if (!template) {
        template = await getDefaultContractTemplate(req.user._id);
      }
      doc.sections = cloneSectionsFromTemplate(template || {});
      doc.sourceData = await buildContractSourceData({
        booking,
        owner: req.user,
        template: template || {},
        contractNumber: doc.contractNumber,
        includeCompanyStamp: doc.includeCompanyStamp !== false,
      });
      doc.template = template?._id || doc.template;
      doc.templateSnapshot = buildTemplateSnapshot(template || {});
      clearContentLock(doc);
    } else {
      const hydrated = await hydrateContractIfNeeded(doc.toObject(), req.user, { persist: false });
      if (!doc.sourceData || Object.keys(doc.sourceData || {}).length === 0) {
        doc.sourceData = hydrated.sourceData;
      }
      if (!doc.sections || (!doc.sections.bodyHtml && !doc.sections.headerHtml)) {
        doc.sections = hydrated.sections;
      }
    }

    const pdf = await persistPdfFromInstance({
      sections: doc.sections,
      sourceData: doc.sourceData,
      owner: req.user,
      documentTitle: `Contract ${doc.contractNumber}`,
      filePrefix: `contract-${doc.contractNumber}`,
    });

    doc.renderedHtml = pdf.renderedHtml;
    doc.pdfPath = pdf.filePath;
    doc.pdfUrl = pdf.pdfUrl;
    bumpDocumentVersion(doc);
    doc.updatedBy = req.user._id;
    await doc.save();

    await archiveRevision({
      owner: req.user._id,
      documentType: 'contract',
      document: doc,
      user: req.user,
      note: fromBooking ? 'refresh-from-booking' : 'regenerate',
    });

    await logAudit({
      owner: req.user._id,
      action: fromBooking ? 'contract.refresh_from_booking' : 'contract.regenerate',
      entityType: 'Contract',
      entityId: doc._id,
      details: `Contract ${doc.contractNumber} ${fromBooking ? 'refreshed from booking' : 'PDF regenerated'} (v${doc.version})`,
    });

    const populated = await Contract.findById(doc._id)
      .populate({ path: 'booking', populate: { path: 'car' } })
      .populate('template')
      .lean();

    res.json({
      success: true,
      message: fromBooking ? 'Contract refreshed from booking' : 'Contract PDF regenerated',
      contract: {
        ...populated,
        pdfUrl: versionedAssetUrl(populated.pdfUrl, populated.version, populated.updatedAt),
      },
    });
  } catch (error) {
    if (error instanceof OptimisticLockError) {
      return res.status(409).json({ success: false, message: error.message, code: error.code });
    }
    console.error(error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to regenerate contract' });
  }
};

export const listContractVersions = async (req, res) => {
  try {
    const contract = await Contract.findOne({ _id: req.params.id, owner: req.user._id }).select('_id').lean();
    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }
    const versions = await listRevisions({
      owner: req.user._id,
      documentType: 'contract',
      documentId: contract._id,
      limit: parseInt(req.query.limit, 10) || 50,
    });
    res.json({ success: true, versions });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load versions' });
  }
};

export const restoreContractVersion = async (req, res) => {
  try {
    const version = Number(req.params.version);
    const live = await Contract.findOne({ _id: req.params.id, owner: req.user._id });
    if (!live) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    const revision = await getRevision({
      owner: req.user._id,
      documentType: 'contract',
      documentId: live._id,
      version,
    });
    if (!revision) {
      return res.status(404).json({ success: false, message: 'Version not found' });
    }

    live.sourceData = revision.snapshot.sourceData || {};
    live.sections = revision.snapshot.sections || {};
    live.status = revision.snapshot.status || live.status;
    markContentLocked(live);

    const pdf = await persistPdfFromInstance({
      sections: live.sections,
      sourceData: live.sourceData,
      owner: req.user,
      documentTitle: `Contract ${live.contractNumber}`,
      filePrefix: `contract-${live.contractNumber}`,
    });
    live.renderedHtml = pdf.renderedHtml;
    live.pdfPath = pdf.filePath;
    live.pdfUrl = pdf.pdfUrl;
    bumpDocumentVersion(live);
    live.updatedBy = req.user._id;
    await live.save();

    // Restore creates a NEW tip revision; historical rows stay immutable
    await archiveRevision({
      owner: req.user._id,
      documentType: 'contract',
      document: live,
      user: req.user,
      note: 'restore',
      meta: { restoredFrom: version },
    });

    await logAudit({
      owner: req.user._id,
      action: 'contract.restore',
      entityType: 'Contract',
      entityId: live._id,
      details: `Contract ${live.contractNumber} restored from v${version} → v${live.version}`,
    });

    res.json({ success: true, message: 'Version restored', contract: live.toObject() });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to restore version' });
  }
};

export const previewContract = async (req, res) => {
  try {
    let contract = await Contract.findOne({
      _id: req.params.id,
      owner: req.user._id,
    }).lean();

    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    contract = await hydrateContractIfNeeded(contract, req.user);

    // Always render from instance SSOT (never stale HTML, never live template)
    const html = (contract.sections && contract.sourceData)
      ? renderInstance({
          sections: contract.sections,
          sourceData: contract.sourceData,
          documentTitle: `Contract ${contract.contractNumber}`,
        })
      : (contract.renderedHtml || '');

    res.json({ success: true, html });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to preview contract' });
  }
};

export const previewContractFromBooking = async (req, res) => {
  try {
    const { bookingId, templateId, includeCompanyStamp = true } = req.body;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      owner: req.user._id,
    }).populate('car').lean();

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    await ensureDefaultTemplates(req.user._id);

    const template = await resolveContractTemplate(
      req.user._id,
      templateId && mongoose.isValidObjectId(templateId) ? templateId : null,
    );

    if (!template) {
      return res.status(404).json({ success: false, message: 'No template found' });
    }

    const contractNumber = 'PREVIEW';
    const { withAgencyForDocuments } = await import('../services/documentBrandContext.js');
    const agency = await withAgencyForDocuments({ booking, owner: req.user });
    const brandedTemplate = {
      ...template,
      logoUrl: template?.logoUrl || agency?.logoUrl || '',
    };
    const variables = buildTemplateVariables(booking, {
      contractNumber,
      owner: req.user,
      agency,
      template: brandedTemplate,
      includeCompanyStamp,
    });
    const html = buildDocumentHtml(brandedTemplate, variables);

    res.json({ success: true, html, variables });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to preview contract' });
  }
};

export const downloadContractPdf = async (req, res) => {
  try {
    let contract = await Contract.findOne({
      _id: req.params.id,
      owner: req.user._id,
    }).lean();

    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    contract = await hydrateContractIfNeeded(contract, req.user);

    const { ensureInstancePdfFile } = await import('../utils/ensureDocumentPdf.js');
    const { filePath } = await ensureInstancePdfFile({
      document: contract,
      owner: req.user,
      documentTitle: `Contract ${contract.contractNumber}`,
      filePrefix: `contract-${contract.contractNumber}`,
      Model: Contract,
    });

    // Default: stream the PDF bytes (authenticated). JSON only when explicitly requested.
    if (String(req.query.format || '').toLowerCase() === 'json') {
      const fresh = await Contract.findById(contract._id).lean();
      return res.json({
        success: true,
        pdfUrl: versionedAssetUrl(
          fresh?.pdfUrl || contract.pdfUrl,
          fresh?.version || contract.version,
          fresh?.updatedAt || contract.updatedAt,
        ),
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${String(contract.contractNumber || 'contract').replace(/"/g, '')}.pdf"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(filePath);
  } catch (error) {
    console.error('[downloadContractPdf]', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to download contract PDF',
    });
  }
};

export const listBookingsForContracts = async (req, res) => {
  try {
    const bookings = await Booking.find({
      owner: req.user._id,
      status: { $nin: ['cancelled'] },
    })
      .populate('car', 'brand model year licensePlate')
      .select([
        'reservationId',
        'customerName',
        'customerPhone',
        'pickupDate',
        'returnDate',
        'price',
        'status',
        'channel',
        'dateOfBirth',
        'nationality',
        'customerAddress',
        'placeOfBirth',
        'identityDocumentNumber',
        'identityIssuedOn',
        'driverLicenseNumber',
        'driverLicenseExpiry',
        'driverLicenseIssuedOn',
        'passportNumber',
        'deliveredBy',
        'receivedBy',
        'fuelLevelStart',
        'kmDepart',
        'kmRetour',
        'franchiseAmount',
        'secondDriver',
      ].join(' '))
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({ success: true, bookings });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load bookings' });
  }
};

export { upsertContractFromCompletion };

export default {
  listContracts,
  getContract,
  generateContract,
  updateContract,
  regenerateContract,
  listContractVersions,
  restoreContractVersion,
  previewContract,
  previewContractFromBooking,
  downloadContractPdf,
  listBookingsForContracts,
  upsertContractFromCompletion,
  createInvoiceForBooking,
};
