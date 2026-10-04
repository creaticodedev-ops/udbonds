import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { formatRelativeTime, sa } from './saUi'

const severityDot = (severity) => {
  if (severity === 'critical') return 'var(--sa-danger)'
  if (severity === 'warn') return 'var(--sa-warn)'
  return 'var(--sa-accent)'
}

export const SaNotificationCenter = ({
  open,
  onClose,
  items = [],
  unread = 0,
  loading,
  onMarkRead,
  onMarkAll,
}) => {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface)] shadow-[var(--sa-shadow)]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--sa-border)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[var(--sa-text)]">Notifications</p>
          <p className="text-xs text-[var(--sa-text-muted)]">
            {unread ? `${unread} new notification${unread === 1 ? '' : 's'}` : 'You are caught up'}
          </p>
        </div>
        <button type="button" className={sa.btnGhost} onClick={onMarkAll} disabled={!unread}>
          Mark all as read
        </button>
      </div>
      <div className="max-h-[min(22rem,60vh)] overflow-y-auto sa-scrollbar">
        {loading ? <p className="px-4 py-6 text-sm text-[var(--sa-text-muted)]">Loading…</p> : null}
        {!loading && !items.length ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--sa-text-muted)]">
            Platform events will appear here.
          </p>
        ) : null}
        {items.map((item) => (
          <Link
            key={item._id}
            to={item.href || '/superadmin/notifications'}
            onClick={() => {
              if (!item.readAt) onMarkRead?.(item._id)
              onClose?.()
            }}
            className="flex gap-3 border-b border-[var(--sa-border)] px-4 py-3 last:border-0 hover:bg-[var(--sa-surface-2)]"
          >
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ background: item.readAt ? 'var(--sa-border-strong)' : severityDot(item.severity) }}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--sa-text)]">{item.title}</span>
              {item.body ? (
                <span className="mt-0.5 block text-xs text-[var(--sa-text-secondary)]">{item.body}</span>
              ) : null}
              <span className="mt-1 block text-[11px] text-[var(--sa-text-muted)]">
                {formatRelativeTime(item.createdAt)}
              </span>
            </span>
          </Link>
        ))}
      </div>
      <div className="border-t border-[var(--sa-border)] px-4 py-2.5">
        <Link to="/superadmin/notifications" onClick={onClose} className={sa.link}>
          View all notifications
        </Link>
      </div>
    </div>
  )
}

export default SaNotificationCenter
