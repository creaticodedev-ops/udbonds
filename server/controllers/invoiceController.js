import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Booking from '../models/Booking.js';
import ExportTemplate from '../models/ExportTemplate.js';
import { publicUploadUrl } from '../services/pdfDocuments.js';
import { generateDocumentFromTemplate } from '../services/templatePdfExport.js';
import { ensureDefaultTemplates } from './exportTemplateController.js';
import { getDefaultInvoiceTemplate } from '../utils/resolveExportTemplate.js';
import { logAudit } from '../utils/adminOps.js';
import {
  cloneSectionsFromTemplate,
  buildTemplateSnapshot,
  buildInvoiceSourceData,
  persistPdfFromInstance,
  assertOptimisticLock,
  archiveRevision,
  bumpDocumentVersion,
  listRevisions,
  getRevision,
  mergeSections,
  mergeSourceData,
  OptimisticLockError,
  isContentLocked,
  markContentLocked,
  clearContentLock,
  renderInstance,
  versionedAssetUrl,
} from '../services/documentInstanceService.js';

const buildInvoiceNumber = (booking, provided = '') => {
  const trimmed = String(provided || '').trim();
  if (trimmed) return trimmed.toUpperCase();
  if (booking?.reservationId) return `INV-${booking.reservationId.replace(/^RES-/, '')}`;
  return `INV-${Date.now().toString().slice(-8).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
};

const normalizeInvoiceItems = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      description: String(item.description || '').trim(),
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
      taxRate: Number(item.taxRate || 0),
    }))
    .filter((item) => item.description || item.quantity || item.unitPrice);

const computeInvoiceTotals = ({ items, discountAmount = 0, taxAmount: suppliedTaxAmount }) => {
  const normalizedItems = normalizeInvoiceItems(items);
  const subtotal = normalizedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const computedTaxAmount = Number(
    suppliedTaxAmount ??
      normalizedItems.reduce(
        (sum, item) => sum + ((item.quantity * item.unitPrice) * (item.taxRate || 0) / 100),
        0,
      ),
  );
  const discount = Number(discountAmount || 0);
  const totalAmount = Math.max(0, subtotal + computedTaxAmount - discount);
  return { normalizedItems, subtotal, taxAmount: computedTaxAmount, discountAmount: discount, totalAmount };
};

const invoiceFieldsFromDoc = (invoice) => ({
  invoiceNumber: invoice.invoiceNumber,
  invoiceDate: invoice.invoiceDate,
  dueDate: invoice.dueDate,
  currency: invoice.currency,
  customerName: invoice.customerName,
  customerEmail: invoice.customerEmail,
  customerPhone: invoice.customerPhone,
  customerAddress: invoice.customerAddress,
  customerTaxId: invoice.customerTaxId,
  vehicleBrand: invoice.vehicleBrand,
  vehicleModel: invoice.vehicleModel,
  vehicleYear: invoice.vehicleYear,
  vehiclePlate: invoice.vehiclePlate,
  vehicleType: invoice.vehicleType,
  items: invoice.items || [],
  subtotal: invoice.subtotal,
  discountAmount: invoice.discountAmount,
  taxAmount: invoice.taxAmount,
  totalAmount: invoice.totalAmount,
  paymentStatus: invoice.paymentStatus,
  paymentMethod: invoice.paymentMethod,
  paymentReference: invoice.paymentReference,
  notes: invoice.notes,
});

export const hydrateInvoiceIfNeeded = async (invoice, user, { persist = true } = {}) => {
  if (!invoice) return invoice;
  const needsSource = !invoice.sourceData || Object.keys(invoice.sourceData).length === 0;
  const needsSections = !invoice.sections || (!invoice.sections.bodyHtml && !invoice.sections.headerHtml);
  if (!needsSource && !needsSections) return invoice;

  let template = null;
  if (invoice.template) {
    template = await ExportTemplate.findById(invoice.template._id || invoice.template).lean();
  }
  if (!template) {
    await ensureDefaultTemplates(invoice.owner);
    template = await getDefaultInvoiceTemplate(invoice.owner);
  }

  let booking = null;
  if (invoice.booking) {
    booking = await Booking.findById(invoice.booking._id || invoice.booking).populate('car').lean();
  }

  const sections = needsSections ? cloneSectionsFromTemplate(template || {}) : invoice.sections;
  const sourceData = needsSource
    ? await buildInvoiceSourceData({
        invoiceFields: invoiceFieldsFromDoc(invoice),
        booking,
        owner: user,
        template: template || {},
        includeCompanyStamp: invoice.includeCompanyStamp !== false,
      })
    : invoice.sourceData;

  if (!persist) {
    return {
      ...invoice,
      sourceData,
      sections,
      template: invoice.template || template?._id || null,
      templateSnapshot: invoice.templateSnapshot?.templateId
        ? invoice.templateSnapshot
        : buildTemplateSnapshot(template || {}),
    };
  }

  const updated = await Invoice.findOneAndUpdate(
    { _id: invoice._id, owner: invoice.owner },
    {
      $set: {
        sourceData,
        sections,
        template: invoice.template || template?._id || null,
        templateSnapshot: invoice.templateSnapshot?.templateId
          ? invoice.templateSnapshot
          : buildTemplateSnapshot(template || {}),
        updatedBy: user?._id || user || null,
      },
    },
    { new: true },
  )
    .populate('booking')
    .populate('template')
    .lean();

  return updated || { ...invoice, sourceData, sections };
};

const generateInvoiceDocument = async ({ owner, invoiceNumber, invoiceData, includeCompanyStamp, booking = null, template = null }) => {
  await ensureDefaultTemplates(owner._id || owner);
  const invoiceTemplate = template || await getDefaultInvoiceTemplate(owner._id || owner);

  if (!invoiceTemplate) {
    throw new Error('No invoice template found. Set a default invoice template in Admin → Export Templates.');
  }

  const bookingLike = {
    ...(booking || {}),
    _id: booking?._id || null,
    reservationId: invoiceNumber,
    customerName: invoiceData.customerName || '—',
    customerEmail: invoiceData.customerEmail || '',
    customerPhone: invoiceData.customerPhone || '',
    nationality: invoiceData.customerNationality || '',
    dateOfBirth: invoiceData.customerDob || '',
    pickupDate: invoiceData.invoiceDate || new Date(),
    returnDate: invoiceData.dueDate || invoiceData.invoiceDate || new Date(),
    price: invoiceData.totalAmount || 0,
    paymentStatus: invoiceData.paymentStatus || 'pending',
    notes: invoiceData.notes || '',
    channel: 'manual',
    car: invoiceData.vehicleBrand || invoiceData.vehicleModel || invoiceData.vehiclePlate
      ? {
          brand: invoiceData.vehicleBrand || '',
          model: invoiceData.vehicleModel || '',
          year: invoiceData.vehicleYear || '',
          licensePlate: invoiceData.vehiclePlate || '',
          category: invoiceData.vehicleType || '',
        }
      : undefined,
    priceBreakdown: {
      rentalPrice: invoiceData.subtotal || 0,
      pickupDeliveryFee: 0,
      dropoffDeliveryFee: 0,
      discountTotal: invoiceData.discountAmount || 0,
    },
    customerAddress: invoiceData.customerAddress || '',
  };

  const invoiceResult = await generateDocumentFromTemplate({
    template: invoiceTemplate,
    booking: bookingLike,
    owner: owner._id || owner,
    documentTitle: `Invoice ${invoiceNumber}`,
    includeCompanyStamp,
  });

  const sourceData = await buildInvoiceSourceData({
    invoiceFields: { ...invoiceData, invoiceNumber },
    booking: bookingLike,
    owner,
    template: invoiceTemplate,
    includeCompanyStamp,
  });

  return {
    filePath: invoiceResult.filePath,
    pdfUrl: invoiceResult.pdfUrl,
    renderedHtml: invoiceResult.renderedHtml || '',
    variables: invoiceResult.variables || {},
    template: invoiceTemplate,
    sections: cloneSectionsFromTemplate(invoiceTemplate),
    sourceData,
  };
};

export const listInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', customerName = '', cin = '', phone = '' } = req.query;
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pg - 1) * lim;

    const query = { owner: req.user._id };
    const invoiceFilters = [];

    if (search?.trim()) {
      const term = search.trim();
      invoiceFilters.push(
        { invoiceNumber: { $regex: term, $options: 'i' } },
        { customerName: { $regex: term, $options: 'i' } },
        { customerEmail: { $regex: term, $options: 'i' } },
        { customerPhone: { $regex: term, $options: 'i' } },
      );
    }

    if (customerName?.trim()) {
      invoiceFilters.push({ customerName: { $regex: customerName.trim(), $options: 'i' } });
    }

    if (cin?.trim()) {
      const term = cin.trim();
      invoiceFilters.push({ customerTaxId: { $regex: term, $options: 'i' } });
    }

    if (phone?.trim()) {
      invoiceFilters.push({ customerPhone: { $regex: phone.trim(), $options: 'i' } });
    }

    if (invoiceFilters.length) {
      query.$or = invoiceFilters;
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate({
          path: 'booking',
          select: 'reservationId customerName customerPhone pickupDate returnDate price status car',
          populate: { path: 'car', select: 'brand model year' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      Invoice.countDocuments(query),
    ]);

    res.json({
      success: true,
      invoices,
      pagination: {
        total,
        page: pg,
        limit: lim,
        totalPages: Math.ceil(total / lim) || 1,
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load invoices' });
  }
};

export const getInvoice = async (req, res) => {
  try {
    let invoice = await Invoice.findOne({ _id: req.params.id, owner: req.user._id })
      .populate('booking')
      .populate('template')
      .lean();
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    invoice = await hydrateInvoiceIfNeeded(invoice, req.user);
    res.json({ success: true, invoice });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load invoice' });
  }
};

export const generateInvoice = async (req, res) => {
  try {
    const { bookingId, includeCompanyStamp = true } = req.body;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await Booking.findOne({ _id: bookingId, owner: req.user._id }).populate('car');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const invoiceNumber = buildInvoiceNumber(booking);
    const invoiceData = {
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      customerAddress: booking.customerAddress || '',
      customerNationality: booking.nationality || '',
      customerDob: booking.dateOfBirth || '',
      invoiceDate: booking.pickupDate || new Date(),
      dueDate: booking.returnDate || booking.pickupDate || new Date(),
      subtotal: booking.price || 0,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: booking.price || 0,
      paymentStatus: booking.paymentStatus || 'pending',
      notes: booking.notes || '',
      vehicleBrand: booking.car?.brand || '',
      vehicleModel: booking.car?.model || '',
      vehicleYear: booking.car?.year || '',
      vehiclePlate: booking.car?.licensePlate || '',
      currency: req.body.currency || 'MAD',
      items: [{
        description: `Rental — ${booking.car?.brand || ''} ${booking.car?.model || ''}`.trim(),
        quantity: 1,
        unitPrice: booking.price || 0,
        taxRate: 0,
      }],
    };

    const generated = await generateInvoiceDocument({
      owner: req.user,
      invoiceNumber,
      invoiceData,
      includeCompanyStamp,
      booking,
    });

    const existing = await Invoice.findOne({ booking: booking._id, owner: req.user._id });
    if (existing && isContentLocked(existing) && !req.body.forceFromBooking) {
      return res.status(409).json({
        success: false,
        code: 'CONTENT_LOCKED',
        message: 'This invoice was manually edited. Open it in Invoices to update, or pass forceFromBooking to replace from booking data.',
        invoice: existing,
      });
    }

    const invoice = await Invoice.findOneAndUpdate(
      { booking: booking._id, owner: req.user._id },
      {
        owner: req.user._id,
        booking: booking._id,
        template: generated.template._id,
        source: 'booking',
        invoiceNumber,
        invoiceDate: new Date(),
        currency: invoiceData.currency,
        customerName: booking.customerName || '',
        customerEmail: booking.customerEmail || '',
        customerPhone: booking.customerPhone || '',
        customerAddress: booking.customerAddress || '',
        vehicleBrand: booking.car?.brand || '',
        vehicleModel: booking.car?.model || '',
        vehicleYear: booking.car?.year || '',
        vehiclePlate: booking.car?.licensePlate || '',
        items: invoiceData.items,
        subtotal: booking.price || 0,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: booking.price || 0,
        paymentStatus: booking.paymentStatus || 'pending',
        notes: booking.notes || '',
        renderedHtml: generated.renderedHtml,
        pdfUrl: generated.pdfUrl || publicUploadUrl(generated.filePath),
        pdfPath: generated.filePath,
        sourceData: generated.sourceData,
        sections: generated.sections,
        templateSnapshot: buildTemplateSnapshot(generated.template),
        generatedBy: req.user._id,
        createdBy: existing?.createdBy || req.user._id,
        updatedBy: req.user._id,
        includeCompanyStamp,
        contentLocked: false,
        status: 'final',
        version: existing ? Number(existing.version || 1) + 1 : 1,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    // Archive tip AFTER version bump (create → v1; replace → vN+1)
    await archiveRevision({
      owner: req.user._id,
      documentType: 'invoice',
      document: invoice,
      user: req.user,
      note: existing
        ? (req.body.forceFromBooking ? 'refresh-from-booking' : 'regenerate')
        : 'generate',
    });

    await logAudit({
      owner: req.user._id,
      action: existing ? 'invoice.regenerate' : 'invoice.generate',
      entityType: 'Invoice',
      entityId: invoice._id,
      details: `Invoice ${invoiceNumber} ${existing ? 'updated' : 'generated'} for booking`,
    });

    res.status(201).json({ success: true, message: 'Invoice generated successfully', invoice });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to generate invoice' });
  }
};

export const createManualInvoice = async (req, res) => {
  try {
    const {
      invoiceNumber,
      invoiceDate,
      dueDate,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerTaxId,
      vehicleBrand,
      vehicleModel,
      vehicleYear,
      vehiclePlate,
      vehicleType,
      items = [],
      discountAmount = 0,
      taxAmount: suppliedTaxAmount,
      paymentStatus = 'pending',
      paymentMethod = 'cash',
      paymentReference = '',
      notes = '',
      currency = 'MAD',
      includeCompanyStamp = true,
    } = req.body;

    if (!customerName?.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    const { normalizedItems, subtotal, taxAmount, discountAmount: discount, totalAmount } = computeInvoiceTotals({
      items,
      discountAmount,
      taxAmount: suppliedTaxAmount,
    });

    if (!normalizedItems.length) {
      return res.status(400).json({ success: false, message: 'At least one invoice item is required' });
    }

    const finalInvoiceNumber = buildInvoiceNumber(null, invoiceNumber);
    const invoiceDateValue = invoiceDate ? new Date(invoiceDate) : new Date();
    const dueDateValue = dueDate ? new Date(dueDate) : null;
    const itemsSummary = normalizedItems.map((item) => `${item.description || 'Item'} x${item.quantity || 1} @ ${currency} ${Number(item.unitPrice || 0).toFixed(2)}`).join('\n');
    const finalNotes = [notes, itemsSummary].filter(Boolean).join('\n\n');

    const invoiceData = {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerTaxId,
      customerNationality: '',
      customerDob: '',
      invoiceDate: invoiceDateValue,
      dueDate: dueDateValue,
      subtotal,
      discountAmount: discount,
      taxAmount,
      totalAmount,
      paymentStatus,
      paymentMethod,
      paymentReference,
      notes: finalNotes,
      vehicleBrand,
      vehicleModel,
      vehicleYear,
      vehiclePlate,
      vehicleType,
      currency,
      items: normalizedItems,
    };

    const generated = await generateInvoiceDocument({
      owner: req.user,
      invoiceNumber: finalInvoiceNumber,
      invoiceData,
      includeCompanyStamp,
    });

    const invoice = await Invoice.create({
      agencyId: req.agencyId || null,
      owner: req.agencyLegacyOwnerId || req.user._id,
      booking: null,
      template: generated.template._id,
      source: 'manual',
      invoiceNumber: finalInvoiceNumber,
      invoiceDate: invoiceDateValue,
      dueDate: dueDateValue,
      currency,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerTaxId,
      vehicleBrand,
      vehicleModel,
      vehicleYear,
      vehiclePlate,
      vehicleType,
      items: normalizedItems,
      subtotal,
      discountAmount: discount,
      taxAmount,
      totalAmount,
      paymentStatus,
      paymentMethod,
      paymentReference,
      notes: finalNotes,
      renderedHtml: generated.renderedHtml,
      pdfUrl: generated.pdfUrl || publicUploadUrl(generated.filePath),
      pdfPath: generated.filePath,
      sourceData: generated.sourceData,
      sections: generated.sections,
      templateSnapshot: buildTemplateSnapshot(generated.template),
      generatedBy: req.user._id,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      includeCompanyStamp,
      status: 'final',
      version: 1,
    });

    await archiveRevision({
      owner: req.user._id,
      documentType: 'invoice',
      document: invoice,
      user: req.user,
      note: 'generate',
    });

    res.status(201).json({ success: true, message: 'Manual invoice created successfully', invoice });
  } catch (error) {
    console.error(error.message);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Invoice number already exists, please choose another one' });
    }
    res.status(500).json({ success: false, message: 'Failed to create manual invoice' });
  }
};

export const updateInvoice = async (req, res) => {
  try {
    const {
      expectedUpdatedAt,
      regeneratePdf = true,
      sections,
      sourceData,
      status,
      includeCompanyStamp,
      ...fields
    } = req.body;

    const live = await Invoice.findOne({ _id: req.params.id, owner: req.user._id });
    if (!live) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    assertOptimisticLock(live, expectedUpdatedAt);

    const hydrated = await hydrateInvoiceIfNeeded(live.toObject(), req.user, { persist: false });
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

    const doc = live;

    const nextItems = fields.items !== undefined ? fields.items : doc.items;
    const { normalizedItems, subtotal, taxAmount, discountAmount, totalAmount } = computeInvoiceTotals({
      items: nextItems,
      discountAmount: fields.discountAmount !== undefined ? fields.discountAmount : doc.discountAmount,
      taxAmount: fields.taxAmount,
    });

    if (fields.items !== undefined && !normalizedItems.length) {
      return res.status(400).json({ success: false, message: 'At least one invoice item is required' });
    }

    // Never invent a new invoice number on PATCH — only allow explicit same/new unique value
    if (fields.invoiceNumber && String(fields.invoiceNumber).trim()) {
      doc.invoiceNumber = String(fields.invoiceNumber).trim().toUpperCase();
    }
    if (fields.invoiceDate) doc.invoiceDate = new Date(fields.invoiceDate);
    if (fields.dueDate !== undefined) doc.dueDate = fields.dueDate ? new Date(fields.dueDate) : null;
    if (fields.currency !== undefined) doc.currency = fields.currency;
    if (fields.customerName !== undefined) doc.customerName = fields.customerName;
    if (fields.customerEmail !== undefined) doc.customerEmail = fields.customerEmail;
    if (fields.customerPhone !== undefined) doc.customerPhone = fields.customerPhone;
    if (fields.customerAddress !== undefined) doc.customerAddress = fields.customerAddress;
    if (fields.customerTaxId !== undefined) doc.customerTaxId = fields.customerTaxId;
    if (fields.vehicleBrand !== undefined) doc.vehicleBrand = fields.vehicleBrand;
    if (fields.vehicleModel !== undefined) doc.vehicleModel = fields.vehicleModel;
    if (fields.vehicleYear !== undefined) doc.vehicleYear = fields.vehicleYear;
    if (fields.vehiclePlate !== undefined) doc.vehiclePlate = fields.vehiclePlate;
    if (fields.vehicleType !== undefined) doc.vehicleType = fields.vehicleType;
    if (fields.paymentStatus !== undefined) doc.paymentStatus = fields.paymentStatus;
    if (fields.paymentMethod !== undefined) doc.paymentMethod = fields.paymentMethod;
    if (fields.paymentReference !== undefined) doc.paymentReference = fields.paymentReference;
    if (fields.notes !== undefined) doc.notes = fields.notes;
    if (typeof includeCompanyStamp === 'boolean') doc.includeCompanyStamp = includeCompanyStamp;
    if (status === 'draft' || status === 'final') doc.status = status;

    if (fields.items !== undefined || fields.discountAmount !== undefined || fields.taxAmount !== undefined) {
      doc.items = normalizedItems;
      doc.subtotal = subtotal;
      doc.discountAmount = discountAmount;
      doc.taxAmount = taxAmount;
      doc.totalAmount = totalAmount;
    }

    if (sections && typeof sections === 'object') {
      doc.sections = mergeSections(doc.sections, sections);
    }

    const rebuiltSource = await buildInvoiceSourceData({
      invoiceFields: invoiceFieldsFromDoc(doc),
      booking: doc.booking ? await Booking.findById(doc.booking).populate('car').lean() : null,
      owner: req.user,
      template: doc.sections,
      includeCompanyStamp: doc.includeCompanyStamp,
    });
    // Prefer existing instance source as base so booking never silently rewrites edits
    const baseSource = (doc.sourceData && Object.keys(doc.sourceData).length)
      ? doc.sourceData
      : rebuiltSource;
    doc.sourceData = sourceData && typeof sourceData === 'object'
      ? mergeSourceData(mergeSourceData(rebuiltSource, baseSource), sourceData)
      : mergeSourceData(rebuiltSource, baseSource);

    // Instance fields are SSOT after edit — do not keep pulling booking into locked content
    markContentLocked(doc);
    bumpDocumentVersion(doc);
    doc.updatedBy = req.user._id;

    doc.renderedHtml = renderInstance({
      sections: doc.sections,
      sourceData: doc.sourceData,
      documentTitle: `Invoice ${doc.invoiceNumber}`,
    });

    if (regeneratePdf) {
      const pdf = await persistPdfFromInstance({
        sections: doc.sections,
        sourceData: doc.sourceData,
        owner: req.user,
        documentTitle: `Invoice ${doc.invoiceNumber}`,
        filePrefix: `invoice-${doc.invoiceNumber}`,
      });
      doc.renderedHtml = pdf.renderedHtml;
      doc.pdfPath = pdf.filePath;
      doc.pdfUrl = pdf.pdfUrl;
    }

    await doc.save();

    await archiveRevision({
      owner: req.user._id,
      documentType: 'invoice',
      document: doc,
      user: req.user,
      note: 'save',
    });

    await logAudit({
      owner: req.user._id,
      action: 'invoice.update',
      entityType: 'Invoice',
      entityId: doc._id,
      details: `Invoice ${doc.invoiceNumber} updated (v${doc.version})`,
    });

    const populated = await Invoice.findById(doc._id).populate('booking').populate('template').lean();
    res.json({
      success: true,
      message: 'Invoice updated',
      invoice: {
        ...populated,
        pdfUrl: versionedAssetUrl(populated.pdfUrl, populated.version, populated.updatedAt),
      },
    });
  } catch (error) {
    if (error instanceof OptimisticLockError) {
      return res.status(409).json({ success: false, message: error.message, code: error.code });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Invoice number already exists' });
    }
    console.error(error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to update invoice' });
  }
};

export const regenerateInvoice = async (req, res) => {
  try {
    const { expectedUpdatedAt, fromBooking = false, forceFromBooking = false } = req.body || {};
    const refreshFromBooking = fromBooking || forceFromBooking;
    const doc = await Invoice.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (expectedUpdatedAt) assertOptimisticLock(doc, expectedUpdatedAt);

    if (refreshFromBooking) {
      const booking = doc.booking
        ? await Booking.findById(doc.booking).populate('car').lean()
        : null;
      let template = null;
      if (doc.template) {
        template = await ExportTemplate.findById(doc.template).lean();
      }
      if (!template) {
        template = await getDefaultInvoiceTemplate(req.user._id);
      }
      doc.sections = cloneSectionsFromTemplate(template || {});
      doc.sourceData = await buildInvoiceSourceData({
        invoiceFields: invoiceFieldsFromDoc(doc),
        booking,
        owner: req.user,
        template: template || {},
        includeCompanyStamp: doc.includeCompanyStamp !== false,
      });
      // When refreshing from booking, also sync structured fields from booking if present
      if (booking) {
        doc.customerName = booking.customerName || doc.customerName;
        doc.customerEmail = booking.customerEmail || doc.customerEmail;
        doc.customerPhone = booking.customerPhone || doc.customerPhone;
        doc.customerAddress = booking.customerAddress || doc.customerAddress;
        doc.vehicleBrand = booking.car?.brand || doc.vehicleBrand;
        doc.vehicleModel = booking.car?.model || doc.vehicleModel;
        doc.vehicleYear = booking.car?.year != null ? String(booking.car.year) : doc.vehicleYear;
        doc.vehiclePlate = booking.car?.licensePlate || doc.vehiclePlate;
        if (booking.price != null) {
          doc.totalAmount = booking.price;
          doc.subtotal = booking.price;
        }
      }
      doc.template = template?._id || doc.template;
      doc.templateSnapshot = buildTemplateSnapshot(template || {});
      clearContentLock(doc);
    } else {
      const hydrated = await hydrateInvoiceIfNeeded(doc.toObject(), req.user, { persist: false });
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
      documentTitle: `Invoice ${doc.invoiceNumber}`,
      filePrefix: `invoice-${doc.invoiceNumber}`,
    });

    doc.renderedHtml = pdf.renderedHtml;
    doc.pdfPath = pdf.filePath;
    doc.pdfUrl = pdf.pdfUrl;
    bumpDocumentVersion(doc);
    doc.updatedBy = req.user._id;
    await doc.save();

    await archiveRevision({
      owner: req.user._id,
      documentType: 'invoice',
      document: doc,
      user: req.user,
      note: refreshFromBooking ? 'refresh-from-booking' : 'regenerate',
    });

    await logAudit({
      owner: req.user._id,
      action: refreshFromBooking ? 'invoice.refresh_from_booking' : 'invoice.regenerate',
      entityType: 'Invoice',
      entityId: doc._id,
      details: `Invoice ${doc.invoiceNumber} ${refreshFromBooking ? 'refreshed from booking' : 'PDF regenerated'} (v${doc.version})`,
    });

    const populated = await Invoice.findById(doc._id).populate('booking').populate('template').lean();
    res.json({
      success: true,
      message: refreshFromBooking ? 'Invoice refreshed from booking' : 'Invoice PDF regenerated',
      invoice: {
        ...populated,
        pdfUrl: versionedAssetUrl(populated.pdfUrl, populated.version, populated.updatedAt),
      },
    });
  } catch (error) {
    if (error instanceof OptimisticLockError) {
      return res.status(409).json({ success: false, message: error.message, code: error.code });
    }
    console.error(error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to regenerate invoice' });
  }
};

export const listInvoiceVersions = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, owner: req.user._id }).select('_id').lean();
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const versions = await listRevisions({
      owner: req.user._id,
      documentType: 'invoice',
      documentId: invoice._id,
      limit: parseInt(req.query.limit, 10) || 50,
    });
    res.json({ success: true, versions });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load versions' });
  }
};

export const restoreInvoiceVersion = async (req, res) => {
  try {
    const version = Number(req.params.version);
    const live = await Invoice.findOne({ _id: req.params.id, owner: req.user._id });
    if (!live) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const revision = await getRevision({
      owner: req.user._id,
      documentType: 'invoice',
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

    const inv = live.sourceData?.invoice || {};
    if (inv.customerName) live.customerName = inv.customerName;
    if (inv.items) live.items = inv.items;
    if (inv.subtotal != null) live.subtotal = inv.subtotal;
    if (inv.discountAmount != null) live.discountAmount = inv.discountAmount;
    if (inv.taxAmount != null) live.taxAmount = inv.taxAmount;
    if (inv.totalAmount != null) live.totalAmount = inv.totalAmount;

    const pdf = await persistPdfFromInstance({
      sections: live.sections,
      sourceData: live.sourceData,
      owner: req.user,
      documentTitle: `Invoice ${live.invoiceNumber}`,
      filePrefix: `invoice-${live.invoiceNumber}`,
    });
    live.renderedHtml = pdf.renderedHtml;
    live.pdfPath = pdf.filePath;
    live.pdfUrl = pdf.pdfUrl;
    bumpDocumentVersion(live);
    live.updatedBy = req.user._id;
    await live.save();

    await archiveRevision({
      owner: req.user._id,
      documentType: 'invoice',
      document: live,
      user: req.user,
      note: 'restore',
      meta: { restoredFrom: version },
    });

    await logAudit({
      owner: req.user._id,
      action: 'invoice.restore',
      entityType: 'Invoice',
      entityId: live._id,
      details: `Invoice ${live.invoiceNumber} restored from v${version} → v${live.version}`,
    });

    res.json({ success: true, message: 'Version restored', invoice: live.toObject() });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to restore version' });
  }
};

export const downloadInvoicePdf = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, owner: req.user._id }).lean();
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const { ensureInstancePdfFile } = await import('../utils/ensureDocumentPdf.js');
    const { filePath } = await ensureInstancePdfFile({
      document: invoice,
      owner: req.user,
      documentTitle: `Invoice ${invoice.invoiceNumber}`,
      filePrefix: `invoice-${invoice.invoiceNumber}`,
      Model: Invoice,
    });

    if (String(req.query.format || '').toLowerCase() === 'json') {
      const fresh = await Invoice.findById(invoice._id).lean();
      return res.json({
        success: true,
        pdfUrl: versionedAssetUrl(
          fresh?.pdfUrl || invoice.pdfUrl,
          fresh?.version || invoice.version,
          fresh?.updatedAt || invoice.updatedAt,
        ),
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${String(invoice.invoiceNumber || 'invoice').replace(/"/g, '')}.pdf"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(filePath);
  } catch (error) {
    console.error('[downloadInvoicePdf]', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to download invoice PDF',
    });
  }
};

export default {
  listInvoices,
  getInvoice,
  generateInvoice,
  createManualInvoice,
  updateInvoice,
  regenerateInvoice,
  listInvoiceVersions,
  restoreInvoiceVersion,
  downloadInvoicePdf,
};
