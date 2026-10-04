import { parseAgencyDateTime } from './moroccoTime.js';

export const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());

export const parseDateRange = (pickupDate, returnDate) => {
  // Naive datetimes from the UI are Africa/Casablanca wall time.
  const picked = parseAgencyDateTime(pickupDate);
  const returned = parseAgencyDateTime(returnDate);
  if (isNaN(picked.getTime()) || isNaN(returned.getTime())) {
    return { valid: false, message: 'Invalid pickup or return date & time' };
  }
  if (returned <= picked) {
    return { valid: false, message: 'Return date & time must be after pickup date & time' };
  }
  return { valid: true, picked, returned };
};

export const calcRentalDays = (picked, returned) =>
  Math.max(1, Math.ceil((returned - picked) / (1000 * 60 * 60 * 24)));

export const safeErrorMessage = (error, fallback = 'Something went wrong') => {
  if (error?.name === 'ValidationError') return 'Invalid data provided';
  if (error?.name === 'CastError') return 'Invalid identifier';
  return fallback;
};

export const cleanupUpload = (file) => {
  if (!file?.path) return;
  try {
    import('fs').then(({ default: fs }) => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });
  } catch {
    // ignore cleanup errors
  }
};
