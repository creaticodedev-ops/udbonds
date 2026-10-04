import React, { useEffect, useMemo, useState } from 'react'
import { HERO_IMAGE } from '../assets/assets'
import { useAppContext } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import DateRangePicker from './DateRangePicker'
import CitySelect from './CitySelect'
import toast from 'react-hot-toast'
import { trackSearch } from '../analytics/ga4'
import { heroVehicleHint, resolveHeroCity } from './hero/heroTelemetry'
import { featuredVehicles } from '../storefrontHome/fleetShowcase'
import { buildWaMeUrl } from '../utils/whatsapp'
import { usePrefersReducedMotion } from '../storefrontHome/usePrefersReducedMotion'
import '../storefrontHome/storefrontHome.css'

const Hero = () => {
  const [pickupLocation, setPickupLocation] = useState('')
  const { t } = useI18n()
  const reduceMotion = usePrefersReducedMotion()
  const {
    pickupDate,
    setPickupDate,
    returnDate,
    setReturnDate,
    navigate,
    pickupLocations,
    publicPath,
    storefrontProfile,
    cars,
    currency,
  } = useAppContext()

  const displayBrand = storefrontProfile?.name || ''
  const heroHeadline = storefrontProfile?.hero?.headline || ''
  const heroSub = storefrontProfile?.hero?.subheadline || ''
  const heroBadge = storefrontProfile?.hero?.badgeText || ''

  const cities = useMemo(
    () => [...new Set(pickupLocations.map((location) => location.city).filter(Boolean))].sort(),
    [pickupLocations],
  )

  const originCity = useMemo(
    () => resolveHeroCity(storefrontProfile, pickupLocations),
    [storefrontProfile, pickupLocations],
  )

  const vehicleHint = useMemo(() => heroVehicleHint(cars), [cars])
  const leadVehicle = useMemo(() => featuredVehicles(cars, 1)[0] || null, [cars])
  const heroImage = leadVehicle?.image || leadVehicle?.images?.[0] || HERO_IMAGE.webp
  const heroAlt = leadVehicle
    ? `${leadVehicle.brand} ${leadVehicle.model}`
    : displayBrand
      ? `${displayBrand} — ${t('hero.title')}`
      : t('hero.title')

  const dial = String(storefrontProfile?.whatsapp || storefrontProfile?.phone || '').replace(/\D/g, '')
  const whatsappUrl = dial
    ? buildWaMeUrl(t('whyChoose.whatsappMessage', { brand: displayBrand || 'car rental' }), dial)
    : ''

  const startISO = typeof pickupDate === 'string' ? pickupDate.slice(0, 10) : ''
  const endISO = typeof returnDate === 'string' ? returnDate.slice(0, 10) : ''

  const kickerParts = [heroBadge || t('hero.badge'), originCity].filter(Boolean)

  const handleSearch = (e) => {
    e.preventDefault()
    if (!pickupLocation) {
      toast.error(t('hero.selectLocation'))
      return
    }
    if (!startISO || !endISO) {
      toast.error(t('hero.selectDates'))
      return
    }
    if (endISO < startISO) {
      toast.error(t('hero.invalidRange'))
      return
    }
    trackSearch({
      location: pickupLocation,
      has_dates: true,
      source: 'hero',
    })
    const carsBase = publicPath?.('/cars') || '/cars'
    navigate(
      `${carsBase}?${new URLSearchParams({
        pickupLocation,
        pickupDate: startISO,
        returnDate: endISO,
      }).toString()}`,
    )
  }

  const exploreFleet = () => {
    document.getElementById('fleet')?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  useEffect(() => {
    if (!pickupLocation && cities.length === 1) setPickupLocation(cities[0])
  }, [cities, pickupLocation])

  return (
    <section className="sf-hero" data-motion={reduceMotion ? 'off' : 'on'} aria-labelledby="sf-hero-title">
      <div className="sf-hero-sky" aria-hidden="true" />
      <div className="sf-hero-grain" aria-hidden="true" />
      <div className="sf-hero-haze" aria-hidden="true" />
      <div className="sf-road" aria-hidden="true">
        <div className="sf-road-surface" />
        <div className="sf-road-edge" />
        <div className="sf-road-lines" />
      </div>
      <div className="sf-headlights" aria-hidden="true" />
      <div className="sf-ground-shadow" aria-hidden="true" />
      <div className="sf-trail" aria-hidden="true" />

      <div className="sf-hero-copy">
        {kickerParts.length ? (
          <p className="sf-kicker">
            <i aria-hidden="true" />
            <span>{kickerParts.join(' · ')}</span>
          </p>
        ) : null}

        {displayBrand ? <p className="sf-hero-brand">{displayBrand}</p> : null}

        <h1 id="sf-hero-title">{heroHeadline || t('hero.title')}</h1>
        <p className="sf-lead">{heroSub || t('hero.subtitle')}</p>

        <div className="sf-hero-actions">
          <button type="button" className="sf-btn sf-btn-primary" onClick={exploreFleet}>
            {t('hero.exploreFleet')}
          </button>
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sf-btn sf-btn-ghost-light"
              data-analytics-source="hero_whatsapp"
            >
              {t('hero.whatsappCta')}
            </a>
          ) : null}
        </div>
      </div>

      <div className="sf-stage">
        <div className="sf-car-wrap">
          <img
            src={heroImage}
            alt={heroAlt}
            width={1200}
            height={675}
            decoding="async"
            fetchPriority="high"
            onError={(e) => {
              if (e.currentTarget.src !== HERO_IMAGE.webp) e.currentTarget.src = HERO_IMAGE.webp
            }}
          />
        </div>
        {vehicleHint || leadVehicle ? (
          <div className="sf-car-meta">
            {leadVehicle ? (
              <span>
                <strong>
                  {leadVehicle.brand} {leadVehicle.model}
                </strong>
              </span>
            ) : null}
            {vehicleHint ? (
              <span>{t('hero.fromPerDay', { price: `${currency}${vehicleHint.from}` })}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="sf-console-wrap">
        <form onSubmit={handleSearch} className="sf-console" aria-label={t('hero.bookingLabel')}>
          <div className="sf-console-grid">
            <div className="sf-console-field" data-filled={pickupLocation ? 'true' : 'false'}>
              <CitySelect
                value={pickupLocation}
                onChange={setPickupLocation}
                options={cities}
                label={t('hero.pickupLocation')}
                placeholder={t('hero.selectLocation')}
              />
            </div>
            <div className="sf-console-field" data-filled={startISO && endISO ? 'true' : 'false'}>
              <DateRangePicker
                startDate={startISO}
                endDate={endISO}
                onChange={({ startDate, endDate }) => {
                  setPickupDate(startDate)
                  setReturnDate(endDate)
                }}
              />
            </div>
            <div className="sf-console-submit">
              <button type="submit" className="sf-btn sf-btn-primary sf-find">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                {t('hero.search')}
              </button>
            </div>
          </div>
        </form>
        <p className="sf-trust">{t('hero.trustLine')}</p>
      </div>
    </section>
  )
}

export default Hero
