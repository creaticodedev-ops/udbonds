import React, { useMemo } from 'react'
import { motion as Motion } from 'framer-motion'
import PhoneInput from '../PhoneInput'
import LocationSelect from './LocationSelect'
import ReservationDateTimes from './ReservationDateTimes'
import { WhatsAppButton } from '../forms/PremiumFormUI'
import { booking } from '../ui/bookingUi'

const fieldInput =
  'min-w-0 flex-1 border-0 bg-transparent py-2.5 text-[15px] leading-none text-ink placeholder:text-muted/55 focus:outline-none focus:ring-0'

const Label = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className={`mb-2 block ${booking.label}`}>
    {children}
  </label>
)

const IconWrap = ({ children }) => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-light text-muted ring-1 ring-borderColor/60">
    {children}
  </span>
)

const SectionHeading = ({ step, title }) => (
  <div className="mb-4 flex items-center gap-3">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">
      {step}
    </span>
    <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
  </div>
)

const Icons = {
  user: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
    </svg>
  ),
  mail: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0v-.243a2.25 2.25 0 00-1.07-1.916l-7.5-4.615a2.25 2.25 0 00-2.36 0L3.32 4.91a2.25 2.25 0 00-1.07 1.916V6.75" />
    </svg>
  ),
  phone: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.907 1.21a12.042 12.042 0 01-5.516-5.517l1.21-.907a.75.75 0 00.417-1.173l-1.106-4.423A.75.75 0 006.58 3.42H5.208A2.25 2.25 0 003 5.625v1.372z" />
    </svg>
  ),
  note: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  ),
}

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] },
  }),
}

function BookingSummary({ breakdown, currency, t, car, pickupLabel, returnLabel, daysLabel, dateError = '', minRentalDays = 0, rulesLoading = false }) {
  const ready = breakdown?.ready

  return (
    <div className="overflow-hidden rounded-2xl border border-borderColor/70 bg-light/60">
      <div className="flex items-start justify-between gap-3 border-b border-borderColor/60 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{t('carDetails.summaryTitle')}</p>
          <p className="mt-1.5 font-display text-xl font-medium leading-none text-ink truncate sm:text-[1.35rem]">
            {car.brand} {car.model}
          </p>
          {ready && daysLabel ? <p className="mt-1.5 text-xs text-muted">{daysLabel}</p> : null}
          {!ready && !rulesLoading && minRentalDays > 1 ? (
            <p className="mt-1.5 text-xs text-muted">{t('carDetails.minRentalGuide', { days: minRentalDays })}</p>
          ) : null}
          {rulesLoading ? (
            <p className="mt-1.5 text-xs text-muted">{t('carDetails.rulesLoading')}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{t('carDetails.rateLabel')}</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {currency}{car.pricePerDay}
            <span className="text-xs font-normal text-muted">{t('carDetails.perDay')}</span>
          </p>
        </div>
      </div>

      {dateError ? (
        <p className="px-4 py-5 text-sm leading-relaxed text-red-700 sm:px-5" role="alert">{dateError}</p>
      ) : !ready ? (
        <p className="px-4 py-5 text-sm leading-relaxed text-muted sm:px-5">{t('carDetails.priceHint')}</p>
      ) : (
        <ul className="space-y-3 px-4 py-4 text-sm sm:px-5">
          <li className="flex justify-between gap-3 text-muted">
            <span>{t('carDetails.rentalPrice')}</span>
            <span className="font-medium tabular-nums text-ink">{currency}{breakdown.rentalPrice}</span>
          </li>
          <li className="flex justify-between gap-3 text-muted">
            <span>{t('carDetails.pickupDeliveryFee')}</span>
            <span className="font-medium tabular-nums text-ink">
              {breakdown.pickupDeliveryFee <= 0 ? t('carDetails.free') : `${currency}${breakdown.pickupDeliveryFee}`}
            </span>
          </li>
          <li className="flex justify-between gap-3 text-muted">
            <span>{t('carDetails.dropoffDeliveryFee')}</span>
            <span className="font-medium tabular-nums text-ink">
              {breakdown.dropoffDeliveryFee <= 0 ? t('carDetails.free') : `${currency}${breakdown.dropoffDeliveryFee}`}
            </span>
          </li>
          {(breakdown.extraDriverFee || 0) > 0 && (
            <li className="flex justify-between gap-3 text-muted">
              <span>{t('carDetails.extraDriverFee')}</span>
              <span className="font-medium tabular-nums text-ink">{currency}{breakdown.extraDriverFee}</span>
            </li>
          )}
          {breakdown.discountTotal > 0 && (
            <li className="flex justify-between gap-3 text-emerald-700">
              <span>{t('carDetails.discounts')}</span>
              <span className="font-medium tabular-nums">−{currency}{breakdown.discountTotal}</span>
            </li>
          )}
        </ul>
      )}

      {pickupLabel && returnLabel && (
        <div className="space-y-2 border-t border-borderColor/60 px-4 py-3.5 text-xs leading-relaxed text-muted sm:px-5">
          <p className="line-clamp-2">
            <span className="font-semibold text-ink/80">{t('carDetails.pickupLocation')}: </span>
            {pickupLabel}
          </p>
          <p className="line-clamp-2">
            <span className="font-semibold text-ink/80">{t('carDetails.dropoffLocation')}: </span>
            {returnLabel}
          </p>
        </div>
      )}

      <div className="flex items-end justify-between gap-3 bg-ink px-4 py-4 text-white sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{t('carDetails.finalTotal')}</p>
          <p className="mt-1 text-xs text-white/55">{t('carDetails.noHiddenFees')}</p>
        </div>
        <p className="font-display text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums sm:text-3xl">
          {ready ? `${currency}${breakdown.total}` : '—'}
        </p>
      </div>
    </div>
  )
}

export default function ReservationPanel({
  car,
  form,
  setForm,
  pickupDate,
  setPickupDate,
  returnDate,
  setReturnDate,
  bookableLocations,
  pickupLoc,
  returnLoc,
  priceBreakdown,
  currency,
  submitting,
  onWhatsAppSubmit,
  t,
  formatFeeLabel,
  minDate,
  minRentalDays = null,
  maxRentalDays = null,
  advanceBookingDays = 365,
  pickupHoursStart = '08:00',
  pickupHoursEnd = '20:00',
  returnHoursStart = '08:00',
  returnHoursEnd = '20:00',
  unavailablePeriods = [],
  dateError = '',
  rulesLoading = false,
  promoError = '',
  quoting = false,
}) {
  const ready = priceBreakdown?.ready && !dateError && !rulesLoading && minRentalDays != null
  const disabled = submitting || !ready

  const locationOptions = useMemo(
    () =>
      bookableLocations.map((loc) => ({
        value: loc._id,
        label: formatFeeLabel(loc),
        keywords: `${loc.name} ${loc.address} ${loc.city || ''}`,
      })),
    [bookableLocations, formatFeeLabel],
  )

  const daysLabel =
    ready && priceBreakdown.days > 0
      ? t('carDetails.rentalDays', {
          days: priceBreakdown.days,
          rate: `${currency}${priceBreakdown.pricePerDay}`,
        })
      : ''

  const pickupShort = pickupLoc ? formatFeeLabel(pickupLoc) : ''
  const returnShort = returnLoc ? formatFeeLabel(returnLoc) : ''

  return (
    <Motion.div
      initial="hidden"
      animate="show"
      className="lg:sticky lg:top-24 lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:pb-2"
    >
      <div className={`${booking.card} overflow-hidden`}>
        {/* Header */}
        <div className="relative overflow-hidden border-b border-borderColor/70 px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-sand/50 to-transparent" aria-hidden />
          <Motion.div variants={fade} custom={0} className="relative">
            <p className={booking.eyebrow}>{t('carDetails.bookingTitle')}</p>
            <h2 className="mt-2 font-display text-[1.65rem] font-medium leading-[1.15] text-ink sm:text-3xl">
              {t('carDetails.bookingHeadline')}
            </h2>
            <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted">{t('carDetails.bookingSubtitle')}</p>
          </Motion.div>

          <Motion.ul variants={fade} custom={1} className="relative mt-5 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[t('carDetails.trustNoCard'), t('carDetails.trustInstant'), t('carDetails.trustSupport')].map((item) => (
              <li
                key={item}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-light px-3 py-1.5 text-[11px] font-medium text-ink/75 ring-1 ring-borderColor/80"
              >
                <svg className="h-3 w-3 text-primary" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
                {item}
              </li>
            ))}
          </Motion.ul>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onWhatsAppSubmit(e)
          }}
          className="space-y-8 px-5 py-6 sm:space-y-9 sm:px-7 sm:py-8"
        >
          {/* Trip */}
          <Motion.section variants={fade} custom={2}>
            <SectionHeading step="1" title={t('carDetails.tripDetails')} />
            <div className="space-y-4">
              <ReservationDateTimes
                pickupDate={pickupDate}
                returnDate={returnDate}
                setPickupDate={setPickupDate}
                setReturnDate={setReturnDate}
                minDate={minDate}
                minRentalDays={minRentalDays}
                maxRentalDays={maxRentalDays}
                advanceBookingDays={advanceBookingDays}
                pickupHoursStart={pickupHoursStart}
                pickupHoursEnd={pickupHoursEnd}
                returnHoursStart={returnHoursStart}
                returnHoursEnd={returnHoursEnd}
                unavailablePeriods={unavailablePeriods}
                rulesLoading={rulesLoading}
                dateError={dateError}
              />
              <div>
                <Label>{t('carDetails.pickupLocation')}</Label>
                <LocationSelect
                  id="pickupLocation"
                  required
                  value={form.pickupLocationId}
                  onChange={(id) => setForm({ ...form, pickupLocationId: id })}
                  options={locationOptions}
                  placeholder={t('carDetails.selectPickup')}
                />
              </div>
              <div>
                <Label>{t('carDetails.dropoffLocation')}</Label>
                <LocationSelect
                  id="returnLocation"
                  required
                  value={form.returnLocationId}
                  onChange={(id) => setForm({ ...form, returnLocationId: id })}
                  options={locationOptions}
                  placeholder={t('carDetails.selectDropoff')}
                />
              </div>
            </div>
          </Motion.section>

          {/* Guest */}
          <Motion.section variants={fade} custom={3}>
            <SectionHeading step="2" title={t('carDetails.yourDetails')} />
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">{t('carDetails.fullName')}</Label>
                <div className={booking.fieldShell}>
                  <IconWrap>{Icons.user}</IconWrap>
                  <input
                    id="fullName"
                    type="text"
                    className={fieldInput}
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    required
                    autoComplete="name"
                    placeholder={t('carDetails.fullNamePlaceholder')}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">{t('carDetails.phone')}</Label>
                <div
                  className={`${booking.fieldShell} [&_.PhoneInputInput]:!h-full [&_.PhoneInputInput]:!border-0 [&_.PhoneInputInput]:!bg-transparent [&_.PhoneInputInput]:!px-0 [&_.PhoneInputInput]:!shadow-none [&_.PhoneInputInput]:!text-[15px] [&_.PhoneInputCountry]:!pl-0`}
                >
                  <IconWrap>{Icons.phone}</IconWrap>
                  <div className="min-w-0 flex-1">
                    <PhoneInput
                      id="phone"
                      value={form.phone}
                      onChange={(phone) => setForm({ ...form, phone })}
                      required
                      inputClassName="!h-full !py-0"
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="email">{t('carDetails.email')}</Label>
                <div className={booking.fieldShell}>
                  <IconWrap>{Icons.mail}</IconWrap>
                  <input
                    id="email"
                    type="email"
                    className={fieldInput}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    autoComplete="email"
                    placeholder={t('carDetails.emailPlaceholder')}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="promoCode">{t('carDetails.promoCode')}</Label>
                <div className={booking.fieldShell}>
                  <IconWrap>{Icons.note}</IconWrap>
                  <input
                    id="promoCode"
                    type="text"
                    className={`${fieldInput} uppercase`}
                    value={form.promoCode || ''}
                    onChange={(e) => setForm({ ...form, promoCode: e.target.value.toUpperCase() })}
                    autoComplete="off"
                    placeholder={t('carDetails.promoCodePlaceholder')}
                  />
                </div>
                {quoting && (
                  <p className="mt-1.5 text-[11px] text-muted">{t('carDetails.promoChecking')}</p>
                )}
                {promoError && form.promoCode ? (
                  <p className="mt-1.5 text-[11px] text-red-600">{promoError}</p>
                ) : null}
                {!promoError && (priceBreakdown?.discountTotal || 0) > 0 && (
                  <p className="mt-1.5 text-[11px] text-emerald-700">
                    {t('carDetails.promoApplied', {
                      amount: `${currency}${priceBreakdown.discountTotal}`,
                    })}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="notes">{t('carDetails.notes')}</Label>
                <div className={`${booking.fieldShell} h-auto min-h-[6.5rem] items-start py-3`}>
                  <IconWrap>{Icons.note}</IconWrap>
                  <textarea
                    id="notes"
                    rows={3}
                    className={`${fieldInput} min-h-[4.5rem] resize-none leading-relaxed py-1`}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder={t('carDetails.notesPlaceholder')}
                  />
                </div>
              </div>
            </div>
          </Motion.section>

          {/* Summary */}
          <Motion.div variants={fade} custom={4}>
            <SectionHeading step="3" title={t('carDetails.summaryTitle')} />
            <BookingSummary
              breakdown={ready ? priceBreakdown : { ...priceBreakdown, ready: false }}
              currency={currency}
              t={t}
              car={car}
              pickupLabel={pickupShort}
              returnLabel={returnShort}
              daysLabel={daysLabel}
              dateError={dateError}
              minRentalDays={minRentalDays || 0}
              rulesLoading={rulesLoading}
            />
          </Motion.div>

          {/* CTA — sticky on mobile for thumb reach */}
          <Motion.div
            variants={fade}
            custom={5}
            className="sticky bottom-0 z-10 -mx-5 border-t border-borderColor/70 bg-surface/95 px-5 pt-4 backdrop-blur-md booking-safe-bottom sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
          >
            <WhatsAppButton
              disabled={disabled}
              className="booking-tap !h-12 !rounded-2xl !py-0 !text-[15px] !font-semibold !shadow-[0_14px_36px_-14px_rgba(37,211,102,0.7)] active:scale-[0.99] transition-transform"
            >
              {submitting ? t('carDetails.submitting') : t('carDetails.whatsappReserve')}
            </WhatsAppButton>
            <p className="mt-3 text-center text-xs leading-relaxed text-muted">{t('carDetails.whatsappHint')}</p>
            <p className="mt-1 text-center text-[11px] text-muted/70">{t('carDetails.noCard')}</p>
          </Motion.div>
        </form>
      </div>
    </Motion.div>
  )
}
