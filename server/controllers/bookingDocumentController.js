import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import { storeDocumentImage } from '../services/documentStore.js';
import { applyAdminDocumentUpload, getDocumentUrls } from '../services/customerDocuments.js';
import { cleanupUploadedFile } from '../middleware/multer.js';
import { appendSignedQuery } from '../middleware/uploadAccess.js';
import { logAudit } from '../utils/adminOps.js';

const signDocUrl = (url) => {
  if (!url) return '';
  if (url.includes('/uploads/documents')) return appendSignedQuery(url);
  return url;
};

/** Upload customer documents for a reservation (walk-in / admin). */
export const uploadBookingDocuments = async (req, res) => {
  let file = req.file;
  try {
    const { bookingId } = req.params;
    const { docType, identityType } = req.body;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }
    if (!file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file' });
    }
    if (!['driving_license', 'identity', 'passport'].includes(docType)) {
      return res.status(400).json({ success: false, message: 'Invalid document type' });
    }
    if (docType === 'identity' && !['national_id', 'passport'].includes(identityType)) {
      return res.status(400).json({ success: false, message: 'Select National ID or Passport' });
    }

    const booking = await Booking.findOne({ _id: bookingId, owner: req.user._id });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const url = await storeDocumentImage(file, `/booking-docs/${booking.reservationId || bookingId}`, {
      ownerId: booking.owner,
    });
    file = null;

    applyAdminDocumentUpload(booking, {
      docType,
      identityType: docType === 'passport' ? 'passport' : identityType,
      url,
      uploadedBy: req.user._id,
    });

    await booking.save();

    await logAudit({
      owner: req.user._id,
      actor: req.user._id,
      action: 'booking.documents.upload',
      entityType: 'Booking',
      entityId: booking._id,
      details: `Uploaded ${docType} for ${booking.reservationId}`,
    });

    const docs = getDocumentUrls(booking);
    res.json({
      success: true,
      message: 'Document uploaded',
      documents: {
        drivingLicenseUrl: signDocUrl(docs.drivingLicenseUrl),
        identityDocumentUrl: signDocUrl(docs.identityDocumentUrl),
        passportUrl: signDocUrl(docs.passportUrl),
        identityType: docs.identityType,
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  } finally {
    cleanupUploadedFile(file);
  }
};

/** Return signed download URL for a stored customer document. */
export const getBookingDocumentUrl = async (req, res) => {
  try {
    const { bookingId, docType } = req.params;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await Booking.findOne({ _id: bookingId, owner: req.user._id }).lean();
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const docs = getDocumentUrls(booking);
    let url = '';
    if (docType === 'driving_license') url = docs.drivingLicenseUrl;
    else if (docType === 'identity') url = docs.identityDocumentUrl;
    else if (docType === 'passport') url = docs.passportUrl || (docs.identityType === 'passport' ? docs.identityDocumentUrl : '');

    if (!url) {
      return res.status(404).json({ success: false, message: 'Document not available' });
    }

    res.json({ success: true, url: signDocUrl(url) });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to get document URL' });
  }
};

export default { uploadBookingDocuments, getBookingDocumentUrl };
