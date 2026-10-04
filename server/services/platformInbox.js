import PlatformNotification from '../models/PlatformNotification.js';

export const pushInbox = async (payload = {}) => {
  try {
    const title = String(payload.title || '').trim();
    if (!title) return null;
    return await PlatformNotification.create({
      category: payload.category || 'system',
      type: payload.type || 'system.event',
      title: title.slice(0, 160),
      body: String(payload.body || '').trim().slice(0, 400),
      href: String(payload.href || '').trim().slice(0, 240),
      agencyId: payload.agencyId || null,
      agencyName: String(payload.agencyName || '').trim().slice(0, 120),
      severity: payload.severity || 'info',
      meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : {},
    });
  } catch (error) {
    console.error('[platformInbox]', error.message);
    return null;
  }
};

export const listInbox = async ({ unreadOnly = false, page = 1, limit = 30 } = {}) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const lim = Math.min(100, Math.max(1, Number(limit) || 30));
  const filter = unreadOnly ? { readAt: null } : {};
  const [items, total, unread] = await Promise.all([
    PlatformNotification.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * lim).limit(lim).lean(),
    PlatformNotification.countDocuments(filter),
    PlatformNotification.countDocuments({ readAt: null }),
  ]);
  return {
    items,
    unread,
    pagination: {
      page: pageNum,
      limit: lim,
      total,
      totalPages: Math.max(1, Math.ceil(total / lim)),
    },
  };
};

export const markInboxRead = async (id) => {
  if (!id) return null;
  return PlatformNotification.findByIdAndUpdate(id, { $set: { readAt: new Date() } }, { new: true }).lean();
};

export const markAllInboxRead = async () => {
  const result = await PlatformNotification.updateMany({ readAt: null }, { $set: { readAt: new Date() } });
  return { modified: result.modifiedCount || 0 };
};

export const notifyDeliveryOutcome = async (agency, notifications, { kind = 'approve' } = {}) => {
  const email = notifications?.email || {};
  const name = agency?.name || 'Agency';
  const href = agency?._id ? `/superadmin/agencies/${agency._id}` : '/superadmin/notifications';
  if (email.status === 'failed') {
    await pushInbox({
      category: 'system',
      type: 'system.email_failed',
      title: kind === 'reject' ? 'Rejection email failed' : 'Approval email failed',
      body: `${name}${email.error ? ` — ${email.error}` : ''}`,
      href,
      agencyId: agency?._id,
      agencyName: name,
      severity: 'critical',
      meta: { channel: 'email', status: email.status },
    });
  } else if (email.status === 'not_configured') {
    await pushInbox({
      category: 'system',
      type: 'system.smtp_not_configured',
      title: 'SMTP configuration requires attention',
      body: `Could not email ${name}. SMTP is not configured or not verified.`,
      href: '/superadmin/health',
      agencyId: agency?._id,
      agencyName: name,
      severity: 'warn',
      meta: { channel: 'email', status: email.status },
    });
  }
};

export default {
  pushInbox,
  listInbox,
  markInboxRead,
  markAllInboxRead,
  notifyDeliveryOutcome,
};
