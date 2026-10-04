import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { collectSeoPages } from './lib/seoPages.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const { pages, siteOrigin } = await collectSeoPages()

const urls = pages
  .filter((p) => p.path)
  .map((p) => {
    const loc = `${siteOrigin}${p.path === '/' ? '/' : p.path}`
    return `  <url>
    <loc>${loc}</loc>
    <changefreq>${p.changefreq || 'weekly'}</changefreq>
    <priority>${p.priority || '0.5'}</priority>
  </url>`
  })
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

const publicPath = path.join(root, 'public', 'sitemap.xml')
fs.writeFileSync(publicPath, xml, 'utf8')

const distPath = path.join(root, 'dist', 'sitemap.xml')
if (fs.existsSync(path.join(root, 'dist'))) {
  fs.writeFileSync(distPath, xml, 'utf8')
}

console.log(`generate-sitemap: wrote ${pages.length} URLs → public/sitemap.xml`)
