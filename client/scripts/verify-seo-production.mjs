/**
 * Post-deploy production SEO verification against live hdncar.com
 * Usage: node scripts/verify-seo-production.mjs
 */
const ORIGIN = process.env.SEO_VERIFY_ORIGIN || 'https://www.hdncar.com'
const HOME_TITLE_SNIPPET = 'Premium Car Rental in Morocco'

const fetchText = async (url) => {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'HDN-SEO-Verify/1.0' },
  })
  const text = await res.text()
  return { status: res.status, finalUrl: res.url, contentType: res.headers.get('content-type') || '', text }
}

const pick = (html, re) => {
  const m = html.match(re)
  return m ? m[1].trim() : ''
}

const analyzePage = (html) => {
  const title = pick(html, /<title>([^<]*)<\/title>/i)
  const description = pick(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
  const canonical = pick(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i)
  const robots = pick(html, /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i)
  const h1 = pick(html, /<h1[^>]*>([^<]*)<\/h1>/i)
  const hasPrerender = /id=["']seo-prerender["']/.test(html)
  const ldCount = (html.match(/application\/ld\+json/g) || []).length
  const looksLikeHomeMeta =
    title.includes(HOME_TITLE_SNIPPET) ||
    canonical === 'https://hdncar.com/' ||
    canonical === 'https://www.hdncar.com/'
  return { title, description, canonical, robots, h1, hasPrerender, ldCount, looksLikeHomeMeta }
}

const results = {
  sitemapUrls: [],
  pages: [],
  failures: [],
  warnings: [],
}

const sm = await fetchText(`${ORIGIN}/sitemap.xml`)
if (sm.status !== 200 || !sm.contentType.includes('xml')) {
  results.failures.push(`sitemap.xml bad response: ${sm.status} ${sm.contentType}`)
} else {
  results.sitemapUrls = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
}

const robots = await fetchText(`${ORIGIN}/robots.txt`)
results.robots = {
  status: robots.status,
  contentType: robots.contentType,
  hasSitemap: /Sitemap:\s*https:\/\/hdncar\.com\/sitemap\.xml/i.test(robots.text),
  isPlainText: robots.contentType.includes('text/plain'),
  hasCloudflareManaged: /Cloudflare Managed/i.test(robots.text),
  disallowOwner: /Disallow:\s*\/owner/i.test(robots.text),
}

for (const loc of results.sitemapUrls) {
  // Prefer www host that actually serves 200 without apex redirect noise
  const url = loc.replace('https://hdncar.com', ORIGIN.replace(/\/$/, ''))
  const path = new URL(loc).pathname || '/'
  try {
    const { status, contentType, text } = await fetchText(url)
    const meta = analyzePage(text)
    const row = { loc, path, status, contentType, ...meta }
    results.pages.push(row)

    if (status !== 200) results.failures.push(`${path}: HTTP ${status}`)
    if (!contentType.includes('text/html')) results.failures.push(`${path}: content-type ${contentType}`)
    if (!meta.title) results.failures.push(`${path}: missing title`)
    if (!meta.description) results.failures.push(`${path}: missing description`)
    if (!meta.canonical) results.failures.push(`${path}: missing canonical`)
    if (!meta.h1 && path !== '/' && path !== '/cars') results.failures.push(`${path}: missing H1`)
    // Homepage-meta leakage on dedicated SEO routes
    if (path !== '/' && meta.looksLikeHomeMeta && !meta.hasPrerender) {
      results.failures.push(`${path}: appears to use homepage metadata without prerender`)
    }
    if (path !== '/' && path !== '/cars' && !meta.hasPrerender) {
      results.warnings.push(`${path}: no #seo-prerender block`)
    }
    if (path !== '/' && path !== '/cars' && meta.ldCount < 1) {
      results.warnings.push(`${path}: no JSON-LD`)
    }
    // Canonical should point at apex path matching sitemap
    if (meta.canonical && !meta.canonical.includes(path === '/' ? 'hdncar.com/' : path)) {
      results.warnings.push(`${path}: canonical mismatch (${meta.canonical})`)
    }
  } catch (err) {
    results.failures.push(`${path}: fetch error ${err.message}`)
  }
}

// noindex private routes (SPA may only set via Helmet after JS — check raw HTML)
for (const path of ['/booking-confirmation', '/complete-booking/test-token']) {
  const { status, text } = await fetchText(`${ORIGIN}${path}`)
  const robotsMeta = pick(text, /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i)
  results.privatePages = results.privatePages || []
  results.privatePages.push({ path, status, robotsMeta, note: 'noindex is client Helmet; raw HTML may still say index,follow until hydrate' })
}

// Functional smoke: cars API + homepage assets
const carsPage = await fetchText(`${ORIGIN}/cars`)
const home = await fetchText(`${ORIGIN}/`)
const apiCars = await fetchText('https://api.hdncar.com/api/user/cars')
const apiLocs = await fetchText('https://api.hdncar.com/api/pickup-locations')
results.appSmoke = {
  homeOk: home.status === 200,
  carsOk: carsPage.status === 200,
  apiCarsOk: apiCars.status === 200 && apiCars.text.includes('"success":true'),
  apiLocationsOk: apiLocs.status === 200 && apiLocs.text.includes('"success":true'),
  ownerLoginShell: (await fetchText(`${ORIGIN}/owner`)).status === 200,
}

console.log(JSON.stringify({
  origin: ORIGIN,
  sitemapCount: results.sitemapUrls.length,
  pagesChecked: results.pages.length,
  failures: results.failures,
  warnings: results.warnings,
  robots: results.robots,
  privatePages: results.privatePages,
  appSmoke: results.appSmoke,
  sample: results.pages.filter((p) =>
    ['/', '/location-voiture-maroc', '/cars/suv', '/guide', '/location-voiture/casablanca'].includes(p.path)
  ),
  homeMetaLeakCount: results.pages.filter((p) => p.path !== '/' && p.looksLikeHomeMeta).length,
  prerenderCount: results.pages.filter((p) => p.hasPrerender).length,
  withLdCount: results.pages.filter((p) => p.ldCount > 0).length,
}, null, 2))

if (results.failures.length) process.exitCode = 1
