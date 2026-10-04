import express from "express";
import {
  assignBookingVehicle,
  changeBookingStatus,
  changePaymentStatus,
  checkAvailabilityOfCar,
  createBooking,
  createWalkInBooking,
  deleteBooking,
  exportOwnerBookings,
  getCalendarBookings,
  getOwnerBookings,
  quoteBooking,
  updateBooking
} from "../controllers/bookingController.js";
import { ensureCompletionLink } from "../controllers/bookingCompletionController.js";
import { protect } from "../middleware/auth.js";
import { requireOwner } from "../middleware/ownerAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { rateLimit } from "../middleware/rateLimit.js";

import upload, { handleMulterError } from "../middleware/multer.js";
import {
    getBookingDocumentUrl,
    uploadBookingDocuments,
} from "../controllers/bookingDocumentController.js";

const bookingRouter = express.Router();
const bookingsGate = [protect, requireOwner, requirePermission('bookings')];
const calendarGate = [protect, requireOwner, requirePermission('calendar')];

bookingRouter.post('/check-availability', rateLimit({ windowMs: 60_000, max: 30 }), checkAvailabilityOfCar);
bookingRouter.post('/quote', rateLimit({ windowMs: 60_000, max: 60, message: 'Too many quote requests' }), quoteBooking);
bookingRouter.post('/create', rateLimit({ windowMs: 60_000, max: 10, message: 'Too many booking attempts' }), createBooking);
bookingRouter.post('/owner/walk-in', ...bookingsGate, createWalkInBooking);
bookingRouter.get('/owner', ...bookingsGate, getOwnerBookings);
bookingRouter.get('/owner/export', ...bookingsGate, exportOwnerBookings);
bookingRouter.get('/owner/calendar', ...calendarGate, getCalendarBookings);
bookingRouter.post('/owner/completion/ensure-link', ...bookingsGate, ensureCompletionLink);
bookingRouter.post('/change-status', ...bookingsGate, changeBookingStatus);
bookingRouter.post('/change-payment-status', ...bookingsGate, changePaymentStatus);
bookingRouter.post('/update', ...bookingsGate, updateBooking);
bookingRouter.post('/assign-vehicle', ...bookingsGate, assignBookingVehicle);
bookingRouter.post('/owner/:bookingId/documents', ...bookingsGate, upload.single('file'), handleMulterError, uploadBookingDocuments);
bookingRouter.get('/owner/:bookingId/documents/:docType', ...bookingsGate, getBookingDocumentUrl);
bookingRouter.post('/delete', ...bookingsGate, deleteBooking);

export default bookingRouter;
