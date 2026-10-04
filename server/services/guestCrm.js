import mongoose from 'mongoose';
import GuestCustomer from '../models/GuestCustomer.js';
import Booking from '../models/Booking.js';

const asObjectId = (id) => {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return id;
  }
};

/**
 * Sync guest CRM profile from booking data (admin-only CRM).
 */
export const upsertGuestFromBooking = async (booking) => {
  if (!booking?.customerEmail || !booking?.owner) return null;

  const email = booking.customerEmail.trim().toLowerCase();
  const ownerId = asObjectId(booking.owner);
  const city = (booking.pickupLocation || '').split(',')[0]?.trim()
    || (booking.pickupLocation || '').split('-')[0]?.trim()
    || '';

  let guest = await GuestCustomer.findOne({ owner: ownerId, email });

  const stats = await Booking.aggregate([
    { $match: { owner: ownerId, customerEmail: email } },
    {
      $group: {
        _id: null,
        totalReservations: { $sum: 1 },
        cancelledReservations: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
        completedReservations: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        totalSpent: {
          $sum: {
            $cond: [
              { $in: ['$status', ['confirmed', 'active', 'completed']] },
              '$price',
              0,
            ],
          },
        },
        lastBookingAt: { $max: '$createdAt' },
      },
    },
  ]);

  const s = stats[0] || {
    totalReservations: 1,
    cancelledReservations: 0,
    completedReservations: 0,
    totalSpent: ['confirmed', 'active', 'completed'].includes(booking.status) ? (booking.price || 0) : 0,
    lastBookingAt: booking.createdAt || new Date(),
  };

  let status = guest?.status || 'new';
  if (status !== 'vip' && status !== 'blacklisted') {
    if (s.totalReservations <= 1) status = 'new';
    else if (s.totalSpent >= 5000 || s.completedReservations >= 5) status = 'vip';
    else status = 'regular';
  }

  const payload = {
    name: booking.customerName || guest?.name || 'Guest',
    phone: booking.customerPhone || guest?.phone || '',
    city: city || guest?.city || '',
    totalReservations: s.totalReservations,
    cancelledReservations: s.cancelledReservations,
    completedReservations: s.completedReservations,
    totalSpent: s.totalSpent,
    lastBookingAt: s.lastBookingAt,
  };

  if (guest) {
    Object.assign(guest, payload);
    if (guest.status !== 'vip' && guest.status !== 'blacklisted') {
      guest.status = status;
    }
    await guest.save();
    return guest;
  }

  const { resolveAgencyIdFromOwner } = await import('../utils/resolveAgencyId.js');
  const agencyId = await resolveAgencyIdFromOwner(ownerId);
  guest = await GuestCustomer.create({
    agencyId,
    owner: ownerId,
    email,
    ...payload,
    status,
  });
  return guest;
};

export const refreshGuestStats = async (ownerId, email) => {
  const normalized = email.trim().toLowerCase();
  const oid = asObjectId(ownerId);
  const bookings = await Booking.find({
    owner: oid,
    customerEmail: normalized,
  }).sort({ createdAt: -1 });

  const guest = await GuestCustomer.findOne({ owner: oid, email: normalized });
  if (!guest) return null;

  guest.totalReservations = bookings.length;
  guest.cancelledReservations = bookings.filter((b) => b.status === 'cancelled').length;
  guest.completedReservations = bookings.filter((b) => b.status === 'completed').length;
  guest.totalSpent = bookings
    .filter((b) => ['confirmed', 'active', 'completed'].includes(b.status))
    .reduce((sum, b) => sum + (b.price || 0), 0);
  guest.lastBookingAt = bookings[0]?.createdAt || null;

  if (guest.status !== 'vip' && guest.status !== 'blacklisted') {
    if (guest.totalReservations <= 1) guest.status = 'new';
    else if (guest.totalSpent >= 5000 || guest.completedReservations >= 5) guest.status = 'vip';
    else guest.status = 'regular';
  }

  if (bookings[0]) {
    guest.name = bookings[0].customerName || guest.name;
    guest.phone = bookings[0].customerPhone || guest.phone;
  }

  await guest.save();
  return guest;
};
