import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import SeoPageShell from './SeoPageShell'
import { useAppContext } from '../../context/AppContext'
import { airportsFromLocations } from '../../seo/data/airports'
import { SEO_CATEGORIES } from '../../seo/data/categories'
import { breadcrumbJsonLd, faqJsonLd } from '../../seo/jsonLd'

const AirportPage = () => {
  const { airport } = useParams()
  const { pickupLocations } = useAppContext()

  const pages = useMemo(() => airportsFromLocations(pickupLocations), [pickupLocations])
  const data = pages.find((p) => p.slug === String(airport || '').toLowerCase())

  // No invented airport pages: only active locationType=airport points.
  // Wait until locations have been requested at least once (array may be empty).
  if (!data) {
    if (!pickupLocations.length) {
      return (
        <div className="page-shell page-pad py-16 text-center text-muted">
          Aucun aéroport bookable actif pour le moment.
        </div>
      )
    }
    return <Navigate to="/location-voiture-maroc" replace />
  }

  const path = `/location-voiture-aeroport/${data.slug}`
  const breadcrumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Location voiture Maroc', path: '/location-voiture-maroc' },
    { name: data.h1, path },
  ]

  const pickupName = data.locationName || data.city
  const ctaTo = pickupName
    ? `/cars?pickupLocation=${encodeURIComponent(pickupName)}`
    : '/cars'

  return (
    <SeoPageShell
      title={data.title}
      description={data.description}
      path={path}
      h1={data.h1}
      intro={data.intro}
      sections={data.sections}
      faqs={data.faqs}
      breadcrumbs={breadcrumbs}
      ctaTo={ctaTo}
      ctaLabel="Rechercher une voiture à cet aéroport"
      jsonLd={[breadcrumbJsonLd(breadcrumbs), faqJsonLd(data.faqs)]}
      related={[
        {
          title: 'Catégories',
          links: SEO_CATEGORIES.slice(0, 4).map((c) => ({ to: `/cars/${c.slug}`, label: c.name })),
        },
        ...(data.citySlug
          ? [{
              title: 'Ville',
              links: [{ to: `/location-voiture/${data.citySlug}`, label: data.city || data.citySlug }],
            }]
          : []),
      ]}
    />
  )
}

export default AirportPage
