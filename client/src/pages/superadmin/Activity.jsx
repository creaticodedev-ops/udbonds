import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { saError, useSuperAdmin } from '../../context/SuperAdminContext'
import {
  SaCard,
  SaEmpty,
  SaError,
  SaPageHeader,
  SaPagination,
  SaSkeleton,
  SaTabs,
  formatAuditAction,
  formatRelativeTime,
  sa,
} from './saUi'

const groupByDay = (logs) => {
  const map = new Map()
  logs.forEach((log) => {
    const day = log.createdAt ? new Date(log.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown'
    if (!map.has(day)) map.set(day, [])
    map.get(day).push(log)
  })
  return [...map.entries()]
}

const SuperAdminActivity = () => {
  const { axios } = useSuperAdmin()
  const [tab, setTab] = useState('platform')
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [bookings, setBookings] = useState([])
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const loadAudit = useCallback(
    async (page = 1) => {
      setLoading(true)
      setError('')
      try {
        const { data } = await axios.get('/api/super-admin/audit-logs', {
          params: { page, limit: 40, search: debounced || undefined },
        })
        if (!data.success) throw new Error(data.message)
        setLogs(data.logs || [])
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 })
      } catch (err) {
        setError(saError(err, 'Unable to load activity'))
      } finally {
        setLoading(false)
      }
    },
    [axios, debounced],
  )

  const loadOps = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.get('/api/super-admin/activity')
      if (!data.success) throw new Error(data.message)
      setBookings(data.recentBookings || [])
      setCars(data.recentCars || [])
    } catch (err) {
      setError(saError(err, 'Unable to load operations activity'))
    } finally {
      setLoading(false)
    }
  }, [axios])

  useEffect(() => {
    if (tab === 'platform') loadAudit(1)
    else loadOps()
  }, [tab, loadAudit, loadOps])

  const days = useMemo(() => groupByDay(logs), [logs])

  return (
    <div className={sa.page}>
      <SaPageHeader title="Activity Log" subtitle="Real audit events and recent operational records. Nothing here is simulated." />
      <SaTabs
        tabs={[
          { id: 'platform', label: 'Platform' },
          { id: 'operations', label: 'Operations' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'platform' ? (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by action or details…"
          className={`${sa.input} max-w-md`}
        />
      ) : null}

      {error ? (
        <SaError title="Unable to load activity" description={error} onRetry={() => (tab === 'platform' ? loadAudit(1) : loadOps())} />
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SaSkeleton key={i} className="h-12" />
          ))}
        </div>
      ) : null}

      {!loading && !error && tab === 'platform' ? (
        logs.length ? (
          <div className="space-y-8">
            {days.map(([day, items]) => (
              <section key={day}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sa-text-muted)]">{day}</h2>
                <ol className="space-y-3 border-l border-[var(--sa-border)] pl-4">
                  {items.map((log) => (
                    <li key={log._id} className="relative">
                      <span className="absolute -left-[1.15rem] top-1.5 h-2 w-2 rounded-full bg-[var(--sa-accent)]" aria-hidden />
                      <p className="text-[11px] tabular-nums text-[var(--sa-text-muted)]">
                        {log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </p>
                      <p className="text-sm text-[var(--sa-text)]">
                        <span className="font-medium">{log.actor?.name || log.actor?.email || 'System'}</span>{' '}
                        {formatAuditAction(log.action)}
                        {log.owner?.agencyName ? ` · ${log.owner.agencyName}` : ''}
                      </p>
                      {log.details ? <p className="text-xs text-[var(--sa-text-secondary)]">{log.details}</p> : null}
                      <p className="text-[11px] text-[var(--sa-text-muted)]">{formatRelativeTime(log.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <SaEmpty title="No audit entries" description="Approvals, rejections, and admin changes will appear here." />
        )
      ) : null}

      {!loading && !error && tab === 'operations' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SaCard title="Recent bookings">
            {bookings.length ? (
              <ul className="divide-y divide-[var(--sa-border)]">
                {bookings.map((b) => (
                  <li key={b._id} className="py-3">
                    <p className="text-sm font-medium">{b.reservationId || b.customerName}</p>
                    <p className="text-xs text-[var(--sa-text-muted)]">
                      {b.owner?.agencyName || b.owner?.name || '—'} · {b.status} · {formatRelativeTime(b.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <SaEmpty title="No bookings yet" description="New reservations will appear here." />
            )}
          </SaCard>
          <SaCard title="Recent fleet">
            {cars.length ? (
              <ul className="divide-y divide-[var(--sa-border)]">
                {cars.map((car) => (
                  <li key={car._id} className="py-3">
                    <p className="text-sm font-medium">
                      {car.brand} {car.model}
                    </p>
                    <p className="text-xs text-[var(--sa-text-muted)]">
                      {car.owner?.agencyName || car.owner?.name || '—'} · {formatRelativeTime(car.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <SaEmpty title="No vehicles yet" description="Fleet additions will appear here." />
            )}
          </SaCard>
        </div>
      ) : null}

      {tab === 'platform' ? (
        <SaPagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} onPage={loadAudit} />
      ) : null}
    </div>
  )
}

export default SuperAdminActivity
