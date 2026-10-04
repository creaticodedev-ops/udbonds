import { Link } from 'react-router-dom'
import SeoHead from '../../seo/SeoHead'
import { booking } from '../../components/ui/bookingUi'

const FaqList = ({ faqs = [] }) => {
  if (!faqs.length) return null
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-ink">Questions fréquentes</h2>
      <div className="mt-4 space-y-3">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-2xl border border-borderColor/80 bg-white px-4 py-3"
          >
            <summary className="cursor-pointer list-none font-medium text-ink marker:content-none">
              {faq.question}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

const RelatedLinks = ({ title, links = [] }) => {
  if (!links.length) return null
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="inline-flex rounded-full border border-borderColor bg-white px-3 py-1.5 text-sm text-ink hover:border-ink/30"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Shared layout for SEO landing pages — content-first, one CTA group.
 */
const SeoPageShell = ({
  title,
  description,
  path,
  h1,
  intro,
  sections = [],
  faqs = [],
  breadcrumbs = [],
  jsonLd = [],
  ctaTo = '/cars',
  ctaLabel = 'Voir les véhicules disponibles',
  related = [],
  children,
}) => (
  <article className="page-shell page-pad mx-auto max-w-3xl pb-16 pt-8 sm:pt-10">
    <SeoHead title={title} description={description} path={path} jsonLd={jsonLd} lang="fr" />

    {breadcrumbs.length > 0 && (
      <nav aria-label="Fil d’Ariane" className="mb-6 text-xs text-muted sm:text-sm">
        <ol className="flex flex-wrap items-center gap-1">
          {breadcrumbs.map((crumb, i) => (
            <li key={crumb.path} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden>/</span>}
              {i < breadcrumbs.length - 1 ? (
                <Link to={crumb.path} className="hover:text-ink">
                  {crumb.name}
                </Link>
              ) : (
                <span className="text-ink">{crumb.name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    )}

    <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
      {h1}
    </h1>
    {intro && <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{intro}</p>}

    <div className="mt-6 flex flex-wrap gap-3">
      <Link to={ctaTo} className={booking.btnPrimary}>
        {ctaLabel}
      </Link>
      <Link to="/location-voiture-maroc" className={booking.btnSecondary}>
        Location voiture Maroc
      </Link>
    </div>

    {sections.map((section) => (
      <section key={section.heading} className="mt-10">
        <h2 className="text-xl font-semibold text-ink">{section.heading}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">{section.body}</p>
      </section>
    ))}

    {children}

    <FaqList faqs={faqs} />
    {related.map((block) => (
      <RelatedLinks key={block.title} title={block.title} links={block.links} />
    ))}
  </article>
)

export default SeoPageShell
