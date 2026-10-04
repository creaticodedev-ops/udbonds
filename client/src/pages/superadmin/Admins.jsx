import React, { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSuperAdmin, saError } from '../../context/SuperAdminContext'
import {
  SaBadge,
  SaEmpty,
  SaField,
  SaModal,
  SaPageHeader,
  SaPagination,
  SaFilterBar,
  SaSkeleton,
  sa,
  statusBadgeTone,
} from './saUi'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  agencyName: '',
  notes: '',
  startTrial: true,
}

const SuperAdminAdmins = () => {
  const { axios } = useSuperAdmin()
  const [searchParams, setSearchParams] = useSearchParams()
  const [admins, setAdmins] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [license, setLicense] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(searchParams.get('create') === '1')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const { data } = await axios.get('/api/super-admin/admins', {
          params: { search: debouncedSearch, status, license, page, limit: 20 },
        })
        if (data.success) {
          setAdmins(data.admins)
          setPagination(data.pagination)
        }
      } catch (error) {
        toast.error(saError(error))
      } finally {
        setLoading(false)
      }
    },
    [axios, debouncedSearch, status, license],
  )

  useEffect(() => {
    load(1)
  }, [load])

  useEffect(() => {
    if (searchParams.get('create') === '1') setShowCreate(true)
  }, [searchParams])

  const createAdmin = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await axios.post('/api/super-admin/admins', form)
      if (data.success) {
        toast.success('Admin created')
        setForm(emptyForm)
        setShowCreate(false)
        setSearchParams({})
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

  return (
    <div className={sa.page}>
      <SaPageHeader
        title="Users"
        subtitle="Agency owners across the platform. Passwords are never shown."
        action={
          <button type="button" onClick={() => setShowCreate(true)} className={sa.btnPrimary}>
            Create user
          </button>
        }
      />

      <SaModal open={showCreate} onClose={() => { setShowCreate(false); setSearchParams({}) }} title="Create admin account" wide>
        <form onSubmit={createAdmin} className="grid sm:grid-cols-2 gap-4">
          {[
            ['name', 'Full name', 'text', true],
            ['email', 'Email', 'email', true],
            ['password', 'Temporary password', 'password', true],
            ['agencyName', 'Agency name', 'text', false],
          ].map(([key, label, type, required]) => (
            <SaField key={key} label={label}>
              <input
                required={required}
                type={type}
                minLength={key === 'password' ? 8 : undefined}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className={sa.input}
              />
            </SaField>
          ))}
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
            Start 7-day trial immediately
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className={sa.btnPrimary}>
              {saving ? 'Creating…' : 'Create account'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className={sa.btnSecondary}>
              Cancel
            </button>
          </div>
        </form>
      </SaModal>

      <SaFilterBar>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, agency…"
          className={`${sa.input} flex-1 min-w-[12rem]`}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={sa.select}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="disabled">Disabled</option>
        </select>
        <select value={license} onChange={(e) => setLicense(e.target.value)} className={sa.select}>
          <option value="">All licenses</option>
          <option value="trial">Trial</option>
          <option value="active">Licensed</option>
          <option value="expired">Expired</option>
        </select>
      </SaFilterBar>

      <div className={sa.tableWrap}>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <SaSkeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : admins.length === 0 ? (
          <SaEmpty title="No admins found" description="Adjust filters or create a new admin account." />
        ) : (
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr>
                <th className={sa.th}>User</th>
                <th className={sa.th}>Agency</th>
                <th className={sa.th}>Role</th>
                <th className={sa.th}>Status</th>
                <th className={sa.th}>Last activity</th>
                <th className={sa.th}>Created</th>
                <th className={sa.th} />
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                  <tr key={admin._id} className={sa.row}>
                    <td className={sa.td}>
                      <p className="font-medium text-[var(--sa-text)]">{admin.name}</p>
                      <p className="text-xs text-[var(--sa-text-muted)]">{admin.email}</p>
                    </td>
                    <td className={sa.td}>{admin.agencyName || '—'}</td>
                    <td className={sa.td}>
                      <SaBadge tone="neutral">Owner</SaBadge>
                    </td>
                    <td className={sa.td}>
                      <SaBadge tone={statusBadgeTone(admin.accountStatus)}>{admin.accountStatus || 'active'}</SaBadge>
                    </td>
                    <td className={`${sa.td} text-xs text-[var(--sa-text-muted)]`}>
                      {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : '—'}
                    </td>
                    <td className={`${sa.td} text-xs text-[var(--sa-text-muted)]`}>
                      {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className={`${sa.td} text-right`}>
                      <Link to={`/superadmin/admins/${admin._id}`} className={sa.btnGhost}>
                        View
                      </Link>
                    </td>
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

export default SuperAdminAdmins
