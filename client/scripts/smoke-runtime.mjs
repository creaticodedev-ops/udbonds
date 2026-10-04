/**
 * Runtime smoke test for the production preview build.
 * Captures console errors, failed network, and walks key routes.
 */
import puppeteer from 'puppeteer'

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4174'
const API = process.env.SMOKE_API || 'http://127.0.0.1:3000'

const errors = []
const warnings = []
const failedRequests = []

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const page = await browser.newPage()
page.setDefaultTimeout(30000)

page.on('console', (msg) => {
  const type = msg.type()
  const text = msg.text()
  if (type === 'error') errors.push(text)
  if (type === 'warning' || type === 'warn') warnings.push(text)
})

page.on('pageerror', (err) => {
  errors.push(`PAGEERROR: ${err.message}`)
})

page.on('requestfailed', (req) => {
  failedRequests.push(`${req.failure()?.errorText || 'fail'} ${req.url()}`)
})

async function go(path) {
  const url = `${BASE}${path}`
  const res = await page.goto(url, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 800))
  return { path, status: res?.status(), title: await page.title() }
}

const results = []
results.push(await go('/'))

// Home should render brand / root
const rootHtml = await page.$eval('#root', (el) => el.innerHTML.slice(0, 200))
if (!rootHtml || rootHtml.length < 20) {
  errors.push('Home #root appears empty')
}

results.push(await go('/cars'))
results.push(await go('/booking-confirmation')) // may redirect
results.push(await go('/not-a-real-route'))

// Try car details if API has cars (optional)
try {
  const apiRes = await fetch(`${API}/api/user/cars`)
  if (apiRes.ok) {
    const data = await apiRes.json()
    const id = data?.cars?.[0]?._id
    if (id) {
      results.push(await go(`/car-details/${id}`))
      // Check reservation form exists
      const hasForm = await page.$('form')
      if (!hasForm) warnings.push('Car details: no form found')
    }
  }
} catch (e) {
  warnings.push(`API cars check skipped: ${e.message}`)
}

console.log(JSON.stringify({
  base: BASE,
  results,
  errors,
  warnings: warnings.filter((w) =>
    /preload|Preload|not used|Failed to load|hydrat|chunk|React|framer|motion|undefined|Cannot/i.test(w)
    || true
  ).slice(0, 40),
  failedRequests: failedRequests.filter((u) => !u.includes('favicon')).slice(0, 30),
}, null, 2))

await browser.close()
process.exit(errors.length ? 1 : 0)
