import mongoose from 'mongoose';
import { getSmtpConfigSummary } from './emailService.js';

export const getPlatformHealth = () => {
  const dbState = mongoose.connection.readyState;
  const smtp = getSmtpConfigSummary();
  const imagekit = Boolean(
    String(process.env.IMAGEKIT_PUBLIC_KEY || '').trim() &&
      String(process.env.IMAGEKIT_PRIVATE_KEY || '').trim() &&
      String(process.env.IMAGEKIT_URL_ENDPOINT || '').trim(),
  );

  const database =
    dbState === 1 ? 'operational' : dbState === 2 ? 'warning' : 'error';
  const smtpStatus = !smtp.configured ? 'not_configured' : smtp.verified ? 'operational' : 'warning';
  const storage = imagekit ? 'operational' : 'not_configured';

  return {
    checkedAt: new Date().toISOString(),
    checks: [
      { id: 'api', label: 'API', status: 'operational', detail: 'Control plane responding' },
      {
        id: 'database',
        label: 'Database',
        status: database,
        detail: database === 'operational' ? 'MongoDB connected' : `Connection state ${dbState}`,
      },
      {
        id: 'smtp',
        label: 'SMTP',
        status: smtpStatus,
        detail: smtp.configured
          ? smtp.verified
            ? `${smtp.host}:${smtp.port}`
            : smtp.lastVerifyError || 'Configured, verify failed'
          : 'Set SMTP_HOST, SMTP_USER, SMTP_PASS',
      },
      {
        id: 'whatsapp',
        label: 'WhatsApp',
        status: 'not_configured',
        detail: 'No WhatsApp send API. Super Admin uses wa.me links only.',
      },
      {
        id: 'storage',
        label: 'Storage',
        status: storage,
        detail: imagekit ? 'ImageKit credentials present' : 'ImageKit env vars not set',
      },
    ],
  };
};

export const getPlatformSettingsSnapshot = () => {
  const smtp = getSmtpConfigSummary();
  const clientUrl = String(process.env.CLIENT_URL || '')
    .split(',')[0]
    .trim();
  return {
    platform: {
      name: String(process.env.PLATFORM_NAME || process.env.BRAND_NAME || 'RSZ CAR').trim() || 'RSZ CAR',
      clientUrl: clientUrl || '',
      baseDomain: String(process.env.PLATFORM_BASE_DOMAIN || '').trim(),
    },
    email: {
      configured: smtp.configured,
      verified: smtp.verified,
      host: smtp.host,
      port: smtp.port,
      user: smtp.user,
      from: smtp.from,
    },
    notifications: {
      inbox: true,
      whatsappApi: false,
      whatsappMode: 'wa.me',
    },
    security: {
      jwtConfigured: Boolean(String(process.env.JWT_SECRET || '').trim()),
      superAdminLogin: '/superadmin/login',
    },
  };
};

export default { getPlatformHealth, getPlatformSettingsSnapshot };
