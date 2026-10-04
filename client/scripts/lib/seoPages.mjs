/**
 * Build-time SEO page catalog (no React). Used by sitemap + prerender.
 */
import { MOROCCO_PILLAR } from '../../src/seo/data/moroccoPillar.js'
import { getPublishedCities } from '../../src/seo/data/cities.js'
import { SEO_CATEGORIES } from '../../src/seo/data/categories.js'
import { SEO_GUIDES } from '../../src/seo/data/guides.js'
import { airportsFromLocations } from '../../src/seo/data/airports.js'
import { SITE_ORIGIN } from '../../src/seo/constants.js'
import { uniqueCarSlug } from '../../src/seo/slugify.js'

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const renderSections = (sections = []) =>
  sections
    .map(
      (s) => `
      <section>
        <h2>${escapeHtml(s.heading)}</h2>
        <p>${escapeHtml(s.body)}</p>
      </section>`
    )
    .join('\n')

const renderFaqs = (faqs = []) => {
  if (!faqs.length) return ''
  return `
    <section>
      <h2>Questions fréquentes</h2>
      ${faqs
        .map(
          (f) => `
        <details>
          <summary>${escapeHtml(f.question)}</summary>
          <p>${escapeHtml(f.answer)}</p>
        </details>`
        )
        .join('\n')}
    </section>`
}

export const fetchJson = async (url) => {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 12000)
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export const resolveApiOrigin = () => {
  const raw =
    process.env.VITE_API_URL ||
    process.env.VITE_BASE_URL ||
    process.env.SEO_API_ORIGIN ||
    ''
  const base = String(raw).replace(/\/+$/, '').replace(/\/api$/, '')
  if (!base) {
    console.warn(
      '[seoPages] Missing VITE_API_URL (or VITE_BASE_URL / SEO_API_ORIGIN); SEO fetch may fail.',
    )
  }
  return base
}

export async function collectSeoPages() {
  const api = resolveApiOrigin()
  const locData = await fetchJson(`${api}/api/pickup-locations`)
  const list = Array.isArray(locData?.locations) ? locData.locations : []

  // Only real active airport pickup points from the live API (never invent desks).
  const airports = airportsFromLocations(list)

  const carsData = await fetchJson(`${api}/api/user/cars`)
  const cars = carsData?.success && Array.isArray(carsData.cars) ? carsData.cars : []

  const pages = []

  pages.push({
    path: MOROCCO_PILLAR.path,
    title: MOROCCO_PILLAR.title,
    description: MOROCCO_PILLAR.description,
    h1: MOROCCO_PILLAR.h1,
    intro: MOROCCO_PILLAR.intro,
    sections: MOROCCO_PILLAR.sections,
    faqs: MOROCCO_PILLAR.faqs,
    priority: '0.95',
    changefreq: 'weekly',
  })

  for (const city of getPublishedCities()) {
    pages.push({
      path: `/location-voiture/${city.slug}`,
      title: city.title,
      description: city.description,
      h1: city.h1,
      intro: city.intro,
      sections: city.sections,
      faqs: city.faqs,
      priority: '0.85',
      changefreq: 'weekly',
    })
  }

  for (const airport of airports) {
    pages.push({
      path: `/location-voiture-aeroport/${airport.slug}`,
      title: airport.title,
      description: airport.description,
      h1: airport.h1,
      intro: airport.intro,
      sections: airport.sections,
      faqs: airport.faqs,
      priority: '0.85',
      changefreq: 'weekly',
    })
  }

  for (const cat of SEO_CATEGORIES) {
    pages.push({
      path: `/cars/${cat.slug}`,
      title: cat.title,
      description: cat.description,
      h1: cat.h1,
      intro: cat.intro,
      sections: cat.sections,
      faqs: cat.faqs,
      priority: '0.8',
      changefreq: 'weekly',
    })
  }

  pages.push({
    path: '/guide',
    title: 'Guides location voiture Maroc',
    description: 'Conseils pratiques pour louer et conduire au Maroc avec HDN Car.',
    h1: 'Guides location de voiture au Maroc',
    intro: 'Réponses utiles avant de réserver.',
    sections: SEO_GUIDES.map((g) => ({
      heading: g.h1,
      body: g.description,
    })),
    faqs: [],
    priority: '0.75',
    changefreq: 'monthly',
  })

  for (const guide of SEO_GUIDES) {
    pages.push({
      path: `/guide/${guide.slug}`,
      title: guide.title,
      description: guide.description,
      h1: guide.h1,
      intro: guide.intro,
      sections: guide.sections,
      faqs: guide.faqs,
      priority: '0.7',
      changefreq: 'monthly',
    })
  }

  for (const car of cars) {
    const slug = uniqueCarSlug(car, cars)
    if (!slug) continue
    const name = `${car.brand || ''} ${car.model || ''}`.trim()
    pages.push({
      path: `/cars/${slug}`,
      title: `Location ${name} Maroc`,
      description: `Louez une ${name} au Maroc avec HDN Car.`,
      h1: `Location ${name} au Maroc`,
      intro: `${name} — véhicule de la flotte HDN Car.`,
      sections: [
        {
          heading: 'Réservation',
          body: 'Consultez disponibilité et tarifs sur la fiche véhicule pour finaliser la réservation.',
        },
      ],
      faqs: [],
      priority: '0.65',
      changefreq: 'weekly',
    })
  }

  // Core pages
  pages.unshift(
    {
      path: '/',
      title: 'RSZ CAR — Car Rental Management Software',
      description:
        'RSZ CAR is an all-in-one car rental management platform for reservations, fleet, customers, contracts, accounting and daily operations.',
      h1: 'RSZ CAR',
      intro: 'Car rental management software.',
      sections: [],
      faqs: [],
      priority: '1.0',
      changefreq: 'weekly',
      skipBodyPrerender: true,
      marketing: true,
    },
    {
      path: '/cars',
      title: 'Véhicules à louer — HDN Car',
      description: 'Parcourez la flotte HDN Car et réservez votre véhicule au Maroc.',
      h1: 'Nos véhicules',
      intro: 'Catalogue de location.',
      sections: [],
      faqs: [],
      priority: '0.9',
      changefreq: 'daily',
      skipBodyPrerender: true,
    }
  )

  return { pages, airports, cars, siteOrigin: SITE_ORIGIN }
}

export function renderPageBody(page) {
  return `
<main id="seo-prerender">
  <article>
    <h1>${escapeHtml(page.h1)}</h1>
    <p>${escapeHtml(page.intro || '')}</p>
    ${renderSections(page.sections)}
    ${renderFaqs(page.faqs)}
    <p><a href="/cars">Voir les véhicules disponibles</a> · <a href="/location-voiture-maroc">Location voiture Maroc</a></p>
  </article>
</main>`
}

const buildPrerenderJsonLd = (page, canonical) => {
  const graph = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      url: canonical,
      inLanguage: 'fr-MA',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Accueil',
          item: SITE_ORIGIN,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: page.h1 || page.title,
          item: canonical,
        },
      ],
    },
  ]
  if (page.faqs?.length) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    })
  }
  return graph
}

export function injectSeoIntoHtml(template, page) {
  const title = escapeHtml(
    page.marketing
      ? page.title
      : page.title.includes('HDN')
        ? page.title
        : `${page.title} | HDN Car`
  )
  const desc = escapeHtml(page.description || '')
  const canonical = `${SITE_ORIGIN}${page.path === '/' ? '/' : page.path}`
  const body = page.skipBodyPrerender ? '' : renderPageBody(page)
  const jsonLd = buildPrerenderJsonLd(page, canonical)
    .map((node) => `<script type="application/ld+json">${JSON.stringify(node)}</script>`)
    .join('\n    ')

  let html = template
  // Idempotent: strip prior prerender injections if template was already processed
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, '')
  html = html.replace(/<main id="seo-prerender">[\s\S]*?<\/main>\s*/i, '')
  html = html.replace(/<style id="seo-prerender-hide">[\s\S]*?<\/style>\s*/i, '')
  html = html.replace(/<script>document\.documentElement\.classList\.add\('js'\)<\/script>\s*/i, '')

  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${desc}" />`
  )
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${canonical}" />`
  )
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${title}" />`
  )
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${desc}" />`
  )
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${canonical}" />`
  )
  html = html.replace(/<html\s+lang="[^"]*"/i, '<html lang="fr"')

  // Ensure robots index for SEO pages
  if (!/name="robots"/i.test(html)) {
    html = html.replace('</head>', `<meta name="robots" content="index,follow" />\n</head>`)
  }

  // Hide prerender body before first paint when JS runs — prevents CLS on hydrate.
  // Non-JS crawlers still receive full text in HTML source.
  const antiCls = `
    <style id="seo-prerender-hide">html.js #seo-prerender{display:none!important}</style>
    <script>document.documentElement.classList.add('js')</script>`

  html = html.replace('</head>', `    ${jsonLd}\n    ${antiCls}\n  </head>`)

  if (body) {
    // Place crawlable content before the SPA root; React mounts into #root only.
    html = html.replace(
      /<div id="root"><\/div>/i,
      `${body}\n    <div id="root"></div>`
    )
  }

  return html
}
