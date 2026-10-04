import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { saError } from '../../context/SuperAdminContext'
import {
  SaBadge,
  SaCard,
  SaEmpty,
  SaField,
  SaSkeleton,
  confirmDestructive,
  copyToClipboard,
  sa,
  statusBadgeTone,
} from './saUi'

export const AgencyBillingPanel = ({ agencyId, axios, busy, run }) => {
  const [billing, setBilling] = useState(null)
  const [events, setEvents] = useState([])
  const [plans, setPlans] = useState([])
  const [planCode, setPlanCode] = useState('basic')
  const [extendDays, setExtendDays] = useState(7)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [billRes, plansRes] = await Promise.all([
        axios.get(`/api/super-admin/agencies/${agencyId}/billing`),
        axios.get('/api/super-admin/billing/plans'),
      ])
      if (billRes.data?.success) {
        setBilling(billRes.data.billing)
        setEvents(billRes.data.events || [])
        if (billRes.data.billing?.subscription?.planCode) {
          setPlanCode(billRes.data.billing.subscription.planCode)
        }
      }
      if (plansRes.data?.success) setPlans(plansRes.data.plans || [])
    } catch (error) {
      toast.error(saError(error))
    } finally {
      setLoading(false)
    }
  }, [axios, agencyId])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !billing) {
    return (
      <div className="space-y-3">
        <SaSkeleton className="h-16 w-full" />
        <SaSkeleton className="h-10 w-2/3" />
      </div>
    )
  }

  const sub = billing?.subscription
  const usage = billing?.usage || {}
  const limits = billing?.limits || {}
  const planOptions =
    plans.length > 0
      ? plans
      : [
          { code: 'free_trial', name: 'Free Trial' },
          { code: 'basic', name: 'Basic' },
          { code: 'pro', name: 'Pro' },
          { code: 'enterprise', name: 'Enterprise' },
          { code: 'legacy_grandfathered', name: 'Legacy' },
        ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SaBadge tone="accent">{sub?.planCode || '—'}</SaBadge>
          <SaBadge tone={statusBadgeTone(sub?.status)}>{sub?.status || 'unknown'}</SaBadge>
        </div>
        <button type="button" onClick={load} className={sa.btnGhost}>
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${sa.card} ${sa.cardPad}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-muted)]">Trial ends</p>
          <p className="mt-1 text-sm text-[var(--sa-text)]">
            {sub?.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleString() : '—'}
          </p>
        </div>
        <div className={`${sa.card} ${sa.cardPad}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-muted)]">Vehicles</p>
          <p className="mt-1 text-sm text-[var(--sa-text)]">
            {usage.vehicles ?? 0}
            {limits.maxVehicles != null ? ` / ${limits.maxVehicles}` : ' / ∞'}
          </p>
        </div>
        <div className={`${sa.card} ${sa.cardPad}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-muted)]">Custom domain</p>
          <p className="mt-1 text-sm text-[var(--sa-text)]">{limits.customDomain ? 'Included' : 'Not included'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <SaField label="Assign plan" className="min-w-[10rem]">
          <select value={planCode} onChange={(e) => setPlanCode(e.target.value)} className={sa.select}>
            {planOptions.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name || p.code}
              </option>
            ))}
          </select>
        </SaField>
        <button
          type="button"
          disabled={busy === 'bill-assign'}
          onClick={() =>
            run('bill-assign', async () => {
              const { data } = await axios.post(`/api/super-admin/agencies/${agencyId}/billing/assign-plan`, {
                planCode,
              })
              if (!data.success) throw new Error(data.message || 'Assign failed')
              toast.success(`Assigned ${planCode}`)
              await load()
            })
          }
          className={sa.btnPrimary}
        >
          Assign plan
        </button>
        <SaField label="Extend trial (days)" className="w-28">
          <input
            type="number"
            min={1}
            value={extendDays}
            onChange={(e) => setExtendDays(Number(e.target.value) || 7)}
            className={sa.input}
          />
        </SaField>
        <button
          type="button"
          disabled={busy === 'bill-extend'}
          onClick={() =>
            run('bill-extend', async () => {
              const { data } = await axios.post(`/api/super-admin/agencies/${agencyId}/billing/extend-trial`, {
                days: extendDays,
              })
              if (!data.success) throw new Error(data.message || 'Extend failed')
              toast.success('Trial extended')
              await load()
            })
          }
          className={sa.btnSecondary}
        >
          Extend trial
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['bill-reactivate', 'Reactivate', 'reactivate', {}, false],
          ['bill-suspend', 'Suspend billing', 'suspend', {}, true],
          ['bill-expire', 'Expire', 'expire', {}, true],
          ['bill-cancel', 'Cancel now', 'cancel', { atPeriodEnd: false }, true],
        ].map(([key, label, action, body, destructive]) => (
          <button
            key={key}
            type="button"
            disabled={busy === key}
            onClick={() => {
              if (destructive && !confirmDestructive(`${label}? This affects billing access.`)) return
              run(key, async () => {
                const { data } = await axios.post(
                  `/api/super-admin/agencies/${agencyId}/billing/${action}`,
                  body,
                )
                if (!data.success) throw new Error(data.message || `${action} failed`)
                toast.success(label)
                await load()
              })
            }}
            className={destructive ? sa.btnDanger : sa.btnSecondary}
          >
            {label}
          </button>
        ))}
      </div>

      {events.length > 0 ? (
        <SaCard title="Recent billing events" description="Latest subscription changes for this agency">
          <ul className="space-y-2 max-h-48 overflow-y-auto sa-scrollbar text-xs text-[var(--sa-text-secondary)]">
            {events.slice(0, 12).map((ev) => (
              <li key={ev._id} className="flex flex-wrap gap-x-2 border-b border-[var(--sa-border)] pb-2">
                <span className="font-medium text-[var(--sa-text)]">{ev.type}</span>
                <span className="text-[var(--sa-text-muted)]">
                  {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}
                  {ev.to?.status ? ` → ${ev.to.status}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </SaCard>
      ) : (
        <SaEmpty title="No billing events yet" description="Subscription changes will appear here." />
      )}
    </div>
  )
}

export const AgencyStaffPanel = ({ agencyId, axios, busy, run }) => {
  const [members, setMembers] = useState([])
  const [usage, setUsage] = useState({ seats: 1, maxStaff: null })
  const [form, setForm] = useState({ name: '', email: '', staffRole: 'agent' })
  const [inviteUrl, setInviteUrl] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`/api/super-admin/agencies/${agencyId}/staff`)
      if (data.success) {
        setMembers(data.members || [])
        setUsage(data.usage || { seats: 1, maxStaff: null })
      }
    } catch (error) {
      toast.error(saError(error))
    } finally {
      setLoading(false)
    }
  }, [axios, agencyId])

  useEffect(() => {
    load()
  }, [load])

  const copyInvite = async () => {
    const result = await copyToClipboard(inviteUrl, 'Invite link copied')
    toast[result.ok ? 'success' : 'error'](result.message)
  }

  if (loading && !members.length) {
    return (
      <div className="space-y-3">
        <SaSkeleton className="h-8 w-40" />
        <SaSkeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--sa-text-secondary)]">
        Seats used: <span className="font-semibold text-[var(--sa-text)]">{usage.seats}</span>
        {usage.maxStaff == null ? ' / ∞' : ` / ${usage.maxStaff}`}
      </p>

      {members.length === 0 ? (
        <SaEmpty title="No staff members" description="Invite team members to help manage this agency." />
      ) : (
        <ul className="divide-y divide-[var(--sa-border)] rounded-[var(--sa-radius)] border border-[var(--sa-border)]">
          {members.map((m) => (
            <li key={m._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--sa-text)]">{m.name}</p>
                <p className="text-xs text-[var(--sa-text-muted)]">
                  {m.email} · {m.staffRole} · {m.accountStatus}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === `staff-rm-${m._id}`}
                onClick={() => {
                  if (!confirmDestructive(`Remove ${m.name} from this agency?`)) return
                  run(`staff-rm-${m._id}`, async () => {
                    const { data } = await axios.delete(`/api/super-admin/agencies/${agencyId}/staff/${m._id}`)
                    if (!data.success) throw new Error(data.message || 'Remove failed')
                    toast.success('Staff removed')
                    await load()
                  })
                }}
                className={sa.btnDanger}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <SaCard title="Invite staff" description="The invitee sets their password via a secure activation link.">
        <div className="grid gap-3 sm:grid-cols-3">
          <SaField label="Name">
            <input
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={sa.input}
            />
          </SaField>
          <SaField label="Email">
            <input
              type="email"
              placeholder="email@agency.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={sa.input}
            />
          </SaField>
          <SaField label="Role">
            <select
              value={form.staffRole}
              onChange={(e) => setForm((f) => ({ ...f, staffRole: e.target.value }))}
              className={`${sa.select} w-full`}
            >
              <option value="manager">Manager</option>
              <option value="agent">Agent</option>
              <option value="viewer">Viewer</option>
            </select>
          </SaField>
        </div>
        <button
          type="button"
          disabled={busy === 'staff-invite' || !form.name.trim() || !form.email.trim()}
          onClick={() =>
            run('staff-invite', async () => {
              const { data } = await axios.post(`/api/super-admin/agencies/${agencyId}/staff`, form)
              if (!data.success) throw new Error(data.message || 'Invite failed')
              setInviteUrl(data.inviteUrl || '')
              setForm({ name: '', email: '', staffRole: 'agent' })
              toast.success('Staff invited')
              await load()
            })
          }
          className={`${sa.btnPrimary} mt-4`}
        >
          Send invite
        </button>
        {inviteUrl ? (
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input readOnly value={inviteUrl} className={`${sa.input} font-mono text-xs`} />
            <button type="button" onClick={copyInvite} className={sa.btnSecondary}>
              Copy link
            </button>
          </div>
        ) : null}
      </SaCard>
    </div>
  )
}

export const AgencyDomainsPanel = ({ agency, agencyId, axios, busy, run, onRefresh }) => {
  const [domainInput, setDomainInput] = useState(agency.customDomain || '')

  useEffect(() => {
    setDomainInput(agency.customDomain || '')
  }, [agency.customDomain])

  const storefrontUrl = agency.slug ? `/s/${agency.slug}` : null

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`${sa.card} ${sa.cardPad}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-muted)]">Subdomain</p>
          <p className="mt-1 text-sm font-mono text-[var(--sa-text)]">{agency.slug || '—'}</p>
          <p className="mt-1 text-xs text-[var(--sa-text-muted)]">
            Subdomain enabled: {agency.subdomainEnabled !== false ? 'Yes' : 'No'}
          </p>
          {storefrontUrl ? (
            <a href={storefrontUrl} target="_blank" rel="noreferrer" className={`${sa.btnGhost} mt-3 inline-flex`}>
              Open storefront →
            </a>
          ) : null}
        </div>
        <div className={`${sa.card} ${sa.cardPad}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-muted)]">Custom domain</p>
          <p className="mt-1 text-sm font-mono text-[var(--sa-text)]">{agency.customDomain || 'Not configured'}</p>
          <div className="mt-2">
            <SaBadge tone={statusBadgeTone(agency.customDomainStatus === 'active' ? 'active' : agency.customDomainStatus)}>
              {agency.customDomainStatus || 'none'}
            </SaBadge>
          </div>
          {agency.customDomainVerifiedAt ? (
            <p className="mt-2 text-xs text-[var(--sa-text-muted)]">
              Verified {new Date(agency.customDomainVerifiedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      </div>

      {agency.customDomainVerifyToken && agency.customDomainStatus === 'pending' ? (
        <SaCard title="DNS verification" description="Owner must add this TXT record, or use force verify below.">
          <div className="flex flex-col sm:flex-row gap-2">
            <input readOnly value={agency.customDomainVerifyToken} className={`${sa.input} font-mono text-xs`} />
            <button
              type="button"
              onClick={async () => {
                const result = await copyToClipboard(agency.customDomainVerifyToken, 'Token copied')
                toast[result.ok ? 'success' : 'error'](result.message)
              }}
              className={sa.btnSecondary}
            >
              Copy token
            </button>
          </div>
        </SaCard>
      ) : null}

      <SaCard title="Super Admin domain actions" description="Set or verify custom domains for this agency.">
        <SaField label="Custom domain" hint="Apex domain without scheme, e.g. rentals.example.com">
          <input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="example.com"
            className={sa.input}
          />
        </SaField>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy === 'domain-set' || !domainInput.trim()}
            onClick={() =>
              run('domain-set', async () => {
                const { data } = await axios.post(`/api/super-admin/agencies/${agencyId}/domains/verify`, {
                  customDomain: domainInput.trim(),
                })
                if (!data.success) throw new Error(data.message || 'Failed to set domain')
                toast.success('Domain updated')
                await onRefresh?.()
              })
            }
            className={sa.btnPrimary}
          >
            Set domain
          </button>
          <button
            type="button"
            disabled={busy === 'domain-verify' || !agency.customDomain}
            onClick={() =>
              run('domain-verify', async () => {
                const { data } = await axios.post(`/api/super-admin/agencies/${agencyId}/domains/verify`, {})
                if (!data.success) throw new Error(data.message || 'Verification failed')
                toast.success(data.message || 'Domain verified')
                await onRefresh?.()
              })
            }
            className={sa.btnSecondary}
          >
            Force verify
          </button>
          <button
            type="button"
            disabled={busy === 'domain-clear' || !agency.customDomain}
            onClick={() => {
              if (!confirmDestructive('Clear custom domain for this agency?')) return
              run('domain-clear', async () => {
                const { data } = await axios.post(`/api/super-admin/agencies/${agencyId}/domains/verify`, {
                  clear: true,
                })
                if (!data.success) throw new Error(data.message || 'Clear failed')
                toast.success('Domain cleared')
                setDomainInput('')
                await onRefresh?.()
              })
            }}
            className={sa.btnDanger}
          >
            Clear domain
          </button>
        </div>
      </SaCard>
    </div>
  )
}
