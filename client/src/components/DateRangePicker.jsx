import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/I18nContext'

const WEEKDAYS = {
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  fr: ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'],
  es: ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'],
}

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
}

const pad = (n) => String(n).padStart(2, '0')

export const toISODate = (date) => {
  if (!date) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const parseISODate = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(String(value))) return null
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setHours(0, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const addMonths = (date, count) => new Date(date.getFullYear(), date.getMonth() + count, 1)

const sameDay = (a, b) =>
  Boolean(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate())

const isBeforeDay = (a, b) => a.getTime() < b.getTime()
const isAfterDay = (a, b) => a.getTime() > b.getTime()

const formatShort = (iso, language) => {
  const d = parseISODate(iso)
  if (!d) return ''
  const locale = language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-GB'
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

const addDays = (date, count) => {
  const d = new Date(date)
  d.setDate(d.getDate() + count)
  d.setHours(0, 0, 0, 0)
  return d
}

const MonthGrid = ({
  monthDate,
  minDate,
  maxDate,
  start,
  end,
  hover,
  onSelect,
  onHover,
  weekdays,
  monthNames,
  isDateBlocked,
}) => {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []

  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))

  const rangeEnd = end || hover

  return (
    <div className="w-full">
      <div className="mb-4 text-center">
        <p className="font-display text-[1.35rem] text-ink leading-none">
          {monthNames[month]}
        </p>
        <p className="mt-1 text-xs tracking-[0.12em] text-muted uppercase">{year}</p>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {weekdays.map((d) => (
          <div key={d} className="h-8 text-[11px] font-medium tracking-wide text-muted flex items-center justify-center">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} className="h-9 sm:h-10" />

          const beforeMin = isBeforeDay(date, minDate)
          const afterMax = maxDate ? isAfterDay(date, maxDate) : false
          const blocked = Boolean(isDateBlocked?.(date))
          const disabled = beforeMin || afterMax || blocked
          const isStart = sameDay(date, start)
          const isEnd = sameDay(date, end) || (!end && hover && sameDay(date, hover) && start && !sameDay(start, hover))
          const inRange =
            start &&
            rangeEnd &&
            !sameDay(start, rangeEnd) &&
            isAfterDay(date, start) &&
            isBeforeDay(date, rangeEnd)
          const isToday = sameDay(date, startOfDay(new Date()))
          const isSolo = isStart && (!rangeEnd || sameDay(start, rangeEnd))

          let shape = 'rounded-full'
          if (isStart && rangeEnd && !sameDay(start, rangeEnd)) shape = 'rounded-l-full rounded-r-none'
          if (isEnd && start && !sameDay(start, rangeEnd)) shape = 'rounded-r-full rounded-l-none'
          if (isSolo) shape = 'rounded-full'
          if (inRange) shape = 'rounded-none'

          return (
            <div
              key={toISODate(date)}
              className={`relative h-9 sm:h-10 flex items-center justify-center ${inRange && !blocked ? 'bg-primary/10' : ''} ${
                isStart && rangeEnd && !sameDay(start, rangeEnd) ? 'bg-primary/10 rounded-l-full' : ''
              } ${isEnd && start && !sameDay(start, rangeEnd) ? 'bg-primary/10 rounded-r-full' : ''}`}
            >
              <button
                type="button"
                disabled={disabled}
                title={blocked ? 'Unavailable' : undefined}
                onClick={() => onSelect(date)}
                onMouseEnter={() => !disabled && onHover(date)}
                className={[
                  'h-9 w-9 sm:h-10 sm:w-10 text-sm flex items-center justify-center transition-all duration-150 select-none',
                  shape,
                  disabled
                    ? blocked
                      ? 'text-[#C8C0BA] bg-[#F3EEE9]/70 line-through decoration-[#D5CDC8] cursor-not-allowed'
                      : 'text-[#C8C0BA] line-through decoration-[#D5CDC8] cursor-not-allowed'
                    : 'cursor-pointer hover:bg-sand text-ink',
                  (isStart || (isEnd && end) || (isEnd && !end && hover))
                    ? 'bg-primary text-white hover:bg-primary-dull font-semibold shadow-sm'
                    : '',
                  isToday && !isStart && !isEnd && !disabled
                    ? 'ring-1 ring-inset ring-primary/50'
                    : '',
                ].join(' ')}
              >
                {date.getDate()}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Premium dual-field date range picker with portaled calendar (never clipped).
 */
const DateRangePicker = ({
  startDate,
  endDate,
  onChange,
  minDate,
  /** Latest selectable pickup/return calendar day (advance booking limit). */
  maxDate = null,
  /** Minimum rental duration in days (from Booking Settings). */
  minSpanDays = 1,
  /** Maximum rental duration in days (from Booking Settings). */
  maxSpanDays = 0,
  /** Inclusive unavailable periods: [{ startDate, endDate }] ISO dates. */
  unavailablePeriods = [],
  pickupLabel,
  returnLabel,
  className = '',
  hint = '',
}) => {
  const { t, language } = useI18n()
  const [open, setOpen] = useState(false)
  const [activeField, setActiveField] = useState('start') // start | end
  const [viewMonth, setViewMonth] = useState(() => parseISODate(startDate) || startOfDay(new Date()))
  const [hover, setHover] = useState(null)
  const [panelStyle, setPanelStyle] = useState({})
  const [isMobile, setIsMobile] = useState(false)

  const wrapRef = useRef(null)
  const panelRef = useRef(null)

  const min = useMemo(() => startOfDay(minDate || new Date()), [minDate])
  const max = useMemo(() => (maxDate ? startOfDay(maxDate) : null), [maxDate])
  const start = useMemo(() => parseISODate(startDate), [startDate])
  const end = useMemo(() => parseISODate(endDate), [endDate])
  const span = Math.max(1, Math.round(Number(minSpanDays) || 1))
  const maxSpan = Math.max(0, Math.round(Number(maxSpanDays) || 0))
  const periods = useMemo(
    () =>
      (unavailablePeriods || [])
        .map((p) => ({
          startDate: String(p.startDate || p.start || '').slice(0, 10),
          endDate: String(p.endDate || p.end || '').slice(0, 10),
        }))
        .filter((p) => p.startDate && p.endDate),
    [unavailablePeriods],
  )

  const isDateBlocked = (date) => {
    const iso = toISODate(date)
    return periods.some((p) => iso >= p.startDate && iso <= p.endDate)
  }

  const endMin = useMemo(() => {
    if (!start) return min
    const offset = span > 1 ? span : 0
    const candidate = addDays(start, offset)
    return candidate.getTime() > min.getTime() ? candidate : min
  }, [start, span, min])

  const endMax = useMemo(() => {
    if (!start || maxSpan <= 0) return max
    // Calendar span of N rental days with equal times ≈ N days ahead for ceil-day calc when times equal.
    const candidate = addDays(start, Math.max(0, maxSpan))
    if (!max) return candidate
    return candidate.getTime() < max.getTime() ? candidate : max
  }, [start, maxSpan, max])

  const gridMin = activeField === 'end' && start ? endMin : min
  const gridMax = activeField === 'end' && start ? endMax : max
  const weekdays = WEEKDAYS[language] || WEEKDAYS.en
  const monthNames = MONTHS[language] || MONTHS.en

  useEffect(() => {
    // Sheet on phones only; tablets/desktop use anchored dual-month popover
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
    const dualMonth = window.innerWidth >= 768
    const width = Math.min(dualMonth ? 680 : 360, Math.max(320, window.innerWidth - gutter * 2))
    let left = rect.left + rect.width / 2 - width / 2
    left = Math.max(gutter, Math.min(left, window.innerWidth - width - gutter))
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < 420 && rect.top > spaceBelow

    setPanelStyle({
      position: 'fixed',
      left,
      width,
      maxWidth: `calc(100vw - ${gutter * 2}px)`,
      top: openUp ? undefined : rect.bottom + 10,
      bottom: openUp ? window.innerHeight - rect.top + 10 : undefined,
      zIndex: 80,
    })
  }

  useLayoutEffect(() => {
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
      setHover(null)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setHover(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openCalendar = (field) => {
    setActiveField(field)
    setViewMonth(start || startOfDay(new Date()))
    setOpen(true)
  }

  const rangeCrossesUnavailable = (from, to) => {
    if (!from || !to) return false
    let cursor = new Date(from)
    while (cursor.getTime() <= to.getTime()) {
      if (isDateBlocked(cursor)) return true
      cursor = addDays(cursor, 1)
    }
    return false
  }

  const handleSelect = (date) => {
    if (isBeforeDay(date, min)) return
    if (max && isAfterDay(date, max)) return
    if (isDateBlocked(date)) return

    if (activeField === 'start' || !start || (start && end)) {
      onChange({ startDate: toISODate(date), endDate: '' })
      setActiveField('end')
      setHover(null)
      return
    }

    if (isBeforeDay(date, start)) {
      onChange({ startDate: toISODate(date), endDate: '' })
      setActiveField('end')
      return
    }

    // Enforce minimum rental span when choosing the return date.
    if (isBeforeDay(date, endMin)) return
    if (endMax && isAfterDay(date, endMax)) return
    if (rangeCrossesUnavailable(start, date)) return

    onChange({ startDate: toISODate(start), endDate: toISODate(date) })
    setHover(null)
    setTimeout(() => setOpen(false), 160)
  }

  const clearDates = (e) => {
    e.stopPropagation()
    onChange({ startDate: '', endDate: '' })
    setActiveField('start')
    setHover(null)
  }

  const nights =
    start && end ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000)) : 0

  const fieldBase =
    'booking-tap flex-1 min-w-0 h-[3.75rem] px-4 text-left transition-colors duration-200 cursor-pointer rounded-2xl md:rounded-none flex flex-col justify-center'

  const calendarPanel = open && (
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
            ? 'bg-white rounded-t-3xl p-4 sm:p-5 pb-[max(2rem,env(safe-area-inset-bottom))] max-h-[88svh] overflow-y-auto shadow-2xl'
            : 'rounded-2xl border border-borderColor bg-white p-4 sm:p-5 shadow-[0_24px_60px_-20px_rgba(22,18,16,0.35)] max-h-[min(560px,calc(100vh-24px))] overflow-y-auto'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {isMobile && (
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-borderColor" />
        )}

        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted font-medium">
              {activeField === 'end' ? t('hero.selectReturn') : t('hero.selectPickup')}
            </p>
            {nights > 0 && (
              <p className="text-sm text-ink mt-1 font-medium truncate">{t('hero.nights', { count: nights })}</p>
            )}
            {span > 1 ? (
              <p className="mt-1 text-xs leading-snug text-muted">
                {hint || t('carDetails.minRentalGuide', { days: span })}
              </p>
            ) : null}
            {periods.length > 0 ? (
              <p className="mt-1 text-xs leading-snug text-muted">{t('carDetails.unavailableLegend')}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              className="h-9 w-9 rounded-xl border border-borderColor hover:bg-sand flex items-center justify-center cursor-pointer"
              aria-label="Previous month"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="h-9 w-9 rounded-xl border border-borderColor hover:bg-sand flex items-center justify-center cursor-pointer"
              aria-label="Next month"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <MonthGrid
            monthDate={viewMonth}
            minDate={gridMin}
            maxDate={gridMax}
            start={start}
            end={end}
            hover={activeField === 'end' ? hover : null}
            onSelect={handleSelect}
            onHover={setHover}
            weekdays={weekdays}
            monthNames={monthNames}
            isDateBlocked={isDateBlocked}
          />
          <div className="hidden md:block">
            <MonthGrid
              monthDate={addMonths(viewMonth, 1)}
              minDate={gridMin}
              maxDate={gridMax}
              start={start}
              end={end}
              hover={activeField === 'end' ? hover : null}
              onSelect={handleSelect}
              onHover={setHover}
              weekdays={weekdays}
              monthNames={monthNames}
              isDateBlocked={isDateBlocked}
            />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-borderColor flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={clearDates}
            className="booking-tap inline-flex h-12 items-center px-2 text-sm text-muted hover:text-ink transition-colors cursor-pointer"
          >
            {t('hero.clear')}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="booking-tap inline-flex h-12 items-center rounded-2xl bg-primary px-6 text-[15px] font-semibold text-white transition-colors hover:bg-primary-dull cursor-pointer"
          >
            {t('hero.done')}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <div className="flex flex-col divide-y divide-borderColor/80 md:flex-row md:items-stretch md:divide-x md:divide-y-0">
        <button
          type="button"
          onClick={() => openCalendar('start')}
          className={`${fieldBase} ${open && activeField === 'start' ? 'bg-sand/50' : 'hover:bg-sand/30 active:bg-sand/40'}`}
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {pickupLabel || t('hero.pickupDate')}
          </p>
          <p className={`truncate text-[15px] leading-none ${startDate ? 'font-medium text-ink' : 'text-muted/55'}`}>
            {startDate ? formatShort(startDate, language) : t('hero.selectPickup')}
          </p>
        </button>

        <button
          type="button"
          onClick={() => openCalendar(start ? 'end' : 'start')}
          className={`${fieldBase} ${open && activeField === 'end' ? 'bg-sand/50' : 'hover:bg-sand/30 active:bg-sand/40'}`}
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {returnLabel || t('hero.returnDate')}
          </p>
          <p className={`truncate text-[15px] leading-none ${endDate ? 'font-medium text-ink' : 'text-muted/55'}`}>
            {endDate ? formatShort(endDate, language) : t('hero.selectReturn')}
          </p>
        </button>
      </div>

      {open && createPortal(calendarPanel, document.body)}
    </div>
  )
}

export default DateRangePicker
