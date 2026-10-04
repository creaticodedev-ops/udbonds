import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { collectSeoPages, injectSeoIntoHtml } from './lib/seoPages.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')
const templatePath = path.join(distDir, 'index.html')

if (!fs.existsSync(templatePath)) {
  console.error('prerender-seo: dist/index.html missing — run vite build first')
  process.exit(1)
}

const template = fs.readFileSync(templatePath, 'utf8')
const { pages } = await collectSeoPages()

let count = 0
for (const page of pages) {
  if (page.path === '/') {
    // Apex `/` is the RSZ CAR marketing site. Keep the Vite template
    // (title, description, OG) instead of tenant rental SEO.
    continue
  }

  const html = injectSeoIntoHtml(template, page)

  const outDir = path.join(distDir, ...page.path.replace(/^\//, '').split('/'))
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8')
  count += 1
}

console.log(`prerender-seo: wrote ${count} HTML documents under dist/`)
