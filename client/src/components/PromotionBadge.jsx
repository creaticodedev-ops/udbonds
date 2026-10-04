import React from 'react'
import {
  getPromotionBadgeLabel,
  getPromotionOfferLabel,
  getDisplayDailyPrices,
} from '../utils/promotionDisplay'

/**
 * Elegant, non-flashy promotion badge for catalog cards & detail pages.
 */
export default function PromotionBadge({
  promotion,
  currency = 'MAD ',
  variant = 'card',
  className = '',
  showPrice = false,
}) {
  if (!promotion) return null

  const badge = getPromotionBadgeLabel(promotion)
  const offer = getPromotionOfferLabel(promotion)
  const prices = showPrice ? getDisplayDailyPrices(promotion) : null

  if (variant === 'inline') {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/95 px-2.5 py-1 text-[11px] font-semibold tracking-[0.06em] text-primary shadow-sm ${className}`}
      >
        <span className="tabular-nums">{badge}</span>
        {offer && offer !== badge ? (
          <span className="hidden max-w-[9rem] truncate font-medium normal-case tracking-normal text-ink/70 sm:inline">
            {offer}
          </span>
        ) : null}
      </span>
    )
  }

  if (variant === 'detail') {
    return (
      <div
        className={`overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-white to-sand/50 px-4 py-3.5 shadow-[0_12px_32px_-28px_rgba(22,18,16,0.45)] ${className}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-8 items-center rounded-full bg-primary px-3 text-[12px] font-semibold tracking-[0.08em] text-white">
            {badge}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            {offer}
          </span>
        </div>
        {prices?.showStrike ? (
          <p className="mt-2.5 text-sm text-ink">
            <span className="text-muted line-through decoration-ink/30 tabular-nums">
              {currency}{prices.original}
            </span>
            <span className="mx-1.5 text-muted">→</span>
            <span className="font-semibold tabular-nums">
              {currency}{prices.final}
            </span>
            <span className="text-muted"> / day</span>
            {prices.caption ? (
              <span className="ml-2 text-[12px] font-semibold text-primary">{prices.caption}</span>
            ) : null}
          </p>
        ) : prices?.caption ? (
          <p className="mt-2 text-sm text-muted">
            <span className="font-medium text-ink">{prices.caption}</span>
            {' · '}
            {offer}
          </p>
        ) : null}
        {promotion.requirePromoCode && promotion.code ? (
          <p className="mt-1.5 text-[11px] text-muted">
            Code <span className="font-mono font-semibold text-ink/80">{promotion.code}</span>
          </p>
        ) : null}
      </div>
    )
  }

  // card variant — sits on media (presentation only; pointer-events-none)
  return (
    <div className={`pointer-events-none absolute left-3 top-3 z-[1] max-w-[calc(100%-1.5rem)] sm:left-3.5 sm:top-3.5 ${className}`}>
      <div className="inline-flex max-w-full flex-col gap-1">
        <span
          className="inline-flex max-w-full items-center truncate rounded-full border border-white/35 bg-ink/75 px-2.5 py-1 text-[11px] font-semibold tracking-[0.1em] text-white backdrop-blur-md"
          title={badge}
        >
          {badge}
        </span>
        {offer && offer !== badge ? (
          <span
            className="inline-flex w-fit max-w-full truncate rounded-full border border-white/25 bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/80 backdrop-blur-sm"
            title={offer}
          >
            {offer}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function PromotionPriceTag({ promotion, currency = 'MAD ', perDayLabel = '/ day', className = '' }) {
  const prices = getDisplayDailyPrices(promotion)
  if (!prices) return null

  if (!prices.showStrike) {
    return (
      <div className={`shrink-0 rounded-xl bg-white/95 px-2.5 py-2 text-right shadow-sm backdrop-blur-sm ${className}`}>
        <p className="text-sm font-semibold leading-none tabular-nums text-ink">
          {currency}{prices.original}
        </p>
        <p className="mt-1 text-[10px] text-muted">{perDayLabel}</p>
      </div>
    )
  }

  return (
    <div className={`max-w-[48%] shrink-0 rounded-xl bg-white/95 px-2 py-1.5 text-right shadow-sm backdrop-blur-sm sm:max-w-none sm:px-2.5 sm:py-2 ${className}`}>
      <p className="text-[10px] leading-none text-muted line-through tabular-nums decoration-ink/30">
        {currency}{prices.original}
      </p>
      <p className="mt-0.5 text-sm font-semibold leading-none tabular-nums text-ink">
        {currency}{prices.final}
      </p>
      <p className="mt-1 flex flex-wrap items-center justify-end gap-x-1 gap-y-0.5 text-[10px] leading-tight text-muted">
        <span>{perDayLabel}</span>
        {prices.caption ? <span className="font-semibold text-primary">{prices.caption}</span> : null}
      </p>
    </div>
  )
}
