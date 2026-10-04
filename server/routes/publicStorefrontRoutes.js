import express from 'express';
import { rateLimit } from '../middleware/rateLimit.js';
import { getPublicStorefront } from '../controllers/publicStorefrontController.js';

const router = express.Router();

router.get(
  '/',
  rateLimit({ windowMs: 60_000, max: 60, message: 'Too many storefront requests' }),
  getPublicStorefront,
);

export default router;
