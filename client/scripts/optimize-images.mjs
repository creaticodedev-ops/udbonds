/**
 * Convert large PNGs → WebP (+ AVIF for hero LCP) for Lighthouse image savings.
 * Run: node scripts/optimize-images.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const assetsDir = path.resolve(__dirname, '../src/assets')
const publicImages = path.resolve(__dirname, '../public/images')

fs.mkdirSync(publicImages, { recursive: true })

const jobs = [
  { file: 'main_car.png', width: 1200, quality: 78, publicHero: true },
  { file: 'banner_car_image.png', width: 1600, quality: 72 },
  { file: 'car_image1.png', width: 900, quality: 75 },
  { file: 'car_image2.png', width: 900, quality: 75 },
  { file: 'car_image3.png', width: 900, quality: 75 },
  { file: 'car_image4.png', width: 900, quality: 75 },
  { file: 'user_profile.png', width: 256, quality: 70 },
  { file: 'testimonial_image_1.png', width: 160, quality: 70 },
  { file: 'testimonial_image_2.png', width: 160, quality: 70 },
]

const report = []

for (const job of jobs) {
  const input = path.join(assetsDir, job.file)
  if (!fs.existsSync(input)) {
    console.warn('skip missing', job.file)
    continue
  }

  const base = job.file.replace(/\.png$/i, '')
  const webpOut = path.join(assetsDir, `${base}.webp`)
  const pipeline = sharp(input).rotate().resize({
    width: job.width,
    withoutEnlargement: true,
  })

  await pipeline
    .clone()
    .webp({ quality: job.quality, effort: 6 })
    .toFile(webpOut)

  const inSize = fs.statSync(input).size
  const webpSize = fs.statSync(webpOut).size
  report.push({ file: job.file, inKB: Math.round(inSize / 1024), webpKB: Math.round(webpSize / 1024) })

  if (job.publicHero) {
    const publicWebp = path.join(publicImages, 'main_car.webp')
    const publicAvif = path.join(publicImages, 'main_car.avif')
    await sharp(input)
      .rotate()
      .resize({ width: 900, withoutEnlargement: true })
      .webp({ quality: 76, effort: 6 })
      .toFile(publicWebp)
    await sharp(input)
      .rotate()
      .resize({ width: 900, withoutEnlargement: true })
      .avif({ quality: 55, effort: 6 })
      .toFile(publicAvif)
    report.push({
      file: 'public/images/main_car',
      webpKB: Math.round(fs.statSync(publicWebp).size / 1024),
      avifKB: Math.round(fs.statSync(publicAvif).size / 1024),
    })
  }
}

console.table(report)
console.log('Done. Update imports to .webp where applicable.')
