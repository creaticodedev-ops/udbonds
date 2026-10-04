import express from 'express';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  getStaffInvitePreview,
  activateStaffFromInvite,
} from '../controllers/staffOnboardingController.js';

const router = express.Router();

const tokenLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: 'Too many staff activation requests',
});

router.get('/:token', tokenLimit, getStaffInvitePreview);
router.post('/:token/activate', tokenLimit, activateStaffFromInvite);

export default router;
