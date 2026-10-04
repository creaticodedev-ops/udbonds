import React from 'react'
import { Link } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'

const CONTACT_PHONE = import.meta.env.VITE_PLATFORM_SUPPORT_PHONE || ''
const CONTACT_EMAIL = import.meta.env.VITE_PLATFORM_SUPPORT_EMAIL || ''
const CONTACT_WHATSAPP = String(import.meta.env.VITE_PLATFORM_SUPPORT_WHATSAPP || '').replace(/\D/g, '')

/**
 * Banner when subscription is inactive — dashboard stays read-only (P4).
 * Does not delete or alter business data.
 */
const TrialExpired = ({ variant = 'banner' }) => {
  const { logout, license } = useAppContext()
  const { t } = useI18n()

  const endsAt = license?.trialEndsAt
    ? new Date(license.trialEndsAt).toLocaleString()
    : null

  const whatsappUrl = CONTACT_WHATSAPP
    ? `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(
        t('admin.trial.whatsappMessage')
      )}`
    : ''

  if (variant === 'banner') {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">{t('admin.trial.title')}</p>
            <p className="text-amber-900/80 text-xs sm:text-sm">
              {t('admin.trial.subtitle')}{' '}
              {endsAt ? t('admin.trial.endedOn', { date: endsAt }) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              to="/owner/settings"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white"
            >
              {t('admin.settings.tabBilling') || 'Billing'}
            </Link>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-950"
              >
                {t('admin.trial.contactWhatsapp')}
              </a>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center rounded-xl border border-amber-300/80 px-4 py-2 text-xs font-medium text-amber-950/80"
            >
              {t('admin.trial.logout')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100svh-57px)] flex items-center justify-center px-4 py-12 bg-light">
      <div className="w-full max-w-lg rounded-2xl border border-borderColor bg-white p-8 sm:p-10 shadow-[0_18px_50px_-28px_rgba(22,18,16,0.3)] text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700 text-2xl font-semibold">
          !
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-primary font-medium mb-2">
          {t('admin.trial.eyebrow')}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-medium text-ink">
          {t('admin.trial.title')}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed">
          {t('admin.trial.subtitle')}
        </p>
        {endsAt && (
          <p className="mt-4 text-xs text-gray-400">
            {t('admin.trial.endedOn', { date: endsAt })}
          </p>
        )}
        <div className="mt-6 rounded-xl bg-light border border-borderColor px-4 py-3 text-left text-sm text-gray-600 space-y-1.5">
          <p className="font-medium text-ink">{t('admin.trial.dataSafeTitle')}</p>
          <p className="text-muted text-xs sm:text-sm leading-relaxed">
            {t('admin.trial.dataSafeBody')}
          </p>
        </div>
        <div className="mt-6 space-y-2 text-sm text-gray-700">
          <p className="font-medium text-ink">{t('admin.trial.contactTitle')}</p>
          {CONTACT_PHONE ? (
            <p>
              <a href={`tel:${CONTACT_PHONE}`} className="text-primary hover:underline">
                {CONTACT_PHONE}
              </a>
            </p>
          ) : null}
          {CONTACT_EMAIL ? (
            <p>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          ) : null}
        </div>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dull text-white text-sm font-medium transition-colors"
            >
              {t('admin.trial.contactWhatsapp')}
            </a>
          ) : null}
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-borderColor text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            {t('admin.trial.logout')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TrialExpired
