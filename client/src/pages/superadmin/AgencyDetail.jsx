import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSuperAdmin, saError } from '../../context/SuperAdminContext'
import { AgencyBillingPanel, AgencyDomainsPanel, AgencyStaffPanel } from './agencyDetailPanels'
import {
  SaAvatar,
  SaBadge,
  SaCard,
  SaEmpty,
  SaError,
  SaField,
  SaPageHeader,
  SaSkeleton,
  SaStat,
  SaTabs,
  confirmDestructive,
  copyToClipboard,
  formatRelativeTime,
  sa,
  statusBadgeTone,
} from './saUi'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'usage', label: 'Usage' },
  { id: 'billing', label: 'Billing' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'activity', label: 'Activity' },
  { id: 'settings', label: 'Settings' },
]

const SuperAdminAgencyDetail = () => {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') || 'overview'
  const tab =
    rawTab === 'staff'
      ? 'users'
      : ['general', 'branding', 'domains'].includes(rawTab)
        ? 'settings'
        : rawTab
  const { axios } = useSuperAdmin()
  const [agency, setAgency] = useState(null)
  const [stats, setStats] = useState(null)
  const [recentCars, setRecentCars] = useState([])
  const [recentBookings, setRecentBookings] = useState([])
  const [audit, setAudit] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState({
    name: '',
    slug: '',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    country: '',
    logoUrl: '',
    timezone: '',
    currency: '',
    locale: '',
    isPublicStorefront: false,
  })
  const [branding, setBranding] = useState({
    logoUrl: '',
    faviconUrl: '',
    primaryBrandColor: '',
    secondaryBrandColor: '',
  })
  const [busy, setBusy] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')

  const setTab = (next) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set('tab', next)
      return p
    })
  }

  const applyAgency = (data) => {
    setAgency(data.agency)
    setStats(data.stats)
    setRecentCars(data.recentCars || [])
    setRecentBookings(data.recentBookings || [])
    setEdit({
      name: data.agency.name || '',
      slug: data.agency.slug || '',
      phone: data.agency.phone || '',
      whatsapp: data.agency.whatsapp || '',
      address: data.agency.address || '',
      city: data.agency.city || '',
      country: data.agency.country || '',
      logoUrl: data.agency.logoUrl || '',
      timezone: data.agency.timezone || '',
      currency: data.agency.currency || '',
      locale: data.agency.locale || '',
      isPublicStorefront: Boolean(data.agency.isPublicStorefront),
    })
    setBranding({
      logoUrl: data.agency.logoUrl || '',
      faviconUrl: data.agency.faviconUrl || '',
      primaryBrandColor: data.agency.primaryBrandColor || '',
      secondaryBrandColor: data.agency.secondaryBrandColor || '',
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.get(`/api/super-admin/agencies/${id}`)
      if (data.success) applyAgency(data)
      else throw new Error(data.message || 'Unable to load agency')
      const auditRes = await axios.get('/api/super-admin/audit-logs', { params: { agencyId: id, limit: 20 } }).catch(() => null)
      if (auditRes?.data?.success) setAudit(auditRes.data.logs || [])
    } catch (err) {
      setError(saError(err))
      toast.error(saError(err))
    } finally {
      setLoading(false)
    }
  }, [axios, id])

  useEffect(() => {
    load()
  }, [load])

  const run = async (key, fn) => {
    setBusy(key)
    try {
      await fn()
    } catch (error) {
      toast.error(saError(error))
    } finally {
      setBusy('')
    }
  }

  const owner = agency?.primaryOwner
  const needsInvite = useMemo(() => {
    if (!agency) return false
    return (
      agency.status === 'pending' ||
      owner?.accountStatus === 'pending' ||
      Boolean(agency.invitePending)
    )
  }, [agency, owner])

  if (loading && !agency) {
    return (
      <div className={sa.page}>
        <SaSkeleton className="h-8 w-48" />
        <SaSkeleton className="h-12 w-72 mt-4" />
        <div className="grid sm:grid-cols-3 gap-3 mt-6">
          <SaSkeleton className="h-24" />
          <SaSkeleton className="h-24" />
          <SaSkeleton className="h-24" />
        </div>
      </div>
    )
  }

  if (error && !agency) {
    return (
      <div className={sa.page}>
        <SaPageHeader title="Agency" />
        <SaError title="Unable to load this agency" description={error} onRetry={load} />
        <Link to="/superadmin/agencies" className={sa.btnSecondary}>
          Back to agencies
        </Link>
      </div>
    )
  }

  if (!agency) return null

  const copyInviteLink = async () => {
    const result = await copyToClipboard(inviteUrl, 'Link copied')
    toast[result.ok ? 'success' : 'error'](result.message)
  }

  const copyId = async (value, label) => {
    const result = await copyToClipboard(value, `${label} copied`)
    toast[result.ok ? 'success' : 'error'](result.message)
  }

  return (
    <div className={sa.page}>
      <SaPageHeader
        breadcrumb={
          <Link to="/superadmin/agencies" className={`${sa.btnGhost} -ml-2`}>
            ← All agencies
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <SaAvatar name={agency.name} src={agency.logoUrl} size={44} />
            <span>{agency.name}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono">{agency.slug}</span>
            {agency.createdAt ? <span>· Created {new Date(agency.createdAt).toLocaleDateString()}</span> : null}
            {agency.approvedAt ? <span>· Approved {new Date(agency.approvedAt).toLocaleDateString()}</span> : null}
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <SaBadge tone={statusBadgeTone(agency.status)}>{agency.status}</SaBadge>
            {agency.isPublicStorefront ? <SaBadge tone="info">Public storefront</SaBadge> : null}
          </div>
        }
      />

      <SaTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="space-y-6 pt-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SaStat label="Cars" value={stats?.cars ?? 0} />
            <SaStat label="Bookings" value={stats?.bookings ?? 0} />
            <SaStat label="Customers" value={stats?.customers ?? 0} />
            <SaStat
              label="Storefront"
              value={agency.isPublicStorefront ? 'Public' : 'Private'}
              hint={agency.slug ? `/s/${agency.slug}` : undefined}
            />
          </div>

          {agency.status === 'pending' || agency.status === 'rejected' ? (
            <SaCard
              title="Approval Center"
              description="Self-serve registrations are activated here. Invite-only agencies still need a password before approval."
              action={
                <Link to="/superadmin/requests" className={sa.link}>
                  Open requests →
                </Link>
              }
            >
              <p className="text-sm text-[var(--sa-text-secondary)] mb-3">
                Dashboard URL:{' '}
                <span className="font-mono text-xs">{agency.dashboardUrl || agency.access?.dashboardUrl || '—'}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to="/superadmin/requests" className={sa.btnPrimary}>
                  Review in Approval Center
                </Link>
              </div>
            </SaCard>
          ) : null}

          {needsInvite ? (
            <SaCard
              title="Owner onboarding"
              description="Agency and owner are pending until activation is complete."
            >
              {agency.inviteExpiresAt ? (
                <p className="text-xs text-[var(--sa-text-muted)] mb-3">
                  Current invite expires {new Date(agency.inviteExpiresAt).toLocaleString()}.
                </p>
              ) : null}
              {inviteUrl ? (
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <input readOnly value={inviteUrl} className={`${sa.input} font-mono text-xs`} />
                  <button type="button" onClick={copyInviteLink} className={sa.btnSecondary}>
                    Copy link
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                disabled={busy === 'invite' || agency.status === 'suspended' || agency.status === 'disabled'}
                onClick={() =>
                  run('invite', async () => {
                    const { data } = await axios.post(`/api/super-admin/agencies/${id}/resend-invite`)
                    if (!data.success) throw new Error(data.message || 'Failed')
                    setInviteUrl(data.onboardingUrl || '')
                    toast.success('Onboarding link generated')
                    await load()
                  })
                }
                className={sa.btnPrimary}
              >
                {busy === 'invite' ? 'Generating…' : inviteUrl ? 'Regenerate invite' : 'Generate invite link'}
              </button>
            </SaCard>
          ) : null}

          <SaCard title="Primary owner">
            {owner ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--sa-text)]">{owner.name}</p>
                  <p className="text-sm text-[var(--sa-text-muted)]">{owner.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <SaBadge tone={statusBadgeTone(owner.accountStatus)}>{owner.accountStatus || 'active'}</SaBadge>
                    {owner.licenseStatus ? (
                      <SaBadge tone={statusBadgeTone(owner.licenseStatus)}>{owner.licenseStatus}</SaBadge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-[var(--sa-text-muted)]">
                    {owner.passwordSetAt ? 'Password set' : 'Awaiting password'}
                  </p>
                </div>
                {owner._id ? (
                  <Link to={`/superadmin/admins/${owner._id}`} className={sa.btnSecondary}>
                    Open owner profile →
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-[var(--sa-text-muted)]">No primary owner linked.</p>
            )}
          </SaCard>

          <SaCard title="Agency status" description="Suspend locks login. Disable is a stronger lock. Neither deletes data. Rejected is not the same as suspended.">
            <div className="flex flex-wrap gap-2">
              {agency.status === 'pending' ? (
                <Link to="/superadmin/requests" className={sa.btnPrimary}>
                  Review request
                </Link>
              ) : null}
              {['active', 'suspended', 'disabled'].map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={busy === `status-${status}` || agency.status === status}
                  onClick={() => {
                    const label =
                      status === 'suspended'
                        ? 'Suspend this agency? The owner will lose dashboard access. Data is kept.'
                        : status === 'disabled'
                          ? 'Disable this agency? This is not a delete. Data is kept.'
                          : 'Reactivate this agency?'
                    if (status !== 'active' && !confirmDestructive(label)) return
                    if (status === 'active' && agency.status !== 'active' && !confirmDestructive(label)) return
                    run(`status-${status}`, async () => {
                      const { data } = await axios.patch(`/api/super-admin/agencies/${id}/status`, { status })
                      if (!data.success) throw new Error(data.message || 'Status update failed')
                      toast.success(`Agency ${status}`)
                      await load()
                    })
                  }}
                  className={
                    agency.status === status
                      ? `${sa.btnPrimary} capitalize`
                      : status === 'suspended' || status === 'disabled'
                        ? `${sa.btnDanger} capitalize`
                        : `${sa.btnSecondary} capitalize`
                  }
                >
                  {status === 'active' ? 'Reactivate' : status}
                </button>
              ))}
            </div>
          </SaCard>

          <SaCard title="Identifiers">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-[var(--sa-text-muted)]">Contact</dt>
                <dd className="mt-1 text-[var(--sa-text-secondary)]">{agency.email || owner?.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-[var(--sa-text-muted)]">Phone</dt>
                <dd className="mt-1 text-[var(--sa-text-secondary)]">{agency.phone || agency.whatsapp || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-[var(--sa-text-muted)]">Tenant / storefront</dt>
                <dd className="mt-1 font-mono text-xs text-[var(--sa-text-secondary)]">
                  {agency.access?.storefrontUrl || (agency.slug ? `/s/${agency.slug}` : '—')}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-[var(--sa-text-muted)]">Owner dashboard</dt>
                <dd className="mt-1 flex items-center gap-2 font-mono text-xs text-[var(--sa-text-secondary)]">
                  <span className="truncate">{agency.dashboardUrl || agency.access?.dashboardUrl || '—'}</span>
                  <button
                    type="button"
                    className={sa.btnGhost}
                    onClick={() => copyId(agency.dashboardUrl || agency.access?.dashboardUrl, 'Dashboard URL')}
                  >
                    Copy
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-[var(--sa-text-muted)]">Agency ID</dt>
                <dd className="mt-1 flex items-center gap-2 font-mono text-xs text-[var(--sa-text-secondary)]">
                  {agency._id}
                  <button type="button" onClick={() => copyId(agency._id, 'Agency ID')} className={sa.btnGhost}>
                    Copy
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-[var(--sa-text-muted)]">Legacy owner ID</dt>
                <dd className="mt-1 font-mono text-xs text-[var(--sa-text-secondary)]">{agency.legacyOwnerId || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-[var(--sa-text-muted)]">Onboarding completed</dt>
                <dd className="mt-1 text-[var(--sa-text-secondary)]">
                  {agency.onboardingCompletedAt
                    ? new Date(agency.onboardingCompletedAt).toLocaleString()
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-[var(--sa-text-muted)]">Created</dt>
                <dd className="mt-1 text-[var(--sa-text-secondary)]">
                  {agency.createdAt ? new Date(agency.createdAt).toLocaleString() : '—'}
                </dd>
              </div>
            </dl>
          </SaCard>
        </div>
      )}

      {tab === 'settings' && (
        <>
        <SaCard title="General settings" className="mt-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <SaField label="Agency name">
              <input
                value={edit.name}
                onChange={(e) => setEdit((f) => ({ ...f, name: e.target.value }))}
                className={sa.input}
              />
            </SaField>
            <SaField label="Slug">
              <input
                value={edit.slug}
                onChange={(e) => setEdit((f) => ({ ...f, slug: e.target.value }))}
                className={`${sa.input} font-mono`}
              />
            </SaField>
            <SaField label="Phone">
              <input value={edit.phone} onChange={(e) => setEdit((f) => ({ ...f, phone: e.target.value }))} className={sa.input} />
            </SaField>
            <SaField label="WhatsApp">
              <input
                value={edit.whatsapp}
                onChange={(e) => setEdit((f) => ({ ...f, whatsapp: e.target.value }))}
                className={sa.input}
              />
            </SaField>
            <SaField label="Address" className="sm:col-span-2">
              <input
                value={edit.address}
                onChange={(e) => setEdit((f) => ({ ...f, address: e.target.value }))}
                className={sa.input}
              />
            </SaField>
            <SaField label="City">
              <input value={edit.city} onChange={(e) => setEdit((f) => ({ ...f, city: e.target.value }))} className={sa.input} />
            </SaField>
            <SaField label="Country">
              <input
                value={edit.country}
                onChange={(e) => setEdit((f) => ({ ...f, country: e.target.value }))}
                className={sa.input}
              />
            </SaField>
            <SaField label="Timezone">
              <input
                value={edit.timezone}
                onChange={(e) => setEdit((f) => ({ ...f, timezone: e.target.value }))}
                className={sa.input}
              />
            </SaField>
            <SaField label="Currency">
              <input
                value={edit.currency}
                onChange={(e) => setEdit((f) => ({ ...f, currency: e.target.value }))}
                className={sa.input}
              />
            </SaField>
            <SaField label="Locale">
              <input
                value={edit.locale}
                onChange={(e) => setEdit((f) => ({ ...f, locale: e.target.value }))}
                className={sa.input}
              />
            </SaField>
            <label className="flex items-center gap-2 text-sm text-[var(--sa-text-secondary)] sm:col-span-2">
              <input
                type="checkbox"
                checked={edit.isPublicStorefront}
                onChange={(e) => setEdit((f) => ({ ...f, isPublicStorefront: e.target.checked }))}
                className="accent-[var(--sa-accent)]"
              />
              Public storefront
            </label>
          </div>
          <button
            type="button"
            disabled={busy === 'save'}
            onClick={() =>
              run('save', async () => {
                const { data } = await axios.patch(`/api/super-admin/agencies/${id}`, edit)
                if (!data.success) throw new Error(data.message || 'Save failed')
                toast.success('Agency updated')
                await load()
              })
            }
            className={`${sa.btnPrimary} mt-6`}
          >
            {busy === 'save' ? 'Saving…' : 'Save changes'}
          </button>
        </SaCard>

        <SaCard title="Branding" description="Visual identity shown on the agency storefront and documents." className="mt-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <SaField label="Logo URL">
              <input
                value={branding.logoUrl}
                onChange={(e) => setBranding((f) => ({ ...f, logoUrl: e.target.value }))}
                className={sa.input}
              />
            </SaField>
            <SaField label="Favicon URL">
              <input
                value={branding.faviconUrl}
                onChange={(e) => setBranding((f) => ({ ...f, faviconUrl: e.target.value }))}
                className={sa.input}
              />
            </SaField>
            <SaField label="Primary brand color">
              <div className="flex gap-2">
                <input
                  value={branding.primaryBrandColor}
                  onChange={(e) => setBranding((f) => ({ ...f, primaryBrandColor: e.target.value }))}
                  placeholder="#A51624"
                  className={`${sa.input} font-mono`}
                />
                {branding.primaryBrandColor ? (
                  <span
                    className="w-10 h-10 rounded-[var(--sa-radius-sm)] border border-[var(--sa-border)] shrink-0"
                    style={{ background: branding.primaryBrandColor }}
                    aria-hidden
                  />
                ) : null}
              </div>
            </SaField>
            <SaField label="Secondary brand color">
              <div className="flex gap-2">
                <input
                  value={branding.secondaryBrandColor}
                  onChange={(e) => setBranding((f) => ({ ...f, secondaryBrandColor: e.target.value }))}
                  placeholder="#1a1a1a"
                  className={`${sa.input} font-mono`}
                />
                {branding.secondaryBrandColor ? (
                  <span
                    className="w-10 h-10 rounded-[var(--sa-radius-sm)] border border-[var(--sa-border)] shrink-0"
                    style={{ background: branding.secondaryBrandColor }}
                    aria-hidden
                  />
                ) : null}
              </div>
            </SaField>
          </div>
          {branding.logoUrl ? (
            <div className="mt-4 p-4 rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface-2)]">
              <p className="text-xs text-[var(--sa-text-muted)] mb-2">Logo preview</p>
              <img src={branding.logoUrl} alt="" className="max-h-16 object-contain" />
            </div>
          ) : null}
          <button
            type="button"
            disabled={busy === 'branding'}
            onClick={() =>
              run('branding', async () => {
                const { data } = await axios.patch(`/api/super-admin/agencies/${id}`, branding)
                if (!data.success) throw new Error(data.message || 'Save failed')
                toast.success('Branding updated')
                await load()
              })
            }
            className={`${sa.btnPrimary} mt-6`}
          >
            {busy === 'branding' ? 'Saving…' : 'Save branding'}
          </button>
        </SaCard>
        <div className="mt-4">
          <AgencyDomainsPanel
            agency={agency}
            agencyId={id}
            axios={axios}
            busy={busy}
            run={run}
            onRefresh={load}
          />
        </div>
        </>
      )}

      {tab === 'billing' && (
        <SaCard title="Billing & subscription" className="mt-2">
          <AgencyBillingPanel agencyId={id} axios={axios} busy={busy} run={run} />
        </SaCard>
      )}

      {tab === 'users' && (
        <SaCard title="Users" className="mt-2">
          <AgencyStaffPanel agencyId={id} axios={axios} busy={busy} run={run} />
        </SaCard>
      )}

      {tab === 'usage' && (
        <div className="grid gap-4 lg:grid-cols-2 mt-2">
          <SaCard title="Fleet">
            {recentCars.length ? (
              <ul className="divide-y divide-[var(--sa-border)]">
                {recentCars.map((car) => (
                  <li key={car._id} className="py-2 text-sm">
                    {car.brand} {car.model}
                    <span className="block text-xs text-[var(--sa-text-muted)]">{car.category || '—'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <SaEmpty title="No vehicles" description="This agency has no fleet records yet." />
            )}
          </SaCard>
          <SaCard title="Bookings">
            {recentBookings.length ? (
              <ul className="divide-y divide-[var(--sa-border)]">
                {recentBookings.map((booking) => (
                  <li key={booking._id} className="py-2 text-sm">
                    {booking.reservationId || booking.customerName}
                    <span className="block text-xs text-[var(--sa-text-muted)]">
                      {booking.status} · {booking.createdAt ? formatRelativeTime(booking.createdAt) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <SaEmpty title="No bookings" description="Reservations will appear here when they exist." />
            )}
          </SaCard>
        </div>
      )}

      {tab === 'notifications' && (
        <SaCard title="Delivery status" className="mt-2" description="Retry never undoes approval or rejection.">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Email</dt>
              <dd>
                <SaBadge tone={statusBadgeTone(agency.notifications?.email?.status)}>
                  {agency.notifications?.email?.status || 'idle'}
                </SaBadge>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>WhatsApp</dt>
              <dd>
                <SaBadge tone={statusBadgeTone(agency.notifications?.whatsapp?.status)}>
                  {agency.notifications?.whatsapp?.status || 'idle'}
                </SaBadge>
              </dd>
            </div>
          </dl>
          {agency.notifications?.email?.error ? (
            <p className="mt-3 text-xs text-[var(--sa-danger)]">{agency.notifications.email.error}</p>
          ) : null}
          {['active', 'rejected'].includes(agency.status) ? (
            <button
              type="button"
              className={`${sa.btnSecondary} mt-4`}
              disabled={busy === 'notify'}
              onClick={() =>
                run('notify', async () => {
                  const { data } = await axios.post(`/api/super-admin/agencies/${id}/notify`)
                  if (!data.success) throw new Error(data.message)
                  toast.success('Notification retry complete')
                  await load()
                })
              }
            >
              {busy === 'notify' ? 'Retrying…' : 'Retry'}
            </button>
          ) : null}
        </SaCard>
      )}

      {tab === 'activity' && (
        <div className="space-y-4 mt-2">
          <SaCard title="Agency timeline">
            {audit.length ? (
              <ol className="space-y-3 border-l border-[var(--sa-border)] pl-4">
                {audit.map((log) => (
                  <li key={log._id}>
                    <p className="text-[11px] text-[var(--sa-text-muted)]">{formatRelativeTime(log.createdAt)}</p>
                    <p className="text-sm">{log.actor?.name || log.actor?.email || 'System'} · {log.details || log.action}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <SaEmpty title="No agency audit yet" description="Approvals and status changes will appear here." />
            )}
          </SaCard>
          <Link to="/superadmin/activity" className={sa.btnSecondary}>
            View platform-wide activity →
          </Link>
        </div>
      )}
    </div>
  )
}

export default SuperAdminAgencyDetail
