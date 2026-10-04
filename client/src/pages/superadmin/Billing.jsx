import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useSuperAdmin, saError } from '../../context/SuperAdminContext'
import { SaBarChart, SaCard, SaEmpty, SaLink, SaPageHeader, SaSkeleton, SaStat, sa } from './saUi'

const SuperAdminBilling = () => {
  const { axios } = useSuperAdmin()
  const [byStatus, setByStatus] = useState({})
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [ov, pl] = await Promise.all([
          axios.get('/api/super-admin/billing/overview'),
          axios.get('/api/super-admin/billing/plans'),
        ])
        if (cancelled) return
        if (ov.data?.success) setByStatus(ov.data.byStatus || {})
        if (pl.data?.success) setPlans(pl.data.plans || [])
      } catch (error) {
        toast.error(saError(error, 'Failed to load billing overview'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [axios])

  const chart = useMemo(() => {
    const colors = {
      trialing: 'var(--sa-chart-2)',
      active: 'var(--sa-chart-1)',
      past_due: 'var(--sa-chart-4)',
      expired: 'var(--sa-danger)',
      suspended: 'var(--sa-danger)',
      canceled: 'var(--sa-text-muted)',
    }
    return Object.entries(byStatus).map(([label, value]) => ({
      label: label.replace(/_/g, ' '),
      value,
      color: colors[label] || 'var(--sa-chart-3)',
    }))
  }, [byStatus])

  const total = Object.values(byStatus).reduce((a, b) => a + Number(b || 0), 0)

  if (loading) {
    return (
      <div className={sa.page}>
        <SaSkeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SaSkeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={sa.page}>
      <SaPageHeader
        title="Billing"
        subtitle="Platform subscription overview. Manage a specific agency from its detail page."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SaStat label="Subscriptions" value={total} />
        <SaStat label="Active" value={byStatus.active || 0} accent="var(--sa-success)" />
        <SaStat label="Trialing" value={byStatus.trialing || 0} accent="var(--sa-info)" />
        <SaStat label="Expired / suspended" value={(byStatus.expired || 0) + (byStatus.suspended || 0)} accent="var(--sa-danger)" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <SaCard title="Status distribution">
          {chart.length ? <SaBarChart items={chart} /> : <SaEmpty title="No subscriptions" description="Run billing migration if agencies exist." />}
        </SaCard>
        <SaCard
          title="Plan catalog"
          description="Public and internal plans seeded by P4."
          action={<SaLink to="/superadmin/agencies">Agencies →</SaLink>}
        >
          <ul className="divide-y divide-[var(--sa-border)]">
            {plans.map((p) => (
              <li key={p.code} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-[var(--sa-text)]">{p.name}</p>
                  <p className="text-xs text-[var(--sa-text-muted)] font-mono">{p.code}</p>
                </div>
                <p className="text-sm tabular-nums text-[var(--sa-text-secondary)]">
                  {p.priceAmount > 0 ? `${p.priceAmount} ${p.currency}` : 'Custom'}
                </p>
              </li>
            ))}
            {!plans.length ? <SaEmpty title="No plans loaded" /> : null}
          </ul>
        </SaCard>
      </div>
    </div>
  )
}

export default SuperAdminBilling
