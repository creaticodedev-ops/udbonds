import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSuperAdmin, saError } from '../../context/SuperAdminContext'
import {
  SaBadge,
  SaCard,
  SaEmpty,
  SaError,
  SaHealthDot,
  SaLink,
  SaPageHeader,
  SaSkeleton,
  SaStat,
  formatRelativeTime,
  sa,
  statusBadgeTone,
} from './saUi'

const AgencyList = ({ items, emptyTitle, emptyDescription, href }) => {
  if (!items?.length) {
    return <SaEmpty title={emptyTitle} description={emptyDescription} />
  }
  return (
    <ul className="divide-y divide-[var(--sa-border)]">
      {items.map((agency) => (
        <li key={agency._id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--sa-text)]">{agency.name}</p>
            <p className="truncate font-mono text-xs text-[var(--sa-text-muted)]">
              {agency.slug} · {formatRelativeTime(agency.approvedAt || agency.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SaBadge tone={statusBadgeTone(agency.status)}>{agency.status}</SaBadge>
            <Link to={href ? href(agency) : `/superadmin/agencies/${agency._id}`} className={sa.btnGhost}>
              Open
            </Link>
          </div>
        </li>
      ))}
    </ul>
  )
}

const SuperAdminDashboard = () => {
  const { axios } = useSuperAdmin()
  const [data, setData] = useState(null)
  const [billing, setBilling] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [ov, bill, sys] = await Promise.all([
        axios.get('/api/super-admin/overview'),
        axios.get('/api/super-admin/billing/overview').catch(() => ({ data: null })),
        axios.get('/api/super-admin/health').catch(() => ({ data: null })),
      ])
      if (ov.data?.success) setData(ov.data)
      else throw new Error(ov.data?.message || 'Unable to load overview')
      if (bill.data?.success) setBilling(bill.data.byStatus || {})
      if (sys.data?.success) setHealth(sys.data.checks || [])
    } catch (err) {
      setError(saError(err, 'Unable to load overview'))
    } finally {
      setLoading(false)
    }
  }, [axios])

  useEffect(() => {
    load()
  }, [load])

  const o = data?.overview || {}
  const hasBilling = Boolean(billing && Object.keys(billing).length)

  if (loading) {
    return (
      <div className={sa.page}>
        <SaSkeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SaSkeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SaSkeleton className="h-56" />
          <SaSkeleton className="h-56" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={sa.page}>
        <SaPageHeader title="Overview" subtitle="Platform operations at a glance." />
        <SaError title="Unable to load overview" description={error} onRetry={load} />
      </div>
    )
  }

  return (
    <div className={sa.page}>
      <SaPageHeader
        title="Overview"
        subtitle="Agencies waiting, system health, and what happened last."
        action={
          <>
            <Link to="/superadmin/requests" className={sa.btnPrimary}>
              Review requests{o.pendingAgencies ? ` (${o.pendingAgencies})` : ''}
            </Link>
            <Link to="/superadmin/agencies?create=1" className={sa.btnSecondary}>
              Create agency
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SaStat label="Total agencies" value={o.totalAgencies} />
        <SaStat label="Pending requests" value={o.pendingAgencies} accent="var(--sa-warn)" hint="Waiting for approval" />
        <SaStat label="Active agencies" value={o.activeAgencies} accent="var(--sa-success)" />
        <SaStat label="Suspended agencies" value={o.suspendedAgencies} accent="var(--sa-danger)" />
      </div>

      {hasBilling ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <SaStat label="Active subscriptions" value={billing.active ?? 0} />
          <SaStat label="Trials" value={billing.trialing ?? 0} />
          <SaStat
            label="Payment issues"
            value={(billing.past_due || 0) + (billing.canceled || 0) + (billing.expired || 0)}
            hint="Past due, canceled, or expired"
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <SaCard title="New registrations" action={<SaLink to="/superadmin/requests">Open queue →</SaLink>}>
          <AgencyList
            items={data?.recentPending}
            emptyTitle="No pending agency requests"
            emptyDescription="New agency registrations will appear here."
            href={() => '/superadmin/requests'}
          />
        </SaCard>
        <SaCard title="Recent approvals">
          <AgencyList
            items={data?.recentApproved}
            emptyTitle="No recent approvals"
            emptyDescription="Approved agencies will show here."
          />
        </SaCard>
        <SaCard title="Recent suspensions">
          <AgencyList
            items={data?.recentSuspended}
            emptyTitle="No suspended agencies"
            emptyDescription="Suspended tenants will show here."
          />
        </SaCard>
      </div>

      <SaCard
        title="System status"
        description="Live checks from this control plane. No synthetic uptime."
        action={<SaLink to="/superadmin/health">Health →</SaLink>}
      >
        {health?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {health.map((check) => (
              <li key={check.id} className="rounded-[var(--sa-radius-sm)] border border-[var(--sa-border)] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sa-text-muted)]">
                  {check.label}
                </p>
                <div className="mt-2">
                  <SaHealthDot status={check.status} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <SaEmpty title="Health unavailable" description="Open System Health to retry the live checks." />
        )}
      </SaCard>
    </div>
  )
}

export default SuperAdminDashboard
