import React, { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../../utils/apiError'
import { VEHICLE_CATEGORIES } from '../../../utils/vehicleCategories'
import ConfirmDialog from '../../../components/owner/ConfirmDialog'
import {
  EmptyState,
  Field,
  LoadingBlock,
  SettingsCard,
  StatusPill,
  settingsUi,
} from './settingsUi'

const OCCASIONS = [
  'custom', 'summer', 'winter', 'new_year', 'ramadan', 'eid',
  'black_friday', 'special_event', 'last_minute', 'long_stay',
]

const toLocal = (d) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const emptyPromo = () => {
  const start = new Date()
  const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  return {
    name: '',
    description: '',
    code: '',
    discountType: 'percentage',
    discountValue: 10,
    startAt: toLocal(start),
    endAt: toLocal(end),
    minRentalDays: 1,
    maxRentalDays: 0,
    minBookingAmount: 0,
    maxDiscountAmount: 0,
    vehicleCategories: [],
    vehicleModels: '',
    globalUsageLimit: 0,
    perCustomerUsageLimit: 0,
    isActive: true,
    requirePromoCode: true,
    priority: 100,
    allowStacking: false,
    occasion: 'custom',
  }
}

const formatRange = (start, end) => {
  try {
    const opts = { day: '2-digit', month: 'short', year: 'numeric' }
    return `${new Date(start).toLocaleDateString(undefined, opts)} → ${new Date(end).toLocaleDateString(undefined, opts)}`
  } catch {
    return '—'
  }
}

const toneForLifecycle = (lifecycle) => {
  if (lifecycle === 'active') return 'success'
  if (lifecycle === 'scheduled') return 'info'
  if (lifecycle === 'expired') return 'neutral'
  return 'warn'
}

const PromotionsPanel = ({ axios, t, currency }) => {
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyPromo())
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      // Always fetch the full set so filter counts stay accurate.
      const { data } = await axios.get('/api/owner/promotions')
      if (data.success) setPromotions(data.promotions || [])
      else {
        setLoadError(data.message || t('admin.settings.promoLoadError'))
        toast.error(data.message || t('admin.settings.promoLoadError'))
      }
    } catch (error) {
      const msg = getErrorMessage(error)
      setLoadError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [axios, t])

  useEffect(() => {
    load()
  }, [load])

  // Lock background scroll while the editor sheet is open (mobile + desktop).
  useEffect(() => {
    if (!editing) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [editing])

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const counts = useMemo(() => {
    const c = { all: promotions.length, active: 0, scheduled: 0, expired: 0, codes: 0 }
    for (const p of promotions) {
      if (p.lifecycle === 'active') c.active += 1
      if (p.lifecycle === 'scheduled') c.scheduled += 1
      if (p.lifecycle === 'expired') c.expired += 1
      if (p.code) c.codes += 1
    }
    return c
  }, [promotions])

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase()
    return promotions.filter((p) => {
      if (status === 'active' && p.lifecycle !== 'active') return false
      if (status === 'scheduled' && p.lifecycle !== 'scheduled') return false
      if (status === 'expired' && p.lifecycle !== 'expired') return false
      if (status === 'codes' && !p.code) return false
      if (status === 'inactive' && p.isActive) return false
      if (!query) return true
      const hay = `${p.name || ''} ${p.code || ''} ${p.description || ''}`.toLowerCase()
      return hay.includes(query)
    })
  }, [promotions, status, q])

  const openCreate = () => {
    setEditing('new')
    setForm(emptyPromo())
    setPreview(null)
  }

  const openEdit = (p) => {
    const toLocalIso = (iso) => {
      if (!iso) return ''
      const d = new Date(iso)
      return toLocal(d)
    }
    setEditing(p._id)
    setForm({
      name: p.name || '',
      description: p.description || '',
      code: p.code || '',
      discountType: p.discountType || 'percentage',
      discountValue: p.discountValue ?? 0,
      startAt: toLocalIso(p.startAt),
      endAt: toLocalIso(p.endAt),
      minRentalDays: p.minRentalDays ?? 1,
      maxRentalDays: p.maxRentalDays ?? 0,
      minBookingAmount: p.minBookingAmount ?? 0,
      maxDiscountAmount: p.maxDiscountAmount ?? 0,
      vehicleCategories: p.vehicleCategories || [],
      vehicleModels: (p.vehicleModels || []).join(', '),
      globalUsageLimit: p.globalUsageLimit ?? 0,
      perCustomerUsageLimit: p.perCustomerUsageLimit ?? 0,
      isActive: p.isActive !== false,
      requirePromoCode: p.requirePromoCode !== false,
      priority: p.priority ?? 100,
      allowStacking: Boolean(p.allowStacking),
      occasion: p.occasion || 'custom',
    })
    setPreview(null)
  }

  const payloadFromForm = () => ({
    ...form,
    startAt: new Date(form.startAt).toISOString(),
    endAt: new Date(form.endAt).toISOString(),
    vehicleModels: String(form.vehicleModels || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    discountValue: Number(form.discountValue),
    minRentalDays: Number(form.minRentalDays),
    maxRentalDays: Number(form.maxRentalDays),
    minBookingAmount: Number(form.minBookingAmount),
    maxDiscountAmount: Number(form.maxDiscountAmount),
    globalUsageLimit: Number(form.globalUsageLimit),
    perCustomerUsageLimit: Number(form.perCustomerUsageLimit),
    priority: Number(form.priority),
  })

  const onSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(t('admin.settings.promoNameRequired'))
      return
    }
    if (new Date(form.endAt) < new Date(form.startAt)) {
      toast.error(t('admin.settings.promoDateError'))
      return
    }
    setSaving(true)
    try {
      const body = payloadFromForm()
      const { data } = editing === 'new'
        ? await axios.post('/api/owner/promotions', body)
        : await axios.put(`/api/owner/promotions/${editing}`, body)
      if (!data.success) {
        toast.error(data.message || t('admin.settings.saveError'))
        return
      }
      toast.success(t('admin.settings.promoSaved'))
      setEditing(null)
      load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (p) => {
    try {
      const { data } = await axios.patch(`/api/owner/promotions/${p._id}/active`, {
        isActive: !p.isActive,
      })
      if (data.success) {
        toast.success(p.isActive ? t('admin.settings.deactivated') : t('admin.settings.activated'))
        load()
      } else toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      const { data } = await axios.delete(`/api/owner/promotions/${pendingDelete._id}`)
      if (data.success) {
        toast.success(t('admin.settings.promoDeleted'))
        setPendingDelete(null)
        load()
      } else toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const runPreview = async () => {
    try {
      const { data } = await axios.post('/api/owner/promotions/preview', {
        pricePerDay: 500,
        days: 7,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxDiscountAmount: Number(form.maxDiscountAmount),
      })
      if (data.success) setPreview(data.preview)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const discountLabel = (p) => (
    p.discountType === 'percentage'
      ? `−${p.discountValue}%`
      : `−${currency}${p.discountValue}`
  )

  const filters = [
    ['all', counts.all],
    ['active', counts.active],
    ['scheduled', counts.scheduled],
    ['expired', counts.expired],
    ['codes', counts.codes],
  ]

  return (
    <div className="space-y-5 min-w-0 overflow-x-clip">
      <SettingsCard
        soft
        eyebrow={t('admin.settings.promotionsSection')}
        title={t('admin.settings.promotionsTitle')}
        description={t('admin.settings.promotionsHint')}
        action={
          <button type="button" onClick={openCreate} className={`${settingsUi.btnPrimary} w-full sm:w-auto`}>
            {t('admin.settings.promoCreate')}
          </button>
        }
      >
        <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2">
            {filters.map(([key, n]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(key)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition ${
                  status === key
                    ? 'border-primary bg-primary text-white'
                    : 'border-borderColor bg-white text-ink/70 hover:border-ink/20'
                }`}
              >
                {t(`admin.settings.promoFilter.${key}`)}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${status === key ? 'bg-white/20' : 'bg-sand text-muted'}`}>
                  {n}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <input
            className={settingsUi.input}
            placeholder={t('admin.settings.promoSearch')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </SettingsCard>

      {loading ? (
        <LoadingBlock label={t('admin.settings.loading')} />
      ) : loadError ? (
        <EmptyState
          title={t('admin.settings.promoLoadError')}
          body={loadError}
          action={
            <button type="button" className={settingsUi.btnSecondary} onClick={load}>
              {t('admin.settings.reload')}
            </button>
          }
        />
      ) : promotions.length === 0 ? (
        <EmptyState
          title={t('admin.settings.promoEmpty')}
          body={t('admin.settings.promoEmptyHint')}
          action={
            <button type="button" className={settingsUi.btnPrimary} onClick={openCreate}>
              {t('admin.settings.promoCreate')}
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={t('admin.settings.promoFilterEmpty')}
          body={t('admin.settings.promoFilterEmptyHint')}
          action={
            <button type="button" className={settingsUi.btnSecondary} onClick={() => { setStatus('all'); setQ('') }}>
              {t('admin.settings.promoFilterReset')}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {visible.map((p) => (
            <article key={p._id} className={`${settingsUi.card} p-4 sm:p-5 flex flex-col gap-4 min-w-0`}>
              <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg text-ink truncate" title={p.name}>{p.name}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusPill tone={toneForLifecycle(p.lifecycle)}>
                      {t(`admin.settings.promoLifecycle.${p.lifecycle}`)}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-muted break-words">
                    {t(`admin.settings.promoOccasionLabel.${p.occasion || 'custom'}`)}
                    {' · '}
                    {formatRange(p.startAt, p.endAt)}
                  </p>
                </div>
                <div className="shrink-0 rounded-2xl bg-sand/70 px-3 py-2 text-right">
                  <p className="text-sm font-semibold tabular-nums text-ink">{discountLabel(p)}</p>
                  <p className="text-[10px] text-muted mt-0.5">{t('admin.settings.priorityShort')} {p.priority}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px]">
                {p.code ? (
                  <span className="rounded-full border border-borderColor bg-light px-2.5 py-1 font-mono font-semibold text-ink">
                    {p.code}
                  </span>
                ) : (
                  <span className="rounded-full border border-borderColor bg-light px-2.5 py-1 text-muted">
                    {t('admin.settings.autoPromo')}
                  </span>
                )}
                <span className="rounded-full border border-borderColor bg-light px-2.5 py-1 text-muted">
                  {t('admin.settings.usageStat', { used: p.usageCount || 0, limit: p.globalUsageLimit || '∞' })}
                </span>
                {(p.vehicleCategories || []).slice(0, 3).map((c) => (
                  <span key={c} className="rounded-full border border-borderColor bg-white px-2.5 py-1 text-ink/70">
                    {c}
                  </span>
                ))}
                {(p.vehicleCategories || []).length > 3 ? (
                  <span className="rounded-full border border-borderColor px-2.5 py-1 text-muted">
                    +{(p.vehicleCategories || []).length - 3}
                  </span>
                ) : null}
                {!(p.vehicleCategories || []).length ? (
                  <span className="rounded-full border border-borderColor px-2.5 py-1 text-muted">
                    {t('admin.settings.allCategories')}
                  </span>
                ) : null}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 border-t border-borderColor/60 pt-3">
                <button type="button" onClick={() => openEdit(p)} className={settingsUi.btnGhost}>
                  {t('admin.settings.edit')}
                </button>
                <button type="button" onClick={() => toggleActive(p)} className={settingsUi.btnGhost}>
                  {p.isActive ? t('admin.settings.deactivate') : t('admin.settings.activate')}
                </button>
                <button type="button" onClick={() => setPendingDelete(p)} className={`${settingsUi.btnDanger} ml-auto`}>
                  {t('admin.settings.delete')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4">
          <div
            className="absolute inset-0"
            onClick={() => !saving && setEditing(null)}
            aria-hidden
          />
          <form
            onSubmit={onSave}
            className="relative z-[1] flex h-[min(92svh,100%)] max-h-[92svh] w-full max-w-3xl min-h-0 flex-col overflow-hidden rounded-t-[1.5rem] border border-borderColor bg-white shadow-2xl sm:h-auto sm:max-h-[90svh] sm:rounded-[1.5rem]"
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-borderColor sm:hidden" aria-hidden />
            <div className="flex items-start justify-between gap-3 border-b border-borderColor/70 px-4 py-4 sm:px-6 shrink-0">
              <div className="min-w-0">
                <p className={`${settingsUi.sectionLabel} text-primary`}>
                  {editing === 'new' ? t('admin.settings.promoCreate') : t('admin.settings.promoEdit')}
                </p>
                <h3 className="mt-1 font-display text-xl text-ink truncate" title={form.name || undefined}>
                  {form.name || t('admin.settings.promoName')}
                </h3>
              </div>
              <button
                type="button"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-borderColor text-muted"
                onClick={() => !saving && setEditing(null)}
                aria-label={t('admin.settings.cancel')}
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('admin.settings.promoName')}>
                  <input className={settingsUi.input} value={form.name} onChange={(e) => set('name', e.target.value)} required />
                </Field>
                <Field label={t('admin.settings.promoOccasion')}>
                  <select className={settingsUi.select} value={form.occasion} onChange={(e) => set('occasion', e.target.value)}>
                    {OCCASIONS.map((o) => (
                      <option key={o} value={o}>{t(`admin.settings.promoOccasionLabel.${o}`)}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t('admin.settings.promoCode')} hint={t('admin.settings.promoCodeHint')}>
                  <input className={`${settingsUi.input} uppercase`} value={form.code}
                    onChange={(e) => set('code', e.target.value.toUpperCase())} />
                </Field>
                <Field label={t('admin.settings.promoPriority')} hint={t('admin.settings.promoPriorityHint')}>
                  <input type="number" className={settingsUi.input} value={form.priority}
                    onChange={(e) => set('priority', e.target.value)} />
                </Field>
                <Field label={t('admin.settings.discountType')}>
                  <select className={settingsUi.select} value={form.discountType}
                    onChange={(e) => set('discountType', e.target.value)}>
                    <option value="percentage">{t('admin.settings.discountPercentage')}</option>
                    <option value="fixed">{t('admin.settings.discountFixed')}</option>
                  </select>
                </Field>
                <Field label={t('admin.settings.discountValue')} hint={t('admin.settings.discountValueHint')}>
                  <input type="number" min={0} step="0.01" className={settingsUi.input}
                    value={form.discountValue} onChange={(e) => set('discountValue', e.target.value)} />
                </Field>
                <Field label={t('admin.settings.startAt')} className="min-w-0">
                  <input
                    type="datetime-local"
                    className={`${settingsUi.input} [color-scheme:light]`}
                    value={form.startAt}
                    onChange={(e) => set('startAt', e.target.value)}
                    required
                  />
                </Field>
                <Field label={t('admin.settings.endAt')} className="min-w-0">
                  <input
                    type="datetime-local"
                    className={`${settingsUi.input} [color-scheme:light]`}
                    value={form.endAt}
                    onChange={(e) => set('endAt', e.target.value)}
                    required
                  />
                </Field>
                <Field label={t('admin.settings.minRentalDays')}>
                  <input type="number" min={1} className={settingsUi.input} value={form.minRentalDays}
                    onChange={(e) => set('minRentalDays', e.target.value)} />
                </Field>
                <Field label={t('admin.settings.promoMaxRentalDays')} hint={t('admin.settings.zeroUnlimited')}>
                  <input type="number" min={0} className={settingsUi.input} value={form.maxRentalDays}
                    onChange={(e) => set('maxRentalDays', e.target.value)} />
                </Field>
                <Field label={t('admin.settings.minBookingAmount')}>
                  <input type="number" min={0} className={settingsUi.input} value={form.minBookingAmount}
                    onChange={(e) => set('minBookingAmount', e.target.value)} />
                </Field>
                <Field label={t('admin.settings.maxDiscountAmount')} hint={t('admin.settings.zeroUnlimited')}>
                  <input type="number" min={0} className={settingsUi.input} value={form.maxDiscountAmount}
                    onChange={(e) => set('maxDiscountAmount', e.target.value)} />
                </Field>
                <Field label={t('admin.settings.globalUsageLimit')} hint={t('admin.settings.zeroUnlimited')}>
                  <input type="number" min={0} className={settingsUi.input} value={form.globalUsageLimit}
                    onChange={(e) => set('globalUsageLimit', e.target.value)} />
                </Field>
                <Field label={t('admin.settings.perCustomerLimit')} hint={t('admin.settings.zeroUnlimited')}>
                  <input type="number" min={0} className={settingsUi.input} value={form.perCustomerUsageLimit}
                    onChange={(e) => set('perCustomerUsageLimit', e.target.value)} />
                </Field>
              </div>

              <Field label={t('admin.settings.promoDescription')}>
                <textarea rows={2} className={settingsUi.textarea} value={form.description}
                  onChange={(e) => set('description', e.target.value)} />
              </Field>

              <Field label={t('admin.settings.vehicleCategories')} hint={t('admin.settings.vehicleCategoriesHint')}>
                <div className="flex flex-wrap gap-2">
                  {VEHICLE_CATEGORIES.map((cat) => {
                    const checked = form.vehicleCategories.includes(cat)
                    return (
                      <label
                        key={cat}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-medium ${
                          checked ? 'border-primary/40 bg-primary/5 text-primary' : 'border-borderColor bg-white text-ink/70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={checked}
                          onChange={() => {
                            set(
                              'vehicleCategories',
                              checked
                                ? form.vehicleCategories.filter((c) => c !== cat)
                                : [...form.vehicleCategories, cat],
                            )
                          }}
                        />
                        {cat}
                      </label>
                    )
                  })}
                </div>
              </Field>

              <Field label={t('admin.settings.vehicleModels')} hint={t('admin.settings.vehicleModelsHint')}>
                <input className={settingsUi.input} value={form.vehicleModels}
                  onChange={(e) => set('vehicleModels', e.target.value)} />
              </Field>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  ['isActive', t('admin.settings.promoActive')],
                  ['requirePromoCode', t('admin.settings.requirePromoCode')],
                  ['allowStacking', t('admin.settings.allowStacking')],
                ].map(([key, label]) => (
                  <label key={key} className="flex min-h-12 items-center gap-3 rounded-2xl border border-borderColor/70 bg-light/40 px-3.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={Boolean(form[key])}
                      onChange={(e) => set(key, e.target.checked)}
                    />
                    <span className="font-medium leading-snug">{label}</span>
                  </label>
                ))}
              </div>

              <div className="rounded-2xl border border-borderColor/70 bg-sand/40 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={runPreview} className={settingsUi.btnGhost}>
                    {t('admin.settings.pricingPreview')}
                  </button>
                  {preview && (
                    <p className="text-sm font-medium text-ink">
                      <span className="text-muted line-through">{currency}{preview.originalPrice}</span>
                      <span className="mx-1.5">→</span>
                      <span className="text-primary">−{preview.discountAmount}</span>
                      <span className="mx-1.5">→</span>
                      <span>{currency}{preview.finalPrice}</span>
                    </p>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-muted">{t('admin.settings.pricingPreviewHint')}</p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-borderColor/70 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-6 booking-safe-bottom">
              <button type="button" disabled={saving} className={`${settingsUi.btnSecondary} w-full sm:w-auto`} onClick={() => setEditing(null)}>
                {t('admin.settings.cancel')}
              </button>
              <button type="submit" disabled={saving} className={`${settingsUi.btnPrimary} w-full sm:w-auto`}>
                {saving ? t('admin.settings.saving') : t('admin.settings.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title={t('admin.settings.delete')}
        message={t('admin.settings.promoDeleteConfirm', { name: pendingDelete?.name || '' })}
        confirmText={t('admin.settings.delete')}
        cancelText={t('admin.settings.cancel')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

export default PromotionsPanel
