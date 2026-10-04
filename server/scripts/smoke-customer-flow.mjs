import puppeteer from 'puppeteer'

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4174'
const executablePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const pageErrors = []
const preloadWarns = []

const browser = await puppeteer.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=390,844'],
  defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
})

const page = await browser.newPage()
page.setDefaultTimeout(45000)
page.on('pageerror', (err) => pageErrors.push(err.message))
page.on('console', (msg) => {
  const text = msg.text()
  if (/preload|was preloaded|not used within a few seconds/i.test(text)) preloadWarns.push(text)
})

async function settle() {
  await new Promise((r) => setTimeout(r, 1000))
}

// 1) Home
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
await settle()
const homeHasHero = await page.evaluate(() => document.body.innerText.length > 50)
const heroImg = await page.evaluate(() => {
  const img = document.querySelector('img[src*="main_car"]')
  if (!img) return { found: false }
  return {
    found: true,
    complete: img.complete,
    naturalWidth: img.naturalWidth,
    src: img.currentSrc || img.src,
  }
})

// 2) Navigate to cars (search results shell)
await page.goto(`${BASE}/cars?pickupLocation=Casablanca&pickupDate=2026-08-10&returnDate=2026-08-12`, {
  waitUntil: 'networkidle2',
})
await settle()
const carsPageOk = await page.evaluate(() => /Available Cars|Showing|No cars/i.test(document.body.innerText))

// 3) Car details with unknown id should not blank-crash
await page.goto(`${BASE}/car-details/000000000000000000000000`, { waitUntil: 'networkidle2' })
await settle()
const detailsRoot = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length || 0)
const detailsText = await page.evaluate(() => document.body.innerText.slice(0, 300))

// 4) Desktop viewport pass
await page.setViewport({ width: 1280, height: 800, isMobile: false, hasTouch: false })
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
await settle()
const desktopOk = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length > 1000)

// 5) Confirmation redirect without state
await page.goto(`${BASE}/booking-confirmation`, { waitUntil: 'networkidle2' })
await settle()
const onCarsAfterConfirm = await page.evaluate(() => location.pathname.includes('/cars') || /Available Cars/i.test(document.body.innerText))

console.log(JSON.stringify({
  homeHasHero,
  heroImg,
  carsPageOk,
  detailsRoot,
  detailsSnippet: detailsText.replace(/\s+/g, ' ').trim().slice(0, 180),
  desktopOk,
  onCarsAfterConfirm,
  pageErrors,
  preloadWarns,
}, null, 2))

await browser.close()
const failed = !homeHasHero || !heroImg.found || !heroImg.naturalWidth || !carsPageOk || !desktopOk || pageErrors.length || preloadWarns.length
process.exit(failed ? 1 : 0)
