import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { SettingsCard, settingsUi } from './settingsUi'
import { getErrorMessage } from '../../../utils/apiError'

const emptyForm = (agency) => ({
  name: agency?.name || '',
  logoUrl: agency?.logoUrl || '',
  faviconUrl: agency?.faviconUrl || '',
  phone: agency?.phone || '',
  whatsapp: agency?.whatsapp || '',
  email: agency?.email || '',
  address: agency?.address || '',
  city: agency?.city || '',
  country: agency?.country || '',
  primaryBrandColor: agency?.primaryBrandColor || '',
  secondaryBrandColor: agency?.secondaryBrandColor || '',
  seoTitle: agency?.seo?.title || '',
  seoDescription: agency?.seo?.description || '',
  seoOgImageUrl: agency?.seo?.ogImageUrl || '',
  heroHeadline: agency?.hero?.headline || '',
  heroSubheadline: agency?.hero?.subheadline || '',
  heroBadgeText: agency?.hero?.badgeText || '',
  instagram: agency?.socials?.instagram || '',
  contractCompanyName: agency?.contractBranding?.companyName || agency?.name || '',
  contractLogoUrl: agency?.contractBranding?.logoUrl || agency?.logoUrl || '',
  showLogoOnPdf: agency?.contractBranding?.showLogoOnPdf !== false,
  contractFooterNote: agency?.contractBranding?.footerNote || '',
})

const Field = ({ label, children }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
    {children}
  </label>
)

const inputClass =
  'w-full rounded-xl border border-borderColor bg-white px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary/25'

const BrandingSettingsPanel = ({ agency, axios, t, onSaved }) => {
  const [form, setForm] = useState(() => emptyForm(agency))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(emptyForm(agency))
  }, [agency])

  const set = (key) => (e) => {
    const value = e?.target?.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await axios.put('/api/owner/agency/branding', {
        name: form.name,
        logoUrl: form.logoUrl,
        faviconUrl: form.faviconUrl,
        phone: form.phone,
        whatsapp: form.whatsapp,
        email: form.email,
        address: form.address,
        city: form.city,
        country: form.country,
        primaryBrandColor: form.primaryBrandColor,
        secondaryBrandColor: form.secondaryBrandColor,
        socials: { instagram: form.instagram },
        seo: {
          title: form.seoTitle,
          description: form.seoDescription,
          ogImageUrl: form.seoOgImageUrl,
        },
        hero: {
          headline: form.heroHeadline,
          subheadline: form.heroSubheadline,
          badgeText: form.heroBadgeText,
        },
        contractBranding: {
          companyName: form.contractCompanyName || form.name,
          logoUrl: form.contractLogoUrl || form.logoUrl,
          showLogoOnPdf: form.showLogoOnPdf,
          footerNote: form.contractFooterNote,
        },
      })
      if (!data.success) {
        toast.error(data.message || t('admin.settings.saveError'))
        return
      }
      toast.success(t('admin.settings.brandingSaved') || 'Branding saved')
      onSaved?.(data.agency)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <SettingsCard
        soft
        eyebrow={t('admin.settings.tabBranding') || 'Branding'}
        title={t('admin.settings.brandingTitle') || 'Agency branding'}
        description={
          t('admin.settings.brandingHint') ||
          'Controls your public storefront, PDFs, emails, and WhatsApp identity. Missing fields stay neutral — we never borrow another agency’s brand.'
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('admin.settings.generalAgency') || 'Agency name'}>
            <input className={inputClass} value={form.name} onChange={set('name')} required />
          </Field>
          <Field label="Primary color">
            <input className={inputClass} value={form.primaryBrandColor} onChange={set('primaryBrandColor')} placeholder="#1F4B99" />
          </Field>
          <Field label="Logo URL">
            <input className={inputClass} value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://…" />
          </Field>
          <Field label="Favicon URL">
            <input className={inputClass} value={form.faviconUrl} onChange={set('faviconUrl')} placeholder="https://…" />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="WhatsApp">
            <input className={inputClass} value={form.whatsapp} onChange={set('whatsapp')} />
          </Field>
          <Field label="Email">
            <input className={inputClass} type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Instagram URL">
            <input className={inputClass} value={form.instagram} onChange={set('instagram')} />
          </Field>
          <Field label="Address">
            <input className={inputClass} value={form.address} onChange={set('address')} />
          </Field>
          <Field label="City">
            <input className={inputClass} value={form.city} onChange={set('city')} />
          </Field>
          <Field label="Country">
            <input className={inputClass} value={form.country} onChange={set('country')} />
          </Field>
          <Field label="Secondary color">
            <input className={inputClass} value={form.secondaryBrandColor} onChange={set('secondaryBrandColor')} />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard title="SEO & hero" description="Title, description, and homepage copy for your storefront.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SEO title">
            <input className={inputClass} value={form.seoTitle} onChange={set('seoTitle')} />
          </Field>
          <Field label="OG image URL">
            <input className={inputClass} value={form.seoOgImageUrl} onChange={set('seoOgImageUrl')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="SEO description">
              <textarea className={inputClass} rows={2} value={form.seoDescription} onChange={set('seoDescription')} />
            </Field>
          </div>
          <Field label="Hero headline">
            <input className={inputClass} value={form.heroHeadline} onChange={set('heroHeadline')} />
          </Field>
          <Field label="Hero badge">
            <input className={inputClass} value={form.heroBadgeText} onChange={set('heroBadgeText')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Hero subheadline">
              <input className={inputClass} value={form.heroSubheadline} onChange={set('heroSubheadline')} />
            </Field>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Contracts / PDFs" description="Shown on rental agreements and invoices.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name on PDF">
            <input className={inputClass} value={form.contractCompanyName} onChange={set('contractCompanyName')} />
          </Field>
          <Field label="PDF logo URL">
            <input className={inputClass} value={form.contractLogoUrl} onChange={set('contractLogoUrl')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Footer note">
              <input className={inputClass} value={form.contractFooterNote} onChange={set('contractFooterNote')} />
            </Field>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.showLogoOnPdf} onChange={set('showLogoOnPdf')} />
            Show logo on PDF
          </label>
        </div>
      </SettingsCard>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className={`${settingsUi.primaryBtn || 'px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold'} disabled:opacity-60`}
        >
          {saving ? 'Saving…' : (t('admin.settings.save') || 'Save branding')}
        </button>
      </div>
    </form>
  )
}

export default BrandingSettingsPanel
