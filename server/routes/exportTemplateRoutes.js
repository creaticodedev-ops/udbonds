import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireOwner } from '../middleware/ownerAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import upload, { handleMulterError } from '../middleware/multer.js';
import {
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
} from '../controllers/exportTemplateController.js';

const router = express.Router();
const gate = (perm) => [protect, requireOwner, requirePermission(perm)];

router.get('/variables', ...gate('templates'), getTemplateVariables);
router.get('/', ...gate('templates'), listExportTemplates);
router.get('/:id', ...gate('templates'), getExportTemplate);
router.post('/', ...gate('templates'), createExportTemplate);
router.put('/:id', ...gate('templates'), updateExportTemplate);
router.delete('/:id', ...gate('templates'), deleteExportTemplate);
router.post('/:id/logo', ...gate('templates'), upload.single('logo'), handleMulterError, uploadTemplateLogo);
router.delete('/:id/logo', ...gate('templates'), clearTemplateLogo);
router.post('/:id/signature', ...gate('templates'), upload.single('signature'), handleMulterError, uploadTemplateSignature);
router.delete('/:id/signature', ...gate('templates'), clearTemplateSignature);
router.post('/preview', ...gate('templates'), previewTemplate);

export default router;
