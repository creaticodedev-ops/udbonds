/**
 * Expire pending reservations past pendingExpiresAt (per-owner booking settings).
 */
import Booking from '../models/Booking.js';
import { createNotification, logAudit } from '../utils/adminOps.js';

let timer = null;
let running = false;

const EXPIRY_NOTE = '[Auto] Pending reservation expired';

export const expirePendingBookingsOnce = async () => {
  if (running) return { scanned: 0, expired: 0 };
  running = true;
  try {
    const now = new Date();
    const due = await Booking.find({
      status: 'pending',
      pendingExpiresAt: { $ne: null, $lte: now },
    })
      .select('_id owner reservationId customerName notes')
      .limit(200);

    if (!due.length) return { scanned: 0, expired: 0 };

    let expired = 0;
    for (const booking of due) {
      booking.status = 'cancelled';
      if (!String(booking.notes || '').includes(EXPIRY_NOTE)) {
        booking.notes = booking.notes ? `${booking.notes}\n${EXPIRY_NOTE}` : EXPIRY_NOTE;
      }
      await booking.save();
      expired += 1;

      try {
          await createNotification({
            owner: booking.owner,
            type: 'system',
            title: 'Pending reservation expired',
            message: `${booking.customerName || 'Guest'} — ${booking.reservationId} auto-cancelled`,
            link: '/owner/manage-bookings',
            meta: { bookingId: String(booking._id), reservationId: booking.reservationId },
          });
        await logAudit({
          owner: booking.owner,
          action: 'booking.auto_expire',
          entityType: 'Booking',
          entityId: booking._id,
          details: `Auto-expired pending reservation ${booking.reservationId}`,
        });
      } catch {
        /* non-fatal */
      }
    }

    return { scanned: due.length, expired };
  } finally {
    running = false;
  }
};

export const startPendingBookingExpiryJob = (intervalMs = 5 * 60 * 1000) => {
  if (timer) return;
  const tick = async () => {
    try {
      const r = await expirePendingBookingsOnce();
      if (r.expired > 0) {
        console.log(`[pendingExpiry] expired ${r.expired} pending booking(s)`);
      }
    } catch (error) {
      console.error('[pendingExpiry]', error.message);
    }
  };
  setTimeout(tick, 15_000);
  timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
};

export const stopPendingBookingExpiryJob = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

export default {
  expirePendingBookingsOnce,
  startPendingBookingExpiryJob,
  stopPendingBookingExpiryJob,
};
