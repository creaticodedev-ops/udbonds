import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../../utils/apiError'
import { Field, SettingsCard, StatusPill, settingsUi } from './settingsUi'

const DEFAULTS = {
  minRentalDays: 1,
  maxRentalDays: 90,
  advanceBookingDays: 365,
  cancellationPolicyText: '',
  cancellationFeeType: 'none',
  cancellationFeeValue: 0,
  securityDepositDefault: 0,
  extraDriverAllowed: true,
  extraDriverFeePerDay: 0,
  mileageMode: 'unlimited',
  mileageLimitKmPerDay: 250,
  pickupHoursStart: '08:00',
  pickupHoursEnd: '20:00',
  returnHoursStart: '08:00',
  returnHoursEnd: '20:00',
  pendingReservationExpiryHours: 48,
}

const toPayload = (form) => ({
  ...form,
  minRentalDays: Number(form.minRentalDays),
  maxRentalDays: Number(form.maxRentalDays),
  advanceBookingDays: Number(form.advanceBookingDays),
  cancellationFeeValue: Number(form.cancellationFeeValue),
  securityDepositDefault: Number(form.securityDepositDefault),
  extraDriverFeePerDay: Number(form.extraDriverFeePerDay),
  mileageLimitKmPerDay: Number(form.mileageLimitKmPerDay),
  pendingReservationExpiryHours: Number(form.pendingReservationExpiryHours),
  extraDriverAllowed: Boolean(form.extraDriverAllowed),
})

const BookingSettingsPanel = ({ axios, initial, t, onSaved }) => {
  const [form, setForm] = useState({ ...DEFAULTS, ...(initial || {}) })
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setForm({ ...DEFAULTS, ...(initial || {}) })
    setDirty(false)
  }, [initial])

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }

  const summary = useMemo(() => ({
    duration: `${form.minRentalDays}–${form.maxRentalDays} ${t('admin.settings.daysUnit')}`,
    hours: `${form.pickupHoursStart}–${form.pickupHoursEnd}`,
    mileage: form.mileageMode === 'limited'
      ? `${form.mileageLimitKmPerDay} km/day`
      : t('admin.settings.mileageUnlimited'),
    expiry: Number(form.pendingReservationExpiryHours) > 0
      ? `${form.pendingReservationExpiryHours}h`
      : t('admin.settings.expiryOff'),
  }), [form, t])

  const onSave = async (e) => {
    e.preventDefault()
    if (Number(form.minRentalDays) > Number(form.maxRentalDays)) {
      toast.error(t('admin.settings.minMaxError'))
      return
    }
    setSaving(true)
    try {
      const payload = toPayload(form)
      const { data } = await axios.put('/api/owner/settings', { bookingSettings: payload })
      if (!data.success) {
        toast.error(data.message || t('admin.settings.saveError'))
        return
      }
      toast.success(t('admin.settings.saved'))
      const saved = data.settings?.bookingSettings
      if (saved) {
        setForm({ ...DEFAULTS, ...saved })
        onSaved?.(saved)
      }
      setDirty(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-5 pb-24 sm:pb-0">
      <SettingsCard
        soft
        eyebrow={t('admin.settings.bookingSection')}
        title={t('admin.settings.bookingTitle')}
        description={t('admin.settings.bookingHint')}
        action={
          <div className="flex flex-wrap gap-2 max-w-full">
            <StatusPill tone="info">{summary.duration}</StatusPill>
            <StatusPill tone="neutral">{summary.hours}</StatusPill>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [t('admin.settings.statDuration'), summary.duration],
            [t('admin.settings.statHours'), summary.hours],
            [t('admin.settings.statMileage'), summary.mileage],
            [t('admin.settings.statExpiry'), summary.expiry],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-borderColor/60 bg-white/80 px-3 py-3">
              <p className={settingsUi.sectionLabel}>{label}</p>
              <p className="mt-1.5 text-sm font-semibold text-ink truncate">{value}</p>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('admin.settings.durationSection')}
        description={t('admin.settings.durationHint')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('admin.settings.minRentalDays')} hint={t('admin.settings.minRentalHint')}>
            <input type="number" min={1} className={settingsUi.input} value={form.minRentalDays}
              onChange={(e) => set('minRentalDays', e.target.value)} />
          </Field>
          <Field label={t('admin.settings.maxRentalDays')} hint={t('admin.settings.maxRentalHint')}>
            <input type="number" min={1} className={settingsUi.input} value={form.maxRentalDays}
              onChange={(e) => set('maxRentalDays', e.target.value)} />
          </Field>
          <Field label={t('admin.settings.advanceBookingDays')} hint={t('admin.settings.advanceBookingHint')}>
            <input type="number" min={1} className={settingsUi.input} value={form.advanceBookingDays}
              onChange={(e) => set('advanceBookingDays', e.target.value)} />
          </Field>
          <Field label={t('admin.settings.pendingExpiryHours')} hint={t('admin.settings.pendingExpiryHint')}>
            <input type="number" min={0} className={settingsUi.input} value={form.pendingReservationExpiryHours}
              onChange={(e) => set('pendingReservationExpiryHours', e.target.value)} />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('admin.settings.cancellationSection')}
        description={t('admin.settings.cancellationHint')}
      >
        <Field label={t('admin.settings.cancellationPolicy')} hint={t('admin.settings.cancellationPolicyExample')}>
          <textarea
            className={settingsUi.textarea}
            value={form.cancellationPolicyText}
            onChange={(e) => set('cancellationPolicyText', e.target.value)}
            placeholder={t('admin.settings.cancellationPolicyPlaceholder')}
          />
        </Field>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('admin.settings.cancellationFeeType')}>
            <select className={settingsUi.select} value={form.cancellationFeeType}
              onChange={(e) => set('cancellationFeeType', e.target.value)}>
              <option value="none">{t('admin.settings.feeNone')}</option>
              <option value="fixed">{t('admin.settings.feeFixed')}</option>
              <option value="percent">{t('admin.settings.feePercent')}</option>
            </select>
          </Field>
          <Field
            label={t('admin.settings.cancellationFeeValue')}
            hint={form.cancellationFeeType === 'percent' ? t('admin.settings.feePercentHint') : t('admin.settings.feeFixedHint')}
          >
            <input type="number" min={0} step="0.01" className={settingsUi.input}
              value={form.cancellationFeeValue}
              disabled={form.cancellationFeeType === 'none'}
              onChange={(e) => set('cancellationFeeValue', e.target.value)} />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('admin.settings.depositExtrasSection')}
        description={t('admin.settings.depositExtrasHint')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('admin.settings.securityDepositDefault')} hint={t('admin.settings.securityDepositHint')}>
            <input type="number" min={0} step="0.01" className={settingsUi.input}
              value={form.securityDepositDefault}
              onChange={(e) => set('securityDepositDefault', e.target.value)} />
          </Field>
          <Field label={t('admin.settings.extraDriverFee')} hint={t('admin.settings.extraDriverFeeHint')}>
            <input type="number" min={0} step="0.01" className={settingsUi.input}
              value={form.extraDriverFeePerDay}
              disabled={!form.extraDriverAllowed}
              onChange={(e) => set('extraDriverFeePerDay', e.target.value)} />
          </Field>
        </div>
        <label className="mt-4 flex min-h-12 items-center gap-3 rounded-2xl border border-borderColor/70 bg-light/40 px-4 text-sm text-ink">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={Boolean(form.extraDriverAllowed)}
            onChange={(e) => set('extraDriverAllowed', e.target.checked)}
          />
          <span className="font-medium">{t('admin.settings.extraDriverAllowed')}</span>
        </label>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('admin.settings.mileageMode')}>
            <select className={settingsUi.select} value={form.mileageMode}
              onChange={(e) => set('mileageMode', e.target.value)}>
              <option value="unlimited">{t('admin.settings.mileageUnlimited')}</option>
              <option value="limited">{t('admin.settings.mileageLimited')}</option>
            </select>
          </Field>
          <Field label={t('admin.settings.mileageLimit')} hint={t('admin.settings.mileageLimitHint')}>
            <input type="number" min={0} className={settingsUi.input}
              disabled={form.mileageMode !== 'limited'}
              value={form.mileageLimitKmPerDay}
              onChange={(e) => set('mileageLimitKmPerDay', e.target.value)} />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('admin.settings.hoursSection')}
        description={t('admin.settings.hoursHint')}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 min-w-0">
          <Field label={t('admin.settings.pickupHoursStart')}>
            <input type="time" className={`${settingsUi.input} [color-scheme:light]`} value={form.pickupHoursStart}
              onChange={(e) => set('pickupHoursStart', e.target.value)} />
          </Field>
          <Field label={t('admin.settings.pickupHoursEnd')}>
            <input type="time" className={`${settingsUi.input} [color-scheme:light]`} value={form.pickupHoursEnd}
              onChange={(e) => set('pickupHoursEnd', e.target.value)} />
          </Field>
          <Field label={t('admin.settings.returnHoursStart')}>
            <input type="time" className={`${settingsUi.input} [color-scheme:light]`} value={form.returnHoursStart}
              onChange={(e) => set('returnHoursStart', e.target.value)} />
          </Field>
          <Field label={t('admin.settings.returnHoursEnd')}>
            <input type="time" className={`${settingsUi.input} [color-scheme:light]`} value={form.returnHoursEnd}
              onChange={(e) => set('returnHoursEnd', e.target.value)} />
          </Field>
        </div>
        <p className="mt-3 text-[12px] text-muted">{t('admin.settings.hoursTimezoneNote')}</p>
      </SettingsCard>

      <div className={`${settingsUi.stickyBar} sm:pt-1`}>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted text-center sm:text-left">
            {dirty ? t('admin.settings.unsavedChanges') : t('admin.settings.allSaved')}
          </p>
          <button type="submit" disabled={saving || !dirty} className={`${settingsUi.btnPrimary} w-full sm:w-auto`}>
            {saving ? t('admin.settings.saving') : t('admin.settings.saveBooking')}
          </button>
        </div>
      </div>
    </form>
  )
}

export default BookingSettingsPanel
