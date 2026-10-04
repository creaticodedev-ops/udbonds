import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { saError, useSuperAdmin } from '../../context/SuperAdminContext'
import { useSaTheme } from './SaThemeContext'
import { SaBadge, SaCard, SaError, SaPageHeader, SaSkeleton, sa } from './saUi'

const Row = ({ label, value, ok }) => (
  <div className="flex items-start justify-between gap-4 border-b border-[var(--sa-border)] py-3 last:border-0">
    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sa-text-muted)]">{label}</dt>
    <dd className="text-right text-sm text-[var(--sa-text)]">
      {ok != null ? <SaBadge tone={ok ? 'success' : 'warn'}>{ok ? 'Configured' : 'Not configured'}</SaBadge> : null}
      {value ? <p className="mt-1 break-all font-mono text-xs text-[var(--sa-text-secondary)]">{value}</p> : null}
    </dd>
  </div>
)

const SuperAdminSettings = () => {
  const { axios } = useSuperAdmin()
  const { theme, toggleTheme } = useSaTheme()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.get('/api/super-admin/settings')
      if (!data.success) throw new Error(data.message)
      setSettings(data.settings)
    } catch (err) {
      setError(saError(err, 'Unable to load settings'))
    } finally {
      setLoading(false)
    }
  }, [axios])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className={sa.page}>
      <SaPageHeader
        title="Settings"
        subtitle="Read-only platform configuration from the server environment. Appearance is stored on this device."
      />
      {error ? <SaError title="Unable to load settings" description={error} onRetry={load} /> : null}
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SaSkeleton className="h-48" />
          <SaSkeleton className="h-48" />
        </div>
      ) : settings ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SaCard title="Platform">
            <dl>
              <Row label="Name" value={settings.platform?.name} />
              <Row label="Client URL" value={settings.platform?.clientUrl || 'Not set'} ok={Boolean(settings.platform?.clientUrl)} />
              <Row label="Base domain" value={settings.platform?.baseDomain || 'Not set'} />
            </dl>
          </SaCard>
          <SaCard title="Email">
            <dl>
              <Row label="SMTP" ok={settings.email?.configured} value={settings.email?.host || ''} />
              <Row label="Verified" ok={settings.email?.verified} />
              <Row label="From" value={settings.email?.from || ''} />
            </dl>
          </SaCard>
          <SaCard title="Notifications">
            <dl>
              <Row label="Platform inbox" ok={settings.notifications?.inbox} />
              <Row label="WhatsApp API" ok={settings.notifications?.whatsappApi} value="wa.me links only" />
            </dl>
          </SaCard>
          <SaCard title="Security">
            <dl>
              <Row label="JWT" ok={settings.security?.jwtConfigured} />
              <Row label="Login" value={settings.security?.superAdminLogin} />
            </dl>
          </SaCard>
          <SaCard title="Appearance">
            <p className="text-sm text-[var(--sa-text-secondary)]">Theme is local to this browser.</p>
            <button type="button" className={`${sa.btnSecondary} mt-3`} onClick={toggleTheme}>
              Use {theme === 'dark' ? 'light' : 'dark'} mode
            </button>
          </SaCard>
          <SaCard title="Access" description="Owner permission matrix for agency workspaces.">
            <Link to="/superadmin/permissions" className={sa.btnSecondary}>
              Open access controls
            </Link>
          </SaCard>
        </div>
      ) : null}
    </div>
  )
}

export default SuperAdminSettings
