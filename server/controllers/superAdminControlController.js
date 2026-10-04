import mongoose from 'mongoose';
import Agency from '../models/Agency.js';
import User from '../models/User.js';
import PlatformNotification from '../models/PlatformNotification.js';
import { notDeleted } from '../services/agencyApprovalService.js';
import { listInbox, markAllInboxRead, markInboxRead } from '../services/platformInbox.js';
import { getPlatformHealth, getPlatformSettingsSnapshot } from '../services/platformHealth.js';
import { escapeRegex } from '../utils/helpers.js';

const pickAgency = (agency) => ({
  _id: agency._id,
  name: agency.name,
  slug: agency.slug,
  email: agency.email,
  phone: agency.phone,
  status: agency.status,
  createdAt: agency.createdAt,
});

const pickUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  accountStatus: user.accountStatus,
  agencyName: user.agencyName,
  agencyId: user.agencyId,
  lastLoginAt: user.lastLoginAt || null,
  createdAt: user.createdAt,
});

export const getControlSummary = async (_req, res) => {
  try {
    const [pendingAgencies, unreadInbox, failedInbox, health] = await Promise.all([
      Agency.countDocuments({ ...notDeleted, status: 'pending' }),
      PlatformNotification.countDocuments({ readAt: null }),
      PlatformNotification.countDocuments({
        readAt: null,
        $or: [{ severity: 'critical' }, { type: { $in: ['system.email_failed', 'system.smtp_not_configured'] } }],
      }),
      Promise.resolve(getPlatformHealth()),
    ]);
    const healthAlerts = health.checks.filter((c) => c.status !== 'operational').length;
    res.json({
      success: true,
      pendingAgencies,
      unreadInbox,
      failedInbox,
      healthAlerts,
    });
  } catch (error) {
    console.error('[getControlSummary]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load control summary' });
  }
};

export const getInbox = async (req, res) => {
  try {
    const unreadOnly = String(req.query.unread || '') === '1' || String(req.query.unreadOnly || '') === 'true';
    const data = await listInbox({
      unreadOnly,
      page: req.query.page,
      limit: req.query.limit || 30,
    });
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('[getInbox]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
};

export const markInboxItemRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification id' });
    }
    const item = await markInboxRead(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, item });
  } catch (error) {
    console.error('[markInboxItemRead]', error.message);
    res.status(500).json({ success: false, message: 'Failed to mark notification read' });
  }
};

export const markInboxAllRead = async (_req, res) => {
  try {
    const result = await markAllInboxRead();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[markInboxAllRead]', error.message);
    res.status(500).json({ success: false, message: 'Failed to mark notifications read' });
  }
};

export const getNotificationDeliveryLog = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = {
      ...notDeleted,
      $or: [
        { 'notifications.email.status': { $in: ['sent', 'failed', 'not_configured', 'skipped'] } },
        { 'notifications.whatsapp.status': { $in: ['link_ready', 'not_configured', 'failed', 'skipped'] } },
      ],
    };
    const [total, agencies] = await Promise.all([
      Agency.countDocuments(filter),
      Agency.find(filter)
        .select('name email phone whatsapp status notifications createdAt approvedAt')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const items = agencies.flatMap((agency) => {
      const rows = [];
      const email = agency.notifications?.email;
      const whatsapp = agency.notifications?.whatsapp;
      if (email?.status && email.status !== 'idle') {
        rows.push({
          id: `${agency._id}-email`,
          agencyId: agency._id,
          agencyName: agency.name,
          recipient: agency.email || '',
          channel: 'email',
          type: 'agency.notification',
          status: email.status,
          error: email.error || '',
          date: email.at || agency.approvedAt || agency.createdAt,
        });
      }
      if (whatsapp?.status && whatsapp.status !== 'idle') {
        rows.push({
          id: `${agency._id}-whatsapp`,
          agencyId: agency._id,
          agencyName: agency.name,
          recipient: agency.phone || agency.whatsapp || '',
          channel: 'whatsapp',
          type: 'agency.notification',
          status: whatsapp.status,
          error: whatsapp.error || '',
          date: whatsapp.at || agency.approvedAt || agency.createdAt,
          canOpen: Boolean(whatsapp.waMeUrl),
        });
      }
      return rows;
    });

    res.json({
      success: true,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('[getNotificationDeliveryLog]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load notification log' });
  }
};

export const searchPlatform = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ success: true, agencies: [], users: [], requests: [] });
    }
    const rx = new RegExp(escapeRegex(q), 'i');
    const agencyMatch = {
      $or: [{ name: rx }, { slug: rx }, { email: rx }, { phone: rx }, { whatsapp: rx }],
    };

    const [agencies, users, requests] = await Promise.all([
      Agency.find({ ...notDeleted, ...agencyMatch, status: { $ne: 'pending' } })
        .select('name slug email phone status createdAt')
        .sort({ updatedAt: -1 })
        .limit(8)
        .lean(),
      User.find({
        role: 'owner',
        $or: [{ name: rx }, { email: rx }, { agencyName: rx }],
      })
        .select('name email role accountStatus agencyName agencyId lastLoginAt createdAt')
        .sort({ updatedAt: -1 })
        .limit(8)
        .lean(),
      Agency.find({ ...notDeleted, status: 'pending', ...agencyMatch })
        .select('name slug email phone status createdAt')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
    ]);

    res.json({
      success: true,
      agencies: agencies.map(pickAgency),
      users: users.map(pickUser),
      requests: requests.map(pickAgency),
    });
  } catch (error) {
    console.error('[searchPlatform]', error.message);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
};

export const getHealth = async (_req, res) => {
  try {
    res.json({ success: true, ...getPlatformHealth() });
  } catch (error) {
    console.error('[getHealth]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load system health' });
  }
};

export const getSettingsSnapshot = async (_req, res) => {
  try {
    res.json({ success: true, settings: getPlatformSettingsSnapshot() });
  } catch (error) {
    console.error('[getSettingsSnapshot]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
};

export default {
  getControlSummary,
  getInbox,
  markInboxItemRead,
  markInboxAllRead,
  getNotificationDeliveryLog,
  searchPlatform,
  getHealth,
  getSettingsSnapshot,
};
