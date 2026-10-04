import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saError, useSuperAdmin } from '../../context/SuperAdminContext'
import { SaEmpty, formatRelativeTime, sa } from './saUi'

const groupLabel = {
  agencies: 'Agencies',
  users: 'Users',
  requests: 'Requests',
}

export const SaGlobalSearch = ({ open, onClose }) => {
  const { axios } = useSuperAdmin()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState({ agencies: [], users: [], requests: [] })

  useEffect(() => {
    if (!open) return undefined
    const timer = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query, open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebounced('')
      setResults({ agencies: [], users: [], requests: [] })
      setError('')
      return undefined
    }
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return undefined
    if (debounced.length < 2) {
      setResults({ agencies: [], users: [], requests: [] })
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError('')
    axios
      .get('/api/super-admin/search', { params: { q: debounced } })
      .then(({ data }) => {
        if (cancelled) return
        if (data.success) {
          setResults({
            agencies: data.agencies || [],
            users: data.users || [],
            requests: data.requests || [],
          })
        }
      })
      .catch((err) => {
        if (!cancelled) setError(saError(err, 'Search failed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [axios, debounced, open])

  const groups = useMemo(
    () =>
      ['requests', 'agencies', 'users']
        .map((key) => ({ key, items: results[key] || [] }))
        .filter((group) => group.items.length),
    [results],
  )

  const go = (item, key) => {
    if (key === 'requests') navigate(`/superadmin/requests`)
    else if (key === 'users') navigate(`/superadmin/admins/${item._id}`)
    else navigate(`/superadmin/agencies/${item._id}`)
    onClose?.()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[12vh] sm:px-4">
      <button type="button" className="absolute inset-0 bg-[var(--sa-overlay)]" aria-label="Close search" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Super Admin"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface)] shadow-[var(--sa-shadow)]"
      >
        <div className="border-b border-[var(--sa-border)] p-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agencies, users, requests…"
            className={sa.input}
            aria-label="Search anything"
          />
        </div>
        <div className="max-h-[min(24rem,50vh)] overflow-y-auto sa-scrollbar p-2">
          {error ? <p className="px-3 py-4 text-sm text-[var(--sa-danger)]">{error}</p> : null}
          {loading ? <p className="px-3 py-4 text-sm text-[var(--sa-text-muted)]">Searching…</p> : null}
          {!loading && !error && debounced.length >= 2 && !groups.length ? (
            <SaEmpty title="No matches" description="Try a name, email, phone, or slug." />
          ) : null}
          {!loading && debounced.length < 2 ? (
            <p className="px-3 py-4 text-sm text-[var(--sa-text-muted)]">Type at least two characters.</p>
          ) : null}
          {groups.map((group) => (
            <div key={group.key} className="mb-2">
              <p className={sa.sectionLabel}>{groupLabel[group.key]}</p>
              {group.items.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => go(item, group.key)}
                  className="flex w-full flex-col items-start rounded-[var(--sa-radius-sm)] px-3 py-2 text-left hover:bg-[var(--sa-surface-2)]"
                >
                  <span className="text-sm font-medium text-[var(--sa-text)]">{item.name}</span>
                  <span className="text-xs text-[var(--sa-text-muted)]">
                    {item.email || item.slug}
                    {item.status ? ` · ${item.status}` : ''}
                    {item.createdAt ? ` · ${formatRelativeTime(item.createdAt)}` : ''}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SaGlobalSearch
