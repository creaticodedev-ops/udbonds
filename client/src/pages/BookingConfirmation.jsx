import React, { useMemo } from 'react'
import { Link, useLocation, Navigate } from 'react-router-dom'
import { motion as Motion } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext'
import { useAppContext } from '../context/AppContext'
import { booking } from '../components/ui/bookingUi'
import NoIndexHead from '../seo/NoIndexHead'

const formatDisplay = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const Row = ({ label, value }) => (
  <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1 sm:grid-cols-[9rem_1fr] sm:gap-x-4">
    <dt className="text-sm text-muted">{label}</dt>
    <dd className="text-sm font-medium text-ink break-words">{value || '—'}</dd>
  </div>
)

const BreakdownRows = ({ breakdown, currency, t }) => {
  if (!breakdown) return null

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-borderColor/70 bg-light/50">
      <div className="border-b border-borderColor/60 px-4 py-3">
        <p className={booking.label}>{t('confirmation.priceBreakdown')}</p>
      </div>
      <ul className="space-y-3 px-4 py-4 text-sm">
        <li className="flex justify-between gap-3 text-muted">
          <span>{t('confirmation.rentalPrice')}</span>
          <span className="font-medium tabular-nums text-ink">{currency}{breakdown.rentalPrice ?? 0}</span>
        </li>
        <li className="flex justify-between gap-3 text-muted">
          <span>{t('confirmation.pickupDeliveryFee')}</span>
          <span className="font-medium tabular-nums text-ink">
            {(breakdown.pickupDeliveryFee || 0) <= 0
              ? t('confirmation.free')
              : `${currency}${breakdown.pickupDeliveryFee}`}
          </span>
        </li>
        <li className="flex justify-between gap-3 text-muted">
          <span>{t('confirmation.dropoffDeliveryFee')}</span>
          <span className="font-medium tabular-nums text-ink">
            {(breakdown.dropoffDeliveryFee || 0) <= 0
              ? t('confirmation.free')
              : `${currency}${breakdown.dropoffDeliveryFee}`}
          </span>
        </li>
        {(breakdown.discountTotal || 0) > 0 && (
          <li className="flex justify-between gap-3 text-emerald-700">
            <span>{t('confirmation.discounts')}</span>
            <span className="font-medium tabular-nums">−{currency}{breakdown.discountTotal}</span>
          </li>
        )}
      </ul>
      <div className="flex items-center justify-between gap-3 bg-ink px-4 py-3.5 text-white">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">{t('confirmation.total')}</span>
        <span className="font-display text-2xl font-semibold tabular-nums tracking-tight">
          {currency}{breakdown.total ?? 0}
        </span>
      </div>
    </div>
  )
}

const BookingConfirmation = () => {
  const { state: routeState } = useLocation()
  const { t } = useI18n()
  const { currency, publicPath } = useAppContext()
  const carsPath = publicPath?.('/cars') || '/cars'
  const homePath = publicPath?.('/') || '/'

  const state = useMemo(() => {
    if (routeState?.reservationId) return routeState
    try {
      const stored = sessionStorage.getItem('lastReservation')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }, [routeState])

  if (!state?.reservationId) {
    return <Navigate to={carsPath} replace />
  }

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`page-pad page-shell mt-8 sm:mt-14 ${booking.pageBottom}`}
    >
      <NoIndexHead title="Confirmation de réservation" />
      <div className="mx-auto max-w-xl">
        <div className={`${booking.card} overflow-hidden`}>
          <div className="relative border-b border-borderColor/70 px-5 pb-6 pt-8 text-center sm:px-8 sm:pt-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-sand/40 to-transparent" aria-hidden />
            <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            </div>
            <p className={`relative ${booking.eyebrow}`}>{t('confirmation.reference')}</p>
            <h1 className="relative mt-2 font-display text-3xl font-medium text-ink sm:text-4xl">{t('confirmation.title')}</h1>
            <p className="relative mt-2 text-sm leading-relaxed text-muted">{t('confirmation.subtitle')}</p>
            <div className="relative mx-auto mt-6 max-w-sm rounded-2xl bg-light px-5 py-4 ring-1 ring-borderColor/70">
              <p className="font-display text-2xl font-semibold tracking-[0.08em] text-primary sm:text-3xl">
                {state.reservationId}
              </p>
              <p className="mt-1.5 text-xs text-muted">{t('confirmation.saveNote')}</p>
            </div>
          </div>

          <div className="space-y-4 px-5 py-6 sm:px-8 sm:py-7">
            <dl className="space-y-3.5">
              <Row label={`${t('confirmation.vehicle')}:`} value={state.carName} />
              <Row label={`${t('confirmation.name')}:`} value={state.customerName} />
              <Row label={`${t('confirmation.emailLabel')}:`} value={state.email} />
              <Row label={`${t('confirmation.phoneLabel')}:`} value={state.phone} />
              <Row label={`${t('confirmation.pickup')}:`} value={state.pickupLocation} />
              <Row label={`${t('confirmation.dropoff')}:`} value={state.returnLocation} />
              <Row label={`${t('confirmation.from')}:`} value={state.pickupDate ? formatDisplay(state.pickupDate) : '—'} />
              <Row label={`${t('confirmation.until')}:`} value={state.returnDate ? formatDisplay(state.returnDate) : '—'} />
            </dl>

            {state.priceBreakdown ? (
              <BreakdownRows breakdown={state.priceBreakdown} currency={currency} t={t} />
            ) : state.price != null ? (
              <p className="rounded-2xl bg-light px-4 py-3 text-sm ring-1 ring-borderColor/70">
                <span className="font-medium text-ink">{t('confirmation.total')}: </span>
                <span className="font-semibold text-primary tabular-nums">{currency}{state.price}</span>
              </p>
            ) : null}
          </div>

          <div className="sticky bottom-0 flex flex-col gap-3 border-t border-borderColor/70 bg-surface/95 px-5 py-4 backdrop-blur-md booking-safe-bottom sm:static sm:flex-row sm:justify-center sm:bg-transparent sm:px-8 sm:pb-8 sm:pt-0 sm:backdrop-blur-none">
            <Link to={carsPath} className={`${booking.btnPrimary} w-full sm:w-auto booking-tap`}>
              {t('confirmation.browseMore')}
            </Link>
            <Link to={homePath} className={`${booking.btnSecondary} w-full sm:w-auto booking-tap`}>
              {t('confirmation.backHome')}
            </Link>
          </div>
        </div>
      </div>
    </Motion.div>
  )
}

export default BookingConfirmation
