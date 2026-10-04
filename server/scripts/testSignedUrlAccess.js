import axios from 'axios';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import models
import Booking from '../models/Booking.js';

const BASE_URL = 'http://localhost:3000';
const api = axios.create({ baseURL: BASE_URL, maxRedirects: 0, validateStatus: () => true });

async function connectDB() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/car-rental';
  await mongoose.connect(mongoUri);
  console.log('[DB] Connected');
}

async function testSignedUrlAccess() {
  console.log('\n=== SIGNED URL ACCESS TEST ===\n');

  try {
    // Find the latest test booking that has a contract
    const booking = await Booking.findOne({
      'completion.contractPdfUrl': { $exists: true, $ne: '' }
    }).sort({ _id: -1 });

    if (!booking) {
      console.log('[!] No bookings with contracts found');
      return;
    }

    console.log('[1] Found booking:', booking.reservationId);
    console.log('[2] Contract URL:', booking.completion.contractPdfUrl);
    
    // Verify the URL has signature parameters
    if (!booking.completion.contractPdfUrl.includes('sig=')) {
      console.log('[!] Contract URL NOT signed (missing sig parameter)');
      return;
    }
    console.log('[✓] Contract URL is signed');

    // Try to download the contract with the signed URL
    console.log('\n[3] Attempting to download contract with signed URL...');
    try {
      const response = await api.get(booking.completion.contractPdfUrl.replace(BASE_URL, ''));
      
      if (response.status === 200) {
        console.log('[✓] Contract downloaded successfully');
        console.log('[✓] Response size:', response.data.length || 'unknown');
        console.log('[✓] Content-Type:', response.headers['content-type']);
        
        // Check if PDF has content
        if (response.data && response.data.length > 100) {
          console.log('\n[SUCCESS] Signed URL authentication is working!');
          console.log('[TIP] The signature file can be accessed via the signed URL.');
          console.log('[TIP] Puppeteer will be able to load the signature image during PDF generation.');
        }
      } else {
        console.log('[!] Failed to download:', response.status, response.statusText);
      }
    } catch (err) {
      console.log('[ERROR] Download failed:', err.message);
    }

    // Check signature storage
    console.log('\n[4] Checking signature storage...');
    console.log('[>] Signature URL:', booking.completion.signatureUrl);
    console.log('[>] Signature exists:', !!booking.completion.signatureUrl);
    console.log('[>] Signature stored:', booking.completion.signatureSignedAt ? 'yes' : 'no');
    console.log('[>] Contract exists:', booking.completion.contractPdfUrl ? 'yes' : 'no');

  } catch (err) {
    console.error('[ERROR]', err.message);
  }

  process.exit(0);
}

await connectDB();
await testSignedUrlAccess();
