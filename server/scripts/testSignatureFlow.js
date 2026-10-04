import axios from 'axios';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import models
import User from '../models/User.js';
import Car from '../models/Car.js';
import Booking from '../models/Booking.js';

const BASE_URL = 'http://localhost:3000';
const api = axios.create({ baseURL: BASE_URL });

// Connect to MongoDB
async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/car-rental';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('[DB] Connected to MongoDB');
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    throw err;
  }
}

// Generate test signature (base64 canvas data)
function generateTestSignature() {
  const canvasWidth = 500;
  const canvasHeight = 100;
  const canvas = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return canvas;
}

// Test the signature flow
async function testSignatureFlow() {
  console.log('\n=== SIGNATURE FLOW TEST ===\n');

  try {
    // Step 1: Find or create a test booking with completion token
    console.log('[1] Finding or creating test booking...');
    let booking = await Booking.findOne().populate('owner').populate('car');
    
    if (!booking) {
      console.log('[!] No bookings found in database. Creating test data...');
      const owner = await User.findOne({ role: 'owner' });
      const car = await Car.findOne({ owner: owner?._id });
      
      if (!owner || !car) {
        console.error('[!] Need at least one owner and car in database');
        return;
      }

      booking = new Booking({
        reservationId: `TEST-${Date.now()}`,
        car: car._id,
        owner: owner._id,
        pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        returnDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        price: 100,
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        customerPhone: '+1234567890',
        status: 'confirmed',
      });
      await booking.save();
      console.log('[✓] Created test booking:', booking.reservationId);
    }

    // Step 2: Generate completion token
    console.log('\n[2] Generating completion token...');
    const tokenData = {
      bookingId: booking._id.toString(),
      completedAt: Date.now(),
    };
    const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    booking.completion.tokenHash = tokenHash;
    booking.completion.tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await booking.save();
    console.log('[✓] Token generated:', token.substring(0, 50) + '...');

    // Step 3: Submit signature
    console.log('\n[3] Submitting signature...');
    const signatureData = generateTestSignature();
    console.log('[>] Posting signature to /api/booking-completion/' + token + '/signature');
    
    try {
      const response = await api.post(`/api/booking-completion/${token}/signature`, {
        signatureDataUrl: signatureData,
        agreed: true,
      });

      console.log('[✓] Signature submission successful');
      console.log('[✓] Response success:', response.data.success);
      console.log('[✓] Message:', response.data.message);

      if (response.data.booking?.completion?.signatureUrl) {
        console.log('[✓] Signature stored at:', response.data.booking.completion.signatureUrl);
      }

      if (response.data.booking?.completion?.contractPdfUrl) {
        console.log('[✓] Contract generated at:', response.data.booking.completion.contractPdfUrl);
        console.log('\n[SUCCESS] Signature workflow completed! Contract PDF has been generated.');
        console.log('[TIP] Check the PDF to verify the signature appears in the contract.');
      } else {
        console.log('[!] No contract PDF URL in response');
      }
    } catch (err) {
      console.error('[ERROR] Signature submission failed:');
      console.error('  Status:', err.response?.status);
      console.error('  Message:', err.response?.data?.message);
      console.error('  Error:', err.message);
    }

  } catch (err) {
    console.error('[ERROR]', err.message);
  }

  process.exit(0);
}

// Run test
await connectDB();
await testSignatureFlow();
