/**
 * Reservation channel helpers.
 * WhatsApp guest reservations are online bookings for stats, revenue, and occupancy.
 */

export const ONLINE_CHANNELS = ['online', 'whatsapp'];
export const WALK_IN_CHANNEL = 'walk_in';

/** Normalize owner/populated refs and free-form channel strings. */
export const normalizeChannel = (channel) => {
  const value = String(channel || 'online').trim().toLowerCase();
  if (value === 'walk_in' || value === 'walk-in' || value === 'walkin') return 'walk_in';
  if (value === 'whatsapp' || value === 'wa') return 'whatsapp';
  return 'online';
};

/** True for public-site and WhatsApp CTA reservations (not walk-in desk). */
export const isOnlineChannel = (channel) => normalizeChannel(channel) !== 'walk_in';

/** Bucket used by analytics dashboards: online | walk_in */
export const channelBucket = (channel) => (isOnlineChannel(channel) ? 'online' : 'walk_in');

/** Mongo match for online (includes WhatsApp) or walk-in filters. */
export const channelQuery = (channelFilter) => {
  if (!channelFilter) return null;
  const normalized = normalizeChannel(channelFilter);
  if (normalized === 'walk_in') return 'walk_in';
  return { $in: ONLINE_CHANNELS };
};

export default {
  ONLINE_CHANNELS,
  WALK_IN_CHANNEL,
  normalizeChannel,
  isOnlineChannel,
  channelBucket,
  channelQuery,
};
