import { Link } from 'react-router-dom'
import SeoHead from '../../seo/SeoHead'
import { SEO_GUIDES } from '../../seo/data/guides'
import { breadcrumbJsonLd } from '../../seo/jsonLd'
import { booking } from '../../components/ui/bookingUi'

const GuideHubPage = () => {
  const path = '/guide'
  const breadcrumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Guides', path },
  ]

  return (
    <div className="page-shell page-pad mx-auto max-w-3xl pb-16 pt-8">
      <SeoHead
        title="Guides location voiture Maroc"
        description="Conseils pratiques HDN Car : documents, conduite, assurance, caution, SUV, aéroports et location économique au Maroc."
        path={path}
        jsonLd={[breadcrumbJsonLd(breadcrumbs)]}
      />
      <nav aria-label="Fil d’Ariane" className="mb-6 text-sm text-muted">
        <Link to="/" className="hover:text-ink">Accueil</Link>
        <span aria-hidden> / </span>
        <span className="text-ink">Guides</span>
      </nav>
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
        Guides location de voiture au Maroc
      </h1>
      <p className="mt-4 text-muted">
        Réponses utiles avant de réserver — rédigées pour les voyageurs, sans promesses marketing creuses.
      </p>
      <ul className="mt-8 space-y-3">
        {SEO_GUIDES.map((guide) => (
          <li key={guide.slug}>
            <Link
              to={`/guide/${guide.slug}`}
              className="block rounded-2xl border border-borderColor/80 bg-white px-4 py-3 hover:border-ink/25"
            >
              <span className="font-medium text-ink">{guide.h1}</span>
              <p className="mt-1 text-sm text-muted">{guide.description}</p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Link to="/cars" className={booking.btnPrimary}>Voir les véhicules</Link>
      </div>
    </div>
  )
}

export default GuideHubPage
