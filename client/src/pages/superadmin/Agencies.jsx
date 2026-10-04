import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSuperAdmin, saError } from '../../context/SuperAdminContext'
import {
  SaAvatar,
  SaBadge,
  SaEmpty,
  SaField,
  SaLogoUpload,
  SaModal,
  SaPageHeader,
  SaPagination,
  SaFilterBar,
  SaSkeleton,
  copyToClipboard,
  sa,
  statusBadgeTone,
} from './saUi'

const emptyForm = {
  name: '',
  slug: '',
  ownerName: '',
  ownerEmail: '',
  phone: '',
  whatsapp: '',
  address: '',
  city: '',
  country: '',
  logoUrl: '',
  notes: '',
  startTrial: true,
  isPublicStorefront: false,
}

const SORT_KEYS = {
  name: (a) => a.name?.toLowerCase() || '',
  slug: (a) => a.slug?.toLowerCase() || '',
  owner: (a) => a.primaryOwner?.name?.toLowerCase() || '',
  status: (a) => a.status || '',
  license: (a) => a.primaryOwner?.licenseStatus || '',
  created: (a) => new Date(a.createdAt || 0).getTime(),
}

const SuperAdminAgencies = () => {
  const { axios } = useSuperAdmin()
  const [searchParams, setSearchParams] = useSearchParams()
  const [agencies, setAgencies] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [licenseFilter, setLicenseFilter] = useState('')
  const [sortKey, setSortKey] = useState('created')
  const [sortDir, setSortDir] = useState('desc')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(searchParams.get('create') === '1')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [createdInvite, setCreatedInvite] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const { data } = await axios.get('/api/super-admin/agencies', {
          params: { q: debouncedSearch, status, page, limit: 20 },
        })
        if (data.success) {
          setAgencies(data.agencies || [])
          setPagination(
            data.pagination || {
              page: data.page || 1,
              totalPages: data.pages || 1,
              total: data.total || 0,
            },
          )
        }
      } catch (error) {
        toast.error(saError(error))
      } finally {
        setLoading(false)
      }
    },
    [axios, debouncedSearch, status],
  )

  useEffect(() => {
    load(1)
  }, [load])

  useEffect(() => {
    if (searchParams.get('create') === '1') setShowCreate(true)
  }, [searchParams])

  const displayed = useMemo(() => {
    let rows = [...agencies]
    if (licenseFilter) {
      rows = rows.filter((a) => (a.primaryOwner?.licenseStatus || '') === licenseFilter)
    }
    const getter = SORT_KEYS[sortKey] || SORT_KEYS.created
    rows.sort((a, b) => {
      const av = getter(a)
      const bv = getter(b)
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return rows
  }, [agencies, licenseFilter, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'created' ? 'desc' : 'asc')
    }
  }

  const sortIndicator = (key) => {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const createAgency = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await axios.post('/api/super-admin/agencies', form)
      if (data.success) {
        toast.success('Agency created — share the onboarding link')
        setForm(emptyForm)
        setShowCreate(false)
        setSearchParams({})
        setCreatedInvite({
          url: data.onboardingUrl,
          expiresAt: data.inviteExpiresAt,
          agency: data.agency,
        })
        load(1)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(saError(error))
    } finally {
      setSaving(false)
    }
  }

  const copyInvite = async () => {
    if (!createdInvite?.url) return
    const result = await copyToClipboard(createdInvite.url, 'Onboarding link copied')
    toast[result.ok ? 'success' : 'error'](result.message)
  }

  const openCreate = () => {
    setShowCreate(true)
    setCreatedInvite(null)
  }

  const closeCreate = () => {
    setShowCreate(false)
    setSearchParams({})
  }

  return (
    <div className={sa.page}>
      <SaPageHeader
        title="Agencies"
        subtitle="Create agencies and invite owners. Owners set their own password via a secure onboarding link."
        action={
          <button type="button" onClick={openCreate} className={sa.btnPrimary}>
            Create agency
          </button>
        }
      />

      {createdInvite?.url ? (
        <div className={`${sa.card} ${sa.cardPad} border-[var(--sa-accent)]/30 bg-[var(--sa-accent-soft)]`}>
          <p className="text-sm font-semibold text-[var(--sa-text)]">
            Agency created{createdInvite.agency?.name ? `: ${createdInvite.agency.name}` : ''}
          </p>
          <p className="mt-1 text-xs text-[var(--sa-text-muted)]">
            Send this single-use onboarding link to the owner.
            {createdInvite.expiresAt
              ? ` Expires ${new Date(createdInvite.expiresAt).toLocaleString()}.`
              : ' It expires after a few days.'}
          </p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input readOnly value={createdInvite.url} className={`${sa.input} font-mono text-xs`} />
            <button type="button" onClick={copyInvite} className={sa.btnSecondary}>
              Copy link
            </button>
          </div>
          {createdInvite.agency?._id ? (
            <Link to={`/superadmin/agencies/${createdInvite.agency._id}`} className={`${sa.btnGhost} mt-3 inline-flex`}>
              Open agency details →
            </Link>
          ) : null}
        </div>
      ) : null}

      <SaModal open={showCreate} onClose={closeCreate} title="Create agency" wide>
        <form onSubmit={createAgency} className="grid sm:grid-cols-2 gap-4">
          <SaField label="Agency name *" className="sm:col-span-2">
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={sa.input}
            />
          </SaField>
          <SaField label="Agency slug" hint="Auto-generated from name if empty">
            <input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="auto-from-name"
              className={`${sa.input} font-mono`}
            />
          </SaField>
          <SaField label="Primary owner name *">
            <input
              required
              value={form.ownerName}
              onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
              className={sa.input}
            />
          </SaField>
          <SaField label="Primary owner email *">
            <input
              required
              type="email"
              value={form.ownerEmail}
              onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
              className={sa.input}
            />
          </SaField>
          <SaField label="Phone">
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={sa.input} />
          </SaField>
          <SaField label="WhatsApp">
            <input
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              className={sa.input}
            />
          </SaField>
          <SaField label="Address" className="sm:col-span-2">
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className={sa.input}
            />
          </SaField>
          <SaField label="City">
            <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className={sa.input} />
          </SaField>
          <SaField label="Country">
            <input
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className={sa.input}
            />
          </SaField>
          <SaLogoUpload
            className="sm:col-span-2"
            value={form.logoUrl}
            onChange={(logoUrl) => setForm((f) => ({ ...f, logoUrl }))}
            disabled={saving}
          />
          <SaField label="Internal notes" className="sm:col-span-2">
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={sa.input}
            />
          </SaField>
          <label className="flex items-center gap-2 text-sm text-[var(--sa-text-secondary)] sm:col-span-2">
            <input
              type="checkbox"
              checked={form.startTrial}
              onChange={(e) => setForm((f) => ({ ...f, startTrial: e.target.checked }))}
              className="accent-[var(--sa-accent)]"
            />
            Start 7-day trial for owner
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--sa-text-secondary)] sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isPublicStorefront}
              onChange={(e) => setForm((f) => ({ ...f, isPublicStorefront: e.target.checked }))}
              className="accent-[var(--sa-accent)]"
            />
            Public storefront agency
          </label>
          <p className="sm:col-span-2 text-xs text-[var(--sa-text-muted)]">
            The owner creates their own password via the activation link. You never set or see their password.
          </p>
          <div className="sm:col-span-2 flex gap-2 pt-2">
            <button type="submit" disabled={saving} className={sa.btnPrimary}>
              {saving ? 'Creating…' : 'Create & generate invite'}
            </button>
            <button type="button" onClick={closeCreate} className={sa.btnSecondary}>
              Cancel
            </button>
          </div>
        </form>
      </SaModal>

      <SaFilterBar>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or slug…"
          className={`${sa.input} flex-1 min-w-[12rem]`}
          aria-label="Search agencies"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={sa.select} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="disabled">Disabled</option>
        </select>
        <select
          value={licenseFilter}
          onChange={(e) => setLicenseFilter(e.target.value)}
          className={sa.select}
          aria-label="Filter by license"
          title="Filters current page results"
        >
          <option value="">All licenses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
        </select>
      </SaFilterBar>

      <div className={sa.tableWrap}>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <SaSkeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <SaEmpty
            title="No agencies found"
            description="Try adjusting your search or filters, or create a new agency."
            action={
              <button type="button" onClick={openCreate} className={sa.btnPrimary}>
                Create agency
              </button>
            }
          />
        ) : (
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr>
                <th className={sa.th}>
                  <button type="button" onClick={() => toggleSort('name')} className="hover:text-[var(--sa-text)]">
                    Agency{sortIndicator('name')}
                  </button>
                </th>
                <th className={sa.th}>
                  <button type="button" onClick={() => toggleSort('owner')} className="hover:text-[var(--sa-text)]">
                    Owner{sortIndicator('owner')}
                  </button>
                </th>
                <th className={sa.th}>
                  <button type="button" onClick={() => toggleSort('status')} className="hover:text-[var(--sa-text)]">
                    Status{sortIndicator('status')}
                  </button>
                </th>
                <th className={sa.th}>
                  <button type="button" onClick={() => toggleSort('license')} className="hover:text-[var(--sa-text)]">
                    License{sortIndicator('license')}
                  </button>
                </th>
                <th className={sa.th}>Storefront</th>
                <th className={sa.th}>
                  <button type="button" onClick={() => toggleSort('created')} className="hover:text-[var(--sa-text)]">
                    Created{sortIndicator('created')}
                  </button>
                </th>
                <th className={sa.th} />
              </tr>
            </thead>
            <tbody>
              {displayed.map((agency) => (
                <tr key={agency._id} className={sa.row}>
                  <td className={sa.td}>
                    <div className="flex items-center gap-3">
                      <SaAvatar name={agency.name} src={agency.logoUrl} size={32} />
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--sa-text)] truncate">{agency.name}</p>
                        <p className="text-xs font-mono text-[var(--sa-text-muted)]">{agency.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className={sa.td}>
                    <p className="text-[var(--sa-text)]">{agency.primaryOwner?.name || '—'}</p>
                    <p className="text-xs text-[var(--sa-text-muted)]">{agency.primaryOwner?.email || ''}</p>
                  </td>
                  <td className={sa.td}>
                    <SaBadge tone={statusBadgeTone(agency.status)}>{agency.status || 'active'}</SaBadge>
                    {agency.invitePending ? (
                      <span className="mt-1 block text-[10px] text-[var(--sa-warn)]">Invite pending</span>
                    ) : null}
                  </td>
                  <td className={sa.td}>
                    {agency.primaryOwner?.licenseStatus ? (
                      <SaBadge tone={statusBadgeTone(agency.primaryOwner.licenseStatus)}>
                        {agency.primaryOwner.licenseStatus}
                      </SaBadge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={sa.td}>
                    {agency.isPublicStorefront ? (
                      <SaBadge tone="info">Public</SaBadge>
                    ) : (
                      <span className="text-xs text-[var(--sa-text-muted)]">Private</span>
                    )}
                  </td>
                  <td className={`${sa.td} text-xs text-[var(--sa-text-muted)]`}>
                    {agency.createdAt ? new Date(agency.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className={`${sa.td} text-right`}>
                    <Link to={`/superadmin/agencies/${agency._id}`} className={sa.btnGhost}>
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SaPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        onPage={load}
      />
    </div>
  )
}

export default SuperAdminAgencies
