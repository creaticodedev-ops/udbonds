import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logoPath = path.resolve(__dirname, '../src/assets/logo.svg')
const outWebp = path.resolve(__dirname, '../src/assets/logo.webp')
const outPng = path.resolve(__dirname, '../public/images/logo.png')
const svg = fs.readFileSync(logoPath, 'utf8')

const match = svg.match(/data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)/)
if (!match) {
  console.log('No embedded raster found; leaving SVG as-is')
  process.exit(0)
}

const buf = Buffer.from(match[2], 'base64')
console.log('Embedded type:', match[1], 'bytes:', buf.length)

await sharp(buf)
  .resize({ width: 320, withoutEnlargement: true })
  .webp({ quality: 82, effort: 6 })
  .toFile(outWebp)

await sharp(buf)
  .resize({ width: 320, withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toFile(outPng)

console.log('logo.webp', Math.round(fs.statSync(outWebp).size / 1024), 'KB')
console.log('public logo.png', Math.round(fs.statSync(outPng).size / 1024), 'KB')
