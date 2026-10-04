import SeoPageShell from './SeoPageShell'
import { MOROCCO_PILLAR } from '../../seo/data/moroccoPillar'
import { getPublishedCities } from '../../seo/data/cities'
import { SEO_CATEGORIES } from '../../seo/data/categories'
import { SEO_GUIDES } from '../../seo/data/guides'
import {
  breadcrumbJsonLd,
  faqJsonLd,
  localBusinessJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from '../../seo/jsonLd'

const MoroccoPillarPage = () => {
  const breadcrumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Location voiture Maroc', path: MOROCCO_PILLAR.path },
  ]

  return (
    <SeoPageShell
      title={MOROCCO_PILLAR.title}
      description={MOROCCO_PILLAR.description}
      path={MOROCCO_PILLAR.path}
      h1={MOROCCO_PILLAR.h1}
      intro={MOROCCO_PILLAR.intro}
      sections={MOROCCO_PILLAR.sections}
      faqs={MOROCCO_PILLAR.faqs}
      breadcrumbs={breadcrumbs}
      jsonLd={[
        organizationJsonLd(),
        websiteJsonLd(),
        localBusinessJsonLd(),
        breadcrumbJsonLd(breadcrumbs),
        faqJsonLd(MOROCCO_PILLAR.faqs),
      ]}
      related={[
        {
          title: 'Villes populaires',
          links: getPublishedCities()
            .slice(0, 8)
            .map((c) => ({ to: `/location-voiture/${c.slug}`, label: c.name })),
        },
        {
          title: 'Catégories',
          links: SEO_CATEGORIES.map((c) => ({ to: `/cars/${c.slug}`, label: c.name })),
        },
        {
          title: 'Guides',
          links: SEO_GUIDES.slice(0, 6).map((g) => ({ to: `/guide/${g.slug}`, label: g.h1 })),
        },
      ]}
    />
  )
}

export default MoroccoPillarPage
