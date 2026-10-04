import { Navigate, useParams } from 'react-router-dom'
import SeoPageShell from './SeoPageShell'
import { getGuideBySlug, SEO_GUIDES } from '../../seo/data/guides'
import { breadcrumbJsonLd, faqJsonLd } from '../../seo/jsonLd'

const GuideArticlePage = () => {
  const { slug } = useParams()
  const data = getGuideBySlug(slug)
  if (!data) return <Navigate to="/guide" replace />

  const path = `/guide/${data.slug}`
  const breadcrumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Guides', path: '/guide' },
    { name: data.h1, path },
  ]

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
      jsonLd={[breadcrumbJsonLd(breadcrumbs), faqJsonLd(data.faqs)]}
      related={[
        {
          title: 'Autres guides',
          links: SEO_GUIDES.filter((g) => g.slug !== data.slug)
            .slice(0, 5)
            .map((g) => ({ to: `/guide/${g.slug}`, label: g.h1 })),
        },
      ]}
    />
  )
}

export default GuideArticlePage
