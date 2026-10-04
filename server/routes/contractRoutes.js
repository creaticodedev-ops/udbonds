import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireOwner } from '../middleware/ownerAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import {
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
} from '../controllers/contractController.js';

const router = express.Router();
const gate = (perm) => [protect, requireOwner, requirePermission(perm)];

router.get('/', ...gate('contracts'), listContracts);
router.get('/bookings', ...gate('contracts'), listBookingsForContracts);
router.post('/generate', ...gate('contracts'), generateContract);
router.post('/preview', ...gate('contracts'), previewContractFromBooking);
router.get('/:id', ...gate('contracts'), getContract);
router.patch('/:id', ...gate('contracts'), updateContract);
router.post('/:id/regenerate', ...gate('contracts'), regenerateContract);
router.get('/:id/versions', ...gate('contracts'), listContractVersions);
router.post('/:id/versions/:version/restore', ...gate('contracts'), restoreContractVersion);
router.get('/:id/preview', ...gate('contracts'), previewContract);
router.get('/:id/pdf', ...gate('contracts'), downloadContractPdf);

export default router;
