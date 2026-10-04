import React, { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import {
  ALL_ACTION_TYPES,
  countGranted,
  diffPermissions,
  hasSensitiveChange,
  isFullAccess,
  modulesForCatalog,
  resolveCatalog,
  samePermissions,
  summarizeAccess,
} from '../../utils/permissionMeta'
import { SaBadge, sa } from '../../pages/superadmin/saUi'

const chipClass = (on) =>
  `inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
    on
      ? 'bg-[var(--sa-accent-soft)] text-[var(--sa-accent)] ring-1 ring-[var(--sa-accent)]/30'
      : 'bg-[var(--sa-surface-2)] text-[var(--sa-text-muted)] ring-1 ring-[var(--sa-border)]'
  }`

const modeBtn = (active) =>
  active ? sa.btnSmPrimary : sa.btnSmSecondary

/**
 * Enterprise RBAC matrix for a single owner-admin.
 * Speaks the existing permission contract: [] = full access; non-empty = allow-list.
 */
const PermissionMatrix = ({
  catalog: catalogProp,
  value,
  baseline,
  onChange,
  peerAdmins = [],
  currentAdminId = '',
  currentAdminName = '',
  saving = false,
  onSave,
  onCancel,
  updatedAt = null,
  className = '',
}) => {
  const { t } = useI18n()
  const catalog = useMemo(() => resolveCatalog(catalogProp), [catalogProp])
  const modules = useMemo(() => modulesForCatalog(catalog), [catalog])

  const [expanded, setExpanded] = useState(() => Object.fromEntries(modules.map((m) => [m.id, true])))
  const [permQuery, setPermQuery] = useState('')
  const [copyFromId, setCopyFromId] = useState('')
  const [compareId, setCompareId] = useState('')

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev }
      modules.forEach((m) => {
        if (next[m.id] === undefined) next[m.id] = true
      })
      return next
    })
  }, [modules])

  const dirty = !samePermissions(value, baseline)
  const summary = summarizeAccess(value, catalog)
  const full = isFullAccess(value)
  const granted = useMemo(() => {
    if (full) return new Set(catalog)
    return new Set((value || []).filter((p) => catalog.includes(p)))
  }, [value, catalog, full])

  const comparePeer = peerAdmins.find((a) => a._id === compareId)
  const compareDiff = useMemo(() => {
    if (!comparePeer) return null
    return diffPermissions(value, comparePeer.permissions || [], catalog)
  }, [comparePeer, value, catalog])

  const q = permQuery.trim().toLowerCase()
  const filteredModules = useMemo(() => {
    if (!q) return modules
    return modules
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((p) => {
          const label = t(p.labelKey).toLowerCase()
          const desc = t(p.descKey).toLowerCase()
          const groupLabel = t(group.labelKey).toLowerCase()
          return p.key.includes(q) || label.includes(q) || desc.includes(q) || groupLabel.includes(q)
        }),
      }))
      .filter((g) => g.permissions.length > 0)
  }, [modules, q, t])

  const setRestrictedList = (keys) => {
    const unique = [...new Set(keys.filter((k) => catalog.includes(k)))]
    onChange(unique)
  }

  const enableFullAccess = () => onChange([])

  const enableRestricted = (seedKeys = catalog) => {
    const seed = seedKeys.filter((k) => catalog.includes(k))
    onChange(seed.length ? seed : [...catalog])
  }

  const toggleKey = (key) => {
    if (full) {
      enableRestricted(catalog.filter((k) => k !== key))
      return
    }
    const next = granted.has(key) ? (value || []).filter((k) => k !== key) : [...(value || []), key]
    setRestrictedList(next)
  }

  const setModuleKeys = (moduleKeys, on) => {
    if (full) {
      if (on) return
      enableRestricted(catalog.filter((k) => !moduleKeys.includes(k)))
      return
    }
    const set = new Set(value || [])
    moduleKeys.forEach((k) => {
      if (on) set.add(k)
      else set.delete(k)
    })
    setRestrictedList([...set])
  }

  const selectAll = () => enableRestricted([...catalog])
  const clearToFull = () => enableFullAccess()
  const resetBaseline = () => onChange(Array.isArray(baseline) ? [...baseline] : [])

  const resetModule = (moduleKeys) => {
    if (isFullAccess(baseline)) {
      const set = new Set(full ? catalog : value || [])
      moduleKeys.forEach((k) => set.add(k))
      if (set.size === catalog.length) enableFullAccess()
      else setRestrictedList([...set])
      return
    }
    const baseSet = new Set(baseline || [])
    const set = new Set(full ? catalog : value || [])
    moduleKeys.forEach((k) => {
      if (baseSet.has(k)) set.add(k)
      else set.delete(k)
    })
    if (set.size === catalog.length && isFullAccess(baseline)) enableFullAccess()
    else setRestrictedList([...set])
  }

  const copyFromPeer = () => {
    const peer = peerAdmins.find((a) => a._id === copyFromId)
    if (!peer) return
    onChange(Array.isArray(peer.permissions) ? [...peer.permissions] : [])
  }

  const handleSave = () => {
    if (!onSave || !dirty) return
    if (hasSensitiveChange(baseline, value)) {
      const ok = window.confirm(t('superadmin.perms.confirmSensitive'))
      if (!ok) return
    } else {
      const ok = window.confirm(t('superadmin.perms.confirmSave'))
      if (!ok) return
    }
    onSave(value)
  }

  const peers = peerAdmins.filter((a) => a._id !== currentAdminId)

  return (
    <div className={`${sa.card} overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--sa-border)] px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">
              {t('superadmin.perms.title')}
            </h2>
            {dirty ? <SaBadge tone="warn">{t('superadmin.perms.unsaved')}</SaBadge> : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--sa-text-muted)]">{t('superadmin.perms.subtitle')}</p>
          {currentAdminName ? (
            <p className="mt-2 text-xs text-[var(--sa-text-secondary)]">
              {t('superadmin.perms.editing', { name: currentAdminName })}
            </p>
          ) : null}
        </div>
        <div className="text-right text-xs text-[var(--sa-text-muted)]">
          <p>
            {summary.mode === 'full'
              ? t('superadmin.perms.summaryFull')
              : t('superadmin.perms.summaryRestricted', {
                  granted: summary.granted,
                  total: summary.total,
                })}
          </p>
          {updatedAt ? (
            <p className="mt-1">
              {t('superadmin.perms.lastUpdated', { date: new Date(updatedAt).toLocaleString() })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 border-b border-[var(--sa-border)] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={clearToFull} className={modeBtn(full)}>
            {t('superadmin.perms.modeFull')}
          </button>
          <button
            type="button"
            onClick={() => enableRestricted(full ? catalog : value?.length ? value : catalog)}
            className={modeBtn(!full)}
          >
            {t('superadmin.perms.modeRestricted')}
          </button>
          <span className="mx-1 hidden h-6 w-px bg-[var(--sa-border)] sm:inline-block" aria-hidden />
          <button type="button" onClick={selectAll} className={sa.btnSmSecondary}>
            {t('superadmin.perms.selectAll')}
          </button>
          <button type="button" onClick={clearToFull} className={sa.btnSmSecondary}>
            {t('superadmin.perms.clearFull')}
          </button>
          <button type="button" disabled={!dirty} onClick={resetBaseline} className={sa.btnSmSecondary}>
            {t('superadmin.perms.revert')}
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className={sa.label}>{t('superadmin.perms.searchPerms')}</span>
            <input
              value={permQuery}
              onChange={(e) => setPermQuery(e.target.value)}
              placeholder={t('superadmin.perms.searchPermsPlaceholder')}
              className={sa.input}
            />
          </label>
          <label className="block">
            <span className={sa.label}>{t('superadmin.perms.copyFrom')}</span>
            <div className="flex gap-2">
              <select
                value={copyFromId}
                onChange={(e) => setCopyFromId(e.target.value)}
                className={`${sa.select} min-w-0 flex-1 w-full`}
              >
                <option value="">{t('superadmin.perms.copyFromPlaceholder')}</option>
                {peers.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name || a.email}
                    {isFullAccess(a.permissions) ? ` (${t('superadmin.perms.badgeFull')})` : ''}
                  </option>
                ))}
              </select>
              <button type="button" disabled={!copyFromId} onClick={copyFromPeer} className={sa.btnSmSecondary}>
                {t('superadmin.perms.copy')}
              </button>
            </div>
          </label>
          <label className="block">
            <span className={sa.label}>{t('superadmin.perms.compareWith')}</span>
            <select value={compareId} onChange={(e) => setCompareId(e.target.value)} className={`${sa.select} w-full`}>
              <option value="">{t('superadmin.perms.comparePlaceholder')}</option>
              {peers.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name || a.email}
                </option>
              ))}
            </select>
          </label>
        </div>

        {comparePeer && compareDiff ? (
          <div className="rounded-[var(--sa-radius-sm)] border border-[var(--sa-border)] bg-[var(--sa-surface-2)] px-3 py-3 text-xs text-[var(--sa-text-secondary)]">
            <p className="font-medium text-[var(--sa-text)]">
              {t('superadmin.perms.compareTitle', { name: comparePeer.name || comparePeer.email })}
            </p>
            <p className="mt-1">
              {t('superadmin.perms.comparePeerSummary', {
                summary: isFullAccess(comparePeer.permissions)
                  ? t('superadmin.perms.badgeFull')
                  : t('superadmin.perms.summaryRestricted', {
                      granted: countGranted(comparePeer.permissions, catalog),
                      total: catalog.length,
                    }),
              })}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <span className="text-[var(--sa-success)]">
                +{compareDiff.added.length}{' '}
                {compareDiff.added.length
                  ? compareDiff.added.map((k) => t(`superadmin.perms.keys.${k}`)).join(', ')
                  : '—'}
              </span>
              <span className="text-[var(--sa-danger)]">
                −{compareDiff.removed.length}{' '}
                {compareDiff.removed.length
                  ? compareDiff.removed.map((k) => t(`superadmin.perms.keys.${k}`)).join(', ')
                  : '—'}
              </span>
            </div>
          </div>
        ) : null}

        <p className="text-[11px] leading-relaxed text-[var(--sa-text-muted)]">{t('superadmin.perms.sessionNote')}</p>
      </div>

      <div className="divide-y divide-[var(--sa-border)]">
        {filteredModules.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--sa-text-muted)] sm:px-6">
            {t('superadmin.perms.noMatch')}
          </p>
        ) : null}
        {filteredModules.map((group) => {
          const moduleKeys = group.permissions.map((p) => p.key)
          const allOn = moduleKeys.every((k) => granted.has(k))
          const someOn = moduleKeys.some((k) => granted.has(k))
          const open = expanded[group.id] !== false

          return (
            <div key={group.id}>
              <div className="flex flex-wrap items-center gap-2 bg-[var(--sa-surface-2)]/60 px-4 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [group.id]: !open }))}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-expanded={open}
                >
                  <span className="text-[var(--sa-text-muted)]">{open ? '▾' : '▸'}</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--sa-text)]">
                    {t(group.labelKey)}
                  </span>
                  <span className="text-[10px] text-[var(--sa-text-muted)]">
                    {moduleKeys.filter((k) => granted.has(k)).length}/{moduleKeys.length}
                  </span>
                </button>
                <button type="button" onClick={() => setModuleKeys(moduleKeys, !allOn)} className={sa.btnSmSecondary}>
                  {allOn ? t('superadmin.perms.clearModule') : t('superadmin.perms.selectModule')}
                </button>
                <button type="button" onClick={() => resetModule(moduleKeys)} className={sa.btnGhost}>
                  {t('superadmin.perms.resetModule')}
                </button>
                {!allOn && someOn ? (
                  <SaBadge tone="warn">{t('superadmin.perms.partial')}</SaBadge>
                ) : null}
              </div>

              {open ? (
                <div className="overflow-x-auto sa-scrollbar">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr>
                        <th className={sa.th}>{t('superadmin.perms.colModule')}</th>
                        <th className={`${sa.th} text-center w-24`}>{t('superadmin.perms.colAccess')}</th>
                        {ALL_ACTION_TYPES.map((action) => (
                          <th key={action} className={`${sa.th} text-center w-16`}>
                            {t(`superadmin.perms.actions.${action}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.permissions.map((perm) => {
                        const on = granted.has(perm.key)
                        return (
                          <tr key={perm.key} className={sa.row}>
                            <td className={`${sa.td} sm:px-6`}>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-[var(--sa-text)]">{t(perm.labelKey)}</span>
                                {perm.sensitive ? (
                                  <SaBadge tone="danger">{t('superadmin.perms.sensitive')}</SaBadge>
                                ) : null}
                              </div>
                              <p className="mt-0.5 text-xs text-[var(--sa-text-muted)]">{t(perm.descKey)}</p>
                              <p className="mt-0.5 font-mono text-[10px] text-[var(--sa-text-muted)]">{perm.key}</p>
                            </td>
                            <td className={`${sa.td} text-center`}>
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggleKey(perm.key)}
                                className="h-4 w-4"
                                aria-label={t(perm.labelKey)}
                              />
                            </td>
                            {ALL_ACTION_TYPES.map((action) => {
                              const applies = perm.actions.includes(action)
                              return (
                                <td key={action} className={`${sa.td} text-center`}>
                                  {applies ? (
                                    <span className={chipClass(on)} title={t(`superadmin.perms.actions.${action}`)}>
                                      {on ? '●' : '○'}
                                    </span>
                                  ) : (
                                    <span className="text-[var(--sa-text-muted)]">—</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--sa-border)] px-4 py-4 sm:px-6">
        <p className="text-xs text-[var(--sa-text-muted)]">
          {dirty ? t('superadmin.perms.dirtyHint') : t('superadmin.perms.cleanHint')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => {
              resetBaseline()
              onCancel?.()
            }}
            className={sa.btnSecondary}
          >
            {t('superadmin.perms.cancel')}
          </button>
          <button type="button" disabled={!dirty || saving} onClick={handleSave} className={sa.btnPrimary}>
            {saving ? t('superadmin.perms.saving') : t('superadmin.perms.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PermissionMatrix
