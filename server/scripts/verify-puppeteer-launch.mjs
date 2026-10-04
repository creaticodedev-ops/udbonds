/**
 * Verify Puppeteer can resolve and launch Chrome, then render a tiny PDF.
 * Run: npm run test:puppeteer
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  withPdfPage,
  closePdfBrowser,
  resolveChromeExecutablePath,
  getPdfBrowserStats,
} from '../utils/launchPdfBrowser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'uploads', 'contracts', '_puppeteer_probe');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `probe-${Date.now()}.pdf`);

const resolved = resolveChromeExecutablePath();
console.log('Resolved executablePath:', resolved || '(puppeteer default / .puppeteerrc.cjs)');
console.log('PUPPETEER_CACHE_DIR:', process.env.PUPPETEER_CACHE_DIR || '(unset)');
console.log('PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH || '(unset)');

try {
  await withPdfPage(async (page) => {
    await page.setContent(
      '<!DOCTYPE html><html><body><h1>Puppeteer OK</h1><p>PDF probe</p></body></html>',
      { waitUntil: 'load', timeout: 30000 },
    );
    await page.pdf({ path: outFile, format: 'A4' });
  });
} finally {
  await closePdfBrowser();
}

const size = fs.statSync(outFile).size;
if (size < 500) {
  console.error('FAIL: PDF too small:', size);
  process.exit(1);
}

console.log('PASS: Chrome launched and PDF written');
console.log('PDF:', outFile, 'bytes:', size);
console.log('Pool stats:', getPdfBrowserStats());
