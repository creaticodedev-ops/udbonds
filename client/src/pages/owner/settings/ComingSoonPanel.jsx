import React from 'react'
import { EmptyState, SettingsCard, StatusPill } from './settingsUi'

const ITEMS = [
  { key: 'notifications', tone: 'info' },
  { key: 'payments', tone: 'warn' },
  { key: 'taxes', tone: 'neutral' },
  { key: 'integrations', tone: 'neutral' },
]

const ComingSoonPanel = ({ t }) => (
  <div className="space-y-5">
    <SettingsCard
      soft
      eyebrow={t('admin.settings.tabFuture')}
      title={t('admin.settings.futureTitle')}
      description={t('admin.settings.futureHint')}
      action={<StatusPill tone="info">{t('admin.settings.comingSoon')}</StatusPill>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ITEMS.map((item) => (
          <div
            key={item.key}
            className="rounded-2xl border border-dashed border-borderColor bg-white/70 px-4 py-5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                {t(`admin.settings.futureItems.${item.key}.title`)}
              </p>
              <StatusPill tone={item.tone}>{t('admin.settings.comingSoon')}</StatusPill>
            </div>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              {t(`admin.settings.futureItems.${item.key}.body`)}
            </p>
          </div>
        ))}
      </div>
    </SettingsCard>

    <EmptyState
      title={t('admin.settings.futureEmptyTitle')}
      body={t('admin.settings.futureEmptyBody')}
    />
  </div>
)

export default ComingSoonPanel
