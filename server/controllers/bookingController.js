import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Car from "../models/Car.js";
import Payment from "../models/Payment.js";
import {
  escapeRegex,
  isValidEmail,
  parseDateRange,
} from "../utils/helpers.js";
import { upsertGuestFromBooking, refreshGuestStats } from "../services/guestCrm.js";
import { createNotification, logAudit } from "../utils/adminOps.js";
import GuestCustomer from "../models/GuestCustomer.js";
import PickupLocation from "../models/PickupLocation.js";
import { buildGuestToAgencyWhatsAppUrl } from "../services/whatsappNotify.js";
import { resolveWhatsAppDials } from "../services/agencySettingsService.js";
import {
  calculateBookingPrice,
  formatLocationLabel,
  resolveLocationDeliveryFees,
} from "../services/pricingEngine.js";
import {
  buildAuthoritativeQuote,
  attachRedemptions,
  pendingExpiresAtFromSettings,
  resolveFranchiseAmount,
} from "../services/bookingPricingFlow.js";
import {
  reservePromotionUsage,
  releasePromotionUsage,
  buildPricingSnapshot,
} from "../services/promotionService.js";
import {
  assertBookingRules,
  getBookingSettings,
  computeCancellationFee,
} from "../services/bookingSettingsService.js";
import { initiateBookingCompletion, generateCompletionLink } from "../services/bookingCompletionService.js";
import {
  carServesCity,
  locationAvailabilityFilter,
} from "../utils/carLocations.js";
import { normalizeToE164 } from "../utils/phoneValidation.js";
import { groupCarsForCatalog, resolveAvailableCarUnit, withCatalogDisplayOrders } from "../utils/carCatalog.js";
import { channelQuery } from "../utils/bookingChannel.js";
import { applyCompletionDetailsToBooking } from "../utils/applyCompletionDetails.js";
import {
  isModelAvailableForDates,
  publicUnavailablePayload,
} from "../services/availabilityService.js";
import { requirePublicAgency } from "../services/publicTenant.js";
import { publicAgencyFilter, idsEqual } from "../utils/tenantScope.js";
import Agency from "../models/Agency.js";

/** Resolve canonical agencyId for a car (uses car.agencyId or Agency.legacyOwnerId map). */
const resolveAgencyIdForOwner = async (ownerId, existingAgencyId = null) => {
  if (existingAgencyId) return existingAgencyId;
  if (!ownerId) return null;
  const agency = await Agency.findOne({ legacyOwnerId: ownerId }).select('_id').lean();
  return agency?._id || null;
};

const BOOKING_STATUSES = ['pending', 'confirmed', 'ready_for_pickup', 'active', 'completed', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

const generateReservationId = async () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const reservationId = `RES-${code}`;
    const exists = await Booking.exists({ reservationId });
    if (!exists) return reservationId;
  }
  return `RES-${Date.now().toString(36).toUpperCase()}`;
};

const buildBookingQuery = (ownerId, filters = {}) => {
  const query = { owner: ownerId };

  if (filters.status) query.status = filters.status;
  if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
  if (filters.channel) {
    const channelMatch = channelQuery(filters.channel);
    if (channelMatch) query.channel = channelMatch;
  }

  if (filters.pickupDateFrom || filters.pickupDateTo) {
    query.pickupDate = {};
    if (filters.pickupDateFrom) query.pickupDate.$gte = new Date(filters.pickupDateFrom);
    if (filters.pickupDateTo) {
      const end = new Date(filters.pickupDateTo);
      end.setHours(23, 59, 59, 999);
      query.pickupDate.$lte = end;
    }
  }

  if (filters.returnDateFrom || filters.returnDateTo) {
    query.returnDate = {};
    if (filters.returnDateFrom) query.returnDate.$gte = new Date(filters.returnDateFrom);
    if (filters.returnDateTo) {
      const end = new Date(filters.returnDateTo);
      end.setHours(23, 59, 59, 999);
      query.returnDate.$lte = end;
    }
  }

  if (filters.createdFrom || filters.createdTo) {
    query.createdAt = {};
    if (filters.createdFrom) query.createdAt.$gte = new Date(filters.createdFrom);
    if (filters.createdTo) {
      const end = new Date(filters.createdTo);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const regexFields = [
    ['pickupLocation', 'pickupLocation'],
    ['dropoffLocation', 'returnLocation'],
    ['customerName', 'customerName'],
    ['phone', 'customerPhone'],
    ['email', 'customerEmail'],
    ['reservationId', 'reservationId'],
  ];

  for (const [filterKey, dbKey] of regexFields) {
    if (filters[filterKey]) {
      query[dbKey] = { $regex: escapeRegex(filters[filterKey]), $options: 'i' };
    }
  }

  if (filters.search) {
    const term = escapeRegex(filters.search);
    query.$or = [
      { customerName: { $regex: term, $options: 'i' } },
      { customerEmail: { $regex: term, $options: 'i' } },
      { customerPhone: { $regex: term, $options: 'i' } },
      { reservationId: { $regex: term, $options: 'i' } },
    ];
  }

  return query;
};

const getSortField = (sortBy) => {
  const sortMap = {
    reservationId: 'reservationId',
    customerName: 'customerName',
    customerPhone: 'customerPhone',
    customerEmail: 'customerEmail',
    pickupLocation: 'pickupLocation',
    dropoffLocation: 'returnLocation',
    pickupDate: 'pickupDate',
    returnDate: 'returnDate',
    totalAmount: 'price',
    paymentStatus: 'paymentStatus',
    status: 'status',
    createdAt: 'createdAt',
  };
  return sortMap[sortBy] || 'createdAt';
};

const filterByVehicleAndCategory = (bookings, filters) => {
  let result = bookings;

  if (filters.vehicle) {
    const search = filters.vehicle.toLowerCase();
    result = result.filter((b) => {
      const car = b.car;
      if (!car) return false;
      return `${car.brand} ${car.model}`.toLowerCase().includes(search);
    });
  }

  if (filters.category) {
    result = result.filter((b) => b.car?.category?.toLowerCase() === filters.category.toLowerCase());
  }

  if (filters.licensePlate) {
    const plate = filters.licensePlate.toLowerCase().trim();
    result = result.filter((b) => (b.car?.licensePlate || '').toLowerCase().includes(plate));
  }

  return result;
};

const checkAvailability = async (carId, pickupDate, returnDate, excludeBookingId = null) => {
  const query = {
    car: carId,
    status: { $in: ['pending', 'confirmed', 'ready_for_pickup', 'active'] },
    pickupDate: { $lte: returnDate },
    returnDate: { $gte: pickupDate },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };

  const overlap = await Booking.findOne(query);
  return !overlap;
};

const parseFilters = (query) => ({
  search: query.search,
  reservationId: query.reservationId,
  customerName: query.customerName,
  phone: query.phone,
  email: query.email,
  vehicle: query.vehicle,
  pickupLocation: query.pickupLocation,
  dropoffLocation: query.dropoffLocation,
  status: query.status,
  paymentStatus: query.paymentStatus,
  channel: query.channel,
  pickupDateFrom: query.pickupDateFrom,
  pickupDateTo: query.pickupDateTo,
  returnDateFrom: query.returnDateFrom,
  returnDateTo: query.returnDateTo,
  createdFrom: query.createdFrom,
  createdTo: query.createdTo,
  category: query.category,
  licensePlate: query.licensePlate,
});

export const checkAvailabilityOfCar = async (req, res) => {
  try {
    const { location, pickupDate, returnDate } = req.body;

    if (!pickupDate || !returnDate) {
      return res.status(400).json({ success: false, message: 'Pickup and return dates are required' });
    }

    const dates = parseDateRange(pickupDate, returnDate);
    if (!dates.valid) {
      return res.status(400).json({ success: false, message: dates.message });
    }

    const agency = await requirePublicAgency(req, res);
    if (!agency) return;

    const carQuery = {
      ...publicAgencyFilter(agency),
      isAvaliable: true,
    };
    if (location) {
      Object.assign(carQuery, locationAvailabilityFilter(location));
    }

    const cars = await Car.find(carQuery).lean();
    const availableCars = [];

    for (const car of cars) {
      if (car.status === 'maintenance') continue;
      const isAvailable = await checkAvailability(car._id, dates.picked, dates.returned);
      if (isAvailable) availableCars.push(car);
    }

    res.json({
      success: true,
      availableCars: await withCatalogDisplayOrders(groupCarsForCatalog(availableCars)),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to check availability' });
  }
};

export const quoteBooking = async (req, res) => {
  try {
    const {
      car: carId,
      pickupDate,
      returnDate,
      pickupLocationId,
      returnLocationId,
      promoCode = '',
      email = '',
    } = req.body || {};

    if (!carId || !pickupDate || !returnDate) {
      return res.status(400).json({ success: false, message: 'Car and dates are required' });
    }
    if (!mongoose.isValidObjectId(carId)) {
      return res.status(400).json({ success: false, message: 'Invalid car selected' });
    }

    const dates = parseDateRange(pickupDate, returnDate);
    if (!dates.valid) {
      return res.status(400).json({ success: false, message: dates.message });
    }

    const carData = await Car.findById(carId);
    if (!carData || !carData.owner) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }

    const agency = await requirePublicAgency(req, res);
    if (!agency) return;
    const carInAgency =
      (agency.agencyId && idsEqual(carData.agencyId, agency.agencyId)) ||
      idsEqual(carData.owner, agency.legacyOwnerId);
    if (!carInAgency) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }

    let pickupLoc = null;
    let returnLoc = null;
    if (mongoose.isValidObjectId(pickupLocationId) && mongoose.isValidObjectId(returnLocationId)) {
      const locScope = publicAgencyFilter(agency);
      [pickupLoc, returnLoc] = await Promise.all([
        PickupLocation.findOne({ _id: pickupLocationId, isActive: true, ...locScope }),
        PickupLocation.findOne({ _id: returnLocationId, isActive: true, ...locScope }),
      ]);
    }

    const quote = await buildAuthoritativeQuote({
      ownerId: carData.owner,
      car: carData,
      pickupDate: dates.picked,
      returnDate: dates.returned,
      pickupLoc,
      returnLoc,
      promoCode,
      customerEmail: String(email || '').trim().toLowerCase(),
      secondDriverEnabled: Boolean(req.body?.secondDriverEnabled || req.body?.secondDriver?.enabled),
      requireValidPromoCode: Boolean(String(promoCode || '').trim()),
    });

    if (!quote.ok) {
      return res.status(400).json({
        success: false,
        message: quote.message,
        code: quote.code || undefined,
        minRentalDays: quote.minRentalDays,
        maxRentalDays: quote.maxRentalDays,
        advanceBookingDays: quote.settings?.advanceBookingDays,
        days: quote.days,
        bookingSettings: quote.settings
          ? {
              minRentalDays: quote.settings.minRentalDays,
              maxRentalDays: quote.settings.maxRentalDays,
              advanceBookingDays: quote.settings.advanceBookingDays,
              pickupHoursStart: quote.settings.pickupHoursStart,
              pickupHoursEnd: quote.settings.pickupHoursEnd,
              returnHoursStart: quote.settings.returnHoursStart,
              returnHoursEnd: quote.settings.returnHoursEnd,
            }
          : undefined,
      });
    }

    const availability = await isModelAvailableForDates({
      ownerId: carData.owner,
      brand: carData.brand,
      model: carData.model,
      pickupDate: dates.picked,
      returnDate: dates.returned,
      preferredCarId: carId,
    });
    if (!availability.available) {
      const periods = publicUnavailablePayload(availability.unavailablePeriods);
      return res.status(409).json({
        success: false,
        code: 'DATES_UNAVAILABLE',
        message: 'This vehicle is not available for the selected dates',
        unavailablePeriods: periods,
      });
    }

    res.json({
      success: true,
      price: quote.price,
      priceBreakdown: quote.priceBreakdown,
      pricingSnapshot: quote.pricingSnapshot,
      bookingSettings: {
        minRentalDays: quote.settings.minRentalDays,
        maxRentalDays: quote.settings.maxRentalDays,
        advanceBookingDays: quote.settings.advanceBookingDays,
        pickupHoursStart: quote.settings.pickupHoursStart,
        pickupHoursEnd: quote.settings.pickupHoursEnd,
        returnHoursStart: quote.settings.returnHoursStart,
        returnHoursEnd: quote.settings.returnHoursEnd,
        cancellationPolicyText: quote.settings.cancellationPolicyText,
        mileageMode: quote.settings.mileageMode,
        mileageLimitKmPerDay: quote.settings.mileageLimitKmPerDay,
        securityDepositDefault: quote.settings.securityDepositDefault,
        extraDriverAllowed: quote.settings.extraDriverAllowed,
        extraDriverFeePerDay: quote.settings.extraDriverFeePerDay,
      },
      promoMessage: quote.promoMessage,
    });
  } catch (error) {
    console.error('[quoteBooking]', error.message);
    res.status(500).json({ success: false, message: 'Failed to quote booking' });
  }
};

export const createBooking = async (req, res) => {
  try {
    const {
      car: carId,
      pickupDate,
      returnDate,
      fullName,
      email,
      phone,
      pickupLocation,
      returnLocation,
      pickupLocationId,
      returnLocationId,
      notes,
      channel: requestChannel,
      promoCode = '',
    } = req.body;

    const isWhatsApp = requestChannel === 'whatsapp' || req.body.viaWhatsApp === true;

    const hasLocationIds =
      mongoose.isValidObjectId(pickupLocationId) && mongoose.isValidObjectId(returnLocationId);
    const hasLocationLabels = Boolean(pickupLocation && returnLocation);

    if (!carId || !pickupDate || !returnDate || !fullName || !email || !phone || (!hasLocationIds && !hasLocationLabels)) {
      return res.status(400).json({ success: false, message: 'Please complete all required booking details' });
    }

    if (!mongoose.isValidObjectId(carId)) {
      return res.status(400).json({ success: false, message: 'Invalid car selected' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    const phoneCheck = normalizeToE164(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ success: false, message: phoneCheck.message });
    }

    const dates = parseDateRange(pickupDate, returnDate);
    if (!dates.valid) {
      return res.status(400).json({ success: false, message: dates.message });
    }

    const carData = await Car.findById(carId);
    if (!carData || !carData.isAvaliable || !carData.owner || carData.status === 'maintenance') {
      return res.status(404).json({ success: false, message: 'Car is not available for booking' });
    }

    const agency = await requirePublicAgency(req, res);
    if (!agency) return;
    const carInAgency =
      (agency.agencyId && idsEqual(carData.agencyId, agency.agencyId)) ||
      idsEqual(carData.owner, agency.legacyOwnerId);
    if (!carInAgency) {
      return res.status(404).json({ success: false, message: 'Car is not available for booking' });
    }

    const assignedCar = await resolveAvailableCarUnit({
      ownerId: carData.owner,
      brand: carData.brand,
      model: carData.model,
      pickupDate: dates.picked,
      returnDate: dates.returned,
      preferredCarId: carId,
    });

    if (!assignedCar) {
      const availability = await isModelAvailableForDates({
        ownerId: carData.owner,
        brand: carData.brand,
        model: carData.model,
        pickupDate: dates.picked,
        returnDate: dates.returned,
        preferredCarId: carId,
      });
      return res.status(409).json({
        success: false,
        code: 'DATES_UNAVAILABLE',
        message: 'This vehicle is not available for the selected dates',
        unavailablePeriods: publicUnavailablePayload(availability.unavailablePeriods),
      });
    }

    const carForBooking = assignedCar;

    const bookingAgencyId = await resolveAgencyIdForOwner(
      carForBooking.owner,
      carForBooking.agencyId || agency.agencyId,
    );

    const blacklisted = await GuestCustomer.findOne({
      ...(bookingAgencyId
        ? { agencyId: bookingAgencyId }
        : { owner: carForBooking.owner }),
      email: email.trim().toLowerCase(),
      status: 'blacklisted',
    });
    if (blacklisted) {
      return res.status(403).json({
        success: false,
        message: 'Unable to complete this reservation. Please contact the agency directly.',
      });
    }

    let pickupLoc = null;
    let returnLoc = null;
    if (hasLocationIds) {
      const locScope = publicAgencyFilter(agency);
      [pickupLoc, returnLoc] = await Promise.all([
        PickupLocation.findOne({ _id: pickupLocationId, isActive: true, ...locScope }),
        PickupLocation.findOne({ _id: returnLocationId, isActive: true, ...locScope }),
      ]);
      if (!pickupLoc || !returnLoc) {
        return res.status(400).json({ success: false, message: 'Please select valid pickup and drop-off locations' });
      }
      if (!carServesCity(carForBooking, pickupLoc.city)) {
        return res.status(400).json({
          success: false,
          message: 'This vehicle is not available at the selected pickup location',
        });
      }
      if (!carServesCity(carForBooking, returnLoc.city)) {
        return res.status(400).json({
          success: false,
          message: 'This vehicle is not available at the selected drop-off location',
        });
      }
    }

    const quote = await buildAuthoritativeQuote({
      ownerId: carForBooking.owner,
      car: carForBooking,
      pickupDate: dates.picked,
      returnDate: dates.returned,
      pickupLoc,
      returnLoc,
      promoCode,
      customerEmail: email.trim().toLowerCase(),
      requireValidPromoCode: true,
    });
    if (!quote.ok) {
      return res.status(400).json({
        success: false,
        message: quote.message,
        code: quote.code || undefined,
        minRentalDays: quote.minRentalDays,
        maxRentalDays: quote.maxRentalDays,
        advanceBookingDays: quote.settings?.advanceBookingDays,
        days: quote.days,
        bookingSettings: quote.settings
          ? {
              minRentalDays: quote.settings.minRentalDays,
              maxRentalDays: quote.settings.maxRentalDays,
              advanceBookingDays: quote.settings.advanceBookingDays,
              pickupHoursStart: quote.settings.pickupHoursStart,
              pickupHoursEnd: quote.settings.pickupHoursEnd,
              returnHoursStart: quote.settings.returnHoursStart,
              returnHoursEnd: quote.settings.returnHoursEnd,
            }
          : undefined,
      });
    }

    const customerEmail = email.trim().toLowerCase();
    const reserved = await reservePromotionUsage(quote.applied, {
      customerEmail,
      ownerId: carForBooking.owner,
    });
    if (!reserved.ok) {
      return res.status(409).json({ success: false, message: reserved.message });
    }

    const priceBreakdown = quote.priceBreakdown;
    const price = quote.price;
    const pricingSnapshot = quote.pricingSnapshot;
    const reservationId = await generateReservationId();

    const pickupLabel = pickupLoc ? formatLocationLabel(pickupLoc) : String(pickupLocation).trim();
    const returnLabel = returnLoc ? formatLocationLabel(returnLoc) : String(returnLocation).trim();

    const stillAvailable = await checkAvailability(carForBooking._id, dates.picked, dates.returned);
    if (!stillAvailable) {
      await releasePromotionUsage(reserved.reserved, { customerEmail });
      const availability = await isModelAvailableForDates({
        ownerId: carForBooking.owner,
        brand: carForBooking.brand,
        model: carForBooking.model,
        pickupDate: dates.picked,
        returnDate: dates.returned,
        preferredCarId: carForBooking._id,
      });
      return res.status(409).json({
        success: false,
        code: 'DATES_UNAVAILABLE',
        message: 'This vehicle was just booked for these dates. Please select different dates.',
        unavailablePeriods: publicUnavailablePayload(availability.unavailablePeriods),
      });
    }

    let booking;
    try {
      booking = await Booking.create({
        reservationId,
        car: carForBooking._id,
        agencyId: bookingAgencyId,
        owner: carForBooking.owner,
        user: null,
        pickupDate: dates.picked,
        returnDate: dates.returned,
        price,
        priceBreakdown,
        pricingSnapshot,
        pendingExpiresAt: pendingExpiresAtFromSettings(quote.settings),
        customerName: fullName.trim(),
        customerEmail,
        customerPhone: phoneCheck.e164,
        pickupLocation: pickupLabel,
        returnLocation: returnLabel,
        pickupLocationId: pickupLoc?._id || null,
        returnLocationId: returnLoc?._id || null,
        notes: notes || '',
        paymentStatus: 'pending',
        status: 'pending',
        channel: isWhatsApp ? 'whatsapp' : 'online',
        createdBy: null,
        franchiseAmount: resolveFranchiseAmount(carForBooking, quote.settings),
        kmDepart: carForBooking.mileage != null ? String(carForBooking.mileage) : '',
      });
    } catch (createError) {
      await releasePromotionUsage(reserved.reserved, { customerEmail });
      throw createError;
    }

    await attachRedemptions({
      ownerId: carForBooking.owner,
      bookingId: booking._id,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      applied: quote.applied,
    });

    try {
      await Payment.create({
        booking: booking._id,
        agencyId: bookingAgencyId,
        owner: carForBooking.owner,
        user: null,
        amount: price,
        status: 'pending',
        gateway: 'offline',
        reference: reservationId,
      });
    } catch (paymentError) {
      console.error('Payment record create failed:', paymentError.message);
    }

    try {
      await upsertGuestFromBooking(booking);
      await createNotification({
        owner: carForBooking.owner,
        type: 'new_reservation',
        title: isWhatsApp ? 'WhatsApp reservation' : 'New reservation',
        message: `${booking.customerName} booked ${carForBooking.brand} ${carForBooking.model} (${reservationId})${isWhatsApp ? ' via WhatsApp' : ''}`,
        link: '/owner/manage-bookings',
        meta: { bookingId: booking._id.toString(), reservationId, channel: booking.channel },
      });
      await logAudit({
        owner: carForBooking.owner,
        action: isWhatsApp ? 'booking.create_whatsapp' : 'booking.create',
        entityType: 'Booking',
        entityId: booking._id,
        details: `${isWhatsApp ? 'WhatsApp' : 'Guest'} reservation ${reservationId} created — total ${price}`,
      });
    } catch (sideEffectError) {
      console.error('Post-booking side effects failed:', sideEffectError.message);
    }

    let whatsappUrl = null;
    let whatsappDial = null;
    if (isWhatsApp) {
      const dials = await resolveWhatsAppDials(carForBooking.owner);
      whatsappDial = dials.reservationDial;
      whatsappUrl = buildGuestToAgencyWhatsAppUrl(
        {
          reservationId,
          customerName: booking.customerName,
          customerPhone: booking.customerPhone,
          customerEmail: booking.customerEmail,
          vehicle: `${carForBooking.brand} ${carForBooking.model}${carForBooking.licensePlate ? ` (${carForBooking.licensePlate})` : ''}`,
          pickupLocation: booking.pickupLocation,
          returnLocation: booking.returnLocation,
          pickupDate: booking.pickupDate,
          returnDate: booking.returnDate,
          price: booking.price,
          priceBreakdown: booking.priceBreakdown,
          notes: booking.notes,
        },
        whatsappDial,
      );
    }

    res.status(201).json({
      success: true,
      message: isWhatsApp
        ? 'WhatsApp reservation created — opening WhatsApp'
        : 'Reservation submitted successfully',
      reservationId: booking.reservationId,
      bookingId: booking._id,
      status: booking.status,
      channel: booking.channel,
      price,
      priceBreakdown,
      pricingSnapshot,
      ...(whatsappUrl ? { whatsappUrl } : {}),
      ...(whatsappDial ? { whatsappDial } : {}),
    });
  } catch (error) {
    console.error(error.message);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Reservation conflict, please try again' });
    }
    res.status(500).json({ success: false, message: 'Failed to create reservation' });
  }
};

/**
 * Staff desk reservation — walk-in / offline.
 * Same Booking pipeline (CRM, calendar, payments, completion, reports).
 */
export const createWalkInBooking = async (req, res) => {
  try {
    const ownerId = req.agencyLegacyOwnerId || req.user._id;
    const agencyId = req.agencyId || null;
    const {
      car: carId,
      pickupDate,
      returnDate,
      fullName,
      email,
      phone,
      pickupLocationId,
      returnLocationId,
      pickupLocation,
      returnLocation,
      notes,
      status: requestedStatus,
      paymentStatus: requestedPayment,
      sendCompletionLink = false,
      markPaid = false,
      nationality,
      driverLicenseNumber,
      driverLicenseExpiry,
      driverLicenseIssuedOn,
      passportNumber,
      dateOfBirth,
      customerAddress,
      placeOfBirth,
      identityDocumentNumber,
      identityIssuedOn,
      secondDriver,
      deliveredBy,
      receivedBy,
      fuelLevelStart,
      kmDepart,
      kmRetour,
      franchiseAmount,
      promoCode = '',
    } = req.body;

    const hasLocationIds =
      mongoose.isValidObjectId(pickupLocationId) && mongoose.isValidObjectId(returnLocationId);
    const hasLocationLabels = Boolean(pickupLocation && returnLocation);

    if (!carId || !pickupDate || !returnDate || !fullName || !phone || (!hasLocationIds && !hasLocationLabels)) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle, dates, customer name, phone, and locations are required',
      });
    }

    if (!mongoose.isValidObjectId(carId)) {
      return res.status(400).json({ success: false, message: 'Invalid car selected' });
    }

    const normalizedEmail = email?.trim() ? email.trim().toLowerCase() : '';
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    const phoneCheck = normalizeToE164(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ success: false, message: phoneCheck.message });
    }

    const dates = parseDateRange(pickupDate, returnDate);
    if (!dates.valid) {
      return res.status(400).json({ success: false, message: dates.message });
    }

    const carData = await Car.findById(carId);
    if (!carData || carData.owner?.toString() !== ownerId.toString()) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }
    if (carData.status === 'maintenance' || !carData.isAvaliable) {
      return res.status(409).json({
        success: false,
        message: 'This vehicle is unavailable (maintenance or marked offline)',
      });
    }

    if (normalizedEmail) {
      const blacklisted = await GuestCustomer.findOne({
        owner: ownerId,
        email: normalizedEmail,
        status: 'blacklisted',
      });
      if (blacklisted) {
        return res.status(403).json({
          success: false,
          message: 'This customer is blacklisted and cannot be booked',
        });
      }
    }

    const available = await checkAvailability(carId, dates.picked, dates.returned);
    if (!available) {
      return res.status(409).json({ success: false, message: 'Car is not available for the selected dates' });
    }

    let pickupLoc = null;
    let returnLoc = null;
    if (hasLocationIds) {
      const locFilter = agencyId
        ? { agencyId, isActive: true }
        : { owner: ownerId, isActive: true };
      [pickupLoc, returnLoc] = await Promise.all([
        PickupLocation.findOne({ _id: pickupLocationId, ...locFilter }),
        PickupLocation.findOne({ _id: returnLocationId, ...locFilter }),
      ]);
      if (!pickupLoc || !returnLoc) {
        return res.status(400).json({ success: false, message: 'Please select valid pickup and drop-off locations' });
      }
      if (!carServesCity(carData, pickupLoc.city)) {
        return res.status(400).json({
          success: false,
          message: 'This vehicle is not available at the selected pickup location',
        });
      }
      if (!carServesCity(carData, returnLoc.city)) {
        return res.status(400).json({
          success: false,
          message: 'This vehicle is not available at the selected drop-off location',
        });
      }
    }

    // Synthetic email keeps CRM upsert working when desk omits email;
    // templateEngine strips @local.americonfort from printed contracts.
    const guestEmail =
      normalizedEmail ||
      `walkin+${phoneCheck.e164.replace(/\D/g, '').slice(-9) || Date.now()}@local.americonfort`;

    const quote = await buildAuthoritativeQuote({
      ownerId,
      car: carData,
      pickupDate: dates.picked,
      returnDate: dates.returned,
      pickupLoc,
      returnLoc,
      promoCode,
      customerEmail: guestEmail,
      secondDriverEnabled: Boolean(secondDriver?.enabled),
      requireValidPromoCode: true,
    });
    if (!quote.ok) {
      return res.status(400).json({
        success: false,
        message: quote.message,
        code: quote.code || undefined,
        minRentalDays: quote.minRentalDays,
        maxRentalDays: quote.maxRentalDays,
        days: quote.days,
        bookingSettings: quote.settings
          ? {
              minRentalDays: quote.settings.minRentalDays,
              maxRentalDays: quote.settings.maxRentalDays,
            }
          : undefined,
      });
    }

    const reserved = await reservePromotionUsage(quote.applied, {
      customerEmail: guestEmail,
      ownerId,
    });
    if (!reserved.ok) {
      return res.status(409).json({ success: false, message: reserved.message });
    }

    const priceBreakdown = quote.priceBreakdown;
    const price = quote.price;
    const pricingSnapshot = quote.pricingSnapshot;
    const reservationId = await generateReservationId();
    const pickupLabel = pickupLoc ? formatLocationLabel(pickupLoc) : String(pickupLocation).trim();
    const returnLabel = returnLoc ? formatLocationLabel(returnLoc) : String(returnLocation).trim();

    const stillAvailable = await checkAvailability(carId, dates.picked, dates.returned);
    if (!stillAvailable) {
      await releasePromotionUsage(reserved.reserved, { customerEmail: guestEmail });
      return res.status(409).json({ success: false, message: 'Car is not available for the selected dates' });
    }

    let status = BOOKING_STATUSES.includes(requestedStatus) ? requestedStatus : 'confirmed';
    if (status === 'cancelled') status = 'confirmed';

    const paymentStatus =
      markPaid || requestedPayment === 'paid'
        ? 'paid'
        : PAYMENT_STATUSES.includes(requestedPayment)
          ? requestedPayment
          : 'pending';

    const franchiseResolved = resolveFranchiseAmount(carData, quote.settings, franchiseAmount);
    const kmDepartResolved =
      kmDepart !== undefined && kmDepart !== null && String(kmDepart).trim() !== ''
        ? String(kmDepart).trim()
        : (carData.mileage != null ? String(carData.mileage) : '');

    let booking;
    try {
      booking = await Booking.create({
      reservationId,
      car: carId,
      agencyId: agencyId || (await resolveAgencyIdForOwner(ownerId, carData.agencyId)),
      owner: ownerId,
      user: null,
      createdBy: req.user._id,
      channel: 'walk_in',
      pickupDate: dates.picked,
      returnDate: dates.returned,
      price,
      priceBreakdown,
      pricingSnapshot,
      pendingExpiresAt: status === 'pending' ? pendingExpiresAtFromSettings(quote.settings) : null,
      customerName: fullName.trim(),
      customerEmail: guestEmail,
      customerPhone: phoneCheck.e164,
      pickupLocation: pickupLabel,
      returnLocation: returnLabel,
      pickupLocationId: pickupLoc?._id || null,
      returnLocationId: returnLoc?._id || null,
      notes: notes || '',
      nationality: nationality || '',
      dateOfBirth: dateOfBirth || '',
      customerAddress: customerAddress || '',
      placeOfBirth: placeOfBirth || '',
      identityDocumentNumber: identityDocumentNumber || '',
      identityIssuedOn: identityIssuedOn || '',
      driverLicenseNumber: driverLicenseNumber || '',
      driverLicenseExpiry: driverLicenseExpiry || '',
      driverLicenseIssuedOn: driverLicenseIssuedOn || '',
      passportNumber: passportNumber || '',
      deliveredBy: deliveredBy || '',
      receivedBy: receivedBy || '',
      fuelLevelStart: fuelLevelStart || '',
      kmDepart: kmDepartResolved,
      kmRetour: kmRetour || '',
      franchiseAmount: franchiseResolved,
      secondDriver: {
        enabled: Boolean(secondDriver?.enabled),
        fullName: secondDriver?.fullName?.trim() || '',
        dateOfBirth: secondDriver?.dateOfBirth?.trim() || '',
        nationality: secondDriver?.nationality?.trim() || '',
        driverLicenseNumber: secondDriver?.driverLicenseNumber?.trim() || '',
        driverLicenseExpiry: secondDriver?.driverLicenseExpiry?.trim() || '',
        passportNumber: secondDriver?.passportNumber?.trim() || '',
        phone: secondDriver?.phone?.trim() || '',
      },
      status,
      paymentStatus,
      completion: {
        paymentComplete: paymentStatus === 'paid',
        amountPaid: paymentStatus === 'paid' ? price : 0,
        paymentType: paymentStatus === 'paid' ? 'full' : '',
        paymentCompletedAt: paymentStatus === 'paid' ? new Date() : null,
      },
    });
    } catch (createError) {
      await releasePromotionUsage(reserved.reserved, { customerEmail: guestEmail });
      throw createError;
    }

    await attachRedemptions({
      ownerId,
      bookingId: booking._id,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      applied: quote.applied,
    });

    try {
      await Payment.create({
        booking: booking._id,
        agencyId: booking.agencyId || agencyId,
        owner: ownerId,
        user: null,
        amount: price,
        status: paymentStatus === 'paid' ? 'paid' : 'pending',
        gateway: 'offline',
        method: 'walk_in',
        reference: reservationId,
      });
    } catch (paymentError) {
      console.error('Payment record create failed:', paymentError.message);
    }

    let completionMeta = null;
    if (sendCompletionLink && normalizedEmail && ['confirmed', 'pending'].includes(status)) {
      try {
        if (status === 'pending') {
          booking.status = 'confirmed';
          await booking.save();
        }
        completionMeta = await initiateBookingCompletion(booking);
      } catch (err) {
        console.error('Walk-in completion link failed:', err.message);
      }
    }

    try {
      await upsertGuestFromBooking(booking);
      await createNotification({
        owner: ownerId,
        type: 'new_reservation',
        title: 'Walk-in reservation',
        message: `${booking.customerName} — ${carData.brand} ${carData.model} (${reservationId})`,
        link: '/owner/manage-bookings',
        meta: { bookingId: booking._id.toString(), reservationId, channel: 'walk_in' },
      });
      await logAudit({
        owner: ownerId,
        actor: ownerId,
        action: 'booking.walk_in.create',
        entityType: 'Booking',
        entityId: booking._id,
        details: `Walk-in reservation ${reservationId} — ${status}/${paymentStatus} — total ${price}`,
      });
    } catch (sideEffectError) {
      console.error('Walk-in side effects failed:', sideEffectError.message);
    }

    const populated = await Booking.findById(booking._id).populate('car');

    res.status(201).json({
      success: true,
      message: 'Walk-in reservation created',
      reservationId: booking.reservationId,
      booking: populated,
      completion: completionMeta
        ? {
            emailSent: completionMeta.email?.success,
            completionUrl: completionMeta.completionUrl,
          }
        : null,
    });
  } catch (error) {
    console.error(error.message);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Reservation conflict, please try again' });
    }
    res.status(500).json({ success: false, message: 'Failed to create walk-in reservation' });
  }
};

export const getOwnerBookings = async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const sortBy = getSortField(req.query.sortBy);
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const query = buildBookingQuery(req.user._id, filters);

    let bookings = await Booking.find(query)
      .populate('car')
      .sort({ [sortBy]: sortOrder })
      .lean();

    bookings = filterByVehicleAndCategory(bookings, filters);
    const total = bookings.length;
    const paginatedBookings = bookings.slice(skip, skip + limit);

    res.json({
      success: true,
      bookings: paginatedBookings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch reservations' });
  }
};

export const changeBookingStatus = async (req, res) => {
  try {
    const { _id } = req.user;
    const { bookingId, status, force } = req.body;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }
    if (!BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.owner?.toString() !== _id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Ready for pickup requires documents + payment + signature
    // Force override only when explicitly enabled (ops break-glass)
    const allowForce =
      force === true &&
      String(process.env.ALLOW_FORCE_BOOKING_STATUS || '').toLowerCase() === 'true';

    if (status === 'ready_for_pickup' && !allowForce) {
      const c = booking.completion || {};
      const ready =
        c.documentsComplete && c.paymentComplete && c.signatureComplete;
      if (!ready) {
        return res.status(400).json({
          success: false,
          message:
            'Customer must complete documents, payment, and signature first. Confirm the booking to send them a secure link.',
        });
      }
    }

    if (status === 'cancelled' && booking.status !== 'cancelled') {
      const snap = booking.pricingSnapshot?.cancellation || {};
      const estimated = Number(snap.estimatedFee);
      if (Number.isFinite(estimated) && estimated >= 0) {
        booking.cancellationFeeCharged = estimated;
      } else {
        booking.cancellationFeeCharged = computeCancellationFee(
          {
            cancellationFeeType: snap.feeType || 'none',
            cancellationFeeValue: snap.feeValue || 0,
          },
          booking.pricingSnapshot?.finalPrice ?? booking.price,
        );
      }
    }

    booking.status = status;
    await booking.save();

    let completionMeta = null;
    if (status === 'confirmed') {
      try {
        if (booking.customerEmail) {
          await refreshGuestStats(booking.owner, booking.customerEmail);
        }
        await logAudit({
          owner: _id,
          actor: _id,
          action: 'booking.status',
          entityType: 'Booking',
          entityId: booking._id,
          details: `Reservation ${booking.reservationId || booking._id} → ${status}`,
        });
      } catch (e) {
        console.error(e.message);
      }

      try {
        const result = await initiateBookingCompletion(bookingId);
        const emailOk = Boolean(result.emailResult?.success);
        const emailSkipped = Boolean(result.emailResult?.skipped);
        completionMeta = {
          completionUrl: result.completionUrl,
          shareableCompletionUrl: result.completionUrl,
          emailSent: emailOk,
          emailSkipped,
          emailTo: result.emailResult?.to || booking.customerEmail,
          emailReason: result.emailResult?.reason || '',
          messageId: result.emailResult?.messageId || '',
        };
        return res.json({
          success: true,
          message: emailOk
            ? `Reservation confirmed — completion email accepted by SMTP for ${completionMeta.emailTo}`
            : emailSkipped
              ? `Reservation confirmed, but email was NOT sent: ${completionMeta.emailReason}. Configure SMTP in server/.env. Completion link is still available to copy.`
              : `Reservation confirmed, but email FAILED: ${completionMeta.emailReason}. Check server logs ([email]). You can still copy/resend the link.`,
          completion: completionMeta,
          email: result.emailResult,
        });
      } catch (completionError) {
        console.error('Completion invite failed:', completionError.message);
        try {
          const fallback = await generateCompletionLink(bookingId, { resend: true });
          completionMeta = {
            completionUrl: fallback.completionUrl,
            shareableCompletionUrl: fallback.completionUrl,
            emailSent: false,
            emailSkipped: true,
            emailTo: booking.customerEmail,
            emailReason: completionError.message,
            messageId: '',
          };
          return res.json({
            success: true,
            message: `Reservation confirmed. Completion link ready (email step failed: ${completionError.message}).`,
            completion: completionMeta,
          });
        } catch (fallbackErr) {
          console.error('Completion link fallback failed:', fallbackErr.message);
          return res.json({
            success: true,
            message: `Reservation confirmed, but completion link failed: ${fallbackErr.message}`,
            completion: null,
          });
        }
      }
    }

    try {
      if (booking.customerEmail) {
        await refreshGuestStats(booking.owner, booking.customerEmail);
      }
      await logAudit({
        owner: _id,
        actor: _id,
        action: 'booking.status',
        entityType: 'Booking',
        entityId: booking._id,
        details: `Reservation ${booking.reservationId || booking._id} → ${status}`,
      });
    } catch (e) {
      console.error(e.message);
    }

    res.json({
      success: true,
      message: `Reservation marked as ${status}`,
      completion: completionMeta,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

export const changePaymentStatus = async (req, res) => {
  try {
    const { _id } = req.user;
    const { bookingId, paymentStatus } = req.body;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }
    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.owner?.toString() !== _id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    booking.paymentStatus = paymentStatus;
    await booking.save();

    await Payment.findOneAndUpdate(
      { booking: bookingId },
      { status: paymentStatus },
    );

    res.json({ success: true, message: `Payment status updated to ${paymentStatus}` });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update payment status' });
  }
};

export const updateBooking = async (req, res) => {
  try {
    const { _id } = req.user;
    const {
      bookingId,
      customerName,
      customerEmail,
      customerPhone,
      pickupDate,
      returnDate,
      pickupLocation,
      returnLocation,
      notes,
      status,
      paymentStatus,
      carId,
      dateOfBirth,
      nationality,
      customerAddress,
      placeOfBirth,
      identityDocumentNumber,
      identityIssuedOn,
      driverLicenseNumber,
      driverLicenseExpiry,
      driverLicenseIssuedOn,
      passportNumber,
      secondDriver,
      deliveredBy,
      receivedBy,
      fuelLevelStart,
      kmDepart,
      kmRetour,
      franchiseAmount,
    } = req.body;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(bookingId).populate('car');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.owner?.toString() !== _id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (!booking.car) {
      return res.status(400).json({ success: false, message: 'Associated vehicle no longer exists' });
    }

    if (status && !BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    if (paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status' });
    }

    if (carId && mongoose.isValidObjectId(carId) && String(carId) !== String(booking.car._id)) {
      const newCar = await Car.findOne({ _id: carId, owner: _id });
      if (!newCar) {
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }
      if (newCar.status === 'maintenance' || !newCar.isAvaliable) {
        return res.status(409).json({ success: false, message: 'Selected vehicle is unavailable' });
      }
      const available = await checkAvailability(
        carId,
        booking.pickupDate,
        booking.returnDate,
        bookingId,
      );
      if (!available) {
        return res.status(409).json({ success: false, message: 'Selected vehicle is already booked for these dates' });
      }
      booking.car = carId;
      booking.markModified('car');
    }

    if (pickupDate && returnDate) {
      const dates = parseDateRange(pickupDate, returnDate);
      if (!dates.valid) {
        return res.status(400).json({ success: false, message: dates.message });
      }

      const settings = await getBookingSettings(booking.owner);
      const rules = assertBookingRules(settings, dates.picked, dates.returned);
      if (!rules.ok) {
        return res.status(400).json({
          success: false,
          message: rules.message,
          code: rules.code || undefined,
          minRentalDays: rules.minRentalDays,
          maxRentalDays: rules.maxRentalDays,
          days: rules.days,
        });
      }

      const available = await checkAvailability(
        booking.car._id,
        dates.picked,
        dates.returned,
        bookingId,
      );
      if (!available) {
        return res.status(409).json({ success: false, message: 'Car is not available for the selected dates' });
      }

      booking.pickupDate = dates.picked;
      booking.returnDate = dates.returned;
    }

    if (pickupLocation) booking.pickupLocation = pickupLocation;
    if (returnLocation) booking.returnLocation = returnLocation;

    if (secondDriver?.enabled) {
      const settings = await getBookingSettings(booking.owner);
      if (!settings.extraDriverAllowed) {
        return res.status(400).json({
          success: false,
          message: 'Extra drivers are not allowed by current booking settings',
        });
      }
    }

    // Pricing:
    // - pending: re-resolve promotions against current dates/vehicle (server-side)
    // - confirmed+: keep frozen discount amounts so expired/disabled promos don't alter history
    {
      let pickupLoc = null;
      let returnLoc = null;
      let pickupFee = booking.priceBreakdown?.pickupDeliveryFee ?? 0;
      let dropoffFee = booking.priceBreakdown?.dropoffDeliveryFee ?? 0;

      if (booking.pickupLocationId || booking.returnLocationId) {
        [pickupLoc, returnLoc] = await Promise.all([
          booking.pickupLocationId
            ? PickupLocation.findOne({ _id: booking.pickupLocationId, owner: booking.owner })
            : null,
          booking.returnLocationId
            ? PickupLocation.findOne({ _id: booking.returnLocationId, owner: booking.owner })
            : null,
        ]);
        if (pickupLoc && returnLoc) {
          const resolved = resolveLocationDeliveryFees(pickupLoc, returnLoc);
          pickupFee = resolved.pickupDeliveryFee;
          dropoffFee = resolved.dropoffDeliveryFee;
        } else {
          if (pickupLoc) pickupFee = resolveLocationDeliveryFees(pickupLoc, null).pickupDeliveryFee;
          if (returnLoc) dropoffFee = resolveLocationDeliveryFees(null, returnLoc).dropoffDeliveryFee;
        }
      }

      const carDoc = booking.car?.pricePerDay != null
        ? booking.car
        : await Car.findById(booking.car);

      if (booking.status === 'pending') {
        const quote = await buildAuthoritativeQuote({
          ownerId: booking.owner,
          car: carDoc,
          pickupDate: booking.pickupDate,
          returnDate: booking.returnDate,
          pickupLoc,
          returnLoc,
          promoCode: booking.pricingSnapshot?.promoCode || booking.priceBreakdown?.discounts?.[0]?.code || '',
          customerEmail: booking.customerEmail,
          secondDriverEnabled: Boolean(
            secondDriver?.enabled ?? booking.secondDriver?.enabled,
          ),
          requireValidPromoCode: false,
        });
        if (!quote.ok) {
          return res.status(400).json({ success: false, message: quote.message });
        }
        booking.priceBreakdown = quote.priceBreakdown;
        booking.price = quote.price;
        booking.pricingSnapshot = quote.pricingSnapshot;
        booking.pendingExpiresAt = pendingExpiresAtFromSettings(quote.settings, booking.createdAt || new Date());
      } else {
        const frozenDiscounts = (booking.priceBreakdown?.discounts || []).map((d) => ({
          code: d.code || '',
          label: d.label || '',
          amount: Number(d.amount) || 0,
          promotionId: d.promotionId || null,
          discountType: d.discountType || '',
          discountValue: d.discountValue ?? null,
        }));
        const frozenExtraDriverFee = Number(
          booking.priceBreakdown?.extraDriverFee
            ?? booking.pricingSnapshot?.extraDriverFee
            ?? 0,
        ) || 0;

        const priceBreakdown = calculateBookingPrice({
          pricePerDay: carDoc.pricePerDay,
          pickupDate: booking.pickupDate,
          returnDate: booking.returnDate,
          pickupDeliveryFee: pickupFee,
          dropoffDeliveryFee: dropoffFee,
          extraDriverFee: frozenExtraDriverFee,
          discounts: frozenDiscounts,
        });
        priceBreakdown.discounts = frozenDiscounts.map((d, i) => ({
          ...priceBreakdown.discounts[i],
          promotionId: d.promotionId,
          discountType: d.discountType,
          discountValue: d.discountValue,
        }));
        booking.priceBreakdown = priceBreakdown;
        booking.price = priceBreakdown.total;
        booking.pricingSnapshot = buildPricingSnapshot({
          priceBreakdown,
          discounts: frozenDiscounts,
          extras: booking.pricingSnapshot?.extras || {
            extraDriverEnabled: frozenExtraDriverFee > 0,
            extraDriverFee: frozenExtraDriverFee,
          },
          cancellation: booking.pricingSnapshot?.cancellation || {},
          mileage: booking.pricingSnapshot?.mileage || {},
          timezone: booking.pricingSnapshot?.timezone || 'Africa/Casablanca',
        });
      }
    }

    if (customerName) booking.customerName = customerName.trim();
    if (customerEmail) {
      if (!isValidEmail(customerEmail)) {
        return res.status(400).json({ success: false, message: 'Invalid email address' });
      }
      booking.customerEmail = customerEmail.trim().toLowerCase();
    }
    if (customerPhone) {
      const phoneCheck = normalizeToE164(customerPhone);
      if (!phoneCheck.valid) {
        return res.status(400).json({ success: false, message: phoneCheck.message });
      }
      booking.customerPhone = phoneCheck.e164;
    }
    applyCompletionDetailsToBooking(booking, {
      dateOfBirth,
      nationality,
      customerAddress,
      placeOfBirth,
      identityDocumentNumber,
      identityIssuedOn,
      driverLicenseNumber,
      driverLicenseExpiry,
      driverLicenseIssuedOn,
      passportNumber,
      secondDriver,
      deliveredBy,
      receivedBy,
      fuelLevelStart,
      kmDepart,
      kmRetour,
      franchiseAmount,
    });
    if (notes !== undefined) booking.notes = notes;
    if (status) booking.status = status;
    if (paymentStatus) booking.paymentStatus = paymentStatus;

    await booking.save();

    if (paymentStatus) {
      await Payment.findOneAndUpdate({ booking: bookingId }, { status: paymentStatus });
    }
    if (booking.price != null) {
      await Payment.findOneAndUpdate({ booking: bookingId }, { amount: booking.price });
    }

    res.json({ success: true, message: 'Reservation updated', booking });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update reservation' });
  }
};

export const assignBookingVehicle = async (req, res) => {
  try {
    const { bookingId, carId } = req.body;
    const ownerId = req.user._id;

    if (!mongoose.isValidObjectId(bookingId) || !mongoose.isValidObjectId(carId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking or vehicle ID' });
    }

    const booking = await Booking.findOne({ _id: bookingId, owner: ownerId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const newCar = await Car.findOne({ _id: carId, owner: ownerId });
    if (!newCar) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    if (newCar.status === 'maintenance' || !newCar.isAvaliable) {
      return res.status(409).json({ success: false, message: 'Vehicle is unavailable' });
    }

    const available = await checkAvailability(
      carId,
      booking.pickupDate,
      booking.returnDate,
      bookingId,
    );
    if (!available) {
      return res.status(409).json({ success: false, message: 'Vehicle is already booked for these dates' });
    }

    booking.car = carId;
    await booking.save();

    const populated = await Booking.findById(bookingId).populate('car');
    res.json({ success: true, message: 'Vehicle assigned', booking: populated });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to assign vehicle' });
  }
};

export const deleteBooking = async (req, res) => {
  try {
    const { _id } = req.user;
    const { bookingId } = req.body;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.owner?.toString() !== _id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await Payment.deleteMany({ booking: bookingId });
    await Booking.findByIdAndDelete(bookingId);

    res.json({ success: true, message: 'Reservation deleted' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to delete reservation' });
  }
};

export const exportOwnerBookings = async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const query = buildBookingQuery(req.user._id, filters);

    let bookings = await Booking.find(query)
      .populate('car')
      .sort({ createdAt: -1 })
      .lean();

    bookings = filterByVehicleAndCategory(bookings, filters);

    const formatDate = (date) => (date ? new Date(date).toISOString().split('T')[0] : '');
    const formatDateTime = (date) => (date ? new Date(date).toLocaleString() : '');

    const headers = [
      'Reservation ID', 'Channel', 'Customer Name', 'Phone', 'Email', 'Vehicle', 'License Plate', 'Category',
      'Pickup Location', 'Drop-off Location', 'Pickup Date', 'Return Date',
      'Total Amount', 'Payment Status', 'Reservation Status', 'Created At', 'Notes',
    ];

    const rows = bookings.map((b) => [
      b.reservationId || `RES-${b._id.toString().slice(-8).toUpperCase()}`,
      b.channel === 'walk_in' ? 'Walk-in' : 'Online',
      b.customerName || '',
      b.customerPhone || '',
      b.customerEmail || '',
      b.car ? `${b.car.brand} ${b.car.model}` : '',
      b.car?.licensePlate || '',
      b.car?.category || '',
      b.pickupLocation || '',
      b.returnLocation || '',
      formatDateTime(b.pickupDate),
      formatDateTime(b.returnDate),
      b.price || 0,
      b.paymentStatus || '',
      b.status || '',
      formatDate(b.createdAt),
      b.notes || '',
    ]);

    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=reservations.csv');
    res.send(csv);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to export reservations' });
  }
};

export const getCalendarBookings = async (req, res) => {
  try {
    const { month, year } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);

    const bookings = await Booking.find({
      owner: req.user._id,
      status: { $nin: ['cancelled'] },
      pickupDate: { $lte: end },
      returnDate: { $gte: start },
    })
      .populate('car', 'brand model')
      .select('reservationId customerName pickupDate returnDate status channel car paymentStatus price')
      .sort({ pickupDate: 1 })
      .lean();

    res.json({ success: true, bookings });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch calendar data' });
  }
};
