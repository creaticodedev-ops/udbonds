import React, { useMemo } from 'react'
import { assets } from '../assets/assets'
import { motion as Motion } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext'
import { Link } from 'react-router-dom'
import { getPublishedCities } from '../seo/data/cities'
import { SEO_CATEGORIES } from '../seo/data/categories'
import { useAppContext } from '../context/AppContext'
import { airportsFromLocations } from '../seo/data/airports'
import { NAP } from '../seo/constants'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay },
})

const Footer = () => {
  const { t } = useI18n()
  const { pickupLocations, publicPath, storefrontProfile, storefrontSlug } = useAppContext()
  const cities = getPublishedCities().slice(0, 6)
  const airports = useMemo(() => airportsFromLocations(pickupLocations).slice(0, 4), [pickupLocations])
  const homePath = publicPath?.('/') || '/'
  const carsPath = publicPath?.('/cars') || '/cars'
  const isTenant = Boolean(storefrontSlug || storefrontProfile?.agencyId)
  const brandLabel = storefrontProfile?.name || ''
  const brandLogo = storefrontProfile?.logoUrl || ''
  const contactPhone = storefrontProfile?.phone || storefrontProfile?.whatsapp || ''
  const contactEmail = storefrontProfile?.email || ''
  const contactAddress = [storefrontProfile?.address, storefrontProfile?.city]
    .filter(Boolean)
    .join(', ')
  const instagramUrl = storefrontProfile?.socials?.instagram || ''
  // Never show platform NAP on tenant storefronts
  const showPlatformNap = !isTenant && NAP.streetAddress
  const addressLine = isTenant
    ? contactAddress
    : (showPlatformNap ? `${NAP.streetAddress}, ${NAP.addressLocality}` : contactAddress)
  const localityLine = isTenant
    ? [storefrontProfile?.city, storefrontProfile?.country || 'Maroc'].filter(Boolean).join(', ')
    : (showPlatformNap ? `${NAP.addressLocality}, Maroc` : '')
  const phoneHref = isTenant
    ? contactPhone
    : (contactPhone || NAP.telephone)
  const phoneDisplay = isTenant
    ? contactPhone
    : (contactPhone || NAP.telephoneDisplay)
  const emailHref = isTenant
    ? contactEmail
    : (contactEmail || NAP.email)

  return (
    <footer className="page-pad page-shell mt-8 bg-light pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-muted md:mt-16">
      <Motion.div
        {...fadeUp(0)}
        className="flex flex-col md:flex-row flex-wrap justify-between items-start gap-10 pb-10 border-b border-borderColor"
      >
        <div className="max-w-sm w-full">
          {brandLogo ? (
            <Motion.img
              {...fadeUp(0.2)}
              src={brandLogo}
              alt={brandLabel || 'Logo'}
              width={176}
              height={44}
              loading="lazy"
              decoding="async"
              className="block h-9 sm:h-10 lg:h-11 mb-3 w-auto max-h-10 lg:max-h-11 object-contain"
            />
          ) : brandLabel ? (
            <Motion.p {...fadeUp(0.2)} className="mb-3 text-lg font-semibold text-ink">
              {brandLabel}
            </Motion.p>
          ) : null}

          <Motion.p {...fadeUp(0.3)} className="leading-relaxed">
            {t('footer.description')}
          </Motion.p>

          <Motion.div {...fadeUp(0.4)} className="flex items-center gap-4 mt-6">
            {instagramUrl ? (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${brandLabel || 'Agency'} Instagram`}
                className="inline-flex"
              >
                <img src={assets.instagram_logo} className="w-5 h-5 hover:opacity-70 transition" alt="" />
              </a>
            ) : null}
            {phoneHref ? (
              <a
                href={`tel:${String(phoneHref).replace(/\s/g, '')}`}
                aria-label="Phone"
                className="inline-flex text-xs text-ink/70 hover:text-ink"
              >
                {phoneDisplay || phoneHref}
              </a>
            ) : emailHref ? (
              <a
                href={`mailto:${emailHref}`}
                aria-label="Email"
                data-analytics-source="footer_social"
                className="inline-flex"
              >
                <img src={assets.gmail_logo} className="w-5 h-5 hover:opacity-70 transition" alt="" />
              </a>
            ) : null}
          </Motion.div>
        </div>

        <Motion.div
          {...fadeUp(0.3)}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 sm:gap-10 w-full md:w-auto md:flex-1 md:max-w-4xl"
        >
          <div>
            <h2 className="text-base font-medium text-gray-900 uppercase tracking-wide">
              {t('footer.quickLinks')}
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              <li><Link className="hover:text-gray-700 transition" to={homePath}>{t('footer.home')}</Link></li>
              <li><Link className="hover:text-gray-700 transition" to={carsPath}>{t('footer.browseCars')}</Link></li>
              {!isTenant ? (
                <>
                  <li><Link className="hover:text-gray-700 transition" to="/location-voiture-maroc">Location Maroc</Link></li>
                  <li><Link className="hover:text-gray-700 transition" to="/guide">Guides</Link></li>
                </>
              ) : null}
            </ul>
          </div>

          {!isTenant ? (
          <div>
            <h2 className="text-base font-medium text-gray-900 uppercase tracking-wide">Villes</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {cities.map((c) => (
                <li key={c.slug}>
                  <Link className="hover:text-gray-700 transition" to={`/location-voiture/${c.slug}`}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          ) : null}

          {!isTenant ? (
          <div>
            <h2 className="text-base font-medium text-gray-900 uppercase tracking-wide">Catégories</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {SEO_CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link className="hover:text-gray-700 transition" to={`/cars/${c.slug}`}>
                    {c.name}
                  </Link>
                </li>
              ))}
              {airports.map((a) => (
                <li key={a.slug}>
                  <Link className="hover:text-gray-700 transition" to={`/location-voiture-aeroport/${a.slug}`}>
                    {a.iata ? `Aéroport ${a.iata}` : a.locationName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          ) : null}

          <div className="col-span-2 sm:col-span-1">
            <h2 className="text-base font-medium text-gray-900 uppercase tracking-wide">
              {t('footer.contact')}
            </h2>
            <ul className="mt-4 flex flex-col gap-2 break-words">
              {addressLine ? <li>{addressLine}</li> : null}
              {localityLine ? <li>{localityLine}</li> : null}
              {phoneHref ? (
                <li>
                  <a
                    href={`tel:${String(phoneHref).replace(/\s/g, '')}`}
                    data-analytics-source="footer"
                    className="hover:text-gray-700 transition"
                  >
                    {phoneDisplay || phoneHref}
                  </a>
                </li>
              ) : null}
              {emailHref ? (
                <li>
                  <a
                    href={`mailto:${emailHref}`}
                    data-analytics-source="footer"
                    className="hover:text-gray-700 transition"
                  >
                    {emailHref}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </Motion.div>
      </Motion.div>

      <Motion.div
        {...fadeUp(0.5)}
        className="flex flex-col md:flex-row gap-3 items-center justify-between py-6 text-gray-600 text-center md:text-left"
      >
        <p className="text-xs sm:text-sm">© {new Date().getFullYear()} ZAKARIA DOUAMI. {t('footer.rights')}</p>

        <div className="flex flex-col items-center gap-2 md:items-end">
          <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:text-sm">
            <li>
              <Link className="hover:text-gray-800 transition" to="/guide/documents-location-voiture-maroc">
                {t('footer.privacy')}
              </Link>
            </li>
            <span className="text-borderColor" aria-hidden>|</span>
            <li>
              <Link className="hover:text-gray-800 transition" to="/guide/assurance-location-voiture-maroc">
                {t('footer.terms')}
              </Link>
            </li>
            <span className="text-borderColor" aria-hidden>|</span>
            <li>
              <Link className="hover:text-gray-800 transition" to="/guide/caution-location-voiture">
                {t('footer.cookies')}
              </Link>
            </li>
          </ul>
          <Link
            to="/owner"
            className="text-[10px] text-gray-400/70 hover:text-gray-500 transition tracking-wide"
          >
            {t('footer.staffPortal')}
          </Link>
        </div>
      </Motion.div>
    </footer>
  )
}

export default Footer
