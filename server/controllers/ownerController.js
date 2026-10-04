import fs from 'fs';
import mongoose from 'mongoose';
import { getImageKit } from "../configs/imageKit.js";
import Booking from "../models/Booking.js";
import Car from "../models/Car.js";
import MaintenanceRecord from "../models/MaintenanceRecord.js";
import User from "../models/User.js";
import { cleanupUploadedFile } from "../middleware/multer.js";
import { escapeRegex } from "../utils/helpers.js";
import {
  generateFleetId,
  normalizeCategory,
  normalizePlate,
  normalizeVin,
} from "../utils/fleetAssets.js";
import {
  applyLocationsToCar,
  getCarLocations,
  normalizeLocations,
} from "../utils/carLocations.js";

const uploadToImageKit = async (imageFile, folder, width = '1280') => {
  const imagekit = getImageKit();
  if (!imagekit) {
    throw new Error('ImageKit is not configured');
  }
  const fileBuffer = fs.readFileSync(imageFile.path);
  const response = await imagekit.upload({
    file: fileBuffer,
    fileName: imageFile.originalname,
    folder,
  });

  return imagekit.url({
    path: response.filePath,
    transformation: [
      { width },
      { quality: 'auto' },
      { format: 'webp' },
    ],
  });
};

const assertOwnerCar = async (carId, ownerId, agencyId = null) => {
  if (!mongoose.isValidObjectId(carId)) return null;
  const car = await Car.findById(carId);
  if (!car) return null;
  if (agencyId && car.agencyId && String(car.agencyId) === String(agencyId)) return car;
  if (car.owner && ownerId && car.owner.toString() === ownerId.toString()) return car;
  return null;
};

const ensureUniqueFleetId = async (ownerId, preferred = '') => {
  let fleetId = String(preferred || '').trim().toUpperCase();
  if (fleetId) {
    const clash = await Car.findOne({ owner: ownerId, fleetId });
    if (clash) throw Object.assign(new Error('Fleet ID already exists for another vehicle'), { status: 409 });
    return fleetId;
  }
  for (let i = 0; i < 12; i++) {
    fleetId = generateFleetId();
    const exists = await Car.exists({ owner: ownerId, fleetId });
    if (!exists) return fleetId;
  }
  return `FLT-${Date.now().toString(36).toUpperCase()}`;
};

const assertUniqueAssetFields = async (ownerId, { vin, licensePlate, fleetId }, excludeId = null) => {
  const checks = [];
  if (vin) checks.push({ field: 'VIN', query: { owner: ownerId, vin } });
  if (licensePlate) checks.push({ field: 'License plate', query: { owner: ownerId, licensePlate } });
  if (fleetId) checks.push({ field: 'Fleet ID', query: { owner: ownerId, fleetId } });

  for (const { field, query } of checks) {
    if (excludeId) query._id = { $ne: excludeId };
    const hit = await Car.findOne(query).select('_id');
    if (hit) {
      const err = new Error(`${field} is already assigned to another vehicle in your fleet`);
      err.status = 409;
      throw err;
    }
  }
};

/** Backfill fleetId / locations for legacy cars */
const backfillFleetIds = async (ownerId) => {
  const missing = await Car.find({
    owner: ownerId,
    $or: [
      { fleetId: '' },
      { fleetId: null },
      { fleetId: { $exists: false } },
      { locations: { $exists: false } },
      { locations: { $size: 0 } },
    ],
  });
  for (const car of missing) {
    if (!car.fleetId) {
      car.fleetId = await ensureUniqueFleetId(ownerId);
    }
    if (!car.branch && car.location) car.branch = car.location;
    const locs = getCarLocations(car);
    if (locs.length) {
      applyLocationsToCar(car, locs);
    }
    await car.save();
  }
};

export const addCar = async (req, res) => {
  let imageFile = req.file;
  try {
    const { _id } = req.user;

    try {
      const { assertCanAddVehicle } = await import('../services/entitlementsService.js');
      await assertCanAddVehicle(req.agencyId);
    } catch (entErr) {
      if (entErr?.code === 'LIMIT_REACHED' || entErr?.code === 'BILLING_LOCKED' || entErr?.status === 403) {
        return res.status(entErr.status || 403).json({
          success: false,
          code: entErr.code || 'ENTITLEMENT_DENIED',
          message: entErr.message,
          meta: entErr.meta,
        });
      }
      throw entErr;
    }

    if (!imageFile) {
      return res.status(400).json({ success: false, message: 'Car image is required' });
    }
    if (!req.body.carData) {
      return res.status(400).json({ success: false, message: 'Car data is required' });
    }

    let car;
    try {
      car = JSON.parse(req.body.carData);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid car data format' });
    }

    const required = ['brand', 'model', 'year', 'category', 'transmission', 'fuel_type', 'seating_capacity', 'description', 'pricePerDay'];
    for (const field of required) {
      if (!car[field] && car[field] !== 0) {
        return res.status(400).json({ success: false, message: `Missing required field: ${field}` });
      }
    }

    const locations = normalizeLocations(car.locations, car.location);
    if (!locations.length) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one pickup location where this vehicle is available',
      });
    }

    const vin = normalizeVin(car.vin);
    const licensePlate = normalizePlate(car.licensePlate);
    const branch = String(car.branch || locations[0] || '').trim();
    const fleetId = await ensureUniqueFleetId(_id, car.fleetId);
    await assertUniqueAssetFields(_id, { vin, licensePlate, fleetId });

    const image = await uploadToImageKit(imageFile, '/cars');
    cleanupUploadedFile(imageFile);
    imageFile = null;

    const created = await Car.create({
      ...car,
      category: normalizeCategory(car.category),
      agencyId: req.agencyId || null,
      owner: req.agencyLegacyOwnerId || _id,
      image,
      isAvaliable: true,
      fleetId,
      vin,
      licensePlate,
      branch,
      locations,
      location: locations[0],
      mileage: Number(car.mileage) || 0,
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle added to fleet',
      car: created,
    });
  } catch (error) {
    console.error(error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Failed to add car',
    });
  } finally {
    cleanupUploadedFile(imageFile);
  }
};

export const getOwnerCars = async (req, res) => {
  try {
    const { _id } = req.user;
    await backfillFleetIds(_id);

    const {
      search = '',
      fleetId = '',
      vin = '',
      plate = '',
      status = '',
      branch = '',
      category = '',
    } = req.query;

    const filter = { owner: _id };
    if (status) filter.status = status;
    if (branch) filter.branch = new RegExp(escapeRegex(branch), 'i');
    if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
    if (fleetId) filter.fleetId = new RegExp(escapeRegex(fleetId), 'i');
    if (vin) filter.vin = new RegExp(escapeRegex(vin), 'i');
    if (plate) filter.licensePlate = new RegExp(escapeRegex(plate), 'i');

    if (search.trim()) {
      const q = escapeRegex(search.trim());
      filter.$or = [
        { fleetId: new RegExp(q, 'i') },
        { vin: new RegExp(q, 'i') },
        { licensePlate: new RegExp(q, 'i') },
        { brand: new RegExp(q, 'i') },
        { model: new RegExp(q, 'i') },
        { branch: new RegExp(q, 'i') },
        { location: new RegExp(q, 'i') },
        { locations: new RegExp(q, 'i') },
      ];
    }

    const cars = await Car.find(filter).sort({ fleetId: 1, createdAt: -1 });
    const branches = await Car.distinct('branch', { owner: _id, branch: { $nin: ['', null] } });

    res.json({ success: true, cars, branches });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch cars' });
  }
};

export const getOwnerCarById = async (req, res) => {
  try {
    const car = await assertOwnerCar(req.params.id, req.user._id);
    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }
    res.json({ success: true, car });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch car' });
  }
};

export const getVehicleStats = async (req, res) => {
  try {
    const car = await assertOwnerCar(req.params.id, req.user._id);
    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }

    const ownerId = req.user._id;
    const [bookings, maintenanceRecords] = await Promise.all([
      Booking.find({ owner: ownerId, car: car._id }).sort({ pickupDate: 1 }).lean(),
      MaintenanceRecord.find({ owner: ownerId, car: car._id }).sort({ scheduledDate: -1, completedDate: -1 }).lean(),
    ]);

    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setFullYear(now.getFullYear() - 1);

    const activeStatuses = ['pending', 'confirmed', 'ready_for_pickup', 'active'];
    const nonCancelledBookings = bookings.filter((booking) => booking.status !== 'cancelled');
    const rentalDays = nonCancelledBookings.reduce((sum, booking) => {
      if (booking.priceBreakdown?.days > 0) return sum + Number(booking.priceBreakdown.days);
      if (!booking.pickupDate || !booking.returnDate) return sum;
      const start = new Date(booking.pickupDate);
      const end = new Date(booking.returnDate);
      const diffDays = Math.max(1, Math.ceil((end - start) / 86400000));
      return sum + diffDays;
    }, 0);

    const consideredBookings = bookings.filter((booking) => booking.status !== 'cancelled');
    const revenue = consideredBookings.reduce((sum, booking) => sum + Number(booking.price || 0), 0);
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter((booking) => booking.status === 'completed').length;
    const cancelledBookings = bookings.filter((booking) => booking.status === 'cancelled').length;
    const revenueToday = consideredBookings.reduce((sum, booking) => {
      if (!booking.pickupDate) return sum;
      const pickup = new Date(booking.pickupDate);
      if (pickup.toDateString() !== now.toDateString()) return sum;
      return sum + Number(booking.price || 0);
    }, 0);
    const revenueThisWeek = consideredBookings.reduce((sum, booking) => {
      if (!booking.pickupDate) return sum;
      const pickup = new Date(booking.pickupDate);
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      if (pickup < weekStart || pickup > weekEnd) return sum;
      return sum + Number(booking.price || 0);
    }, 0);
    const currentMonthRevenue = consideredBookings.reduce((sum, booking) => {
      if (!booking.pickupDate) return sum;
      const pickup = new Date(booking.pickupDate);
      if (pickup.getFullYear() !== now.getFullYear() || pickup.getMonth() !== now.getMonth()) return sum;
      return sum + Number(booking.price || 0);
    }, 0);
    const currentYearRevenue = consideredBookings.reduce((sum, booking) => {
      if (!booking.pickupDate) return sum;
      const pickup = new Date(booking.pickupDate);
      if (pickup.getFullYear() !== now.getFullYear()) return sum;
      return sum + Number(booking.price || 0);
    }, 0);
    const averageRevenuePerBooking = consideredBookings.length ? Number(revenue / consideredBookings.length).toFixed(2) : '0.00';
    const outstandingBalance = bookings.reduce((sum, booking) => {
      const amountDue = Number(booking.completion?.amountDue || booking.price || 0);
      const amountPaid = Number(booking.completion?.amountPaid || 0);
      const due = Math.max(0, amountDue - amountPaid);
      if (booking.paymentStatus === 'paid' || due <= 0) return sum;
      return sum + due;
    }, 0);
    const firstBookingDate = consideredBookings
      .map((booking) => (booking.pickupDate ? new Date(booking.pickupDate) : null))
      .filter(Boolean)
      .sort((a, b) => a - b)[0];
    const activeDaysWindow = firstBookingDate ? Math.max(1, Math.round((now - firstBookingDate) / 86400000) + 1) : 1;
    const averageDailyRevenue = Number(revenue / activeDaysWindow).toFixed(2);
    const revenuePerRentalDay = rentalDays > 0 ? Number(revenue / rentalDays).toFixed(2) : '0.00';
    const maintenanceCostTotal = maintenanceRecords.reduce((sum, record) => sum + Number(record.cost || 0), 0) + Number(car.totalMaintenanceCost || 0);
    const estimatedProfit = Math.max(0, revenue - maintenanceCostTotal);
    const profitMargin = revenue > 0 ? Number((estimatedProfit / revenue) * 100).toFixed(1) : 0;

    const overlapDays = (bookingStart, bookingEnd, periodStart, periodEnd) => {
      const start = bookingStart > periodStart ? bookingStart : periodStart;
      const end = bookingEnd < periodEnd ? bookingEnd : periodEnd;
      if (start > end) return 0;
      return Math.max(0, Math.round((end - start) / 86400000) + 1);
    };

    const buildPeriodSeries = (periods) => periods.map((period) => {
      const periodBookings = consideredBookings.filter((booking) => {
        if (!booking.pickupDate) return false;
        const bookingStart = new Date(booking.pickupDate);
        const bookingEnd = booking.returnDate ? new Date(booking.returnDate) : bookingStart;
        return bookingStart <= period.end && bookingEnd >= period.start;
      });
      const bookedDays = periodBookings.reduce((sum, booking) => {
        if (!booking.pickupDate) return sum;
        const bookingStart = new Date(booking.pickupDate);
        const bookingEnd = booking.returnDate ? new Date(booking.returnDate) : bookingStart;
        return sum + overlapDays(bookingStart, bookingEnd, period.start, period.end);
      }, 0);
      const periodDays = Math.max(1, Math.round((period.end - period.start) / 86400000) + 1);
      return {
        label: period.label,
        bookings: periodBookings.length,
        revenue: periodBookings.reduce((sum, booking) => sum + Number(booking.price || 0), 0),
        occupancyRate: Number((bookedDays / periodDays) * 100).toFixed(1),
        bookedDays,
        totalDays: periodDays,
      };
    });

    const weeklyPeriods = Array.from({ length: 8 }, (_, index) => {
      const start = new Date(now);
      start.setDate(now.getDate() - ((now.getDay() + 6) % 7) - (index * 7));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { label: `W${index + 1}`, start, end };
    }).reverse();
    const monthlyPeriods = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
      return { label: monthDate.toLocaleString('en', { month: 'short' }), start, end };
    }).reverse();
    const yearlyPeriods = Array.from({ length: 5 }, (_, index) => {
      const year = now.getFullYear() - index;
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
      return { label: String(year), start, end };
    }).reverse();

    const weeklySeries = buildPeriodSeries(weeklyPeriods);
    const monthlySeries = buildPeriodSeries(monthlyPeriods);
    const yearlySeries = buildPeriodSeries(yearlyPeriods);
    const weeklyGrowth = weeklySeries.length > 1 ? Number(((weeklySeries[weeklySeries.length - 1].revenue - weeklySeries[weeklySeries.length - 2].revenue) / Math.max(1, weeklySeries[weeklySeries.length - 2].revenue)) * 100).toFixed(1) : 0;
    const monthlyGrowth = monthlySeries.length > 1 ? Number(((monthlySeries[monthlySeries.length - 1].revenue - monthlySeries[monthlySeries.length - 2].revenue) / Math.max(1, monthlySeries[monthlySeries.length - 2].revenue)) * 100).toFixed(1) : 0;
    const yearlyGrowth = yearlySeries.length > 1 ? Number(((yearlySeries[yearlySeries.length - 1].revenue - yearlySeries[yearlySeries.length - 2].revenue) / Math.max(1, yearlySeries[yearlySeries.length - 2].revenue)) * 100).toFixed(1) : 0;
    const bestPerformingPeriod = monthlySeries.reduce((best, item) => (item.revenue > best.revenue ? item : best), monthlySeries[0] || { label: '-', revenue: 0, bookings: 0, occupancyRate: 0 });
    const upcomingReservations = bookings
      .filter((booking) => booking.status !== 'cancelled' && booking.status !== 'completed' && new Date(booking.pickupDate) >= now)
      .sort((a, b) => new Date(a.pickupDate) - new Date(b.pickupDate))
      .slice(0, 6);

    const recentPeriodBookings = bookings.filter((booking) => {
      if (!booking.pickupDate) return false;
      const pickup = new Date(booking.pickupDate);
      return pickup >= twelveMonthsAgo && pickup <= now;
    });
    const periodDays = Math.max(1, Math.round((now - twelveMonthsAgo) / 86400000));
    const bookedDays = recentPeriodBookings.reduce((sum, booking) => {
      if (!booking.pickupDate || !booking.returnDate) return sum;
      const start = new Date(booking.pickupDate);
      const end = new Date(booking.returnDate);
      const diffDays = Math.max(0, Math.round((end - start) / 86400000));
      return sum + diffDays;
    }, 0);
    const utilizationRate = Number((bookedDays / periodDays) * 100).toFixed(1);
    const averageRentalDuration = nonCancelledBookings.length
      ? Number(rentalDays / nonCancelledBookings.length).toFixed(1)
      : '0.0';

    const monthlyPerformance = Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const label = monthDate.toLocaleString('en', { month: 'short' });
      const monthBookings = bookings.filter((booking) => {
        if (!booking.pickupDate) return false;
        const pickup = new Date(booking.pickupDate);
        return pickup.getFullYear() === monthDate.getFullYear() && pickup.getMonth() === monthDate.getMonth();
      });
      const monthRevenue = monthBookings.reduce((sum, booking) => sum + Number(booking.price || 0), 0);
      return {
        label,
        bookings: monthBookings.length,
        revenue: monthRevenue,
      };
    }).reverse();

    const yearlyPerformance = Array.from({ length: 3 }, (_, index) => {
      const year = now.getFullYear() - index;
      const yearBookings = bookings.filter((booking) => {
        if (!booking.pickupDate) return false;
        const pickup = new Date(booking.pickupDate);
        return pickup.getFullYear() === year;
      });
      return {
        label: String(year),
        bookings: yearBookings.length,
        revenue: yearBookings.reduce((sum, booking) => sum + Number(booking.price || 0), 0),
      };
    }).reverse();

    const availabilityCalendar = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(now);
      day.setDate(now.getDate() + index);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      const isBooked = bookings.some((booking) => {
        if (!booking.pickupDate || !booking.returnDate) return false;
        const start = new Date(booking.pickupDate);
        const end = new Date(booking.returnDate);
        return start <= dayEnd && end >= dayStart && activeStatuses.includes(booking.status);
      });
      return {
        label: day.toLocaleDateString('en', { weekday: 'short' }),
        date: day.toISOString().slice(0, 10),
        isBooked,
      };
    });

    const safeMaintenanceRecords = maintenanceRecords.map((record) => ({
      ...record,
      scheduledDate: record.scheduledDate || null,
      completedDate: record.completedDate || null,
    }));

    const analyticsPayload = {
      revenueToday,
      revenueThisWeek,
      revenueThisMonth: currentMonthRevenue,
      revenueThisYear: currentYearRevenue,
      lifetimeRevenue: revenue,
      averageRevenuePerBooking,
      averageDailyRevenue,
      revenuePerRentalDay,
      bookingsByWeek: weeklySeries,
      bookingsByMonth: monthlySeries,
      bookingsByYear: yearlySeries,
      occupancyByWeek: weeklySeries.map((item) => ({ ...item, occupancyRate: item.occupancyRate })),
      occupancyByMonth: monthlySeries.map((item) => ({ ...item, occupancyRate: item.occupancyRate })),
      occupancyByYear: yearlySeries.map((item) => ({ ...item, occupancyRate: item.occupancyRate })),
      estimatedProfit,
      operatingCosts: maintenanceCostTotal,
      profitMargin,
      bestPerformingPeriod,
      growth: {
        weekly: weeklyGrowth,
        monthly: monthlyGrowth,
        yearly: yearlyGrowth,
      },
    };

    res.json({
      success: true,
      stats: {
        vehicle: {
          brand: car.brand,
          model: car.model,
          licensePlate: car.licensePlate || '',
          fleetId: car.fleetId || '',
          status: car.status,
          availability: car.isAvaliable,
        },
        overview: {
          totalBookings,
          totalRevenue: revenue,
          monthlyRevenue: currentMonthRevenue,
          yearlyRevenue: currentYearRevenue,
          averageRevenuePerBooking,
          outstandingBalance,
          utilizationRate: `${utilizationRate}%`,
          rentalDays,
          averageRentalDuration: `${averageRentalDuration} days`,
          completedBookings,
          cancelledBookings,
          activeBookings: bookings.filter((booking) => activeStatuses.includes(booking.status)).length,
        },
        analytics: analyticsPayload,
        upcomingReservations,
        maintenanceHistory: safeMaintenanceRecords,
        monthlyPerformance,
        yearlyPerformance,
        availabilityCalendar,
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load vehicle statistics' });
  }
};

export const updateCar = async (req, res) => {
  let imageFile = req.file;
  try {
    const { carId } = req.body;
    const car = await assertOwnerCar(carId, req.user._id);
    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }

    if (req.body.carData) {
      let updates;
      try {
        updates = JSON.parse(req.body.carData);
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid car data format' });
      }

      const allowed = [
        'brand', 'model', 'year', 'category', 'transmission', 'fuel_type',
        'seating_capacity', 'description', 'pricePerDay', 'features',
        'licensePlate', 'mileage', 'fleetId', 'vin', 'branch',
      ];
      for (const key of allowed) {
        if (updates[key] !== undefined) car[key] = updates[key];
      }

      if (updates.category !== undefined) car.category = normalizeCategory(updates.category);
      if (updates.vin !== undefined) car.vin = normalizeVin(updates.vin);
      if (updates.licensePlate !== undefined) car.licensePlate = normalizePlate(updates.licensePlate);
      if (updates.fleetId !== undefined) car.fleetId = String(updates.fleetId || '').trim().toUpperCase();
      if (updates.branch !== undefined) car.branch = String(updates.branch || '').trim();
      if (updates.mileage !== undefined) car.mileage = Number(updates.mileage) || 0;

      if (updates.locations !== undefined || updates.location !== undefined) {
        const locations = normalizeLocations(updates.locations, updates.location);
        if (!locations.length) {
          return res.status(400).json({
            success: false,
            message: 'Select at least one pickup location where this vehicle is available',
          });
        }
        applyLocationsToCar(car, locations);
      }

      if (!car.fleetId) {
        car.fleetId = await ensureUniqueFleetId(req.user._id);
      }

      await assertUniqueAssetFields(
        req.user._id,
        { vin: car.vin, licensePlate: car.licensePlate, fleetId: car.fleetId },
        car._id
      );
    }

    if (imageFile) {
      car.image = await uploadToImageKit(imageFile, '/cars');
      cleanupUploadedFile(imageFile);
      imageFile = null;
    }

    await car.save();
    res.json({ success: true, message: 'Vehicle updated', car });
  } catch (error) {
    console.error(error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Failed to update car',
    });
  } finally {
    cleanupUploadedFile(imageFile);
  }
};

export const toggleCarAvailability = async (req, res) => {
  try {
    const { _id } = req.user;
    const { carId } = req.body;

    const car = await assertOwnerCar(carId, _id);
    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }

    car.isAvaliable = !car.isAvaliable;
    await car.save();

    res.json({ success: true, message: 'Availability updated' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to toggle availability' });
  }
};

export const deleteCar = async (req, res) => {
  try {
    const { _id } = req.user;
    const { carId } = req.body;

    const car = await assertOwnerCar(carId, _id);
    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }

    const activeBooking = await Booking.findOne({
      car: carId,
      status: { $in: ['pending', 'confirmed', 'active'] },
    });

    if (activeBooking) {
      return res.status(409).json({ success: false, message: 'Cannot remove a car with active reservations' });
    }

    car.owner = null;
    car.isAvaliable = false;
    await car.save();

    res.json({ success: true, message: 'Car removed from fleet' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to remove car' });
  }
};

export const getDashboardData = async (req, res) => {
  try {
    const { _id } = req.user;

    const cars = await Car.find({ owner: _id });
    const bookings = await Booking.find({ owner: _id }).populate('car').sort({ createdAt: -1 });

    const pendingBookings = await Booking.countDocuments({ owner: _id, status: 'pending' });
    const confirmedBookings = await Booking.countDocuments({ owner: _id, status: 'confirmed' });
    const activeBookings = await Booking.countDocuments({ owner: _id, status: 'active' });
    const completedBookings = await Booking.countDocuments({ owner: _id, status: 'completed' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const todayBookings = await Booking.countDocuments({ owner: _id, createdAt: { $gte: today } });

    const upcomingPickups = await Booking.find({
      owner: _id,
      status: { $in: ['confirmed', 'active'] },
      pickupDate: { $gte: today, $lte: nextWeek },
    }).populate('car').sort({ pickupDate: 1 }).limit(5);

    const upcomingReturns = await Booking.find({
      owner: _id,
      status: { $in: ['active', 'confirmed'] },
      returnDate: { $gte: today, $lte: nextWeek },
    }).populate('car').sort({ returnDate: 1 }).limit(5);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyBookings = bookings.filter((b) =>
      ['confirmed', 'active', 'completed'].includes(b.status) &&
      new Date(b.createdAt) >= startOfMonth,
    );
    const monthlyRevenue = monthlyBookings.reduce((acc, booking) => acc + booking.price, 0);

    const totalCars = cars.length;
    const availableVehicles = cars.filter((car) => car.isAvaliable).length;
    const rentedVehicles = totalCars - availableVehicles;
    const occupancyRate = totalCars > 0 ? Math.round((rentedVehicles / totalCars) * 100) : 0;

    res.json({
      success: true,
      dashboardData: {
        totalCars,
        totalBookings: bookings.length,
        pendingBookings,
        confirmedBookings,
        activeBookings,
        completedBookings,
        todayBookings,
        availableVehicles,
        rentedVehicles,
        occupancyRate,
        upcomingPickups,
        upcomingReturns,
        recentBookings: bookings.slice(0, 5),
        monthlyRevenue,
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
};

export const getAdminOverview = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const cars = await Car.find({ owner: ownerId }).lean();
    const bookings = await Booking.find({ owner: ownerId }).populate('car').sort({ createdAt: -1 }).lean();

    const customers = await Booking.aggregate([
      { $match: { owner: ownerId, customerEmail: { $ne: '' } } },
      { $group: { _id: { $toLower: '$customerEmail' } } },
    ]);

    const revenue = bookings
      .filter((item) => ['confirmed', 'active', 'completed'].includes(item.status))
      .reduce((acc, item) => acc + item.price, 0);

    res.json({
      success: true,
      overview: {
        totalVehicles: cars.length,
        totalReservations: bookings.length,
        availableVehicles: cars.filter((car) => car.isAvaliable).length,
        rentedVehicles: cars.filter((car) => !car.isAvaliable).length,
        totalCustomers: customers.length,
        revenue,
        recentReservations: bookings.slice(0, 6),
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch overview' });
  }
};

export const getCustomers = async (req, res) => {
  try {
    const bookings = await Booking.find({ owner: req.user._id })
      .select('customerName customerEmail customerPhone createdAt status price')
      .sort({ createdAt: -1 })
      .lean();

    const byEmail = new Map();
    for (const booking of bookings) {
      const email = (booking.customerEmail || '').toLowerCase().trim();
      if (!email) continue;
      const existing = byEmail.get(email);
      if (!existing) {
        byEmail.set(email, {
          _id: email,
          name: booking.customerName || 'Guest',
          email: booking.customerEmail,
          phone: booking.customerPhone || '',
          bookingsCount: 1,
          lastBookingAt: booking.createdAt,
          totalSpent: ['confirmed', 'active', 'completed'].includes(booking.status) ? booking.price : 0,
        });
      } else {
        existing.bookingsCount += 1;
        if (['confirmed', 'active', 'completed'].includes(booking.status)) {
          existing.totalSpent += booking.price || 0;
        }
        if (new Date(booking.createdAt) > new Date(existing.lastBookingAt)) {
          existing.lastBookingAt = booking.createdAt;
          existing.name = booking.customerName || existing.name;
          existing.phone = booking.customerPhone || existing.phone;
        }
      }
    }

    const customers = Array.from(byEmail.values()).sort(
      (a, b) => new Date(b.lastBookingAt) - new Date(a.lastBookingAt),
    );

    res.json({ success: true, customers });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch customers' });
  }
};

export const updateUserImage = async (req, res) => {
  let imageFile = req.file;
  try {
    const { _id } = req.user;

    if (!imageFile) {
      return res.status(400).json({ success: false, message: 'Image is required' });
    }

    const image = await uploadToImageKit(imageFile, '/users', '400');
    cleanupUploadedFile(imageFile);
    imageFile = null;

    await User.findByIdAndUpdate(_id, { image });
    res.json({ success: true, message: 'Profile image updated' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update profile image' });
  } finally {
    cleanupUploadedFile(imageFile);
  }
};
