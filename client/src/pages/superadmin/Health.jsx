import React, { useCallback, useEffect, useState } from 'react'
import { saError, useSuperAdmin } from '../../context/SuperAdminContext'
import { SaCard, SaError, SaHealthDot, SaPageHeader, SaSkeleton, sa } from './saUi'

const SuperAdminHealth = () => {
  const { axios } = useSuperAdmin()
  const [checks, setChecks] = useState([])
  const [checkedAt, setCheckedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.get('/api/super-admin/health')
      if (!data.success) throw new Error(data.message)
      setChecks(data.checks || [])
      setCheckedAt(data.checkedAt || '')
    } catch (err) {
      setError(saError(err, 'Unable to load system health'))
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
        title="System Health"
        subtitle="Measured checks only. WhatsApp has no send API in this platform."
        action={
          <button type="button" className={sa.btnSecondary} onClick={load}>
            Recheck
          </button>
        }
      />
      {checkedAt ? (
        <p className="text-xs text-[var(--sa-text-muted)]">Last check {new Date(checkedAt).toLocaleString()}</p>
      ) : null}
      {error ? <SaError title="Unable to load system health" description={error} onRetry={load} /> : null}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SaSkeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {checks.map((check) => (
            <SaCard key={check.id} title={check.label}>
              <SaHealthDot status={check.status} />
              <p className="mt-2 text-sm text-[var(--sa-text-secondary)]">{check.detail}</p>
            </SaCard>
          ))}
        </div>
      )}
    </div>
  )
}

export default SuperAdminHealth
