import { useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import SeoPageShell from './SeoPageShell'
import { useAppContext } from '../../context/AppContext'
import { uniqueCarSlug } from '../../seo/slugify'
import { SEO_CATEGORIES } from '../../seo/data/categories'
import { breadcrumbJsonLd, vehicleProductJsonLd } from '../../seo/jsonLd'
import { SITE_NAME } from '../../seo/constants'

const VehicleSeoPage = ({ slug }) => {
  const { cars, carsLoading } = useAppContext()

  const car = useMemo(() => {
    if (!cars?.length) return null
    return cars.find((c) => uniqueCarSlug(c, cars) === slug) || null
  }, [cars, slug])

  if (carsLoading && !cars?.length) {
    return <div className="page-shell page-pad py-16 text-center text-muted">Chargement…</div>
  }

  if (!car) return <Navigate to="/cars" replace />

  const path = `/cars/${slug}`
  const name = `${car.brand} ${car.model}`.trim()
  const cat = SEO_CATEGORIES.find(
    (c) => c.filterType === 'category' && c.filterValue.toLowerCase() === String(car.category || '').toLowerCase()
  )
  const title = `Location ${name} Maroc`
  const description = `Louez une ${name}${car.category ? ` (${car.category})` : ''} au Maroc avec ${SITE_NAME}. Réservation en ligne, tarifs au jour.`
  const breadcrumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Véhicules', path: '/cars' },
    ...(cat ? [{ name: cat.name, path: `/cars/${cat.slug}` }] : []),
    { name, path },
  ]

  const sections = [
    {
      heading: `Pourquoi louer une ${name} ?`,
      body: `La ${name} fait partie de notre flotte active. Consultez disponibilité, transmission (${car.transmission || '—'}) et tarif journalier sur la fiche réservation.`,
    },
    {
      heading: 'Location au Maroc',
      body: `Idéale pour vos trajets ville ou inter-villes. Combinez avec une prise en charge aéroport active (Casablanca CMN, Marrakech RAK) ou un point ville selon le calendrier.`,
    },
  ]

  return (
    <SeoPageShell
      title={title}
      description={description}
      path={path}
      h1={`Location ${name} au Maroc`}
      intro={`Réservez une ${name} avec ${SITE_NAME}. Page informative ; la réservation se finalise sur la fiche véhicule.`}
      sections={sections}
      breadcrumbs={breadcrumbs}
      ctaTo={`/car-details/${car._id}`}
      ctaLabel={`Réserver — ${name}`}
      jsonLd={[
        breadcrumbJsonLd(breadcrumbs),
        vehicleProductJsonLd(car, path),
      ]}
      related={[
        {
          title: 'Catégories',
          links: [
            ...(cat ? [{ to: `/cars/${cat.slug}`, label: cat.name }] : []),
            ...SEO_CATEGORIES.filter((c) => c.slug !== cat?.slug)
              .slice(0, 3)
              .map((c) => ({ to: `/cars/${c.slug}`, label: c.name })),
          ],
        },
      ]}
    >
      <section className="mt-8 rounded-2xl border border-borderColor/80 bg-white p-4 text-sm text-muted">
        <p>
          Catégorie : <strong className="text-ink">{car.category || '—'}</strong>
          {' · '}
          Transmission : <strong className="text-ink">{car.transmission || '—'}</strong>
          {typeof car.pricePerDay === 'number' ? (
            <>
              {' · '}
              À partir de <strong className="text-ink">{car.pricePerDay} MAD</strong>/jour
            </>
          ) : null}
        </p>
        <p className="mt-2">
          <Link to={`/car-details/${car._id}`} className="text-primary hover:underline">
            Ouvrir la fiche complète et réserver
          </Link>
        </p>
      </section>
    </SeoPageShell>
  )
}

export default VehicleSeoPage
