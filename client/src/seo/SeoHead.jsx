import { Helmet } from 'react-helmet-async'
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_ORIGIN } from './constants'

/**
 * Per-route SEO head. Pass siteName/origin from agency storefront when on tenant surfaces.
 */
const SeoHead = ({
  title,
  description,
  path = '/',
  image = DEFAULT_OG_IMAGE,
  noindex = false,
  lang = 'fr',
  dir,
  type = 'website',
  jsonLd = [],
  siteName = SITE_NAME,
  origin = SITE_ORIGIN,
  faviconUrl = '',
  locale = 'fr_MA',
}) => {
  const brand = siteName || SITE_NAME
  const fullTitle = title
    ? (title.includes(brand) ? title : `${title} | ${brand}`)
    : brand
  const canonical = absoluteUrl(path, origin)
  const robots = noindex ? 'noindex,nofollow' : 'index,follow'
  const graphs = (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).filter(Boolean)
  const ogImage = image || DEFAULT_OG_IMAGE
  const htmlAttributes = dir ? { lang, dir } : { lang }

  return (
    <Helmet htmlAttributes={htmlAttributes}>
      <title>{fullTitle}</title>
      <meta name="description" content={description || ''} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={canonical} />
      {faviconUrl ? <link rel="icon" href={faviconUrl} /> : null}

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={brand} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description || ''} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content={locale} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description || ''} />
      <meta name="twitter:image" content={ogImage} />

      {graphs.map((node, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(node)}
        </script>
      ))}
    </Helmet>
  )
}

export default SeoHead
