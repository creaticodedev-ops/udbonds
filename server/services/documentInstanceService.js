import path from 'path';
import { fileURLToPath } from 'url';
import DocumentRevision from '../models/DocumentRevision.js';
import Contract from '../models/Contract.js';
import {
  buildDocumentHtml,
  buildImageHtml,
  buildTemplateVariables,
} from './templateEngine.js';
import { generatePdfFromTemplate, generatePdfFromHtml } from './templatePdfExport.js';
import { publicUploadUrl } from './pdfDocuments.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_ROOT = path.join(__dirname, '..', 'uploads', 'contracts');

export class OptimisticLockError extends Error {
  constructor(message = 'Document was modified by another user. Reload and try again.') {
    super(message);
    this.name = 'OptimisticLockError';
    this.status = 409;
    this.code = 'OPTIMISTIC_LOCK';
  }
}

export const cloneSectionsFromTemplate = (template = {}) => ({
  headerHtml: template.headerHtml || '',
  bodyHtml: template.bodyHtml || '',
  termsHtml: template.termsHtml || '',
  footerHtml: template.footerHtml || '',
  customCss: template.customCss || '',
  pageSize: template.pageSize === 'Letter' ? 'Letter' : 'A4',
  logoUrl: template.logoUrl || '',
  companySignatureUrl: template.companySignatureUrl || template.signatureUrl || '',
  name: template.name || '',
});

/**
 * Keep logo/signature HTML in sync with durable section asset URLs on every render.
 * Prevents vanished stamps when frozen sourceData was blanked or pointed at dead local files.
 */
export const enrichSourceDataWithSectionAssets = (
  sections = {},
  sourceData = {},
  { includeCompanyStamp = true } = {},
) => {
  const next = { ...(sourceData || {}) };
  const logoUrl = sections?.logoUrl || '';
  const companySignatureUrl = sections?.companySignatureUrl || '';

  if (includeCompanyStamp && companySignatureUrl) {
    const companyHtml = buildImageHtml(
      companySignatureUrl,
      'Company signature',
      'max-height:80px;max-width:220px;margin-top:6px;',
    );
    if (companyHtml) {
      next.company_signature_html = companyHtml;
    }
  } else if (!includeCompanyStamp) {
    next.company_signature_html = '';
  }

  // If signatures_row_html is empty but we still have a company stamp, leave customer
  // signatures from sourceData alone — row HTML is rebuilt only when booking refresh runs.
  if (logoUrl) {
    next._meta = {
      ...(next._meta || {}),
      logoUrl,
    };
  }
  if (companySignatureUrl) {
    next._meta = {
      ...(next._meta || {}),
      companySignatureUrl,
    };
  }

  return next;
};

export const buildTemplateSnapshot = (template = {}) => ({
  templateId: template._id || null,
  name: template.name || '',
  templateVersion: Number(template.templateVersion || 0),
});

export const buildContractSourceData = async ({
  booking,
  owner,
  template,
  contractNumber,
  includeCompanyStamp = true,
  agency = null,
}) => {
  const { withAgencyForDocuments } = await import('./documentBrandContext.js');
  const resolvedAgency = agency || (await withAgencyForDocuments({ booking, owner }));
  const variables = buildTemplateVariables(booking, {
    contractNumber,
    owner,
    agency: resolvedAgency,
    template: {
      ...template,
      logoUrl:
        template?.logoUrl ||
        (resolvedAgency?.logoUrl || ''),
    },
    includeCompanyStamp,
  });
  return {
    ...variables,
    _meta: {
      ...(variables._meta || {}),
      contractNumber,
      includeCompanyStamp: Boolean(includeCompanyStamp),
      bookingId: booking?._id ? String(booking._id) : null,
      reservationId: booking?.reservationId || '',
    },
  };
};

export const buildInvoiceSourceData = async ({
  invoiceFields = {},
  booking = null,
  owner,
  template,
  includeCompanyStamp = true,
  agency = null,
}) => {
  const invoiceNumber = invoiceFields.invoiceNumber || booking?.reservationId || 'INV';
  const bookingLike = {
    ...(booking || {}),
    _id: booking?._id || null,
    reservationId: invoiceNumber,
    customerName: invoiceFields.customerName || booking?.customerName || '—',
    customerEmail: invoiceFields.customerEmail || booking?.customerEmail || '',
    customerPhone: invoiceFields.customerPhone || booking?.customerPhone || '',
    nationality: invoiceFields.customerNationality || booking?.nationality || '',
    dateOfBirth: invoiceFields.customerDob || booking?.dateOfBirth || '',
    customerAddress: invoiceFields.customerAddress || booking?.customerAddress || '',
    pickupDate: invoiceFields.invoiceDate || booking?.pickupDate || new Date(),
    returnDate: invoiceFields.dueDate || invoiceFields.invoiceDate || booking?.returnDate || new Date(),
    price: invoiceFields.totalAmount ?? booking?.price ?? 0,
    paymentStatus: invoiceFields.paymentStatus || booking?.paymentStatus || 'pending',
    notes: invoiceFields.notes || booking?.notes || '',
    channel: booking?.channel || 'manual',
    car: invoiceFields.vehicleBrand || invoiceFields.vehicleModel || invoiceFields.vehiclePlate || booking?.car
      ? {
          ...(booking?.car || {}),
          brand: invoiceFields.vehicleBrand || booking?.car?.brand || '',
          model: invoiceFields.vehicleModel || booking?.car?.model || '',
          year: invoiceFields.vehicleYear || booking?.car?.year || '',
          licensePlate: invoiceFields.vehiclePlate || booking?.car?.licensePlate || '',
          category: invoiceFields.vehicleType || booking?.car?.category || '',
        }
      : undefined,
    priceBreakdown: {
      rentalPrice: invoiceFields.subtotal ?? booking?.price ?? 0,
      pickupDeliveryFee: 0,
      dropoffDeliveryFee: 0,
      discountTotal: invoiceFields.discountAmount || 0,
      taxAmount: invoiceFields.taxAmount || 0,
      total: invoiceFields.totalAmount ?? booking?.price ?? 0,
    },
  };

  const { withAgencyForDocuments } = await import('./documentBrandContext.js');
  const resolvedAgency = agency || (await withAgencyForDocuments({ booking, owner }));
  const variables = buildTemplateVariables(bookingLike, {
    contractNumber: invoiceNumber,
    owner,
    agency: resolvedAgency,
    template: {
      ...template,
      logoUrl: template?.logoUrl || resolvedAgency?.logoUrl || '',
    },
    includeCompanyStamp,
  });

  return {
    ...variables,
    invoice: {
      invoiceNumber,
      invoiceDate: invoiceFields.invoiceDate || null,
      dueDate: invoiceFields.dueDate || null,
      currency: invoiceFields.currency || 'MAD',
      customerName: invoiceFields.customerName || '',
      customerEmail: invoiceFields.customerEmail || '',
      customerPhone: invoiceFields.customerPhone || '',
      customerAddress: invoiceFields.customerAddress || '',
      customerTaxId: invoiceFields.customerTaxId || '',
      vehicleBrand: invoiceFields.vehicleBrand || '',
      vehicleModel: invoiceFields.vehicleModel || '',
      vehicleYear: invoiceFields.vehicleYear || '',
      vehiclePlate: invoiceFields.vehiclePlate || '',
      vehicleType: invoiceFields.vehicleType || '',
      items: invoiceFields.items || [],
      subtotal: invoiceFields.subtotal || 0,
      discountAmount: invoiceFields.discountAmount || 0,
      taxAmount: invoiceFields.taxAmount || 0,
      totalAmount: invoiceFields.totalAmount || 0,
      paymentStatus: invoiceFields.paymentStatus || 'pending',
      paymentMethod: invoiceFields.paymentMethod || 'cash',
      paymentReference: invoiceFields.paymentReference || '',
      notes: invoiceFields.notes || '',
    },
    _meta: {
      includeCompanyStamp: Boolean(includeCompanyStamp),
      bookingId: booking?._id ? String(booking._id) : null,
    },
  };
};

const toTemplateLike = (sections = {}, documentTitle = 'Document') => ({
  name: documentTitle || sections?.name || 'Document',
  headerHtml: sections?.headerHtml || '',
  bodyHtml: sections?.bodyHtml || '',
  termsHtml: sections?.termsHtml || '',
  footerHtml: sections?.footerHtml || '',
  customCss: sections?.customCss || '',
  pageSize: sections?.pageSize || 'A4',
  logoUrl: sections?.logoUrl || '',
  companySignatureUrl: sections?.companySignatureUrl || '',
});

export const renderInstance = ({ sections, sourceData, documentTitle, includeCompanyStamp = true }) => {
  const templateLike = toTemplateLike(sections, documentTitle);
  const variables = enrichSourceDataWithSectionAssets(sections, sourceData, { includeCompanyStamp });
  return buildDocumentHtml(templateLike, variables);
};

export const persistPdfFromInstance = async ({
  sections,
  sourceData,
  owner,
  documentTitle,
  filePrefix = 'doc',
  includeCompanyStamp = true,
}) => {
  const ownerId = String(owner._id || owner);
  const dir = path.join(CONTRACTS_ROOT, ownerId, 'instances');
  const token = Math.random().toString(36).slice(2, 10);
  const safePrefix = String(filePrefix || 'doc').replace(/[^a-zA-Z0-9-_]/g, '');
  const filePath = path.join(dir, `${safePrefix}-${token}.pdf`);

  const templateLike = toTemplateLike(sections, documentTitle);
  const variables = enrichSourceDataWithSectionAssets(sections, sourceData, { includeCompanyStamp });
  const renderedHtml = buildDocumentHtml(templateLike, variables);
  await generatePdfFromTemplate({
    template: templateLike,
    variables,
    filePath,
    title: documentTitle || templateLike.name,
    html: renderedHtml,
  });

  return {
    renderedHtml,
    filePath,
    pdfUrl: publicUploadUrl(filePath),
  };
};

export const assertOptimisticLock = (doc, expectedUpdatedAt) => {
  if (!expectedUpdatedAt) {
    throw new OptimisticLockError('expectedUpdatedAt is required');
  }
  const current = doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null;
  const expected = new Date(expectedUpdatedAt).toISOString();
  if (!current || current !== expected) {
    throw new OptimisticLockError();
  }
};

/** Allowed revision notes (kept in sync with DocumentRevision.note enum). */
const REVISION_NOTES = new Set([
  'generate',
  'save',
  'regenerate',
  'restore',
  'hydrate',
]);

const normalizeRevisionNote = (note) => {
  if (REVISION_NOTES.has(note)) return note;
  // Legacy / descriptive aliases → canonical enum values
  if (note === 'refresh-from-booking' || note === 'completion-signatures') return 'regenerate';
  return 'save';
};

/**
 * Snapshot the document's CURRENT version into revision history.
 *
 * Call AFTER applying edits and bumping `document.version` (and ideally after save),
 * so each unique version number is written exactly once:
 *   generate → archive v1
 *   edit     → bump to v2 → archive v2
 *   restore  → bump to vN → archive vN (new tip; never overwrite old rows)
 *
 * Do NOT call this before incrementing — that re-inserts the already-archived tip
 * (E11000 on documentType+document+version).
 */
export const archiveRevision = async ({
  owner,
  documentType,
  document,
  user,
  note = 'save',
  meta = {},
  version: versionOverride,
}) => {
  if (!document?._id) {
    throw new Error('archiveRevision requires a persisted document with _id');
  }
  const version = Number(
    versionOverride != null ? versionOverride : (document.version ?? 1),
  );
  if (!Number.isFinite(version) || version < 1) {
    throw new Error(`Invalid revision version: ${versionOverride ?? document.version}`);
  }

  await DocumentRevision.create({
    owner: owner._id || owner,
    documentType,
    document: document._id,
    version,
    snapshot: {
      sourceData: document.sourceData || {},
      sections: document.sections || {},
      renderedHtml: document.renderedHtml || '',
      pdfUrl: document.pdfUrl || '',
      pdfPath: document.pdfPath || '',
      status: document.status || 'final',
      meta: {
        ...meta,
        contractNumber: document.contractNumber,
        invoiceNumber: document.invoiceNumber,
      },
    },
    createdBy: user?._id || user || null,
    note: normalizeRevisionNote(note),
  });
};

/**
 * Bump live document version and return the new number.
 * Does not persist — caller must save.
 */
export const bumpDocumentVersion = (document) => {
  const next = Number(document.version || 1) + 1;
  document.version = next;
  return next;
};

export const listRevisions = async ({ owner, documentType, documentId, limit = 50 }) => {
  return DocumentRevision.find({
    owner: owner._id || owner,
    documentType,
    document: documentId,
  })
    .sort({ version: -1 })
    .limit(Math.min(100, Math.max(1, limit)))
    .select('version note createdAt createdBy snapshot.pdfUrl snapshot.meta')
    .populate('createdBy', 'name email')
    .lean();
};

export const getRevision = async ({ owner, documentType, documentId, version }) => {
  return DocumentRevision.findOne({
    owner: owner._id || owner,
    documentType,
    document: documentId,
    version: Number(version),
  }).lean();
};

export const mergeSections = (current = {}, patch = {}) => {
  const next = { ...cloneSectionsFromTemplate(current) };
  for (const key of [
    'headerHtml',
    'bodyHtml',
    'termsHtml',
    'footerHtml',
    'customCss',
    'logoUrl',
    'companySignatureUrl',
    'name',
  ]) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      next[key] = patch[key] == null ? '' : String(patch[key]);
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'pageSize')) {
    next.pageSize = patch.pageSize === 'Letter' ? 'Letter' : 'A4';
  }
  // Explicit remove flags (optional): { removeTerms: true }
  if (patch.removeTerms) next.termsHtml = '';
  if (patch.removeHeader) next.headerHtml = '';
  if (patch.removeBody) next.bodyHtml = '';
  if (patch.removeFooter) next.footerHtml = '';
  if (patch.removeLogo) next.logoUrl = '';
  if (patch.removeCompanySignature) next.companySignatureUrl = '';
  return next;
};

/** HTML asset fields that must not be wiped by empty edit-form placeholders */
export const PROTECTED_SOURCE_KEYS = [
  'company_signature_html',
  'customer_signature_html',
  'second_driver_signature_html',
  'second_driver_signature_section',
  'signatures_row_html',
];

export const mergeSourceData = (current = {}, patch = {}) => {
  if (!patch || typeof patch !== 'object') return { ...(current || {}) };
  const next = { ...(current || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (key === '_meta' && value && typeof value === 'object') {
      next._meta = { ...(next._meta || {}), ...value };
    } else if (key === 'invoice' && value && typeof value === 'object') {
      next.invoice = { ...(next.invoice || {}), ...value };
    } else if (
      PROTECTED_SOURCE_KEYS.includes(key)
      && (value === undefined || value === null || String(value).trim() === '')
      && String(next[key] || '').trim() !== ''
    ) {
      // Keep existing rendered signature/logo HTML unless explicitly replaced with content
      continue;
    } else {
      next[key] = value;
    }
  }
  return next;
};

export const isContentLocked = (doc) => Boolean(
  doc?.contentLocked || doc?.sourceData?._meta?.manuallyEdited,
);

export const markContentLocked = (doc) => {
  const meta = {
    ...(doc.sourceData?._meta || {}),
    manuallyEdited: true,
    manuallyEditedAt: new Date().toISOString(),
  };
  doc.contentLocked = true;
  doc.sourceData = { ...(doc.sourceData || {}), _meta: meta };
  return doc;
};

export const clearContentLock = (doc) => {
  const meta = { ...(doc.sourceData?._meta || {}) };
  delete meta.manuallyEdited;
  delete meta.manuallyEditedAt;
  doc.contentLocked = false;
  doc.sourceData = { ...(doc.sourceData || {}), _meta: meta };
  return doc;
};

/** Signature/HTML fields that completion may refresh without unlocking content */
export const SIGNATURE_SOURCE_KEYS = [
  'customer_signature_html',
  'second_driver_signature_html',
  'second_driver_signature_section',
  'signatures_row_html',
  'company_signature_html',
];

export const mergeSignatureFields = (sourceData = {}, variables = {}) => {
  const next = { ...(sourceData || {}) };
  for (const key of SIGNATURE_SOURCE_KEYS) {
    if (variables?.[key] !== undefined && variables[key] !== null && String(variables[key]).trim() !== '') {
      next[key] = variables[key];
    }
  }
  return next;
};

export const versionedAssetUrl = (url, version, updatedAt) => {
  if (!url) return '';
  const stamp = version || (updatedAt ? new Date(updatedAt).getTime() : Date.now());
  const sep = String(url).includes('?') ? '&' : '?';
  return `${url}${sep}v=${stamp}`;
};

/**
 * Upsert Contract row after guest completion PDF generation (no duplicate spam).
 * Respects contentLocked: preserves manual edits; only merges signature fields.
 */
export const upsertContractFromCompletion = async ({
  owner,
  booking,
  template,
  contractNumber,
  filePath,
  pdfUrl,
  renderedHtml,
  variables,
  user = null,
}) => {
  const ownerId = owner._id || owner;
  const sections = cloneSectionsFromTemplate(template || {});
  const sourceData = {
    ...(variables || {}),
    _meta: {
      contractNumber,
      includeCompanyStamp: true,
      bookingId: String(booking._id),
      reservationId: booking.reservationId || '',
      source: 'completion',
    },
  };

  const existing = await Contract.findOne({ owner: ownerId, booking: booking._id }).sort({ createdAt: -1 });

  if (existing) {
    if (isContentLocked(existing)) {
      // Preserve edited fields/sections; only refresh signatures then re-render from instance
      existing.sourceData = mergeSignatureFields(existing.sourceData || {}, variables || {});
      const pdf = await persistPdfFromInstance({
        sections: existing.sections,
        sourceData: existing.sourceData,
        owner: ownerId,
        documentTitle: `Contract ${existing.contractNumber}`,
        filePrefix: `contract-${existing.contractNumber}`,
      });
      existing.renderedHtml = pdf.renderedHtml;
      existing.pdfPath = pdf.filePath;
      existing.pdfUrl = pdf.pdfUrl;
      bumpDocumentVersion(existing);
      existing.updatedBy = user?._id || user || existing.updatedBy;
      await existing.save();
      await archiveRevision({
        owner: ownerId,
        documentType: 'contract',
        document: existing,
        user,
        note: 'completion-signatures',
        meta: { source: 'completion', contentLocked: true },
      });
      return existing;
    }

    existing.renderedHtml = renderedHtml || existing.renderedHtml;
    existing.pdfPath = filePath || existing.pdfPath;
    existing.pdfUrl = pdfUrl || existing.pdfUrl;
    existing.sourceData = sourceData;
    existing.sections = sections;
    existing.template = template?._id || existing.template;
    existing.templateSnapshot = buildTemplateSnapshot(template || {});
    bumpDocumentVersion(existing);
    existing.updatedBy = user?._id || user || existing.updatedBy;
    await existing.save();
    await archiveRevision({
      owner: ownerId,
      documentType: 'contract',
      document: existing,
      user,
      note: 'regenerate',
      meta: { source: 'completion', contentLocked: false },
    });
    return existing;
  }

  const contract = await Contract.create({
    agencyId: booking.agencyId || null,
    owner: ownerId,
    booking: booking._id,
    template: template?._id || null,
    contractNumber,
    renderedHtml: renderedHtml || '',
    pdfUrl: pdfUrl || '',
    pdfPath: filePath || '',
    sourceData,
    sections,
    templateSnapshot: buildTemplateSnapshot(template || {}),
    generatedBy: user?._id || user || null,
    createdBy: user?._id || user || null,
    updatedBy: user?._id || user || null,
    includeCompanyStamp: true,
    contentLocked: false,
    status: 'final',
    version: 1,
  });

  await archiveRevision({
    owner: ownerId,
    documentType: 'contract',
    document: contract,
    user,
    note: 'generate',
    meta: { source: 'completion' },
  });

  return contract;
};

export { generatePdfFromHtml, publicUploadUrl };

export default {
  cloneSectionsFromTemplate,
  buildTemplateSnapshot,
  buildContractSourceData,
  buildInvoiceSourceData,
  renderInstance,
  persistPdfFromInstance,
  assertOptimisticLock,
  archiveRevision,
  bumpDocumentVersion,
  listRevisions,
  getRevision,
  mergeSections,
  mergeSourceData,
  isContentLocked,
  markContentLocked,
  clearContentLock,
  mergeSignatureFields,
  versionedAssetUrl,
  upsertContractFromCompletion,
  OptimisticLockError,
};
