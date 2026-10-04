import {
  absoluteUrl,
  DEFAULT_OG_IMAGE,
  NAP,
  SITE_NAME,
  SITE_ORIGIN,
  napFromStorefront,
} from './constants'

const resolveBrand = (storefront) => {
  const nap = napFromStorefront(storefront)
  if (nap) {
    return {
      name: nap.legalName || storefront.name || '',
      url: storefront.storefrontUrl || absoluteUrl(storefront.storefrontPath || '/'),
      logo: storefront.logoUrl || '',
      email: nap.email || '',
      telephone: nap.telephone || '',
      streetAddress: nap.streetAddress || '',
      addressLocality: nap.addressLocality || '',
      addressRegion: nap.addressRegion || '',
      addressCountry: nap.addressCountry || 'MA',
      image: nap.ogImageUrl || storefront.logoUrl || DEFAULT_OG_IMAGE,
      sameAs: Object.values(storefront.socials || {}).filter(Boolean),
    }
  }
  // Platform-only fallback — empty contact (no HDN/Safi leak)
  return {
    name: SITE_NAME,
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/images/rsz-car-logo.png`,
    email: NAP.email || '',
    telephone: NAP.telephone || '',
    streetAddress: NAP.streetAddress || '',
    addressLocality: NAP.addressLocality || '',
    addressRegion: NAP.addressRegion || '',
    addressCountry: NAP.addressCountry || 'MA',
    image: DEFAULT_OG_IMAGE,
    sameAs: [],
  }
}

export const organizationJsonLd = (storefront = null) => {
  const b = resolveBrand(storefront)
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: b.name,
    url: b.url,
  }
  if (b.logo) data.logo = b.logo
  if (b.email) data.email = b.email
  if (b.telephone) data.telephone = b.telephone
  if (b.streetAddress || b.addressLocality) {
    data.address = {
      '@type': 'PostalAddress',
      streetAddress: b.streetAddress || undefined,
      addressLocality: b.addressLocality || undefined,
      addressRegion: b.addressRegion || undefined,
      addressCountry: b.addressCountry || undefined,
    }
  }
  if (b.sameAs?.length) data.sameAs = b.sameAs
  return data
}

export const websiteJsonLd = (storefront = null) => {
  const b = resolveBrand(storefront)
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: b.name,
    url: b.url,
    inLanguage: 'fr-MA',
    publisher: { '@type': 'Organization', name: b.name, url: b.url },
  }
}

export const localBusinessJsonLd = (storefront = null) => {
  const b = resolveBrand(storefront)
  const data = {
    '@context': 'https://schema.org',
    '@type': 'AutoRental',
    name: b.name,
    url: b.url,
    areaServed: { '@type': 'Country', name: 'Morocco' },
    priceRange: '$$',
  }
  if (b.image) data.image = b.image
  if (b.telephone) data.telephone = b.telephone
  if (b.email) data.email = b.email
  if (b.streetAddress || b.addressLocality) {
    data.address = {
      '@type': 'PostalAddress',
      streetAddress: b.streetAddress || undefined,
      addressLocality: b.addressLocality || undefined,
      addressRegion: b.addressRegion || undefined,
      addressCountry: b.addressCountry || undefined,
    }
  }
  return data
}

export const breadcrumbJsonLd = (items = [], origin) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: absoluteUrl(item.path, origin),
  })),
})

export const faqJsonLd = (faqs = []) => {
  if (!faqs.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

export const vehicleProductJsonLd = (car, path, storefront = null) => {
  if (!car?.brand || !car?.model) return null
  const b = resolveBrand(storefront)
  const name = `${car.brand} ${car.model}`.trim()
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: b.name ? `Location ${name} avec ${b.name}.` : `Location ${name}.`,
    brand: { '@type': 'Brand', name: car.brand },
    category: car.category || undefined,
    url: absoluteUrl(path, b.url),
  }
  if (car.image) data.image = car.image
  if (typeof car.pricePerDay === 'number' && car.pricePerDay > 0) {
    data.offers = {
      '@type': 'Offer',
      priceCurrency: 'MAD',
      price: String(car.pricePerDay),
      availability: 'https://schema.org/InStock',
      url: absoluteUrl(path, b.url),
    }
  }
  return data
}

export const toJsonLdScript = (nodes) =>
  (Array.isArray(nodes) ? nodes : [nodes])
    .filter(Boolean)
    .map((node) => JSON.stringify(node))
