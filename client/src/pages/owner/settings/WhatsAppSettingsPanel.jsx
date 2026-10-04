import React, { useState } from 'react'
import toast from 'react-hot-toast'
import PhoneInput, { isPhoneValid } from '../../../components/PhoneInput'
import { getErrorMessage } from '../../../utils/apiError'
import { Field, SettingsCard, StatusPill, settingsUi } from './settingsUi'

const WhatsAppSettingsPanel = ({
  axios,
  form,
  setForm,
  effective,
  onReload,
  t,
}) => {
  const [saving, setSaving] = useState(false)

  const validateOptionalPhone = (value, label) => {
    const trimmed = String(value || '').trim()
    if (!trimmed) return true
    if (!isPhoneValid(trimmed)) {
      toast.error(t('admin.settings.invalidPhone', { field: label }))
      return false
    }
    return true
  }

  const onSave = async (e) => {
    e.preventDefault()
    if (!validateOptionalPhone(form.whatsappReservationNumber, t('admin.settings.reservationNumber'))) return
    if (!validateOptionalPhone(form.whatsappConfirmationNumber, t('admin.settings.confirmationNumber'))) return

    setSaving(true)
    try {
      const { data } = await axios.put('/api/owner/settings', {
        whatsappReservationNumber: form.whatsappReservationNumber,
        whatsappConfirmationNumber: form.whatsappConfirmationNumber,
      })
      if (!data.success) {
        toast.error(data.message || t('admin.settings.saveError'))
        return
      }
      toast.success(data.message || t('admin.settings.saved'))
      await onReload?.()
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
        eyebrow={t('admin.settings.whatsappSection')}
        title={t('admin.settings.whatsappTitle')}
        description={t('admin.settings.whatsappHint')}
        action={
          <StatusPill tone={effective.reservationDial ? 'success' : 'warn'}>
            {effective.reservationDial
              ? t('admin.settings.whatsappConnected')
              : t('admin.settings.whatsappFallback')}
          </StatusPill>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-borderColor/60 bg-white/80 px-4 py-3">
            <p className={settingsUi.sectionLabel}>{t('admin.settings.reservationNumber')}</p>
            <p className="mt-1.5 text-sm font-semibold text-ink">
              {effective.reservationDial ? `+${effective.reservationDial}` : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-borderColor/60 bg-white/80 px-4 py-3">
            <p className={settingsUi.sectionLabel}>{t('admin.settings.confirmationNumber')}</p>
            <p className="mt-1.5 text-sm font-semibold text-ink">
              {effective.confirmationDial ? `+${effective.confirmationDial}` : '—'}
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('admin.settings.whatsappNumbersTitle')}
        description={t('admin.settings.whatsappNumbersHint')}
      >
        <div className="space-y-5">
          <Field label={t('admin.settings.reservationNumber')} hint={t('admin.settings.reservationHelp')}>
            <PhoneInput
              value={form.whatsappReservationNumber}
              onChange={(phone) => setForm((f) => ({ ...f, whatsappReservationNumber: phone }))}
            />
          </Field>
          <Field label={t('admin.settings.confirmationNumber')} hint={t('admin.settings.confirmationHelp')}>
            <PhoneInput
              value={form.whatsappConfirmationNumber}
              onChange={(phone) => setForm((f) => ({ ...f, whatsappConfirmationNumber: phone }))}
            />
          </Field>
          <p className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 leading-relaxed">
            {t('admin.settings.fallbackHint')}
          </p>
        </div>

        <div className={`${settingsUi.stickyBar} mt-5`}>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={saving} onClick={onReload} className={settingsUi.btnSecondary}>
              {t('admin.settings.reload')}
            </button>
            <button type="submit" disabled={saving} className={settingsUi.btnPrimary}>
              {saving ? t('admin.settings.saving') : t('admin.settings.save')}
            </button>
          </div>
        </div>
      </SettingsCard>
    </form>
  )
}

export default WhatsAppSettingsPanel
