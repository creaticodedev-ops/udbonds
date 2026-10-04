import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import { assets } from '../assets/assets'

const VehicleCard = ({ car, currency, onOpen, t, featured = false }) => {
  const available = car.isAvaliable !== false
  const image = car.image || car.images?.[0] || assets.car_image1

  return (
    <article className={`sf-vcard${featured ? ' is-featured' : ''}`}>
      <button type="button" className="sf-vcard-media" onClick={() => onOpen(car)} aria-label={`${car.brand} ${car.model}`}>
        <img
          src={image}
          alt={`${car.brand} ${car.model}`}
          width={featured ? 1200 : 640}
          height={featured ? 750 : 400}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.src = assets.car_image1
          }}
        />
        <div className="sf-vcard-shade" aria-hidden="true" />
        <div className="sf-vcard-top">
          {available ? (
            <span className="sf-vcard-status is-on">{t('carCard.available')}</span>
          ) : (
            <span className="sf-vcard-status">{t('carCard.unavailable')}</span>
          )}
          <span className="sf-vcard-price">
            <strong>
              {currency}
              {car.pricePerDay}
            </strong>
            <em>{t('carCard.perDay')}</em>
          </span>
        </div>
      </button>

      <div className="sf-vcard-body">
        <p className="sf-vcard-cat">{car.category}{car.year ? ` · ${car.year}` : ''}</p>
        <h3 className="sf-vcard-name">
          {car.brand} {car.model}
        </h3>
        <div className="sf-vcard-specs">
          {car.seating_capacity ? <span>{t('carDetails.seats', { count: car.seating_capacity })}</span> : null}
          {car.transmission ? <span>{car.transmission}</span> : null}
          {car.fuel_type ? <span>{car.fuel_type}</span> : null}
        </div>
        <div className="sf-vcard-actions">
          <button type="button" className="sf-btn sf-btn-primary" onClick={() => onOpen(car)}>
            {t('home.viewVehicle')}
          </button>
        </div>
      </div>
    </article>
  )
}

const HomeFleet = ({ vehicles }) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { publicPath, currency, storefrontProfile } = useAppContext()
  if (!vehicles.length) return null

  const brand = storefrontProfile?.name || ''
  const open = (car) => {
    const path = publicPath?.(`/car-details/${car._id}`) || `/car-details/${car._id}`
    navigate(path)
    window.scrollTo(0, 0)
  }

  const [lead, ...rest] = vehicles

  return (
    <section id="fleet" className="sf-section sf-fleet" aria-labelledby="sf-fleet-title">
      <div className="page-pad page-shell">
        <header className="sf-section-head">
          <div>
            <p className="sf-eyebrow">{t('featured.eyebrow')}</p>
            <h2 id="sf-fleet-title">
              {brand ? t('featured.titleBrand', { brand }) : t('featured.title')}
            </h2>
            <p className="sf-section-lead">{t('featured.subtitle')}</p>
          </div>
          <button
            type="button"
            className="sf-btn sf-btn-ghost sf-section-cta"
            onClick={() => {
              navigate(publicPath?.('/cars') || '/cars')
              window.scrollTo(0, 0)
            }}
          >
            {t('featured.exploreAll')}
          </button>
        </header>

        <div className="sf-fleet-layout">
          <VehicleCard car={lead} currency={currency} onOpen={open} t={t} featured />
          {rest.length ? (
            <div className="sf-fleet-grid">
              {rest.map((car) => (
                <VehicleCard key={car._id} car={car} currency={currency} onOpen={open} t={t} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default HomeFleet
