import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSuperAdmin, saError } from '../../context/SuperAdminContext'
import { useI18n } from '../../i18n/I18nContext'
import PermissionMatrix from '../../components/superadmin/PermissionMatrix'
import {
  countGranted,
  isFullAccess,
  resolveCatalog,
  summarizeAccess,
} from '../../utils/permissionMeta'
import { SaEmpty, SaPageHeader, SaSkeleton, sa } from './saUi'

const SuperAdminPermissions = () => {
  const { axios } = useSuperAdmin()
  const { t } = useI18n()
  const [admins, setAdmins] = useState([])
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [accessFilter, setAccessFilter] = useState('all') // all | full | restricted
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState([])
  const [baseline, setBaseline] = useState([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.get('/api/super-admin/admins?limit=100')
      if (!data.success) throw new Error(data.message)
      const list = data.admins || []
      setAdmins(list)
      setCatalog(resolveCatalog(data.permissionCatalog))
      setSelectedId((prev) => {
        if (prev && list.some((a) => a._id === prev)) return prev
        return list[0]?._id || ''
      })
    } catch (err) {
      setError(saError(err))
      toast.error(saError(err))
    } finally {
      setLoading(false)
    }
  }, [axios])

  useEffect(() => {
    load()
  }, [load])

  const selected = useMemo(
    () => admins.find((a) => a._id === selectedId) || null,
    [admins, selectedId],
  )

  useEffect(() => {
    if (!selected) {
      setDraft([])
      setBaseline([])
      return
    }
    const perms = Array.isArray(selected.permissions) ? [...selected.permissions] : []
    setDraft(perms)
    setBaseline(perms)
  }, [selected?._id]) // eslint-disable-line react-hooks/exhaustive-deps -- sync when selection changes

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return admins.filter((a) => {
      if (statusFilter !== 'all' && a.accountStatus !== statusFilter) return false
      const full = isFullAccess(a.permissions)
      if (accessFilter === 'full' && !full) return false
      if (accessFilter === 'restricted' && full) return false
      if (!q) return true
      const hay = `${a.name || ''} ${a.email || ''} ${a.agencyName || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [admins, search, accessFilter, statusFilter])

  const save = async (permissions) => {
    if (!selected) return
    setSaving(true)
    try {
      const { data } = await axios.patch(`/api/super-admin/admins/${selected._id}/permissions`, {
        permissions,
      })
      if (!data.success) throw new Error(data.message)
      toast.success(t('superadmin.perms.saveSuccess'))
      const nextPerms = Array.isArray(data.admin?.permissions) ? data.admin.permissions : permissions
      setAdmins((prev) =>
        prev.map((a) =>
          a._id === selected._id
            ? { ...a, permissions: nextPerms, updatedAt: data.admin?.updatedAt || a.updatedAt }
            : a,
        ),
      )
      setDraft([...nextPerms])
      setBaseline([...nextPerms])
    } catch (err) {
      toast.error(saError(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={sa.page}>
        <SaPageHeader title={t('superadmin.perms.hubTitle')} subtitle={t('superadmin.perms.loading')} />
        <SaSkeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error && !admins.length) {
    return (
      <div className={sa.page}>
        <SaPageHeader title={t('superadmin.perms.hubTitle')} />
        <div className={`${sa.card} ${sa.cardPad} border-[var(--sa-danger)]/30 text-sm text-[var(--sa-danger)]`}>
          {error}
        </div>
        <button type="button" onClick={load} className={sa.btnPrimary}>
          {t('superadmin.perms.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className={sa.page}>
      <SaPageHeader title={t('superadmin.perms.hubTitle')} subtitle={t('superadmin.perms.hubSubtitle')} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <aside className={`${sa.card} overflow-hidden`}>
          <div className="space-y-2 border-b border-[var(--sa-border)] p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('superadmin.perms.searchAdmins')}
              className={sa.input}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={accessFilter}
                onChange={(e) => setAccessFilter(e.target.value)}
                className={`${sa.select} text-xs w-full`}
              >
                <option value="all">{t('superadmin.perms.filterAccessAll')}</option>
                <option value="full">{t('superadmin.perms.filterAccessFull')}</option>
                <option value="restricted">{t('superadmin.perms.filterAccessRestricted')}</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`${sa.select} text-xs w-full`}
              >
                <option value="all">{t('superadmin.perms.filterStatusAll')}</option>
                <option value="active">{t('superadmin.perms.filterStatusActive')}</option>
                <option value="suspended">{t('superadmin.perms.filterStatusSuspended')}</option>
                <option value="disabled">{t('superadmin.perms.filterStatusDisabled')}</option>
              </select>
            </div>
          </div>
          <ul className="max-h-[28rem] overflow-y-auto sa-scrollbar divide-y divide-[var(--sa-border)]">
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-[var(--sa-text-muted)]">
                {t('superadmin.perms.noAdmins')}
              </li>
            )}
            {filtered.map((admin) => {
              const summary = summarizeAccess(admin.permissions, catalog)
              const active = admin._id === selectedId
              return (
                <li key={admin._id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(admin._id)}
                    className={`w-full px-3 py-3 text-left transition-colors ${
                      active ? 'bg-[var(--sa-accent-soft)]' : 'hover:bg-[var(--sa-surface-2)]'
                    }`}
                  >
                    <p className="truncate text-sm font-medium text-[var(--sa-text)]">{admin.name}</p>
                    <p className="truncate text-xs text-[var(--sa-text-muted)]">{admin.email}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[10px] uppercase tracking-wide ${
                          summary.mode === 'full' ? 'text-[var(--sa-success)]' : 'text-[var(--sa-accent)]'
                        }`}
                      >
                        {summary.mode === 'full'
                          ? t('superadmin.perms.badgeFull')
                          : t('superadmin.perms.badgeCount', {
                              granted: summary.granted,
                              total: summary.total,
                            })}
                      </span>
                      <span className="text-[10px] capitalize text-[var(--sa-text-muted)]">
                        {admin.accountStatus}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-[var(--sa-border)] px-3 py-2 text-[10px] text-[var(--sa-text-muted)]">
            {t('superadmin.perms.adminCount', { count: filtered.length, total: admins.length })}
          </div>
        </aside>

        <div className="min-w-0 space-y-3">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--sa-text-muted)]">
                <Link to={`/superadmin/admins/${selected._id}`} className={sa.btnGhost}>
                  {t('superadmin.perms.openProfile')}
                </Link>
                <span>
                  {isFullAccess(selected.permissions)
                    ? t('superadmin.perms.badgeFull')
                    : t('superadmin.perms.badgeCount', {
                        granted: countGranted(selected.permissions, catalog),
                        total: catalog.length,
                      })}
                </span>
              </div>
              <PermissionMatrix
                catalog={catalog}
                value={draft}
                baseline={baseline}
                onChange={setDraft}
                peerAdmins={admins}
                currentAdminId={selected._id}
                currentAdminName={selected.name || selected.email}
                saving={saving}
                onSave={save}
                updatedAt={selected.updatedAt}
              />
            </>
          ) : (
            <SaEmpty title={t('superadmin.perms.selectAdmin')} />
          )}
        </div>
      </div>
    </div>
  )
}

export default SuperAdminPermissions
