import React, { useMemo } from 'react'
import DateRangePicker, { toISODate, parseISODate } from '../DateRangePicker'
import { useI18n } from '../../i18n/I18nContext'
import { booking } from '../ui/bookingUi'
import { earliestReturnIsoDate } from '../../utils/bookingDuration'
import {
  filterTimeOptions,
  maxPickupDateFromAdvance,
} from '../../utils/vehicleAvailability'

const splitDateTime = (value) => {
  if (!value) return { date: '', time: '10:00' }
  const local = String(value).slice(0, 16)
  if (local.includes('T')) {
    const [date, time] = local.split('T')
    return { date, time: time || '10:00' }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(local)) return { date: local, time: '10:00' }
  return { date: '', time: '10:00' }
}

const mergeDateTime = (date, time) => (date ? `${date}T${time || '10:00'}` : '')

const ALL_TIME_OPTIONS = (() => {
  const out = []
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return out
})()

const TimeSelect = ({ label, value, onChange, id, options }) => {
  const { t } = useI18n()
  const slots = options?.length ? options : ALL_TIME_OPTIONS
  const safeValue = slots.includes(value) ? value : (slots[0] || value)

  return (
    <div>
      <label htmlFor={id} className={`mb-2 block ${booking.label}`}>
        {label}
      </label>
      <div className={booking.fieldShell}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-light text-muted ring-1 ring-borderColor/60">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
        <select
          id={id}
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 cursor-pointer appearance-none border-0 bg-transparent py-2.5 text-[15px] leading-none text-ink focus:outline-none focus:ring-0"
        >
          {slots.map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </select>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted/70">{t('carDetails.timeLabel')}</span>
      </div>
    </div>
  )
}

/** Premium date range (calendar) + pickup/return time selectors */
export default function ReservationDateTimes({
  pickupDate,
  returnDate,
  setPickupDate,
  setReturnDate,
  minDate,
  minRentalDays = null,
  maxRentalDays = null,
  advanceBookingDays = 365,
  pickupHoursStart = '08:00',
  pickupHoursEnd = '20:00',
  returnHoursStart = '08:00',
  returnHoursEnd = '20:00',
  unavailablePeriods = [],
  rulesLoading = false,
  dateError = '',
}) {
  const { t } = useI18n()
  const pickup = useMemo(() => splitDateTime(pickupDate), [pickupDate])
  const ret = useMemo(() => splitDateTime(returnDate), [returnDate])
  const minDays = minRentalDays == null ? null : Math.max(1, Math.round(Number(minRentalDays) || 1))
  const maxDays = maxRentalDays == null ? null : Math.max(minDays || 1, Math.round(Number(maxRentalDays) || 365))
  const spanReady = !rulesLoading && minDays != null

  const startISO = pickup.date
  const endISO = ret.date

  const pickupTimes = useMemo(
    () => filterTimeOptions(ALL_TIME_OPTIONS, pickupHoursStart, pickupHoursEnd),
    [pickupHoursStart, pickupHoursEnd],
  )
  const returnTimes = useMemo(
    () => filterTimeOptions(ALL_TIME_OPTIONS, returnHoursStart, returnHoursEnd),
    [returnHoursStart, returnHoursEnd],
  )

  const maxDate = useMemo(
    () => maxPickupDateFromAdvance(advanceBookingDays),
    [advanceBookingDays],
  )

  // Keep selected times inside allowed hour windows when settings load/change.
  React.useEffect(() => {
    if (!spanReady) return
    if (pickup.date && pickup.time && !pickupTimes.includes(pickup.time) && pickupTimes[0]) {
      setPickupDate(mergeDateTime(pickup.date, pickupTimes[0]))
    }
    if (ret.date && ret.time && !returnTimes.includes(ret.time) && returnTimes[0]) {
      setReturnDate(mergeDateTime(ret.date, returnTimes[0]))
    }
  }, [
    spanReady,
    pickup.date,
    pickup.time,
    ret.date,
    ret.time,
    pickupTimes,
    returnTimes,
    setPickupDate,
    setReturnDate,
  ])

  const handleRangeChange = ({ startDate, endDate }) => {
    if (startDate) {
      const time = pickupTimes.includes(pickup.time) ? pickup.time : (pickupTimes[0] || pickup.time)
      setPickupDate(mergeDateTime(startDate, time))
    } else {
      setPickupDate('')
    }
    if (endDate) {
      const earliest = spanReady ? earliestReturnIsoDate(startDate || startISO, minDays) : ''
      const safeEnd = earliest && endDate < earliest ? earliest : endDate
      const time = returnTimes.includes(ret.time) ? ret.time : (returnTimes[0] || ret.time)
      setReturnDate(mergeDateTime(safeEnd, time))
    } else if (startDate && !endDate) {
      setReturnDate('')
    }
  }

  return (
    <div className="space-y-4">
      {rulesLoading ? (
        <p className="rounded-2xl border border-borderColor/70 bg-light/70 px-3.5 py-2.5 text-xs leading-relaxed text-muted sm:text-[13px]">
          {t('carDetails.rulesLoading')}
        </p>
      ) : null}
      {spanReady && minDays > 1 ? (
        <p className="rounded-2xl border border-primary/15 bg-primary/[0.04] px-3.5 py-2.5 text-xs leading-relaxed text-ink/80 sm:text-[13px]">
          {t('carDetails.minRentalGuide', { days: minDays })}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-borderColor/80 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
        {spanReady ? (
          <DateRangePicker
            startDate={startISO}
            endDate={endISO}
            onChange={handleRangeChange}
            minDate={minDate}
            maxDate={maxDate}
            minSpanDays={minDays}
            maxSpanDays={maxDays || 0}
            unavailablePeriods={unavailablePeriods}
            pickupLabel={t('carDetails.pickupDate')}
            returnLabel={t('carDetails.returnDate')}
            className="w-full"
            hint={minDays > 1 ? t('carDetails.minRentalGuide', { days: minDays }) : ''}
          />
        ) : (
          <div className="flex h-[3.75rem] items-center px-4 text-sm text-muted" aria-busy="true">
            {t('carDetails.rulesLoading')}
          </div>
        )}
      </div>
      {dateError ? (
        <p className="rounded-2xl border border-red-200 bg-red-50/90 px-3.5 py-2.5 text-xs leading-relaxed text-red-700 sm:text-[13px]" role="alert">
          {dateError}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <TimeSelect
          id="pickup-time"
          label={t('carDetails.pickupTime')}
          value={pickup.time}
          options={pickupTimes}
          onChange={(time) => {
            if (pickup.date) setPickupDate(mergeDateTime(pickup.date, time))
          }}
        />
        <TimeSelect
          id="return-time"
          label={t('carDetails.returnTime')}
          value={ret.time}
          options={returnTimes}
          onChange={(time) => {
            if (ret.date) setReturnDate(mergeDateTime(ret.date, time))
          }}
        />
      </div>
    </div>
  )
}

export { splitDateTime, mergeDateTime, parseISODate, toISODate }
