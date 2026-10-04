import React, { useEffect, useMemo, useState } from 'react'
import Title from '../../components/owner/Title'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../utils/apiError'
import BookingSettingsPanel from './settings/BookingSettingsPanel'
import PromotionsPanel from './settings/PromotionsPanel'
import WhatsAppSettingsPanel from './settings/WhatsAppSettingsPanel'
import GeneralSettingsPanel from './settings/GeneralSettingsPanel'
import BrandingSettingsPanel from './settings/BrandingSettingsPanel'
import DomainSettingsPanel from './settings/DomainSettingsPanel'
import BillingSettingsPanel from './settings/BillingSettingsPanel'
import StaffSettingsPanel from './settings/StaffSettingsPanel'
import ComingSoonPanel from './settings/ComingSoonPanel'
import { LoadingBlock, settingsUi } from './settings/settingsUi'

const emptyWhatsApp = {
  whatsappReservationNumber: '',
  whatsappConfirmationNumber: '',
}

const Settings = () => {
  const { axios, currency, user } = useAppContext()
  const { t } = useI18n()
  const [tab, setTab] = useState('booking')
  const [form, setForm] = useState(emptyWhatsApp)
  const [effective, setEffective] = useState({ reservationDial: '', confirmationDial: '' })
  const [bookingSettings, setBookingSettings] = useState(null)
  const [agency, setAgency] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isOwnerUser = user?.role === 'owner'

  const tabs = useMemo(() => {
    const all = [
      { id: 'booking', label: t('admin.settings.tabBooking'), blurb: t('admin.settings.navBookingBlurb') },
      { id: 'promotions', label: t('admin.settings.tabPromotions'), blurb: t('admin.settings.navPromotionsBlurb') },
      { id: 'whatsapp', label: t('admin.settings.tabWhatsApp'), blurb: t('admin.settings.navWhatsAppBlurb') },
      { id: 'branding', label: t('admin.settings.tabBranding') || 'Branding', blurb: t('admin.settings.navBrandingBlurb') || 'Logo, colors, SEO, contracts', ownerOnly: true },
      { id: 'domains', label: t('admin.settings.tabDomains') || 'Domains', blurb: t('admin.settings.navDomainsBlurb') || 'Subdomain & custom domain', ownerOnly: true },
      { id: 'billing', label: t('admin.settings.tabBilling') || 'Billing', blurb: t('admin.settings.navBillingBlurb') || 'Plan, trial & usage', ownerOnly: true },
      { id: 'staff', label: t('admin.settings.tabStaff') || 'Staff', blurb: t('admin.settings.navStaffBlurb') || 'Invite team & roles', ownerOnly: true },
      { id: 'general', label: t('admin.settings.tabGeneral'), blurb: t('admin.settings.navGeneralBlurb') },
      { id: 'future', label: t('admin.settings.tabFuture'), blurb: t('admin.settings.navFutureBlurb') },
    ]
    return all.filter((item) => !item.ownerOnly || isOwnerUser)
  }, [t, isOwnerUser])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [settingsRes, agencyRes] = await Promise.all([
        axios.get('/api/owner/settings'),
        axios.get('/api/owner/agency'),
      ])
      const data = settingsRes.data
      if (!data.success) {
        const msg = data.message || t('admin.settings.loadError')
        setError(msg)
        toast.error(msg)
        return
      }
      const s = data.settings || {}
      setForm({
        whatsappReservationNumber: s.whatsappReservationNumber || '',
        whatsappConfirmationNumber: s.whatsappConfirmationNumber || '',
      })
      setEffective({
        reservationDial: s.effective?.reservationDial || '',
        confirmationDial: s.effective?.confirmationDial || '',
      })
      setBookingSettings(s.bookingSettings || null)
      if (agencyRes.data?.success) setAgency(agencyRes.data.agency)
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [axios])

  return (
    <div className="px-4 pt-8 md:px-8 lg:px-10 xl:px-12 md:pt-10 flex-1 pb-16 min-w-0 overflow-x-clip">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-borderColor/60 bg-gradient-to-br from-white via-white to-sand/50 px-5 py-6 sm:px-7 sm:py-7 shadow-[0_24px_60px_-42px_rgba(22,18,16,0.4)]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/5 blur-2xl" aria-hidden />
        <Title title={t('admin.settings.title')} subTitle={t('admin.settings.subtitle')} />
        <p className="mt-3 max-w-2xl text-sm text-muted leading-relaxed">
          {t('admin.settings.heroHint')}
        </p>
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[16.5rem_minmax(0,1fr)]">
        {/* Mobile tab rail */}
        <div className="lg:hidden overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max max-w-none gap-2">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition ${
                  tab === item.id
                    ? 'border-primary bg-primary text-white'
                    : 'border-borderColor bg-white text-ink/70'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop side nav */}
        <aside className={`hidden lg:block ${settingsUi.shell} p-3 h-fit sticky top-20`}>
          <p className={`${settingsUi.sectionLabel} px-3 pt-2 pb-3`}>{t('admin.settings.navLabel')}</p>
          <nav className="space-y-1">
            {tabs.map((item) => {
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`w-full rounded-2xl px-3.5 py-3 text-left transition ${
                    active
                      ? 'bg-primary text-white shadow-[0_12px_28px_-18px_rgba(165, 22, 36,0.7)]'
                      : 'text-ink/75 hover:bg-sand/70'
                  }`}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className={`mt-0.5 block text-[11px] leading-snug ${active ? 'text-white/80' : 'text-muted'}`}>
                    {item.blurb}
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="mt-4 lg:mt-0 min-w-0">
          {loading ? (
            <LoadingBlock label={t('admin.settings.loading')} />
          ) : error && !bookingSettings ? (
            <div className={`${settingsUi.card} p-6 text-center`}>
              <p className="font-display text-xl text-ink">{t('admin.settings.loadError')}</p>
              <p className="mt-2 text-sm text-muted">{error}</p>
              <button type="button" onClick={load} className={`${settingsUi.btnPrimary} mt-5`}>
                {t('admin.settings.reload')}
              </button>
            </div>
          ) : (
            <>
              {tab === 'booking' && (
                <BookingSettingsPanel
                  axios={axios}
                  initial={bookingSettings}
                  t={t}
                  onSaved={(saved) => setBookingSettings(saved)}
                />
              )}
              {tab === 'promotions' && (
                <PromotionsPanel axios={axios} t={t} currency={currency || 'MAD '} />
              )}
              {tab === 'whatsapp' && (
                <WhatsAppSettingsPanel
                  axios={axios}
                  form={form}
                  setForm={setForm}
                  effective={effective}
                  onReload={load}
                  t={t}
                />
              )}
              {tab === 'branding' && isOwnerUser && (
                <BrandingSettingsPanel
                  agency={agency}
                  axios={axios}
                  t={t}
                  onSaved={(saved) => setAgency(saved)}
                />
              )}
              {tab === 'domains' && isOwnerUser && (
                <DomainSettingsPanel
                  agency={agency}
                  axios={axios}
                  t={t}
                  onSaved={(saved) => setAgency(saved)}
                />
              )}
              {tab === 'billing' && isOwnerUser && <BillingSettingsPanel axios={axios} t={t} />}
              {tab === 'staff' && isOwnerUser && <StaffSettingsPanel axios={axios} t={t} />}
              {tab === 'general' && (
                <GeneralSettingsPanel
                  bookingSettings={bookingSettings}
                  effective={effective}
                  agency={agency}
                  t={t}
                  onNavigate={setTab}
                />
              )}
              {tab === 'future' && <ComingSoonPanel t={t} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings
