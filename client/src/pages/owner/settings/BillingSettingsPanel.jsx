import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../../utils/apiError'
import { SettingsCard, StatusPill, settingsUi } from './settingsUi'

const toneForStatus = (status) => {
  if (status === 'active' || status === 'trialing') return 'success'
  if (status === 'past_due') return 'warn'
  if (status === 'suspended' || status === 'expired' || status === 'canceled') return 'danger'
  return 'neutral'
}

const fmt = (d) => {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString()
  } catch {
    return '—'
  }
}

const BillingSettingsPanel = ({ axios, t }) => {
  const [loading, setLoading] = useState(true)
  const [billing, setBilling] = useState(null)
  const [plans, setPlans] = useState([])
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.get('/api/owner/billing')
      if (!data.success) {
        setError(data.message || 'Failed to load billing')
        return
      }
      setBilling(data.billing)
      setPlans(data.plans || [])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [axios])

  if (loading) {
    return <p className="text-sm text-muted py-8">{t('admin.settings.loading') || 'Loading…'}</p>
  }

  if (error && !billing) {
    return (
      <SettingsCard title={t('admin.settings.billingTitle') || 'Billing'} description={error}>
        <button type="button" className={settingsUi.btnSecondary} onClick={load}>
          {t('admin.settings.reload') || 'Reload'}
        </button>
      </SettingsCard>
    )
  }

  const sub = billing?.subscription
  const usage = billing?.usage || {}
  const limits = billing?.limits || {}
  const vehiclesLabel =
    limits.maxVehicles == null
      ? `${usage.vehicles ?? 0} / ∞`
      : `${usage.vehicles ?? 0} / ${limits.maxVehicles}`

  return (
    <div className="space-y-5">
      <SettingsCard
        eyebrow={t('admin.settings.billingEyebrow') || 'Subscription'}
        title={t('admin.settings.billingTitle') || 'Billing & plan'}
        description={
          t('admin.settings.billingDesc') ||
          'Your agency plan, trial dates, and usage. Contact support to upgrade.'
        }
        action={
          sub ? (
            <StatusPill tone={toneForStatus(sub.status)}>{sub.status}</StatusPill>
          ) : null
        }
      >
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className={settingsUi.sectionLabel}>Plan</dt>
            <dd className="mt-1 font-semibold text-ink">
              {sub?.plan?.name || sub?.planCode || '—'}
            </dd>
          </div>
          <div>
            <dt className={settingsUi.sectionLabel}>Write access</dt>
            <dd className="mt-1 text-ink">
              {billing?.writeAllowed ? 'Allowed' : 'Read-only (subscription inactive)'}
            </dd>
          </div>
          <div>
            <dt className={settingsUi.sectionLabel}>Trial ends</dt>
            <dd className="mt-1 text-ink">{fmt(sub?.trialEndsAt)}</dd>
          </div>
          <div>
            <dt className={settingsUi.sectionLabel}>Period end</dt>
            <dd className="mt-1 text-ink">{fmt(sub?.currentPeriodEnd)}</dd>
          </div>
          <div>
            <dt className={settingsUi.sectionLabel}>Vehicles</dt>
            <dd className="mt-1 text-ink">{vehiclesLabel}</dd>
          </div>
          <div>
            <dt className={settingsUi.sectionLabel}>Staff seats</dt>
            <dd className="mt-1 text-ink">
              {limits.maxStaff == null
                ? `${usage.staff ?? 1} / ∞`
                : `${usage.staff ?? 1} / ${limits.maxStaff}`}
            </dd>
          </div>
          <div>
            <dt className={settingsUi.sectionLabel}>Custom domain</dt>
            <dd className="mt-1 text-ink">{limits.customDomain ? 'Included' : 'Not on this plan'}</dd>
          </div>
        </dl>

        {!billing?.writeAllowed ? (
          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {t('admin.settings.billingLockedHint') ||
              'Your subscription is inactive. You can still browse data; edits are blocked until reactivated.'}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className={settingsUi.btnPrimary}
            onClick={async () => {
              try {
                await axios.post('/api/owner/billing/checkout', { planCode: 'pro' })
              } catch (err) {
                toast.error(
                  getErrorMessage(err) ||
                    'Self-serve upgrade is not enabled. Contact support.',
                )
              }
            }}
          >
            {t('admin.settings.billingUpgrade') || 'Request upgrade'}
          </button>
          <button type="button" className={settingsUi.btnGhost} onClick={load}>
            Refresh
          </button>
        </div>
      </SettingsCard>

      {plans.length > 0 ? (
        <SettingsCard
          title={t('admin.settings.billingPlansTitle') || 'Available plans'}
          description={t('admin.settings.billingPlansDesc') || 'Public catalogue (manual billing in v1).'}
        >
          <ul className="space-y-3">
            {plans.map((p) => (
              <li
                key={p.code}
                className="flex flex-col gap-1 rounded-2xl border border-borderColor/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-ink">{p.name}</p>
                  <p className="text-xs text-muted">{p.description}</p>
                </div>
                <p className="text-sm font-medium text-ink shrink-0">
                  {p.priceAmount > 0
                    ? `${p.priceAmount} ${p.currency}/${p.interval}`
                    : 'Contact us'}
                </p>
              </li>
            ))}
          </ul>
        </SettingsCard>
      ) : null}
    </div>
  )
}

export default BillingSettingsPanel
