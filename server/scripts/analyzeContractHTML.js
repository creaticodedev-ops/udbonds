import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import ExportTemplate from '../models/ExportTemplate.js';
import User from '../models/User.js';
import { buildTemplateVariables, buildDocumentHtml } from '../services/templateEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function connectDB() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/car-rental';
  await mongoose.connect(mongoUri);
  console.log('[DB] Connected');
}

async function analyzeContractHTML() {
  console.log('\n=== CONTRACT HTML ANALYSIS ===\n');

  try {
    // Find the latest test booking
    const booking = await Booking.findOne({ reservationId: 'RES-X72NDBGA' }).populate('owner');
    
    if (!booking) {
      console.log('[!] Booking not found');
      return;
    }

    console.log('[1] Found booking:', booking.reservationId);
    console.log('[2] Signature URL:', booking.completion?.signatureUrl);
    
    // Get template
    const template = await ExportTemplate.findOne({
      owner: booking.owner._id,
      type: 'contract',
      isDefault: true,
      isActive: true,
    });

    if (!template) {
      console.log('[!] No template found');
      return;
    }

    console.log('[3] Template found:', template._id);
    
    // Build variables
    const variables = buildTemplateVariables(booking, {
      contractNumber: booking.reservationId,
      owner: booking.owner,
      template,
    });

    console.log('[4] Template variables:');
    console.log('    - customer_name:', variables.customer_name);
    console.log('    - customer_signature_html:', variables.customer_signature_html?.substring(0, 100));
    
    // Check template body for placeholder
    if (template.bodyHtml && template.bodyHtml.includes('{{customer_signature_html}}')) {
      console.log('[✓] Template bodyHtml contains {{customer_signature_html}} placeholder');
    } else {
      console.log('[!] Template bodyHtml DOES NOT contain {{customer_signature_html}} placeholder');
      console.log('[!] Template body starts:', template.bodyHtml?.substring(0, 200));
    }
    
    // Build HTML
    const html = buildDocumentHtml(template, variables);
    
    console.log('[5] Searching HTML for signature...');
    
    // Check for signature img tag
    const sigImg = /<img[^>]*signature[^>]*>/gi;
    const imgMatches = html.match(sigImg);
    
    if (imgMatches && imgMatches.length > 0) {
      console.log('[✓] Found', imgMatches.length, 'signature image tag(s)');
      imgMatches.forEach((match, i) => {
        console.log(`    [${i}]:`, match.substring(0, 150));
      });
    } else {
      console.log('[!] NO signature img tags found');
    }

    // Check if {{customer_signature_html}} was replaced
    if (html.includes('{{customer_signature_html}}')) {
      console.log('[!] ERROR: {{customer_signature_html}} not replaced!');
    } else {
      console.log('[✓] {{customer_signature_html}} was replaced');
    }

    // Search for ik.imagekit.io in the HTML 
    const imageKitRegex = /ik\.imagekit\.io[^"<]*/gi;
    const kitMatches = html.match(imageKitRegex);
    if (kitMatches) {
      console.log('[✓] Found', kitMatches.length, 'ImageKit URL(s) in HTML');
      kitMatches.forEach((m, i) => {
        console.log(`    [${i}]:`, m.substring(0, 100));
      });
    } else {
      console.log('[!] NO ImageKit URLs found in HTML');
    }

    // Save HTML for inspection
    const htmlFile = path.join(__dirname, 'debug-contract.html');
    fs.writeFileSync(htmlFile, html);
    console.log('\n[✓] HTML saved to:', htmlFile);
    
    // Check if ImageKit URL is in HTML
    if (html.includes('ik.imagekit.io')) {
      console.log('[✓] ImageKit URL found in HTML');
    }

  } catch (err) {
    console.error('[ERROR]', err.message);
  }

  process.exit(0);
}

await connectDB();
await analyzeContractHTML();
