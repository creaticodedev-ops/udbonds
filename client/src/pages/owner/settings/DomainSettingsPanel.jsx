import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { SettingsCard, settingsUi } from './settingsUi'
import { getErrorMessage } from '../../../utils/apiError'

const DomainSettingsPanel = ({ agency, axios, t, onSaved }) => {
  const [domains, setDomains] = useState(agency?.domains || null)
  const [customDomain, setCustomDomain] = useState(agency?.domains?.customDomain || '')
  const [subdomainEnabled, setSubdomainEnabled] = useState(
    agency?.domains?.subdomainEnabled !== false,
  )
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    setDomains(agency?.domains || null)
    setCustomDomain(agency?.domains?.customDomain || '')
    setSubdomainEnabled(agency?.domains?.subdomainEnabled !== false)
  }, [agency])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await axios.put('/api/owner/agency/domains', {
        customDomain: customDomain.trim(),
        subdomainEnabled,
      })
      if (!data.success) {
        toast.error(data.message || 'Failed to save domain')
        return
      }
      setDomains(data.domains)
      onSaved?.(data.agency)
      toast.success('Domain settings saved')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const clearDomain = async () => {
    setSaving(true)
    try {
      const { data } = await axios.put('/api/owner/agency/domains', { clear: true })
      if (!data.success) {
        toast.error(data.message || 'Failed to clear domain')
        return
      }
      setDomains(data.domains)
      setCustomDomain('')
      onSaved?.(data.agency)
      toast.success('Custom domain removed')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const verify = async () => {
    setVerifying(true)
    try {
      const { data } = await axios.post('/api/owner/agency/domains/verify')
      if (!data.success) {
        toast.error(data.message || 'Verification failed')
        return
      }
      setDomains(data.domains)
      onSaved?.(data.agency)
      toast.success('Domain verified')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setVerifying(false)
    }
  }

  const status = domains?.customDomainStatus || 'none'
  const inputClass =
    'w-full rounded-xl border border-borderColor bg-white px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary/25'

  return (
    <form onSubmit={save} className="space-y-5">
      <SettingsCard
        soft
        eyebrow="Domains"
        title="Public website domains"
        description="Use a platform subdomain, a custom domain, or keep the /s/slug URL. All three stay isolated per agency."
      >
        <div className="space-y-4 text-sm">
          {domains?.slugStorefrontUrl ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Slug URL (always works)</p>
              <p className="mt-1 break-all text-ink">{domains.slugStorefrontUrl}</p>
            </div>
          ) : null}
          {domains?.subdomainUrl ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Platform subdomain
                {domains.platformBaseDomain ? ` (*.${domains.platformBaseDomain})` : ''}
              </p>
              <p className="mt-1 break-all text-ink">{domains.subdomainUrl}</p>
              <label className="mt-2 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={subdomainEnabled}
                  onChange={(e) => setSubdomainEnabled(e.target.checked)}
                />
                Enable subdomain storefront
              </label>
            </div>
          ) : (
            <p className="text-muted">
              Platform subdomain is unavailable until PLATFORM_BASE_DOMAIN is configured on the server.
            </p>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Custom domain"
        description="Point your domain at the platform, add the TXT verify record, then verify."
      >
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Hostname</span>
            <input
              className={inputClass}
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="rentals.youragency.com"
            />
          </label>
          <p className="text-xs text-muted">Status: <strong>{status}</strong></p>
          {domains?.verifyTxtName && domains?.verifyTxtValue ? (
            <div className="rounded-xl border border-borderColor bg-sand/40 p-3 text-xs space-y-1">
              <p className="font-semibold text-ink">DNS TXT record</p>
              <p className="break-all">Host: {domains.verifyTxtName}</p>
              <p className="break-all">Value: {domains.verifyTxtValue}</p>
              {domains.dnsInstructions?.cname ? (
                <p className="pt-2 text-muted">{domains.dnsInstructions.cname.note}</p>
              ) : null}
            </div>
          ) : null}
          {domains?.customDomainUrl ? (
            <p className="text-sm break-all text-ink">Live: {domains.customDomainUrl}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={verifying || status === 'none'}
              onClick={verify}
              className="px-4 py-2 rounded-xl border border-borderColor text-sm disabled:opacity-50"
            >
              {verifying ? 'Verifying…' : 'Verify DNS'}
            </button>
            {status !== 'none' ? (
              <button
                type="button"
                disabled={saving}
                onClick={clearDomain}
                className="px-4 py-2 rounded-xl border border-borderColor text-sm text-red-700 disabled:opacity-50"
              >
                Remove domain
              </button>
            ) : null}
          </div>
        </div>
      </SettingsCard>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className={`${settingsUi.btnPrimary || 'px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold'} disabled:opacity-60`}
        >
          {saving ? 'Saving…' : (t('admin.settings.save') || 'Save')}
        </button>
      </div>
    </form>
  )
}

export default DomainSettingsPanel
