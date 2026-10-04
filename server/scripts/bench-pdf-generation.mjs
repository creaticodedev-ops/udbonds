/**
 * Benchmark contract PDF generation (cold + warm + concurrent).
 * Usage: node scripts/bench-pdf-generation.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { generateContractPdf } from '../services/templatePdfExport.js';
import {
  DEFAULT_CONTRACT_BODY,
  DEFAULT_CONTRACT_HEADER,
  DEFAULT_CONTRACT_FOOTER,
  DEFAULT_CONTRACT_CUSTOM_CSS,
  DEFAULT_CONTRACT_TERMS_HTML,
} from '../services/defaultTemplates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'uploads', 'contracts', '_bench');
fs.mkdirSync(OUT, { recursive: true });

const template = {
  _id: 'bench-tmpl',
  name: 'Bench Contract',
  type: 'contract',
  headerHtml: DEFAULT_CONTRACT_HEADER,
  bodyHtml: DEFAULT_CONTRACT_BODY,
  termsHtml: DEFAULT_CONTRACT_TERMS_HTML,
  footerHtml: DEFAULT_CONTRACT_FOOTER,
  customCss: DEFAULT_CONTRACT_CUSTOM_CSS,
  pageSize: 'A4',
  logoUrl: '',
  companySignatureUrl: '',
};

const owner = {
  _id: 'benchowner',
  businessName: 'Bench Agency',
  email: 'bench@test.com',
  phone: '0600000000',
};

const booking = {
  _id: 'benchbooking',
  reservationId: 'RES-BENCH',
  customerName: 'Bench Customer',
  customerEmail: 'bench@customer.com',
  customerPhone: '+212600000000',
  nationality: 'Marocaine',
  dateOfBirth: '1990-01-01',
  customerAddress: '1 Bench St',
  pickupDate: new Date('2026-08-10T10:00:00Z'),
  returnDate: new Date('2026-08-12T10:00:00Z'),
  pickupLocation: 'Casablanca Airport',
  returnLocation: 'Casablanca Airport',
  price: 900,
  paymentStatus: 'pending',
  channel: 'whatsapp',
  car: { brand: 'Dacia', model: 'Logan', year: 2024, licensePlate: '12345-A-6', category: 'Economy' },
  priceBreakdown: { rentalPrice: 900, pickupDeliveryFee: 0, dropoffDeliveryFee: 0, discountTotal: 0, days: 2 },
  completion: {},
};

const timed = async (label, fn) => {
  const t0 = performance.now();
  const result = await fn();
  const ms = performance.now() - t0;
  console.log(`${label}: ${ms.toFixed(0)} ms`);
  return { ms, result };
};

console.log('=== PDF generation benchmark ===');
console.log('Node', process.version, '| PID', process.pid);

const cold = await timed('1) Cold first PDF (includes Chromium startup if any)', async () =>
  generateContractPdf({
    template,
    booking,
    contractNumber: 'CTR-BENCH-COLD',
    owner,
    includeCompanyStamp: true,
  }),
);

const warmSamples = [];
for (let i = 0; i < 3; i += 1) {
  const w = await timed(`2.${i + 1}) Warm PDF #${i + 1}`, async () =>
    generateContractPdf({
      template,
      booking,
      contractNumber: `CTR-BENCH-WARM-${i + 1}`,
      owner,
      includeCompanyStamp: true,
    }),
  );
  warmSamples.push(w.ms);
}

const warmAvg = warmSamples.reduce((a, b) => a + b, 0) / warmSamples.length;
console.log(`Warm average (3): ${warmAvg.toFixed(0)} ms`);

const concN = 3;
const concT0 = performance.now();
const conc = await Promise.all(
  Array.from({ length: concN }, (_, i) =>
    generateContractPdf({
      template,
      booking,
      contractNumber: `CTR-BENCH-CONC-${i + 1}`,
      owner,
      includeCompanyStamp: true,
    }),
  ),
);
const concMs = performance.now() - concT0;
console.log(`3) Concurrent x${concN} wall time: ${concMs.toFixed(0)} ms (avg/doc ${(concMs / concN).toFixed(0)} ms)`);
conc.forEach((r, i) => {
  const size = fs.statSync(r.filePath).size;
  console.log(`   conc[${i}] size=${size}`);
});

console.log('\n--- Summary ---');
console.log(JSON.stringify({
  coldMs: Math.round(cold.ms),
  warmAvgMs: Math.round(warmAvg),
  warmSamplesMs: warmSamples.map((n) => Math.round(n)),
  concurrentWallMs: Math.round(concMs),
  concurrentCount: concN,
}, null, 2));

// Best-effort close shared browser if present
try {
  const mod = await import('../utils/launchPdfBrowser.js');
  if (typeof mod.closePdfBrowser === 'function') await mod.closePdfBrowser();
} catch {
  /* ignore */
}
