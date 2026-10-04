import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { saError, useSuperAdmin } from '../../context/SuperAdminContext'
import {
  SaBadge,
  SaCard,
  SaEmpty,
  SaError,
  SaPageHeader,
  SaPagination,
  SaSkeleton,
  SaTabs,
  formatRelativeTime,
  sa,
  statusBadgeTone,
} from './saUi'

const notifyLabel = (status) => {
  if (status === 'sent') return 'Sent'
  if (status === 'failed') return 'Failed'
  if (status === 'not_configured') return 'Not configured'
  if (status === 'link_ready') return 'Ready'
  if (status === 'skipped') return 'Skipped'
  return status || '—'
}

const SuperAdminNotifications = () => {
  const { axios } = useSuperAdmin()
  const [tab, setTab] = useState('inbox')
  const [inbox, setInbox] = useState([])
  const [log, setLog] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const loadInbox = useCallback(
    async (page = 1) => {
      setLoading(true)
      setError('')
      try {
        const { data } = await axios.get('/api/super-admin/inbox', { params: { page, limit: 30 } })
        if (!data.success) throw new Error(data.message)
        setInbox(data.items || [])
        setUnread(data.unread || 0)
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 })
      } catch (err) {
        setError(saError(err, 'Unable to load notifications'))
      } finally {
        setLoading(false)
      }
    },
    [axios],
  )

  const loadLog = useCallback(
    async (page = 1) => {
      setLoading(true)
      setError('')
      try {
        const { data } = await axios.get('/api/super-admin/notification-log', { params: { page, limit: 20 } })
        if (!data.success) throw new Error(data.message)
        setLog(data.items || [])
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 })
      } catch (err) {
        setError(saError(err, 'Unable to load notification log'))
      } finally {
        setLoading(false)
      }
    },
    [axios],
  )

  useEffect(() => {
    if (tab === 'inbox') loadInbox(1)
    else loadLog(1)
  }, [tab, loadInbox, loadLog])

  const retry = async (agencyId) => {
    setBusy(agencyId)
    try {
      const { data } = await axios.post(`/api/super-admin/agencies/${agencyId}/notify`)
      if (!data.success) throw new Error(data.message)
      toast.success('Retry complete. Approval status is unchanged.')
      await loadLog(pagination.page)
    } catch (err) {
      toast.error(saError(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className={sa.page}>
      <SaPageHeader
        title="Notifications"
        subtitle="Platform inbox and delivery history. Failed emails never undo an approval."
        action={
          tab === 'inbox' ? (
            <button
              type="button"
              className={sa.btnSecondary}
              disabled={!unread}
              onClick={async () => {
                await axios.patch('/api/super-admin/inbox/read-all')
                loadInbox(pagination.page)
              }}
            >
              Mark all as read
            </button>
          ) : null
        }
      />

      <SaTabs
        tabs={[
          { id: 'inbox', label: 'Inbox', count: unread || undefined, priority: Boolean(unread) },
          { id: 'log', label: 'Delivery log' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error ? <SaError title="Unable to load notifications" description={error} onRetry={() => (tab === 'inbox' ? loadInbox(1) : loadLog(1))} /> : null}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SaSkeleton key={i} className="h-16" />
          ))}
        </div>
      ) : null}

      {!loading && !error && tab === 'inbox' ? (
        inbox.length ? (
          <ul className={`${sa.card} divide-y divide-[var(--sa-border)]`}>
            {inbox.map((item) => (
              <li key={item._id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--sa-text)]">{item.title}</p>
                  <p className="text-xs text-[var(--sa-text-secondary)]">{item.body}</p>
                  <p className="mt-1 text-[11px] text-[var(--sa-text-muted)]">{formatRelativeTime(item.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!item.readAt ? <SaBadge tone="warn">Unread</SaBadge> : <SaBadge>Read</SaBadge>}
                  {item.href ? (
                    <Link to={item.href} className={sa.btnSmSecondary}>
                      Open
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <SaCard>
            <SaEmpty title="No notifications yet" description="Agency registrations, approvals, and delivery failures will appear here." />
          </SaCard>
        )
      ) : null}

      {!loading && !error && tab === 'log' ? (
        log.length ? (
          <>
            <div className="space-y-3 lg:hidden">
              {log.map((row) => (
                <article key={row.id} className={`${sa.card} ${sa.cardPad}`}>
                  <p className="text-sm font-medium">{row.agencyName}</p>
                  <p className="text-xs text-[var(--sa-text-muted)]">{row.recipient || '—'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <SaBadge>{row.channel}</SaBadge>
                    <SaBadge tone={statusBadgeTone(row.status)}>{notifyLabel(row.status)}</SaBadge>
                  </div>
                  {row.channel === 'email' && ['failed', 'not_configured'].includes(row.status) ? (
                    <button
                      type="button"
                      className={`${sa.btnSmSecondary} mt-3`}
                      disabled={busy === row.agencyId}
                      onClick={() => retry(row.agencyId)}
                    >
                      {busy === row.agencyId ? 'Retrying…' : 'Retry'}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
            <div className={`${sa.tableWrap} hidden lg:block`}>
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th className={sa.th}>Recipient</th>
                    <th className={sa.th}>Agency</th>
                    <th className={sa.th}>Channel</th>
                    <th className={sa.th}>Type</th>
                    <th className={sa.th}>Status</th>
                    <th className={sa.th}>Date</th>
                    <th className={sa.th} />
                  </tr>
                </thead>
                <tbody>
                  {log.map((row) => (
                    <tr key={row.id} className={sa.row}>
                      <td className={sa.td}>{row.recipient || '—'}</td>
                      <td className={sa.td}>
                        <Link to={`/superadmin/agencies/${row.agencyId}`} className={sa.link}>
                          {row.agencyName}
                        </Link>
                      </td>
                      <td className={`${sa.td} capitalize`}>{row.channel}</td>
                      <td className={sa.td}>{row.type}</td>
                      <td className={sa.td}>
                        <SaBadge tone={statusBadgeTone(row.status)}>{notifyLabel(row.status)}</SaBadge>
                      </td>
                      <td className={`${sa.td} text-xs`}>{row.date ? new Date(row.date).toLocaleString() : '—'}</td>
                      <td className={`${sa.td} text-right`}>
                        {row.channel === 'email' && ['failed', 'not_configured'].includes(row.status) ? (
                          <button
                            type="button"
                            className={sa.btnSmSecondary}
                            disabled={busy === row.agencyId}
                            onClick={() => retry(row.agencyId)}
                          >
                            Retry
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <SaCard>
            <SaEmpty title="No delivery records" description="Email and WhatsApp outcomes appear after an approve or reject." />
          </SaCard>
        )
      ) : null}

      <SaPagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} onPage={tab === 'inbox' ? loadInbox : loadLog} />
    </div>
  )
}

export default SuperAdminNotifications
