import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n/I18nContext'
import { booking } from '../ui/bookingUi'

/**
 * Searchable location dropdown (pickup / drop-off).
 * options: { value, label, keywords? }
 */
const LocationSelect = ({
  value,
  onChange,
  options = [],
  label,
  placeholder,
  searchPlaceholder,
  emptyText,
  className = '',
  id,
  required,
}) => {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [panelStyle, setPanelStyle] = useState({})
  const [isMobile, setIsMobile] = useState(false)
  const wrapRef = useRef(null)
  const panelRef = useRef(null)
  const inputRef = useRef(null)

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => {
      const hay = `${o.label} ${o.keywords || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [options, query])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!open || !isMobile) return
    document.body.classList.add('nav-open')
    return () => document.body.classList.remove('nav-open')
  }, [open, isMobile])

  const updatePosition = () => {
    if (!wrapRef.current || isMobile) {
      setPanelStyle({})
      return
    }
    const rect = wrapRef.current.getBoundingClientRect()
    const gutter = 16
    const width = Math.min(Math.max(rect.width, 300), window.innerWidth - gutter * 2)
    let left = rect.left
    left = Math.max(gutter, Math.min(left, window.innerWidth - width - gutter))
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < 320 && rect.top > spaceBelow
    setPanelStyle({
      position: 'fixed',
      left,
      width,
      maxWidth: `calc(100vw - ${gutter * 2}px)`,
      top: openUp ? undefined : rect.bottom + 8,
      bottom: openUp ? window.innerHeight - rect.top + 8 : undefined,
      zIndex: 80,
    })
  }

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onScroll = () => updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, isMobile])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
      setQuery('')
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus({ preventScroll: true })
  }, [open])

  const select = (val) => {
    onChange(val)
    setOpen(false)
    setQuery('')
  }

  const panel = open && (
    <div
      ref={panelRef}
      style={isMobile ? undefined : panelStyle}
      className={
        isMobile
          ? 'fixed inset-0 z-[80] flex flex-col justify-end bg-ink/40 backdrop-blur-[2px]'
          : 'date-range-popover'
      }
      onClick={isMobile ? () => setOpen(false) : undefined}
    >
      <div
        className={
          isMobile
            ? 'bg-white rounded-t-3xl p-4 sm:p-5 pb-[max(2rem,env(safe-area-inset-bottom))] max-h-[78svh] overflow-hidden flex flex-col shadow-2xl'
            : 'rounded-2xl border border-borderColor bg-white p-3 shadow-[0_24px_60px_-20px_rgba(22,18,16,0.35)] max-h-80 flex flex-col'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {isMobile && <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-borderColor" />}
        <div className="relative mb-3 shrink-0">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder || t('carDetails.searchLocation')}
            className="h-12 w-full rounded-2xl border border-borderColor bg-light/50 pl-10 pr-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-sm text-muted text-center py-6">{emptyText || t('carDetails.noLocations')}</p>
          )}
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt.value)}
              className={`booking-tap flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors cursor-pointer ${
                value === opt.value ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-sand/70 text-ink'
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sand text-primary mt-0.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </span>
              <span className="min-w-0 leading-snug">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <input type="hidden" id={id} value={value || ''} readOnly tabIndex={-1} aria-hidden />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`booking-tap ${booking.fieldShell} text-left focus:outline-none ${
          open
            ? 'border-primary/35 shadow-[0_0_0_3px_rgba(165, 22, 36,0.08)]'
            : 'hover:border-borderColor focus-visible:border-primary/35 focus-visible:shadow-[0_0_0_3px_rgba(165, 22, 36,0.08)]'
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-light text-muted ring-1 ring-borderColor/60">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </span>
        <span className={`min-w-0 flex-1 truncate text-[15px] leading-none ${selected ? 'font-medium text-ink' : 'text-muted/55'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 text-muted/70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && createPortal(panel, document.body)}
    </div>
  )
}

export default LocationSelect
