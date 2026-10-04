import Booking from '../models/Booking.js';
import Car from '../models/Car.js';
import GuestCustomer from '../models/GuestCustomer.js';
import AuditLog from '../models/AuditLog.js';
import AdminNotification from '../models/AdminNotification.js';
import { escapeRegex } from '../utils/helpers.js';
import { logAudit } from '../utils/adminOps.js';
import { refreshGuestStats, upsertGuestFromBooking } from '../services/guestCrm.js';
import mongoose from 'mongoose';
import { isOnlineChannel } from '../utils/bookingChannel.js';

const asObjectId = (id) => {
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
};

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const endOfMonth = (d = new Date()) => {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
};

const monthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const hasOperationalStatus = (status) => ['pending', 'confirmed', 'ready_for_pickup', 'active'].includes(status);
const hasRevenueStatus = (status) => ['confirmed', 'ready_for_pickup', 'active', 'completed'].includes(status);
const hasReturnStatus = (status) => ['confirmed', 'ready_for_pickup', 'active'].includes(status);

const weekKey = (date) => {
  const d = new Date(date);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
};

/** KPI + operational dashboard */
export const getOpsDashboard = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const today = startOfDay();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const next7 = new Date(today);
    next7.setDate(next7.getDate() + 7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const cars = await Car.find({ owner: ownerId });
    const bookings = await Booking.find({ owner: ownerId }).populate('car', 'brand model').sort({ createdAt: -1 });

    const revenueStatuses = ['confirmed', 'ready_for_pickup', 'active', 'completed'];
    const monthlyRevenue = bookings
      .filter((b) => revenueStatuses.includes(b.status) && new Date(b.createdAt) >= monthStart)
      .reduce((s, b) => s + (b.price || 0), 0);

    const todayBookings = bookings.filter((b) => new Date(b.createdAt) >= today).length;
    const onlineBookingsToday = bookings.filter(
      (b) => new Date(b.createdAt) >= today && isOnlineChannel(b.channel),
    ).length;
    const walkInBookingsToday = bookings.filter(
      (b) => new Date(b.createdAt) >= today && !isOnlineChannel(b.channel),
    ).length;
    const activeRentals = bookings.filter((b) => b.status === 'active').length;
    const pendingBookings = bookings.filter((b) => b.status === 'pending').length;

    const onlineRevenueMonth = bookings
      .filter((b) => revenueStatuses.includes(b.status) && new Date(b.createdAt) >= monthStart && isOnlineChannel(b.channel))
      .reduce((s, b) => s + (b.price || 0), 0);
    const walkInRevenueMonth = bookings
      .filter((b) => revenueStatuses.includes(b.status) && new Date(b.createdAt) >= monthStart && !isOnlineChannel(b.channel))
      .reduce((s, b) => s + (b.price || 0), 0);

    const upcomingPickups = bookings
      .filter((b) => hasOperationalStatus(b.status)
        && new Date(b.pickupDate) >= today
        && new Date(b.pickupDate) <= next7)
      .sort((a, b) => new Date(a.pickupDate) - new Date(b.pickupDate))
      .slice(0, 8);

    const upcomingReturns = bookings
      .filter((b) => hasReturnStatus(b.status)
        && new Date(b.returnDate) >= today
        && new Date(b.returnDate) <= next7)
      .sort((a, b) => new Date(a.returnDate) - new Date(b.returnDate))
      .slice(0, 8);

    const overdueRentals = bookings.filter((b) =>
      hasReturnStatus(b.status) && new Date(b.returnDate) < today,
    );

    const availableVehicles = cars.filter((c) => c.isAvaliable && c.status !== 'maintenance').length;
    const maintenanceVehicles = cars.filter((c) => c.status === 'maintenance' || !c.isAvaliable).length;
    const rentedVehicles = activeRentals;
    const occupancyRate = cars.length > 0
      ? Math.round((activeRentals / cars.length) * 100)
      : 0;

    // Fleet utilization: days booked this month / (cars * days elapsed)
    // Includes WhatsApp + online + walk-in reservations with revenue statuses.
    const daysElapsed = Math.max(1, today.getDate());
    const bookedDays = bookings
      .filter((b) => revenueStatuses.includes(b.status) && new Date(b.returnDate) >= monthStart)
      .reduce((sum, b) => {
        const start = new Date(Math.max(new Date(b.pickupDate), monthStart));
        const end = new Date(Math.min(new Date(b.returnDate), endOfDay()));
        if (end < start) return sum;
        return sum + Math.max(1, Math.ceil((end - start) / 86400000));
      }, 0);
    const onlineBookedDays = bookings
      .filter((b) => revenueStatuses.includes(b.status) && new Date(b.returnDate) >= monthStart && isOnlineChannel(b.channel))
      .reduce((sum, b) => {
        const start = new Date(Math.max(new Date(b.pickupDate), monthStart));
        const end = new Date(Math.min(new Date(b.returnDate), endOfDay()));
        if (end < start) return sum;
        return sum + Math.max(1, Math.ceil((end - start) / 86400000));
      }, 0);
    const fleetUtilization = cars.length > 0
      ? Math.min(100, Math.round((bookedDays / (cars.length * daysElapsed)) * 100))
      : 0;

    res.json({
      success: true,
      dashboard: {
        todayBookings,
        onlineBookingsToday,
        walkInBookingsToday,
        activeRentals,
        pendingBookings,
        upcomingPickups,
        upcomingReturns,
        overdueRentals,
        overdueCount: overdueRentals.length,
        monthlyRevenue,
        onlineRevenueMonth,
        walkInRevenueMonth,
        occupancyRate,
        fleetUtilization,
        onlineOccupancyShare: bookedDays > 0 ? Math.round((onlineBookedDays / bookedDays) * 100) : 0,
        totalCars: cars.length,
        availableVehicles,
        maintenanceVehicles,
        rentedVehicles,
        totalBookings: bookings.length,
        onlineBookings: bookings.filter((b) => isOnlineChannel(b.channel)).length,
        walkInBookings: bookings.filter((b) => !isOnlineChannel(b.channel)).length,
        recentBookings: bookings.slice(0, 6),
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
};

/** Revenue analytics with trends */
export const getRevenueAnalytics = async (req, res) => {
  try {
    const ownerId = req.user._id;
    // Include ready_for_pickup so completed online/WhatsApp flows count in revenue.
    const revenueStatuses = ['confirmed', 'ready_for_pickup', 'active', 'completed'];
    const bookings = await Booking.find({
      owner: ownerId,
      status: { $in: revenueStatuses },
    }).select('price createdAt pickupDate status channel').lean();

    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const yearlyRevenue = bookings
      .filter((b) => new Date(b.createdAt) >= yearStart)
      .reduce((s, b) => s + (b.price || 0), 0);
    const monthlyRevenue = bookings
      .filter((b) => new Date(b.createdAt) >= monthStart)
      .reduce((s, b) => s + (b.price || 0), 0);
    const weeklyRevenue = bookings
      .filter((b) => new Date(b.createdAt) >= weekStart)
      .reduce((s, b) => s + (b.price || 0), 0);

    // Last 12 months
    const monthlyTrend = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      const amount = bookings
        .filter((b) => monthKey(b.createdAt) === key)
        .reduce((s, b) => s + (b.price || 0), 0);
      monthlyTrend.push({ key, label, amount });
    }

    // Last 8 weeks
    const weeklyTrend = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - (i * 7));
      const key = weekKey(d);
      const amount = bookings
        .filter((b) => weekKey(b.createdAt) === key)
        .reduce((s, b) => s + (b.price || 0), 0);
      weeklyTrend.push({ key, label: key, amount });
    }

    // Last 5 years
    const yearlyTrend = [];
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      const amount = bookings
        .filter((b) => new Date(b.createdAt).getFullYear() === y)
        .reduce((s, b) => s + (b.price || 0), 0);
      yearlyTrend.push({ key: String(y), label: String(y), amount });
    }

    const byStatus = await Booking.aggregate([
      { $match: { owner: asObjectId(ownerId) } },
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$price' } } },
    ]);

    // WhatsApp counts as online in channel analytics.
    const byChannel = await Booking.aggregate([
      { $match: { owner: asObjectId(ownerId), status: { $in: revenueStatuses } } },
      {
        $project: {
          price: 1,
          normalizedChannel: {
            $cond: [{ $eq: ['$channel', 'walk_in'] }, 'walk_in', 'online'],
          },
        },
      },
      {
        $group: {
          _id: '$normalizedChannel',
          count: { $sum: 1 },
          revenue: { $sum: '$price' },
        },
      },
    ]);

    const onlineBookings = bookings.filter((b) => isOnlineChannel(b.channel));
    const walkInBookings = bookings.filter((b) => !isOnlineChannel(b.channel));

    res.json({
      success: true,
      analytics: {
        weeklyRevenue,
        monthlyRevenue,
        yearlyRevenue,
        totalRevenue: bookings.reduce((s, b) => s + (b.price || 0), 0),
        bookingCount: bookings.length,
        onlineBookingCount: onlineBookings.length,
        walkInBookingCount: walkInBookings.length,
        monthlyTrend,
        weeklyTrend,
        yearlyTrend,
        byStatus,
        byChannel,
        onlineRevenue: onlineBookings.reduce((s, b) => s + (b.price || 0), 0),
        walkInRevenue: walkInBookings.reduce((s, b) => s + (b.price || 0), 0),
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load analytics' });
  }
};

/** Customer CRM list with filters */
export const getCrmCustomers = async (req, res) => {
  try {
    const ownerId = req.user._id;

    // Ensure CRM profiles exist for booking emails
    const bookingEmails = await Booking.aggregate([
      { $match: { owner: asObjectId(ownerId), customerEmail: { $ne: '' } } },
      {
        $group: {
          _id: { $toLower: '$customerEmail' },
          name: { $last: '$customerName' },
          phone: { $last: '$customerPhone' },
          pickupLocation: { $last: '$pickupLocation' },
          lastBooking: { $last: '$$ROOT' },
        },
      },
    ]);

    for (const row of bookingEmails) {
      const existing = await GuestCustomer.findOne({ owner: ownerId, email: row._id });
      if (!existing) {
        await upsertGuestFromBooking({
          owner: ownerId,
          customerEmail: row._id,
          customerName: row.name,
          customerPhone: row.phone,
          pickupLocation: row.pickupLocation,
          createdAt: row.lastBooking?.createdAt,
          status: row.lastBooking?.status,
          price: row.lastBooking?.price || 0,
        });
      }
    }

    const {
      search, status, city, minRating, maxRating,
      minBookings, maxBookings, minSpent, maxSpent, sortBy = 'lastBookingAt',
    } = req.query;

    const query = { owner: ownerId };
    if (status) query.status = status;
    if (city) query.city = { $regex: escapeRegex(city), $options: 'i' };
    if (minRating || maxRating) {
      query.rating = {};
      if (minRating) query.rating.$gte = Number(minRating);
      if (maxRating) query.rating.$lte = Number(maxRating);
    }
    if (minBookings || maxBookings) {
      query.totalReservations = {};
      if (minBookings) query.totalReservations.$gte = Number(minBookings);
      if (maxBookings) query.totalReservations.$lte = Number(maxBookings);
    }
    if (minSpent || maxSpent) {
      query.totalSpent = {};
      if (minSpent) query.totalSpent.$gte = Number(minSpent);
      if (maxSpent) query.totalSpent.$lte = Number(maxSpent);
    }
    if (search) {
      const term = escapeRegex(search);
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { city: { $regex: term, $options: 'i' } },
      ];
    }

    const sortMap = {
      lastBookingAt: { lastBookingAt: -1 },
      totalSpent: { totalSpent: -1 },
      totalReservations: { totalReservations: -1 },
      rating: { rating: -1 },
      name: { name: 1 },
    };

    const customers = await GuestCustomer.find(query)
      .sort(sortMap[sortBy] || sortMap.lastBookingAt)
      .lean();

    res.json({ success: true, customers });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load customers' });
  }
};

export const getCrmCustomerDetail = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { email } = req.params;
    const normalized = decodeURIComponent(email).toLowerCase();

    await refreshGuestStats(ownerId, normalized);
    const customer = await GuestCustomer.findOne({ owner: ownerId, email: normalized }).lean();
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const bookings = await Booking.find({ owner: ownerId, customerEmail: normalized })
      .populate('car', 'brand model image')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, customer, bookings });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load customer' });
  }
};

/** Rate customer + private note (admin only) */
export const rateCustomer = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { email, rating, note, bookingId } = req.body;

    if (!email || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Email and rating (1-5) are required' });
    }

    const normalized = email.trim().toLowerCase();
    let guest = await GuestCustomer.findOne({ owner: ownerId, email: normalized });
    if (!guest) {
      const last = await Booking.findOne({ owner: ownerId, customerEmail: normalized }).sort({ createdAt: -1 });
      if (!last) return res.status(404).json({ success: false, message: 'Customer not found' });
      guest = await upsertGuestFromBooking(last);
    }

    guest.internalNotes.push({
      text: note || `Rated ${rating}/5`,
      rating: Number(rating),
      booking: bookingId || null,
      createdBy: ownerId,
      createdAt: new Date(),
    });

    const ratedNotes = guest.internalNotes.filter((n) => n.rating);
    guest.ratingCount = ratedNotes.length;
    guest.rating = ratedNotes.reduce((s, n) => s + n.rating, 0) / ratedNotes.length;

    await guest.save();
    await logAudit({
      owner: ownerId,
      actor: ownerId,
      action: 'customer.rate',
      entityType: 'GuestCustomer',
      entityId: guest._id,
      details: `Rated ${guest.email} ${rating}/5`,
    });

    res.json({ success: true, message: 'Customer rated', customer: guest });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to rate customer' });
  }
};

export const addCustomerNote = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { email, note } = req.body;
    if (!email || !note?.trim()) {
      return res.status(400).json({ success: false, message: 'Email and note are required' });
    }

    const normalized = email.trim().toLowerCase();
    let guest = await GuestCustomer.findOne({ owner: ownerId, email: normalized });
    if (!guest) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    guest.internalNotes.push({
      text: note.trim(),
      rating: null,
      createdBy: ownerId,
      createdAt: new Date(),
    });
    await guest.save();

    await logAudit({
      owner: ownerId,
      actor: ownerId,
      action: 'customer.note',
      entityType: 'GuestCustomer',
      entityId: guest._id,
      details: `Added note for ${guest.email}`,
    });

    res.json({ success: true, message: 'Note added', customer: guest });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to add note' });
  }
};

export const updateCustomerStatus = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { email, status, blacklistReason = '' } = req.body;
    const allowed = ['new', 'regular', 'vip', 'blacklisted'];
    if (!email || !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid email and status required' });
    }

    const guest = await GuestCustomer.findOne({ owner: ownerId, email: email.trim().toLowerCase() });
    if (!guest) return res.status(404).json({ success: false, message: 'Customer not found' });

    guest.status = status;
    guest.blacklistReason = status === 'blacklisted' ? blacklistReason : '';
    await guest.save();

    await logAudit({
      owner: ownerId,
      actor: ownerId,
      action: 'customer.status',
      entityType: 'GuestCustomer',
      entityId: guest._id,
      details: `Set ${guest.email} to ${status}`,
    });

    res.json({ success: true, message: `Customer marked as ${status}`, customer: guest });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

/** Fleet maintenance & document expiry alerts */
export const getFleetMaintenance = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const cars = await Car.find({ owner: ownerId }).sort({ brand: 1 }).lean();
    const now = new Date();
    const in30 = new Date(now);
    in30.setDate(in30.getDate() + 30);

    const alerts = [];
    for (const car of cars) {
      const label = `${car.brand} ${car.model}${car.licensePlate ? ` (${car.licensePlate})` : ''}`;

      if (car.nextServiceDate && new Date(car.nextServiceDate) <= in30) {
        alerts.push({
          type: 'service_date',
          severity: new Date(car.nextServiceDate) < now ? 'critical' : 'warning',
          carId: car._id,
          vehicle: label,
          message: `Service due ${new Date(car.nextServiceDate).toLocaleDateString()}`,
          date: car.nextServiceDate,
        });
      }
      if (car.nextServiceMileage && car.mileage && car.mileage >= car.nextServiceMileage) {
        alerts.push({
          type: 'service_mileage',
          severity: 'critical',
          carId: car._id,
          vehicle: label,
          message: `Service overdue by mileage (${car.mileage} / ${car.nextServiceMileage} km)`,
          date: null,
        });
      }
      if (car.insuranceExpiry && new Date(car.insuranceExpiry) <= in30) {
        alerts.push({
          type: 'insurance',
          severity: new Date(car.insuranceExpiry) < now ? 'critical' : 'warning',
          carId: car._id,
          vehicle: label,
          message: `Insurance expires ${new Date(car.insuranceExpiry).toLocaleDateString()}`,
          date: car.insuranceExpiry,
        });
      }
      if (car.registrationExpiry && new Date(car.registrationExpiry) <= in30) {
        alerts.push({
          type: 'registration',
          severity: new Date(car.registrationExpiry) < now ? 'critical' : 'warning',
          carId: car._id,
          vehicle: label,
          message: `Registration expires ${new Date(car.registrationExpiry).toLocaleDateString()}`,
          date: car.registrationExpiry,
        });
      }
    }

    alerts.sort((a, b) => (a.severity === 'critical' ? -1 : 1));

    res.json({ success: true, cars, alerts });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load maintenance data' });
  }
};

export const updateCarMaintenance = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const {
      carId, mileage, nextServiceMileage, nextServiceDate, lastServiceDate,
      insuranceExpiry, registrationExpiry, maintenanceNotes, status, licensePlate,
    } = req.body;

    const car = await Car.findById(carId);
    if (!car || car.owner?.toString() !== ownerId.toString()) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }

    if (mileage !== undefined) car.mileage = Number(mileage) || 0;
    if (nextServiceMileage !== undefined) car.nextServiceMileage = Number(nextServiceMileage) || 0;
    if (nextServiceDate !== undefined) car.nextServiceDate = nextServiceDate || null;
    if (lastServiceDate !== undefined) car.lastServiceDate = lastServiceDate || null;
    if (insuranceExpiry !== undefined) car.insuranceExpiry = insuranceExpiry || null;
    if (registrationExpiry !== undefined) car.registrationExpiry = registrationExpiry || null;
    if (maintenanceNotes !== undefined) car.maintenanceNotes = maintenanceNotes;
    if (licensePlate !== undefined) car.licensePlate = licensePlate;
    if (status && ['available', 'booked', 'maintenance'].includes(status)) {
      car.status = status;
      if (status === 'maintenance') car.isAvaliable = false;
    }

    await car.save();
    await logAudit({
      owner: ownerId,
      actor: ownerId,
      action: 'car.maintenance',
      entityType: 'Car',
      entityId: car._id,
      details: `Updated maintenance for ${car.brand} ${car.model}`,
    });

    res.json({ success: true, message: 'Maintenance updated', car });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update maintenance' });
  }
};

/** Notifications */
export const getNotifications = async (req, res) => {
  try {
    const ownerId = req.user._id;
    await generateOperationalAlerts(ownerId);

    const notifications = await AdminNotification.find({ owner: ownerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await AdminNotification.countDocuments({ owner: ownerId, isRead: false });

    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { notificationId, all } = req.body;
    if (all) {
      await AdminNotification.updateMany({ owner: req.user._id, isRead: false }, { isRead: true });
    } else if (notificationId) {
      await AdminNotification.findOneAndUpdate(
        { _id: notificationId, owner: req.user._id },
        { isRead: true },
      );
    }
    res.json({ success: true, message: 'Updated' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
};

async function generateOperationalAlerts(ownerId) {
  const today = startOfDay();
  const in2 = new Date(today);
  in2.setDate(in2.getDate() + 2);

  const overdue = await Booking.find({
    owner: ownerId,
    status: { $in: ['confirmed', 'active'] },
    returnDate: { $lt: today },
  }).limit(10);

  for (const b of overdue) {
    const exists = await AdminNotification.findOne({
      owner: ownerId,
      type: 'overdue',
      'meta.bookingId': b._id.toString(),
      createdAt: { $gte: today },
    });
    if (!exists) {
      await AdminNotification.create({
        owner: ownerId,
        type: 'overdue',
        title: 'Overdue rental',
        message: `${b.customerName || 'Guest'} — ${b.reservationId || b._id} return was due ${new Date(b.returnDate).toLocaleDateString()}`,
        link: '/owner/manage-bookings',
        meta: { bookingId: b._id.toString() },
      });
    }
  }

  const pickups = await Booking.find({
    owner: ownerId,
    status: { $in: ['pending', 'confirmed'] },
    pickupDate: { $gte: today, $lte: in2 },
  }).limit(10);

  for (const b of pickups) {
    const exists = await AdminNotification.findOne({
      owner: ownerId,
      type: 'upcoming_pickup',
      'meta.bookingId': b._id.toString(),
      createdAt: { $gte: today },
    });
    if (!exists) {
      await AdminNotification.create({
        owner: ownerId,
        type: 'upcoming_pickup',
        title: 'Upcoming pickup',
        message: `${b.customerName || 'Guest'} picks up ${new Date(b.pickupDate).toLocaleString()}`,
        link: '/owner/manage-bookings',
        meta: { bookingId: b._id.toString() },
      });
    }
  }
}

/** Audit log */
export const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 30);
    const skip = (page - 1) * limit;

    const query = { owner: req.user._id };
    if (req.query.action) query.action = { $regex: escapeRegex(req.query.action), $options: 'i' };

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load audit logs' });
  }
};

/** Global quick search */
export const globalSearch = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ success: true, results: { bookings: [], cars: [], customers: [] } });
    }

    const ownerId = req.user._id;
    const term = escapeRegex(q);

    const [bookings, cars, customers] = await Promise.all([
      Booking.find({
        owner: ownerId,
        $or: [
          { reservationId: { $regex: term, $options: 'i' } },
          { customerName: { $regex: term, $options: 'i' } },
          { customerEmail: { $regex: term, $options: 'i' } },
          { customerPhone: { $regex: term, $options: 'i' } },
        ],
      }).populate('car', 'brand model').limit(8).lean(),
      Car.find({
        owner: ownerId,
        $or: [
          { brand: { $regex: term, $options: 'i' } },
          { model: { $regex: term, $options: 'i' } },
          { licensePlate: { $regex: term, $options: 'i' } },
          { location: { $regex: term, $options: 'i' } },
          { locations: { $regex: term, $options: 'i' } },
        ],
      }).limit(8).lean(),
      GuestCustomer.find({
        owner: ownerId,
        $or: [
          { name: { $regex: term, $options: 'i' } },
          { email: { $regex: term, $options: 'i' } },
          { phone: { $regex: term, $options: 'i' } },
        ],
      }).limit(8).lean(),
    ]);

    res.json({ success: true, results: { bookings, cars, customers } });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
};

/** Reports export summary CSV */
export const exportReport = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const type = req.query.type || 'revenue';
    const bookings = await Booking.find({ owner: ownerId }).populate('car').sort({ createdAt: -1 }).lean();
    const customers = await GuestCustomer.find({ owner: ownerId }).lean();
    const cars = await Car.find({ owner: ownerId }).lean();

    let headers = [];
    let rows = [];

    if (type === 'customers') {
      headers = ['Name', 'Email', 'Phone', 'City', 'Status', 'Rating', 'Reservations', 'Cancellations', 'Total Spent', 'Last Booking'];
      rows = customers.map((c) => [
        c.name, c.email, c.phone, c.city, c.status, c.rating?.toFixed?.(1) || 0,
        c.totalReservations, c.cancelledReservations, c.totalSpent,
        c.lastBookingAt ? new Date(c.lastBookingAt).toISOString().split('T')[0] : '',
      ]);
    } else if (type === 'fleet') {
      headers = ['Brand', 'Model', 'Plate', 'Mileage', 'Next Service', 'Insurance Expiry', 'Registration Expiry', 'Status', 'Available'];
      rows = cars.map((c) => [
        c.brand, c.model, c.licensePlate, c.mileage,
        c.nextServiceDate ? new Date(c.nextServiceDate).toISOString().split('T')[0] : '',
        c.insuranceExpiry ? new Date(c.insuranceExpiry).toISOString().split('T')[0] : '',
        c.registrationExpiry ? new Date(c.registrationExpiry).toISOString().split('T')[0] : '',
        c.status, c.isAvaliable,
      ]);
    } else {
      headers = ['Reservation ID', 'Customer', 'Email', 'Vehicle', 'Pickup', 'Return', 'Amount', 'Status', 'Payment', 'Created'];
      rows = bookings.map((b) => [
        b.reservationId || '',
        b.customerName || '',
        b.customerEmail || '',
        b.car ? `${b.car.brand} ${b.car.model}` : '',
        b.pickupDate ? new Date(b.pickupDate).toLocaleString() : '',
        b.returnDate ? new Date(b.returnDate).toLocaleString() : '',
        b.price || 0,
        b.status,
        b.paymentStatus,
        b.createdAt ? new Date(b.createdAt).toISOString().split('T')[0] : '',
      ]);
    }

    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');

    await logAudit({
      owner: ownerId,
      actor: ownerId,
      action: 'report.export',
      entityType: 'Report',
      details: `Exported ${type} report (${rows.length} rows)`,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
};
