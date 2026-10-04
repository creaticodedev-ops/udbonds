import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useSuperAdmin, saError } from '../../context/SuperAdminContext'
import { SaEmpty, SaPageHeader, SaPagination, SaSkeleton, sa } from './saUi'

const SuperAdminAudit = () => {
  const { axios } = useSuperAdmin()
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const { data } = await axios.get('/api/super-admin/audit-logs', {
          params: { search, page, limit: 30 },
        })
        if (data.success) {
          setLogs(data.logs)
          setPagination(data.pagination)
        }
      } catch (error) {
        toast.error(saError(error))
      } finally {
        setLoading(false)
      }
    },
    [axios, search],
  )

  useEffect(() => {
    const t = setTimeout(() => load(1), 200)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className={sa.page}>
      <SaPageHeader
        title="Audit logs"
        subtitle="Important admin and Super Admin actions across the platform."
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter by action or details…"
        className={`${sa.input} max-w-md`}
      />

      <div className={sa.tableWrap}>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <SaSkeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <SaEmpty title="No audit entries" description="Platform actions will be recorded here." />
        ) : (
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr>
                <th className={sa.th}>When</th>
                <th className={sa.th}>Action</th>
                <th className={sa.th}>Actor</th>
                <th className={sa.th}>Target admin</th>
                <th className={sa.th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className={`${sa.row} align-top`}>
                  <td className={`${sa.td} text-xs text-[var(--sa-text-muted)] whitespace-nowrap`}>
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className={`${sa.td} text-xs font-mono text-[var(--sa-accent)]`}>{log.action}</td>
                  <td className={`${sa.td} text-xs`}>
                    {log.actor?.email || '—'}
                    {log.actor?.role === 'superadmin' ? (
                      <span className="block text-[var(--sa-info)]">superadmin</span>
                    ) : null}
                  </td>
                  <td className={`${sa.td} text-xs text-[var(--sa-text-muted)]`}>{log.owner?.email || '—'}</td>
                  <td className={`${sa.td} text-xs text-[var(--sa-text-muted)] max-w-xs`}>{log.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SaPagination page={pagination.page} totalPages={pagination.totalPages} onPage={load} />
    </div>
  )
}

export default SuperAdminAudit
