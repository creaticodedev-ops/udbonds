import React from 'react'
import { useAppContext } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import { groupedLocations } from './fleetShowcase'

const typeLabel = (type, t) => {
  if (type === 'airport') return t('home.locAirport')
  if (type === 'hotel') return t('home.locHotel')
  if (type === 'office') return t('home.locOffice')
  return ''
}

const HomeLocations = () => {
  const { t } = useI18n()
  const { pickupLocations } = useAppContext()
  const groups = groupedLocations(pickupLocations)
  if (!groups.length) return null

  return (
    <section className="sf-section sf-locs" aria-labelledby="sf-locs-title">
      <div className="page-pad page-shell">
        <p className="sf-eyebrow">{t('home.locationsEyebrow')}</p>
        <h2 id="sf-locs-title">{t('home.locationsTitle')}</h2>
        <div className="mt-10 md:mt-14">
          {groups.map(([city, locations]) => (
            <div key={city} className="sf-loc-city">
              <h3>{city}</h3>
              <div className="sf-loc-list">
                {locations.map((loc) => {
                  const type = typeLabel(loc.locationType, t)
                  const extra = type ? ` · ${type}` : ''
                  return loc.googleMapsLink ? (
                    <a key={loc._id} href={loc.googleMapsLink} target="_blank" rel="noopener noreferrer">
                      <span className="sf-loc-name">{loc.name}</span>
                      {loc.address}{extra}
                    </a>
                  ) : (
                    <p key={loc._id}>
                      <span className="sf-loc-name">{loc.name}</span>
                      {loc.address}{extra}
                    </p>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HomeLocations
