import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSuperAdmin, saError } from '../../context/SuperAdminContext'
import {
  SaAvatar,
  SaBadge,
  SaCard,
  SaEmpty,
  SaError,
  SaModal,
  SaPageHeader,
  SaPagination,
  SaSkeleton,
  SaTabs,
  copyToClipboard,
  sa,
  statusBadgeTone,
} from './saUi'

const notifyLabel = (channel) => {
  const status = String(channel?.status || 'idle')
  if (status === 'sent') return 'Sent'
  if (status === 'failed') return 'Failed'
  if (status === 'not_configured') return 'Not configured'
  if (status === 'link_ready') return 'Ready (wa.me)'
  if (status === 'skipped') return 'Skipped'
  return 'Not sent'
}

const displayStatus = (status) => {
  if (status === 'active') return 'Approved'
  if (status === 'pending') return 'Pending'
  if (status === 'rejected') return 'Rejected'
  return status || '—'
}

const FieldRow = ({ label, value }) => (
  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 py-2 border-b border-[var(--sa-border)] last:border-0">
    <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sa-text-muted)]">{label}</dt>
    <dd className="text-sm text-[var(--sa-text)] break-all">{value || '—'}</dd>
  </div>
)

export const SuperAdminAgencyRequests = () => {
  const { axios } = useSuperAdmin()
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [status, setStatus] = useState('pending')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [counts, setCounts] = useState({ pending: 0, rejected: 0, active: 0 })
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState('')
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [success, setSuccess] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const load = useCallback(
    async (page = 1) => {
      setLoading(true)
      setError('')
      try {
        const { data } = await axios.get('/api/super-admin/agencies', {
          params: {
            status: status || undefined,
            q: debounced.trim() || undefined,
            page,
            limit: 20,
          },
        })
        if (data.success) {
          setRows(data.agencies || [])
          setPagination(data.pagination || { page: 1, totalPages: 1, total: data.total || 0 })
        } else {
          throw new Error(data.message || 'Unable to load agency requests')
        }
      } catch (err) {
        setError(saError(err, 'Unable to load agency requests'))
        toast.error(saError(err))
      } finally {
        setLoading(false)
      }
    },
    [axios, status, debounced],
  )

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    load(1)
  }, [load])

  useEffect(() => {
    let cancelled = false
    axios
      .get('/api/super-admin/overview')
      .then(({ data }) => {
        if (cancelled || !data.success) return
        setCounts({
          pending: data.overview?.pendingAgencies || 0,
          rejected: data.overview?.rejectedAgencies || 0,
          active: data.overview?.activeAgencies || 0,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [axios, rows.length])

  const inbox = useMemo(
    () => (status ? rows : rows.filter((row) => ['pending', 'rejected'].includes(row.status))),
    [rows, status],
  )

  const open = (agency) => {
    setSelected(agency)
    setSuccess(null)
    setRejectReason('')
    setDeleteConfirm('')
  }

  const refreshSelected = async (agency) => {
    if (!agency?._id) return
    const { data } = await axios.get(`/api/super-admin/agencies/${agency._id}`)
    if (data.success) {
      setSelected(data.agency)
      setRows((prev) => prev.map((row) => (row._id === data.agency._id ? data.agency : row)))
    }
  }

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

  const owner = selected?.primaryOwner
  const dashboardUrl = selected?.dashboardUrl || selected?.access?.dashboardUrl || ''

  return (
    <div className={sa.page}>
      <SaPageHeader
        title="Agency Requests"
        subtitle="Review self-serve registrations, approve workspaces, and notify owners. Approval is independent of email delivery."
      />

      <SaTabs
        tabs={[
          { id: 'pending', label: 'Pending', count: counts.pending, priority: Boolean(counts.pending) },
          { id: 'active', label: 'Approved', count: counts.active },
          { id: 'rejected', label: 'Rejected', count: counts.rejected },
        ]}
        active={status || 'pending'}
        onChange={setStatus}
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, email, phone, slug…"
        className={`${sa.input} max-w-md`}
      />

      {error ? <SaError title="Unable to load agency requests" description={error} onRetry={() => load(pagination.page || 1)} /> : null}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SaSkeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !error ? (
        <>
          <div className="space-y-3 lg:hidden">
            {inbox.map((agency) => (
              <article
                key={agency._id}
                className={`${sa.card} ${sa.cardPad} ${agency.status === 'pending' ? 'border-[var(--sa-warn)]/40' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{agency.name}</p>
                    <p className="text-xs text-[var(--sa-text-muted)]">{agency.primaryOwner?.name || '—'} · {agency.primaryOwner?.email || agency.email}</p>
                    <p className="text-xs text-[var(--sa-text-muted)]">{agency.phone || '—'} · {agency.createdAt ? new Date(agency.createdAt).toLocaleDateString() : ''}</p>
                  </div>
                  <SaBadge tone={statusBadgeTone(agency.status)}>{displayStatus(agency.status)}</SaBadge>
                </div>
                <button type="button" className={`${sa.btnSmPrimary} mt-3`} onClick={() => open(agency)}>
                  Review
                </button>
              </article>
            ))}
            {!inbox.length ? (
              <SaEmpty
                title={status === 'pending' ? 'No pending agency requests' : 'No agencies in this view'}
                description="New agency registrations will appear here."
              />
            ) : null}
          </div>
        <div className={`${sa.tableWrap} hidden lg:block`}>
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className={sa.th}>Agency</th>
                <th className={sa.th}>Contact</th>
                <th className={sa.th}>Email</th>
                <th className={sa.th}>Phone</th>
                <th className={sa.th}>Created</th>
                <th className={sa.th}>Status</th>
                <th className={sa.th} />
              </tr>
            </thead>
            <tbody>
              {inbox.map((agency) => (
                <tr
                  key={agency._id}
                  className={`${sa.row} cursor-pointer ${agency.status === 'pending' ? 'bg-[var(--sa-warn-soft)]/35' : ''}`}
                  onClick={() => open(agency)}
                >
                  <td className={sa.td}>
                    <div className="flex items-center gap-3">
                      <SaAvatar name={agency.name} src={agency.logoUrl} />
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--sa-text)] truncate">{agency.name}</p>
                        <p className="text-xs text-[var(--sa-text-muted)] font-mono truncate">{agency.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className={sa.td}>{agency.primaryOwner?.name || '—'}</td>
                  <td className={sa.td}>{agency.primaryOwner?.email || agency.email || '—'}</td>
                  <td className={sa.td}>{agency.phone || agency.whatsapp || '—'}</td>
                  <td className={sa.td}>
                    {agency.createdAt ? new Date(agency.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className={sa.td}>
                    <SaBadge tone={statusBadgeTone(agency.status)}>{displayStatus(agency.status)}</SaBadge>
                  </td>
                  <td className={`${sa.td} text-right`}>
                    <button type="button" className={sa.link} onClick={() => open(agency)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {!inbox.length ? (
                <tr>
                  <td colSpan={7}>
                    <SaEmpty
                      title={status === 'pending' ? 'No pending agency requests' : 'No agencies in this view'}
                      description="New agency registrations will appear here."
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        </>
      ) : null}

      <SaPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPage={(p) => load(p)}
      />

      <SaModal
        open={Boolean(selected) && !approveOpen && !rejectOpen && !deleteOpen && !success}
        onClose={() => setSelected(null)}
        title={selected ? selected.name : 'Request'}
        wide
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <SaBadge tone={statusBadgeTone(selected.status)}>{displayStatus(selected.status)}</SaBadge>
              {selected.createdVia ? <SaBadge>{String(selected.createdVia).replace(/_/g, ' ')}</SaBadge> : null}
            </div>

            <SaCard title="Agency">
              <dl>
                <FieldRow label="Name" value={selected.name} />
                <FieldRow label="Slug" value={selected.slug} />
                <FieldRow label="Source" value={selected.createdVia?.replace(/_/g, ' ')} />
              </dl>
            </SaCard>
            <SaCard title="Contact">
              <dl>
                <FieldRow label="Person" value={owner?.name} />
                <FieldRow label="Email" value={owner?.email || selected.email} />
                <FieldRow label="Phone" value={selected.phone || selected.whatsapp} />
              </dl>
            </SaCard>
            <SaCard title="Workspace">
              <dl>
                <FieldRow label="Dashboard" value={dashboardUrl} />
                <FieldRow label="Storefront" value={selected.access?.storefrontUrl} />
                <FieldRow label="Password" value={owner?.passwordSetAt ? 'Set by owner' : 'Invite required'} />
              </dl>
            </SaCard>
            <SaCard title="Activity">
              <dl>
                <FieldRow label="Submitted" value={selected.createdAt ? new Date(selected.createdAt).toLocaleString() : ''} />
                <FieldRow label="Approved" value={selected.approvedAt ? new Date(selected.approvedAt).toLocaleString() : ''} />
                <FieldRow label="Rejected" value={selected.rejectedAt ? new Date(selected.rejectedAt).toLocaleString() : ''} />
              </dl>
            </SaCard>
            <SaCard title="Notifications">
              <dl>
                <FieldRow label="Email" value={notifyLabel(selected.notifications?.email)} />
                <FieldRow label="WhatsApp" value={notifyLabel(selected.notifications?.whatsapp)} />
              </dl>
              {selected.notifications?.email?.error ? (
                <p className="mt-2 text-xs text-[var(--sa-danger)]">{selected.notifications.email.error}</p>
              ) : null}
              {selected.notifications?.whatsapp?.error ? (
                <p className="mt-2 text-xs text-[var(--sa-text-muted)]">{selected.notifications.whatsapp.error}</p>
              ) : null}
            </SaCard>

            <div className="flex flex-wrap gap-2 pt-1">
              {selected.status === 'pending' && !owner?.passwordSetAt ? (
                <p className="w-full text-xs text-[var(--sa-text-muted)]">
                  This owner has not set a password. Generate an onboarding invite from the agency record instead of
                  approving.
                </p>
              ) : null}
              {selected.status === 'pending' && owner?.passwordSetAt ? (
                <button type="button" className={sa.btnPrimary} onClick={() => setApproveOpen(true)}>
                  Approve
                </button>
              ) : null}
              {selected.status === 'pending' ? (
                <button type="button" className={sa.btnSecondary} onClick={() => setRejectOpen(true)}>
                  Reject
                </button>
              ) : null}
              {['pending', 'rejected'].includes(selected.status) ? (
                <button type="button" className={sa.btnDanger} onClick={() => setDeleteOpen(true)}>
                  Delete request
                </button>
              ) : null}
              {['active', 'rejected'].includes(selected.status) ? (
                <button
                  type="button"
                  className={sa.btnSecondary}
                  disabled={busy === 'notify'}
                  onClick={() =>
                    run('notify', async () => {
                      const { data } = await axios.post(`/api/super-admin/agencies/${selected._id}/notify`)
                      if (!data.success) throw new Error(data.message)
                      toast.success('Notification retry complete')
                      await refreshSelected(selected)
                    })
                  }
                >
                  {busy === 'notify' ? 'Retrying…' : 'Retry notifications'}
                </button>
              ) : null}
              <Link to={`/superadmin/agencies/${selected._id}`} className={sa.btnGhost}>
                Open full record →
              </Link>
            </div>
          </div>
        ) : null}
      </SaModal>

      <SaModal open={approveOpen} onClose={() => setApproveOpen(false)} title="Approve agency?">
        <p className="text-sm text-[var(--sa-text-secondary)] leading-relaxed">
          You are about to approve this agency and activate its RSZ CAR workspace.
        </p>
        <dl className="mt-4">
          <FieldRow label="Agency" value={selected?.name} />
          <FieldRow label="Contact" value={owner?.name} />
          <FieldRow label="Email" value={owner?.email || selected?.email} />
          <FieldRow label="Phone" value={selected?.phone || selected?.whatsapp} />
        </dl>
        <p className="mt-4 text-xs text-[var(--sa-text-muted)] leading-relaxed">
          This will activate the agency and allow the owner to access the RSZ CAR workspace. RSZ CAR will email the dashboard
          link. WhatsApp is a wa.me link only — API sending is not configured. Notification failure will not undo approval.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={sa.btnSecondary} onClick={() => setApproveOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={sa.btnPrimary}
            disabled={busy === 'approve'}
            onClick={() =>
              run('approve', async () => {
                const { data } = await axios.post(`/api/super-admin/agencies/${selected._id}/approve`)
                if (!data.success) throw new Error(data.message)
                setApproveOpen(false)
                setSuccess(data)
                await load(pagination.page)
              })
            }
          >
            {busy === 'approve' ? 'Approving…' : 'Approve agency'}
          </button>
        </div>
      </SaModal>

      <SaModal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject agency request?">
        <p className="text-sm text-[var(--sa-text-secondary)]">This agency will not be activated on RSZ CAR.</p>
        <label className={`${sa.label} mt-4`} htmlFor="reject-reason">
          Reason (optional)
        </label>
        <textarea
          id="reject-reason"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          className={sa.input}
          maxLength={500}
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={sa.btnSecondary} onClick={() => setRejectOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={sa.btnDanger}
            disabled={busy === 'reject'}
            onClick={() =>
              run('reject', async () => {
                const { data } = await axios.post(`/api/super-admin/agencies/${selected._id}/reject`, {
                  reason: rejectReason,
                })
                if (!data.success) throw new Error(data.message)
                toast.success('Request rejected')
                setRejectOpen(false)
                setSuccess({ ...data, rejected: true })
                await load(pagination.page)
              })
            }
          >
            {busy === 'reject' ? 'Rejecting…' : 'Reject request'}
          </button>
        </div>
      </SaModal>

      <SaModal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete agency request?">
        <p className="text-sm text-[var(--sa-text-secondary)] leading-relaxed">
          This hides the request from the approval center. The record is soft-deleted so audit history is kept. Type{' '}
          <strong>DELETE</strong> to confirm.
        </p>
        <input
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          className={`${sa.input} mt-4`}
          placeholder="DELETE"
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={sa.btnSecondary} onClick={() => setDeleteOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={sa.btnDanger}
            disabled={busy === 'delete' || deleteConfirm !== 'DELETE'}
            onClick={() =>
              run('delete', async () => {
                const { data } = await axios.delete(`/api/super-admin/agencies/${selected._id}`)
                if (!data.success) throw new Error(data.message)
                toast.success('Request deleted')
                setDeleteOpen(false)
                setSelected(null)
                await load(pagination.page)
              })
            }
          >
            {busy === 'delete' ? 'Deleting…' : 'Delete request'}
          </button>
        </div>
      </SaModal>

      <SaModal
        open={Boolean(success)}
        onClose={() => {
          setSuccess(null)
          setSelected(null)
        }}
        title={success?.rejected ? 'Request rejected' : 'Agency approved successfully'}
      >
        <p className="text-sm text-[var(--sa-text-secondary)] leading-relaxed">
          {success?.rejected
            ? 'The request is kept in history. It was not deleted.'
            : 'The agency is now active. The owner can access the RSZ CAR workspace.'}
        </p>
        <dl className="mt-4">
          <FieldRow label="Agency" value={success?.agency?.name} />
          <FieldRow label="Status" value={success?.rejected ? 'Rejected' : 'Approved'} />
          {!success?.rejected ? (
            <FieldRow label="Dashboard" value={success?.access?.dashboardUrl || success?.agency?.dashboardUrl} />
          ) : null}
          <FieldRow label="Email" value={notifyLabel(success?.notifications?.email)} />
          <FieldRow label="WhatsApp" value={notifyLabel(success?.notifications?.whatsapp)} />
        </dl>
        {success?.notifications?.email?.error ? (
          <p className="mt-3 text-xs text-[var(--sa-danger)]">{success.notifications.email.error}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {!success?.rejected ? (
            <>
          <a
            className={sa.btnPrimary}
            href={success?.access?.dashboardUrl || success?.agency?.dashboardUrl || '#'}
            target="_blank"
            rel="noreferrer"
          >
            Open Dashboard
          </a>
          <button
            type="button"
            className={sa.btnSecondary}
            onClick={async () => {
              const url = success?.access?.dashboardUrl || success?.agency?.dashboardUrl || ''
              const result = await copyToClipboard(url, 'Dashboard link copied')
              toast[result.ok ? 'success' : 'error'](result.message)
            }}
          >
            Copy Dashboard Link
          </button>
          {success?.whatsappUrl || success?.notifications?.whatsapp?.waMeUrl ? (
            <a
              className={sa.btnSecondary}
              href={success.whatsappUrl || success.notifications.whatsapp.waMeUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open WhatsApp
            </a>
          ) : null}
            </>
          ) : null}
          <button
            type="button"
            className={sa.btnGhost}
            onClick={() => {
              setSuccess(null)
              setSelected(null)
            }}
          >
            Close
          </button>
        </div>
      </SaModal>
    </div>
  )
}

export default SuperAdminAgencyRequests
