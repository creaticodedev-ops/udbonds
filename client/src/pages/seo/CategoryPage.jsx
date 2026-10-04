import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import SeoPageShell from './SeoPageShell'
import { getCategoryBySlug } from '../../seo/data/categories'
import { getPublishedCities } from '../../seo/data/cities'
import { useAppContext } from '../../context/AppContext'
import { uniqueCarSlug } from '../../seo/slugify'
import { breadcrumbJsonLd, faqJsonLd } from '../../seo/jsonLd'

const CategoryPage = () => {
  const { slug } = useParams()
  const data = getCategoryBySlug(slug)
  const { cars } = useAppContext()

  const matched = useMemo(() => {
    if (!data) return []
    return (cars || []).filter((car) => {
      if (data.filterType === 'transmission') {
        return String(car.transmission || '').toLowerCase() === String(data.filterValue).toLowerCase()
      }
      return String(car.category || '').toLowerCase() === String(data.filterValue).toLowerCase()
    })
  }, [cars, data])

  if (!data) return <Navigate to="/cars" replace />

  const path = `/cars/${data.slug}`
  const breadcrumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Véhicules', path: '/cars' },
    { name: data.name, path },
  ]

  const ctaTo =
    data.filterType === 'transmission'
      ? '/cars'
      : `/cars?category=${encodeURIComponent(data.filterValue)}`

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
      ctaLabel={`Voir les ${data.name.toLowerCase()} disponibles`}
      jsonLd={[breadcrumbJsonLd(breadcrumbs), faqJsonLd(data.faqs)]}
      related={[
        {
          title: 'Villes',
          links: getPublishedCities()
            .filter((c) => (data.relatedCities || []).includes(c.slug))
            .map((c) => ({ to: `/location-voiture/${c.slug}`, label: c.name })),
        },
        {
          title: 'Guides',
          links: (data.relatedGuides || []).map((g) => ({
            to: `/guide/${g}`,
            label: g.replace(/-/g, ' '),
          })),
        },
      ]}
    >
      {matched.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-ink">Modèles disponibles</h2>
          <ul className="mt-3 space-y-2">
            {matched.slice(0, 12).map((car) => {
              const seoSlug = uniqueCarSlug(car, cars)
              return (
                <li key={car._id}>
                  <Link className="text-primary hover:underline" to={`/cars/${seoSlug}`}>
                    {car.brand} {car.model}
                  </Link>
                  <span className="text-muted"> — </span>
                  <Link className="text-sm text-muted hover:underline" to={`/car-details/${car._id}`}>
                    réserver
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </SeoPageShell>
  )
}

export default CategoryPage
