import AgencySettings from '../models/AgencySettings.js';
import Agency from '../models/Agency.js';
import { normalizeWhatsAppDial } from './whatsappNotify.js';
import {
  normalizeBookingSettings,
  DEFAULT_BOOKING_SETTINGS,
} from './bookingSettingsService.js';

/** Ops-only env dial — never a hardcoded HDN number. Prefer agency.whatsapp / settings. */
const envFallbackDial = () =>
  normalizeWhatsAppDial(
    process.env.WHATSAPP_BUSINESS_NUMBER ||
      process.env.WHATSAPP_TO ||
      process.env.AGENCY_PHONE ||
      '',
  );

const resolveAgencyIdForOwner = async (ownerId, agencyId = null) => {
  if (agencyId) return agencyId;
  if (!ownerId) return null;
  const agency = await Agency.findOne({ legacyOwnerId: ownerId }).select('_id').lean();
  return agency?._id || null;
};

export const getOrCreateAgencySettings = async (ownerId, agencyId = null) => {
  if (!ownerId && !agencyId) return null;
  const resolvedAgencyId = await resolveAgencyIdForOwner(ownerId, agencyId);

  let doc = null;
  if (resolvedAgencyId) {
    doc = await AgencySettings.findOne({ agencyId: resolvedAgencyId });
  }
  if (!doc && ownerId) {
    doc = await AgencySettings.findOne({ owner: ownerId });
  }
  if (!doc) {
    doc = await AgencySettings.create({
      owner: ownerId,
      agencyId: resolvedAgencyId,
      bookingSettings: DEFAULT_BOOKING_SETTINGS,
    });
  } else if (resolvedAgencyId && !doc.agencyId) {
    doc.agencyId = resolvedAgencyId;
    await doc.save();
  }
  return doc;
};

export const resolveWhatsAppDials = async (ownerId, agencyId = null) => {
  const envFallback = envFallbackDial();
  let reservation = '';
  let confirmation = '';
  let agencyWhatsapp = '';

  if (ownerId || agencyId) {
    const resolvedAgencyId = await resolveAgencyIdForOwner(ownerId, agencyId);
    if (resolvedAgencyId) {
      const agency = await Agency.findById(resolvedAgencyId).select('whatsapp phone').lean();
      agencyWhatsapp = normalizeWhatsAppDial(agency?.whatsapp || agency?.phone || '');
    }
    const settings = resolvedAgencyId
      ? await AgencySettings.findOne({ agencyId: resolvedAgencyId }).lean()
      : await AgencySettings.findOne({ owner: ownerId }).lean();
    reservation = normalizeWhatsAppDial(settings?.whatsappReservationNumber);
    confirmation = normalizeWhatsAppDial(settings?.whatsappConfirmationNumber);
  }

  // Tenant dials: settings → agency profile → env (ops). Never another agency's number.
  const reservationDial = reservation || agencyWhatsapp || envFallback;
  const confirmationDial = confirmation || reservation || agencyWhatsapp || envFallback;

  return {
    reservationDial,
    confirmationDial,
    fallbackDial: agencyWhatsapp || envFallback,
    fromDatabase: {
      reservation: Boolean(reservation || agencyWhatsapp),
      confirmation: Boolean(confirmation || reservation || agencyWhatsapp),
    },
  };
};

export const updateWhatsAppSettings = async (ownerId, body = {}, agencyId = null) => {
  const doc = await getOrCreateAgencySettings(ownerId, agencyId);
  if (!doc) throw new Error('Owner required');

  if (body.whatsappReservationNumber !== undefined) {
    doc.whatsappReservationNumber = String(body.whatsappReservationNumber || '').trim();
  }
  if (body.whatsappConfirmationNumber !== undefined) {
    doc.whatsappConfirmationNumber = String(body.whatsappConfirmationNumber || '').trim();
  }

  await doc.save();
  return doc;
};

export const serializeAgencySettings = async (ownerId, doc, agencyId = null) => {
  const dials = await resolveWhatsAppDials(ownerId, agencyId);
  return {
    whatsappReservationNumber: doc?.whatsappReservationNumber || '',
    whatsappConfirmationNumber: doc?.whatsappConfirmationNumber || '',
    bookingSettings: normalizeBookingSettings(doc?.bookingSettings || {}),
    effective: {
      reservationDial: dials.reservationDial,
      confirmationDial: dials.confirmationDial,
    },
    updatedAt: doc?.updatedAt || null,
  };
};

export default {
  getOrCreateAgencySettings,
  resolveWhatsAppDials,
  updateWhatsAppSettings,
  serializeAgencySettings,
};
