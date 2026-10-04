import React from 'react'
import toast from 'react-hot-toast'
import { SettingsCard, StatusPill, settingsUi } from './settingsUi'

const GeneralSettingsPanel = ({ bookingSettings, effective, agency, t, onNavigate }) => {
  const bs = bookingSettings || {}
  const storefrontUrl =
    agency?.storefrontUrl ||
    (agency?.storefrontPath
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}${agency.storefrontPath}`
      : '')

  const rows = [
    {
      label: t('admin.settings.generalAgency'),
      value: agency?.name || '—',
      hint: t('admin.settings.generalAgencyHint'),
    },
    {
      label: t('admin.settings.generalSlug'),
      value: agency?.slug || '—',
      hint: t('admin.settings.generalSlugHint'),
    },
    {
      label: t('admin.settings.generalTimezone'),
      value: 'Africa/Casablanca',
      hint: t('admin.settings.generalTimezoneHint'),
    },
    {
      label: t('admin.settings.generalHours'),
      value: `${bs.pickupHoursStart || '08:00'} – ${bs.pickupHoursEnd || '20:00'}`,
      hint: t('admin.settings.generalHoursHint'),
    },
    {
      label: t('admin.settings.generalDeposit'),
      value: bs.securityDepositDefault != null ? String(bs.securityDepositDefault) : '—',
      hint: t('admin.settings.securityDepositHint'),
    },
  ]

  return (
    <div className="space-y-5">
      <SettingsCard
        soft
        eyebrow={t('admin.settings.tabGeneral')}
        title={t('admin.settings.generalTitle')}
        description={t('admin.settings.generalHint')}
        action={
          <StatusPill tone="success">{t('admin.settings.generalLive')}</StatusPill>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-borderColor/60 bg-white/85 px-4 py-3.5">
              <p className={settingsUi.sectionLabel}>{row.label}</p>
              <p className="mt-1.5 text-sm font-semibold text-ink break-words">{row.value}</p>
              <p className="mt-1 text-[12px] text-muted leading-snug">{row.hint}</p>
            </div>
          ))}
        </div>
      </SettingsCard>

      {storefrontUrl ? (
        <SettingsCard
          title={t('admin.settings.storefrontTitle')}
          description={t('admin.settings.storefrontHint')}
          action={
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t('admin.settings.storefrontOpen')}
            </a>
          }
        >
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              readOnly
              value={storefrontUrl}
              className="flex-1 min-w-0 rounded-xl border border-borderColor bg-white px-3 py-2.5 text-xs sm:text-sm font-mono text-ink"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(storefrontUrl)
                  toast.success(t('admin.settings.storefrontCopied'))
                } catch {
                  toast.error(t('admin.settings.storefrontCopyFailed'))
                }
              }}
              className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dull"
            >
              {t('admin.settings.storefrontCopy')}
            </button>
          </div>
        </SettingsCard>
      ) : null}

      <SettingsCard
        title={t('admin.settings.generalQuickLinks')}
        description={t('admin.settings.generalQuickLinksHint')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            ['booking', t('admin.settings.tabBooking'), t('admin.settings.generalLinkBooking')],
            ['promotions', t('admin.settings.tabPromotions'), t('admin.settings.generalLinkPromos')],
            ['whatsapp', t('admin.settings.tabWhatsApp'), effective.reservationDial ? `+${effective.reservationDial}` : t('admin.settings.whatsappFallback')],
          ].map(([id, title, meta]) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className="rounded-2xl border border-borderColor/70 bg-light/40 px-4 py-4 text-left transition hover:border-primary/30 hover:bg-white"
            >
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="mt-1 text-xs text-muted truncate">{meta}</p>
            </button>
          ))}
        </div>
      </SettingsCard>
    </div>
  )
}

export default GeneralSettingsPanel
