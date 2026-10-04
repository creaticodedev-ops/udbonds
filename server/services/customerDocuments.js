/**
 * Permanent customer document archive on bookings.
 * Synced from online completion uploads and walk-in / admin uploads.
 */
export const syncCompletionDocumentsToArchive = (booking) => {
  const c = booking.completion || {};
  if (!c.drivingLicenseUrl && !c.identityDocumentUrl) return booking;

  if (!booking.customerDocuments) {
    booking.customerDocuments = {
      drivingLicenseUrl: '',
      identityType: '',
      identityDocumentUrl: '',
      passportUrl: '',
      uploadedAt: null,
      source: '',
    };
  }

  const archive = booking.customerDocuments;
  if (c.drivingLicenseUrl) archive.drivingLicenseUrl = c.drivingLicenseUrl;
  if (c.identityDocumentUrl) {
    archive.identityDocumentUrl = c.identityDocumentUrl;
    archive.identityType = c.identityType || archive.identityType;
    if (c.identityType === 'passport') {
      archive.passportUrl = c.identityDocumentUrl;
    }
  }
  archive.uploadedAt = archive.uploadedAt || new Date();
  if (!archive.source) archive.source = 'online';

  booking.markModified('customerDocuments');
  return booking;
};

export const applyAdminDocumentUpload = (booking, { docType, identityType, url, uploadedBy }) => {
  if (!booking.customerDocuments) {
    booking.customerDocuments = {
      drivingLicenseUrl: '',
      identityType: '',
      identityDocumentUrl: '',
      passportUrl: '',
      uploadedAt: null,
      source: 'admin',
    };
  }

  const archive = booking.customerDocuments;
  if (docType === 'driving_license') {
    archive.drivingLicenseUrl = url;
  } else if (docType === 'identity') {
    archive.identityDocumentUrl = url;
    archive.identityType = identityType || 'national_id';
    if (identityType === 'passport') archive.passportUrl = url;
  } else if (docType === 'passport') {
    archive.passportUrl = url;
    if (!archive.identityDocumentUrl) {
      archive.identityDocumentUrl = url;
      archive.identityType = 'passport';
    }
  }

  archive.uploadedAt = new Date();
  archive.source = booking.channel === 'walk_in' ? 'walk_in' : 'admin';
  if (uploadedBy) archive.uploadedBy = uploadedBy;

  // Mirror into completion for consistency when staff uploads offline
  if (!booking.completion) booking.completion = {};
  if (docType === 'driving_license') booking.completion.drivingLicenseUrl = url;
  if (docType === 'identity' || docType === 'passport') {
    booking.completion.identityDocumentUrl = url;
    booking.completion.identityType = identityType || (docType === 'passport' ? 'passport' : 'national_id');
  }

  booking.markModified('customerDocuments');
  booking.markModified('completion');
  return booking;
};

export const getDocumentUrls = (booking) => {
  const archive = booking.customerDocuments || {};
  const completion = booking.completion || {};
  return {
    drivingLicenseUrl: archive.drivingLicenseUrl || completion.drivingLicenseUrl || '',
    identityDocumentUrl: archive.identityDocumentUrl || completion.identityDocumentUrl || '',
    identityType: archive.identityType || completion.identityType || '',
    passportUrl: archive.passportUrl || (archive.identityType === 'passport' ? archive.identityDocumentUrl : '') || '',
  };
};

export default {
  syncCompletionDocumentsToArchive,
  applyAdminDocumentUpload,
  getDocumentUrls,
};
