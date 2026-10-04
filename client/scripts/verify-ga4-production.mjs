/**
 * Headless Chrome check: production must load gtag and send GA4 collect page_view.
 * Usage: node scripts/verify-ga4-production.mjs [url]
 */
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const TARGET = process.argv[2] || 'https://www.hdncar.com/'
const MEASUREMENT_ID = 'G-M4SR5C4KGH'
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

const chrome = chromeCandidates.find((p) => fs.existsSync(p))
if (!chrome) {
  console.error('Chrome not found. Set CHROME_PATH.')
  process.exit(1)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hdn-ga4-'))
const userData = path.join(tmp, 'profile')
const netlog = path.join(tmp, 'netlog.json')
const url = TARGET.includes('debug_mode=') ? TARGET : `${TARGET}${TARGET.includes('?') ? '&' : '?'}debug_mode=1`

const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  `--user-data-dir=${userData}`,
  `--log-net-log=${netlog}`,
  '--net-log-capture-mode=Everything',
  url,
]

console.log('Chrome:', chrome)
console.log('URL:', url)

const child = spawn(chrome, args, { stdio: 'ignore' })
await new Promise((resolve) => setTimeout(resolve, 16000))
child.kill('SIGTERM')
await new Promise((resolve) => setTimeout(resolve, 1500))
try { child.kill('SIGKILL') } catch {}

if (!fs.existsSync(netlog) || fs.statSync(netlog).size < 1000) {
  console.error('FAIL: netlog missing/empty')
  process.exit(1)
}

const s = fs.readFileSync(netlog, 'utf8')
const hasGtag = s.includes(`googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`)
const collectHits = [...s.matchAll(/google-analytics\.com\/g\/collect\?[^"\\\s]{10,800}/g)].map((m) => m[0])
const pageViews = collectHits.filter((u) => u.includes('en=page_view') && u.includes(`tid=${MEASUREMENT_ID}`))

console.log('gtag.js loaded:', hasGtag)
console.log('collect urls:', collectHits.length)
console.log('page_view collect:', pageViews.length)

if (!hasGtag) {
  console.error('FAIL: gtag.js was not requested')
  process.exit(1)
}
if (!pageViews.length) {
  console.error('FAIL: no GA4 page_view collect hit for', MEASUREMENT_ID)
  process.exit(1)
}

const sample = pageViews[0]
console.log('OK sample:', sample.slice(0, 280))
console.log('verify-ga4-production: passed')
