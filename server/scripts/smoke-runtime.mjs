import puppeteer from 'puppeteer'

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4174'
const executablePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const pageErrors = []
const preloadWarns = []
const consoleErrors = []

const browser = await puppeteer.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const page = await browser.newPage()
page.setDefaultTimeout(45000)

page.on('pageerror', (err) => pageErrors.push(err.message))
page.on('console', (msg) => {
  const text = msg.text()
  if (/preload|was preloaded|not used within a few seconds/i.test(text)) {
    preloadWarns.push(text)
  }
  // Ignore expected API failures when backend is down in local preview
  if (msg.type() === 'error') {
    if (/status of 500|status of 404|Failed to load resource|Request failed with status code|net::ERR_/i.test(text)) {
      return
    }
    consoleErrors.push(text)
  }
})

const routes = ['/', '/cars', '/booking-confirmation', '/owner', '/superadmin/login', '/missing-route-xyz']
const results = []

for (const pathName of routes) {
  await page.goto(`${BASE}${pathName}`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 900))
  const rootLen = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length || 0)
  const text = await page.evaluate(() => (document.body?.innerText || '').slice(0, 220))
  const crashed = /Cannot access|is not defined|Something went wrong|Unhandled/i.test(text)
  results.push({ path: pathName, rootLen, crashed, snippet: text.replace(/\s+/g, ' ').trim() })
}

// Home must show brand
const homeOk = results[0]?.rootLen > 1000 && /Drive with distinction|Find cars|car rental|Location|Réserver|Book/i.test(results[0]?.snippet || '')
const carsOk = results[1]?.rootLen > 500
const notFoundOk = /404|not found/i.test(results[5]?.snippet || '')

console.log(JSON.stringify({
  homeOk,
  carsOk,
  notFoundOk,
  pageErrors,
  preloadWarns,
  consoleErrors,
  results,
}, null, 2))

await browser.close()

const failed = !homeOk || !carsOk || pageErrors.length > 0 || consoleErrors.length > 0 || preloadWarns.length > 0
process.exit(failed ? 1 : 0)
