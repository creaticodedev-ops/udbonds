import React from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext'
import { useAppContext } from '../context/AppContext'
import { formatLocationsDisplay } from '../utils/carLocations'
import PromotionBadge, { PromotionPriceTag } from './PromotionBadge'

const CarCard = ({ car }) => {
  const { currency: ctxCurrency } = useAppContext()
  const currency = ctxCurrency || import.meta.env.VITE_CURRENCY || 'MAD '
  const navigate = useNavigate()
  const { t } = useI18n()
  const { publicPath } = useAppContext()
  const fallbackImage = assets.car_image1
  const promo = car?.displayPromotion || null
  const detailsPath = publicPath?.(`/car-details/${car._id}`) || `/car-details/${car._id}`
  const available = car.isAvaliable !== false

  const open = () => {
    navigate(detailsPath)
    window.scrollTo(0, 0)
  }

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      className="group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 rounded-[1.35rem]"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-[1.35rem] bg-sand ring-1 ring-borderColor/55 shadow-[0_18px_48px_-30px_rgba(22,18,16,0.45)]">
        <img
          src={car.image || car.images?.[0] || fallbackImage}
          onError={(e) => {
            e.currentTarget.src = fallbackImage
          }}
          alt={`${car.brand} ${car.model}`}
          width={640}
          height={400}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/15 to-transparent" />

        {promo ? <PromotionBadge promotion={promo} currency={currency} /> : null}

        <div className="absolute left-3 top-3">
          <span
            className={`inline-flex min-h-[1.55rem] items-center rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
              available ? 'bg-primary text-[var(--color-on-primary,#fff)]' : 'bg-ink/55 text-white/80 backdrop-blur-sm'
            }`}
          >
            {available ? t('carCard.available') : t('carCard.unavailable')}
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 sm:bottom-3.5 sm:left-3.5 sm:right-3.5">
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl font-medium leading-tight text-white sm:text-[1.4rem]">
              {car.brand} {car.model}
            </h3>
            <p className="mt-0.5 truncate text-xs text-white/70">
              {car.category}
              {car.year ? ` · ${car.year}` : ''}
            </p>
          </div>
          {promo ? (
            <PromotionPriceTag promotion={promo} currency={currency} perDayLabel={t('carCard.perDay')} />
          ) : (
            <div className="shrink-0 rounded-xl bg-white/95 px-2.5 py-2 text-right shadow-sm backdrop-blur-sm">
              <p className="text-sm font-semibold leading-none tabular-nums text-ink">
                {currency}
                {car.pricePerDay}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-muted">{t('carCard.perDay')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-2 px-0.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <img src={assets.users_icon} alt="" className="h-3.5 opacity-70" />
          {t('carDetails.seats', { count: car.seating_capacity })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <img src={assets.fuel_icon} alt="" className="h-3.5 opacity-70" />
          {car.fuel_type}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <img src={assets.car_icon} alt="" className="h-3.5 opacity-70" />
          {car.transmission}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <img src={assets.location_icon} alt="" className="h-3.5 shrink-0 opacity-70" />
          <span className="truncate">{formatLocationsDisplay(car)}</span>
        </span>
      </div>
    </article>
  )
}

export default CarCard
