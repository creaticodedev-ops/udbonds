import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import SeoPageShell from './SeoPageShell'
import { getCityBySlug, getPublishedCities } from '../../seo/data/cities'
import { SEO_CATEGORIES } from '../../seo/data/categories'
import { airportsFromLocations } from '../../seo/data/airports'
import { useAppContext } from '../../context/AppContext'
import { breadcrumbJsonLd, faqJsonLd } from '../../seo/jsonLd'

const CityPage = () => {
  const { city } = useParams()
  const { pickupLocations } = useAppContext()
  const data = getCityBySlug(city)
  const liveAirports = useMemo(() => airportsFromLocations(pickupLocations), [pickupLocations])

  if (!data) return <Navigate to="/location-voiture-maroc" replace />

  const path = `/location-voiture/${data.slug}`
  const breadcrumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Location voiture Maroc', path: '/location-voiture-maroc' },
    { name: data.name, path },
  ]

  const officeNote = data.hasLocalOffice
    ? null
    : {
        heading: 'Couverture locale',
        body: `HDN Car ne revendique pas d’agence physique inventée à ${data.name}. Nous organisons location et éventuelle livraison selon les points de prise en charge réellement actifs à vos dates.`,
      }

  const sections = officeNote ? [...data.sections, officeNote] : data.sections
  const airportLinks = liveAirports
    .filter((a) => (data.nearbyAirportSlugs || []).includes(a.slug) || a.citySlug === data.slug)
    .map((a) => ({
      to: `/location-voiture-aeroport/${a.slug}`,
      label: a.iata ? `Aéroport ${a.iata}` : a.locationName,
    }))

  return (
    <SeoPageShell
      title={data.title}
      description={data.description}
      path={path}
      h1={data.h1}
      intro={data.intro}
      sections={sections}
      faqs={data.faqs}
      breadcrumbs={breadcrumbs}
      ctaTo="/cars"
      ctaLabel={`Voir les voitures — ${data.name}`}
      jsonLd={[breadcrumbJsonLd(breadcrumbs), faqJsonLd(data.faqs)]}
      related={[
        {
          title: 'Catégories utiles',
          links: (data.relatedCategories || [])
            .map((slug) => SEO_CATEGORIES.find((c) => c.slug === slug))
            .filter(Boolean)
            .map((c) => ({ to: `/cars/${c.slug}`, label: c.name })),
        },
        {
          title: 'Autres villes',
          links: getPublishedCities()
            .filter((c) => c.slug !== data.slug)
            .slice(0, 6)
            .map((c) => ({ to: `/location-voiture/${c.slug}`, label: c.name })),
        },
        ...(airportLinks.length ? [{ title: 'Aéroports liés', links: airportLinks }] : []),
      ]}
    />
  )
}

export default CityPage
