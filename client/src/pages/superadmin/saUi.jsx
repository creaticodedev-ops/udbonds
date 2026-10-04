import React, { useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

export const sa = {
  page: 'space-y-6 sm:space-y-8',
  title: 'text-[1.65rem] sm:text-[1.85rem] font-semibold tracking-tight text-[var(--sa-text)]',
  subtitle: 'mt-1 text-sm text-[var(--sa-text-muted)] max-w-2xl leading-relaxed',
  card: 'rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface)] shadow-[var(--sa-shadow)]',
  cardPad: 'p-4 sm:p-5',
  label: 'block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sa-text-muted)] mb-1.5',
  input:
    'w-full min-h-10 rounded-[var(--sa-radius-sm)] border border-[var(--sa-border)] bg-[var(--sa-input-bg)] px-3 text-sm text-[var(--sa-text)] placeholder:text-[var(--sa-text-muted)] outline-none transition focus:border-[var(--sa-accent)]',
  select:
    'min-h-10 rounded-[var(--sa-radius-sm)] border border-[var(--sa-border)] bg-[var(--sa-input-bg)] px-3 text-sm text-[var(--sa-text)] outline-none focus:border-[var(--sa-accent)]',
  btnPrimary:
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--sa-radius-sm)] bg-[var(--sa-accent)] px-4 text-sm font-semibold text-[var(--sa-on-accent)] transition hover:bg-[var(--sa-accent-hover)] disabled:opacity-50 disabled:pointer-events-none',
  btnSecondary:
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--sa-radius-sm)] border border-[var(--sa-border-strong)] bg-[var(--sa-surface)] px-4 text-sm font-medium text-[var(--sa-text)] transition hover:bg-[var(--sa-surface-2)] disabled:opacity-50 disabled:pointer-events-none',
  btnGhost:
    'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[var(--sa-radius-sm)] px-3 text-sm font-medium text-[var(--sa-text-secondary)] transition hover:bg-[var(--sa-accent-soft)] hover:text-[var(--sa-accent)] disabled:opacity-50',
  btnDanger:
    'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[var(--sa-radius-sm)] border border-[var(--sa-danger)]/30 bg-[var(--sa-danger-soft)] px-3 text-sm font-medium text-[var(--sa-danger)] transition hover:opacity-90 disabled:opacity-50',
  btnSm:
    'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-[var(--sa-radius-sm)] px-3 text-xs font-medium transition disabled:opacity-50 disabled:pointer-events-none',
  btnSmPrimary:
    'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-[var(--sa-radius-sm)] bg-[var(--sa-accent)] px-3 text-xs font-semibold text-[var(--sa-on-accent)] transition hover:bg-[var(--sa-accent-hover)] disabled:opacity-50 disabled:pointer-events-none',
  btnSmSecondary:
    'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-[var(--sa-radius-sm)] border border-[var(--sa-border-strong)] bg-[var(--sa-surface)] px-3 text-xs font-medium text-[var(--sa-text-secondary)] transition hover:bg-[var(--sa-surface-2)] hover:text-[var(--sa-text)] disabled:opacity-50',
  link: 'text-xs font-medium text-[var(--sa-accent)] hover:text-[var(--sa-accent-hover)] transition',
  sectionLabel: 'px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--sa-text-muted)]',
  tableWrap: 'overflow-x-auto rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface)]',
  th: 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--sa-text-muted)] border-b border-[var(--sa-border)] bg-[var(--sa-surface-2)]',
  td: 'px-4 py-3 text-sm text-[var(--sa-text-secondary)] border-b border-[var(--sa-border)]',
  row: 'hover:bg-[var(--sa-surface-2)]/80 transition-colors',
}

export const SaBadge = ({ tone = 'neutral', children, className = '' }) => {
  const tones = {
    neutral: 'bg-[var(--sa-surface-2)] text-[var(--sa-text-secondary)] border-[var(--sa-border)]',
    success: 'bg-[var(--sa-success-soft)] text-[var(--sa-success)] border-transparent',
    warn: 'bg-[var(--sa-warn-soft)] text-[var(--sa-warn)] border-transparent',
    danger: 'bg-[var(--sa-danger-soft)] text-[var(--sa-danger)] border-transparent',
    info: 'bg-[var(--sa-info-soft)] text-[var(--sa-info)] border-transparent',
    accent: 'bg-[var(--sa-accent-soft)] text-[var(--sa-accent)] border-transparent',
  }
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize ${tones[tone] || tones.neutral} ${className}`}
    >
      {children}
    </span>
  )
}

export const statusBadgeTone = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'active' || s === 'trialing' || s === 'approved' || s === 'sent') return 'success'
  if (s === 'pending' || s === 'trial' || s === 'past_due' || s === 'link_ready') return 'warn'
  if (s === 'suspended' || s === 'disabled' || s === 'expired' || s === 'canceled' || s === 'rejected' || s === 'failed') return 'danger'
  return 'neutral'
}

export const SaCard = ({ title, description, action, children, className = '' }) => (
  <section className={`${sa.card} ${sa.cardPad} ${className}`}>
    {(title || description || action) && (
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {title ? <h2 className="text-sm font-semibold text-[var(--sa-text)]">{title}</h2> : null}
          {description ? <p className="mt-0.5 text-xs text-[var(--sa-text-muted)]">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
    )}
    {children}
  </section>
)

export const SaStat = ({ label, value, hint, accent }) => (
  <div className={`${sa.card} ${sa.cardPad}`}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sa-text-muted)]">{label}</p>
    <p
      className="mt-2 text-2xl font-semibold tabular-nums tracking-tight"
      style={{ color: accent || 'var(--sa-text)' }}
    >
      {value ?? '—'}
    </p>
    {hint ? <p className="mt-1 text-xs text-[var(--sa-text-muted)]">{hint}</p> : null}
  </div>
)

export const SaSkeleton = ({ className = '' }) => (
  <div className={`sa-shimmer rounded-[var(--sa-radius-sm)] bg-[var(--sa-border)] ${className}`} />
)

export const SaEmpty = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
    <p className="text-sm font-semibold text-[var(--sa-text)]">{title}</p>
    {description ? <p className="mt-1 max-w-sm text-xs text-[var(--sa-text-muted)]">{description}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
)

export const SaError = ({ title = 'Unable to load this view', description, onRetry }) => (
  <div className={`${sa.card} ${sa.cardPad} flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between`}>
    <div>
      <p className="text-sm font-semibold text-[var(--sa-text)]">{title}</p>
      {description ? <p className="mt-1 text-xs text-[var(--sa-text-muted)]">{description}</p> : null}
    </div>
    {onRetry ? (
      <button type="button" onClick={onRetry} className={sa.btnSecondary}>
        Retry
      </button>
    ) : null}
  </div>
)

export const SaHealthDot = ({ status = 'operational', label }) => {
  const map = {
    operational: { color: 'var(--sa-success)', text: 'Operational' },
    warning: { color: 'var(--sa-warn)', text: 'Warning' },
    warn: { color: 'var(--sa-warn)', text: 'Warning' },
    error: { color: 'var(--sa-danger)', text: 'Error' },
    not_configured: { color: 'var(--sa-text-muted)', text: 'Not configured' },
  }
  const item = map[status] || map.operational
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[var(--sa-text-secondary)]">
      <span className="h-2 w-2 rounded-full" style={{ background: item.color }} aria-hidden />
      <span className="sr-only">{status}</span>
      {label || item.text}
    </span>
  )
}

export const formatRelativeTime = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const minutes = Math.round((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleString()
}

export const formatAuditAction = (action = '') =>
  String(action)
    .replace(/^superadmin\./, '')
    .replace(/[._]/g, ' ')

export const SaModal = ({ open, onClose, title, children, wide }) => {
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
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-[var(--sa-overlay)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[92svh] overflow-y-auto sa-scrollbar rounded-t-[var(--sa-radius)] sm:rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface)] shadow-[var(--sa-shadow)]`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--sa-border)] bg-[var(--sa-surface)] px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-[var(--sa-text)]">{title}</h2>
          <button type="button" onClick={onClose} className={sa.btnGhost} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  )
}

export const SaAvatar = ({ name, src, size = 36 }) => {
  const initials = String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="rounded-[var(--sa-radius-sm)] object-cover border border-[var(--sa-border)]"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-[var(--sa-radius-sm)] bg-[var(--sa-accent-soft)] text-[var(--sa-accent)] text-xs font-bold border border-[var(--sa-border)]"
      style={{ width: size, height: size }}
    >
      {initials || '?'}
    </span>
  )
}

/** Simple CSS bar chart — no chart lib dependency */
export const SaBarChart = ({ items = [], max = null }) => {
  const peak = max || Math.max(1, ...items.map((i) => Number(i.value) || 0))
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.round(((Number(item.value) || 0) / peak) * 100)
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-[var(--sa-text-secondary)]">{item.label}</span>
              <span className="tabular-nums font-medium text-[var(--sa-text)]">{item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--sa-surface-2)] overflow-hidden border border-[var(--sa-border)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: item.color || 'var(--sa-chart-1)',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const confirmDestructive = (message) => window.confirm(message)

export const copyToClipboard = async (text, successMsg = 'Copied') => {
  try {
    await navigator.clipboard.writeText(text)
    return { ok: true, message: successMsg }
  } catch {
    return { ok: false, message: 'Could not copy' }
  }
}

export const SaField = ({ label, hint, children, className = '' }) => (
  <div className={className}>
    {label ? <label className={sa.label}>{label}</label> : null}
    {children}
    {hint ? <p className="mt-1 text-[11px] text-[var(--sa-text-muted)]">{hint}</p> : null}
  </div>
)

export const SaTabs = ({ tabs, active, onChange }) => (
  <div className="flex gap-1 overflow-x-auto sa-scrollbar border-b border-[var(--sa-border)] pb-px -mb-px" role="tablist">
    {tabs.map((tab) => {
      const isActive = active === tab.id
      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(tab.id)}
          className={`shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 transition ${
            isActive
              ? 'border-[var(--sa-accent)] text-[var(--sa-accent)]'
              : 'border-transparent text-[var(--sa-text-muted)] hover:text-[var(--sa-text)] hover:border-[var(--sa-border-strong)]'
          }`}
        >
          {tab.label}
          {tab.count != null ? (
            <span
              className={`ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                tab.priority ? 'bg-[var(--sa-warn-soft)] text-[var(--sa-warn)]' : 'bg-[var(--sa-surface-2)] text-[var(--sa-text-muted)]'
              }`}
            >
              {tab.count}
            </span>
          ) : null}
        </button>
      )
    })}
  </div>
)

export const SaPageHeader = ({ title, subtitle, action, breadcrumb }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {breadcrumb ? <div className="mb-2">{breadcrumb}</div> : null}
      <h1 className={typeof title === 'string' ? sa.title : 'text-[1.65rem] sm:text-[1.85rem] font-semibold tracking-tight text-[var(--sa-text)]'}>
        {title}
      </h1>
      {subtitle ? (
        typeof subtitle === 'string' ? (
          <p className={sa.subtitle}>{subtitle}</p>
        ) : (
          <div className={sa.subtitle}>{subtitle}</div>
        )
      ) : null}
    </div>
    {action ? <div className="flex flex-wrap gap-2 shrink-0">{action}</div> : null}
  </div>
)

export const SaFilterBar = ({ children, className = '' }) => (
  <div className={`flex flex-col sm:flex-row flex-wrap gap-2 ${className}`}>{children}</div>
)

export const SaPagination = ({ page, totalPages, total, onPage, className = '' }) => {
  if (!totalPages || totalPages <= 1) return null
  return (
    <nav
      className={`flex items-center gap-3 text-sm text-[var(--sa-text-secondary)] ${className}`}
      aria-label="Pagination"
    >
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={sa.btnGhost}>
        Previous
      </button>
      <span className="tabular-nums">
        Page {page} / {totalPages}
        {total != null ? (
          <span className="text-[var(--sa-text-muted)]"> · {total} total</span>
        ) : null}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className={sa.btnGhost}
      >
        Next
      </button>
    </nav>
  )
}

export const SaLink = ({ to, children, className = '', ...props }) => {
  if (to) {
    return (
      <Link to={to} className={`${sa.link} ${className}`} {...props}>
        {children}
      </Link>
    )
  }
  return (
    <a className={`${sa.link} ${className}`} {...props}>
      {children}
    </a>
  )
}

const LOGO_MAX_BYTES = 1.5 * 1024 * 1024

export const readImageFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Only image files are allowed'))
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      reject(new Error('Logo must be under 1.5 MB'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read logo file'))
    reader.readAsDataURL(file)
  })

/** Theme-aware logo picker — sets logoUrl (data URL or external URL) for existing API fields. */
export const SaLogoUpload = ({
  value = '',
  onChange,
  label = 'Agency logo',
  hint = 'PNG, JPG, or WebP · max 1.5 MB. Or paste a URL below.',
  disabled = false,
  name = '',
  className = '',
}) => {
  const inputId = useId()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const preview = value?.startsWith('data:') || value?.startsWith('http') ? value : ''

  const pickFile = () => {
    if (!disabled && !busy) inputRef.current?.click()
  }

  const onFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await readImageFileAsDataUrl(file)
      onChange?.(dataUrl)
      toast.success('Logo ready')
    } catch (error) {
      toast.error(error.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const clearLogo = () => {
    onChange?.('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <SaField label={label} hint={hint} className={className}>
      <div
        className={`rounded-[var(--sa-radius)] border border-dashed border-[var(--sa-border-strong)] bg-[var(--sa-surface-2)] p-4 transition ${
          disabled ? 'opacity-60 pointer-events-none' : 'hover:border-[var(--sa-accent)]/40'
        }`}
      >
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[var(--sa-radius-sm)] border border-[var(--sa-border)] bg-[var(--sa-surface)]"
            aria-hidden
          >
            {preview ? (
              <img src={preview} alt="" className="max-h-full max-w-full object-contain p-1" />
            ) : (
              <svg className="h-8 w-8 text-[var(--sa-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <div className="flex flex-wrap gap-2 min-w-0">
            <input
              ref={inputRef}
              id={inputId}
              name={name}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="sr-only"
              disabled={disabled || busy}
              onChange={onFileChange}
            />
            <button type="button" onClick={pickFile} disabled={disabled || busy} className={sa.btnSecondary}>
              {busy ? 'Processing…' : preview ? 'Replace logo' : 'Upload logo'}
            </button>
            {preview ? (
              <button type="button" onClick={clearLogo} disabled={disabled || busy} className={sa.btnGhost}>
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor={`${inputId}-url`} className="text-[11px] font-medium text-[var(--sa-text-muted)]">
          Or paste logo URL
        </label>
        <input
          id={`${inputId}-url`}
          type="url"
          value={value?.startsWith('data:') ? '' : value}
          placeholder="https://…"
          disabled={disabled || busy}
          onChange={(e) => onChange?.(e.target.value.trim())}
          className={`${sa.input} mt-1.5`}
        />
      </div>
    </SaField>
  )
}
