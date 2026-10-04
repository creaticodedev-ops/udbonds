import fs from 'fs';
import ExportTemplate from '../models/ExportTemplate.js';
import { persistPdfFromInstance } from '../services/documentInstanceService.js';
import { logoToDataUri, resolveLocalUploadPath } from './uploadPaths.js';

/** Resolve an existing PDF on disk from absolute path and/or public URL. */
export const resolveExistingPdfPath = (pdfPath, pdfUrl) => {
  if (pdfPath && fs.existsSync(pdfPath)) return pdfPath;
  const fromUrl = resolveLocalUploadPath(pdfUrl);
  if (fromUrl && fs.existsSync(fromUrl)) return fromUrl;
  return null;
};

const assetIsResolvable = (url) => {
  if (!url) return false;
  const value = String(url);
  if (value.startsWith('data:image')) return true;
  if (/^https?:\/\//i.test(value) && !value.includes('/uploads/')) return true; // CDN
  return Boolean(logoToDataUri(value));
};

/**
 * If cloned section assets point at missing local files, heal from the live template
 * (template assets are now durable ImageKit/data-URI). Never overwrites valid assets.
 */
export const healSectionAssetsFromTemplate = async (document) => {
  const sections = { ...(document.sections || {}) };
  const logoOk = !sections.logoUrl || assetIsResolvable(sections.logoUrl);
  const sigOk = !sections.companySignatureUrl || assetIsResolvable(sections.companySignatureUrl);
  if (logoOk && sigOk && (sections.logoUrl || sections.companySignatureUrl)) {
    return { ...document, sections };
  }

  const templateId = document.template?._id || document.template;
  if (!templateId) return { ...document, sections };

  const template = await ExportTemplate.findById(templateId).lean();
  if (!template) return { ...document, sections };

  let changed = false;
  if ((!sections.logoUrl || !assetIsResolvable(sections.logoUrl)) && template.logoUrl) {
    sections.logoUrl = template.logoUrl;
    changed = true;
  }
  if (
    (!sections.companySignatureUrl || !assetIsResolvable(sections.companySignatureUrl))
    && template.companySignatureUrl
  ) {
    sections.companySignatureUrl = template.companySignatureUrl;
    changed = true;
  }

  return { ...document, sections, _assetsHealed: changed };
};

/**
 * Ensure a contract/invoice PDF file exists on disk.
 * Regenerates from instance sections + sourceData when the file was lost
 * (ephemeral Render disk, deploy, manual cleanup).
 */
export const ensureInstancePdfFile = async ({
  document,
  owner,
  documentTitle,
  filePrefix,
  Model,
}) => {
  const existing = resolveExistingPdfPath(document.pdfPath, document.pdfUrl);
  if (existing) {
    return { filePath: existing, regenerated: false, document };
  }

  let doc = await healSectionAssetsFromTemplate(document);

  if (!doc.sections || (!doc.sections.bodyHtml && !doc.sections.headerHtml)) {
    throw new Error('Document sections are missing — cannot regenerate PDF');
  }
  if (!doc.sourceData || typeof doc.sourceData !== 'object') {
    throw new Error('Document source data is missing — cannot regenerate PDF');
  }

  const pdf = await persistPdfFromInstance({
    sections: doc.sections,
    sourceData: doc.sourceData,
    owner,
    documentTitle,
    filePrefix,
    includeCompanyStamp: doc.includeCompanyStamp !== false,
  });

  const patch = {
    pdfPath: pdf.filePath,
    pdfUrl: pdf.pdfUrl,
    renderedHtml: pdf.renderedHtml,
  };
  if (doc._assetsHealed) {
    patch.sections = doc.sections;
  }

  if (Model && doc._id) {
    await Model.updateOne({ _id: doc._id }, { $set: patch });
  }

  return {
    filePath: pdf.filePath,
    regenerated: true,
    document: { ...doc, ...patch },
  };
};

export default { resolveExistingPdfPath, ensureInstancePdfFile, healSectionAssetsFromTemplate };
