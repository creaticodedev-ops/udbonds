import React from 'react'
import { useI18n } from '../i18n/I18nContext'
import { useAppContext } from '../context/AppContext'
import { buildWaMeUrl } from '../utils/whatsapp'
import { realAdvantages } from './fleetShowcase'

const HomeWhy = () => {
  const { t } = useI18n()
  const { cars, pickupLocations, storefrontProfile } = useAppContext()
  const items = realAdvantages({ cars, pickupLocations, storefrontProfile })
  if (!items.length) return null

  const brand = storefrontProfile?.name || ''
  const dial = String(storefrontProfile?.whatsapp || storefrontProfile?.phone || '').replace(/\D/g, '')
  const whatsappUrl = dial
    ? buildWaMeUrl(t('whyChoose.whatsappMessage', { brand: brand || 'car rental' }), dial)
    : ''

  const copy = (item) => {
    if (item.key === 'fleet') {
      return {
        title: t('home.whyFleetTitle', { count: item.count }),
        body: t('home.whyFleetBody'),
      }
    }
    if (item.key === 'locations') {
      return {
        title: t('home.whyLocationsTitle', { count: item.count }),
        body: item.cities.join(' · '),
      }
    }
    if (item.key === 'airport') {
      return { title: t('home.whyAirportTitle'), body: t('home.whyAirportBody') }
    }
    return { title: t('home.whyWhatsappTitle'), body: t('home.whyWhatsappBody') }
  }

  return (
    <section className="sf-section sf-why" aria-labelledby="sf-why-title">
      <div className="page-pad page-shell">
        <p className="sf-eyebrow">{t('home.whyEyebrow')}</p>
        <h2 id="sf-why-title">
          {brand ? t('home.whyTitleBrand', { brand }) : t('home.whyTitle')}
        </h2>
        <div className="sf-why-grid">
          {items.map((item) => {
            const text = copy(item)
            return (
              <article key={item.key} className="sf-why-item">
                <h3>{text.title}</h3>
                <p>{text.body}</p>
              </article>
            )
          })}
        </div>
        {whatsappUrl ? (
          <div className="sf-actions mt-10">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sf-btn sf-btn-primary"
              data-analytics-source="why_choose"
            >
              {t('whyChoose.cta')}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default HomeWhy
