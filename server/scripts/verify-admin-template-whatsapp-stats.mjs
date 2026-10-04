import { isOnlineChannel, channelQuery, channelBucket } from '../utils/bookingChannel.js';

const assert = (cond, msg) => {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
};

assert(isOnlineChannel('whatsapp') === true, 'whatsapp is online');
assert(isOnlineChannel('online') === true, 'online is online');
assert(isOnlineChannel('walk_in') === false, 'walk_in is not online');
assert(channelBucket('whatsapp') === 'online', 'whatsapp buckets to online');

const onlineFilter = channelQuery('online');
assert(Array.isArray(onlineFilter.$in) && onlineFilter.$in.includes('whatsapp'), 'online filter includes whatsapp');
assert(channelQuery('walk_in') === 'walk_in', 'walk_in filter exact');

console.log('Channel assertions passed');
