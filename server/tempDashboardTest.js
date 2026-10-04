import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from './models/User.js';
import Car from './models/Car.js';
import Booking from './models/Booking.js';
import { buildMongoUri } from './configs/db.js';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Missing MONGODB_URI');
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(buildMongoUri(uri), { autoIndex: false });
  const email = 'owner-test@example.com';
  let owner = await User.findOne({ email });
  if (!owner) {
    const hashed = await bcrypt.hash('Password123!', 10);
    owner = await User.create({
      name: 'Owner Test',
      email,
      password: hashed,
      role: 'owner',
      accountStatus: 'active',
      licenseStatus: 'active',
      licensedAt: new Date(),
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      permissions: [],
    });
    console.log('Created owner', owner._id.toString());
  } else {
    console.log('Found owner', owner._id.toString());
  }

  const car = await Car.create({
    owner: owner._id,
    brand: 'TestBrand',
    model: 'Model X',
    year: 2024,
    category: 'SUV',
    seating_capacity: 5,
    fuel_type: 'Petrol',
    transmission: 'Automatic',
    pricePerDay: 100,
    securityDeposit: 200,
    location: 'Test City',
    locations: ['Test City'],
    description: 'Test car',
    features: ['Air Conditioning'],
    isAvaliable: true,
  });
  console.log('Created car', car._id.toString());

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const tenDays = new Date(today);
  tenDays.setDate(tenDays.getDate() + 10);

  const bookingsData = [
    {
      car: car._id,
      owner: owner._id,
      pickupDate: today,
      returnDate: nextWeek,
      status: 'confirmed',
      price: 500,
      customerName: 'Confirmed Guest',
      customerEmail: 'confirmed@example.com',
      channel: 'online',
    },
    {
      car: car._id,
      owner: owner._id,
      pickupDate: tomorrow,
      returnDate: tenDays,
      status: 'active',
      price: 700,
      customerName: 'Active Guest',
      customerEmail: 'active@example.com',
      channel: 'online',
    },
    {
      car: car._id,
      owner: owner._id,
      pickupDate: tenDays,
      returnDate: new Date(tenDays.getTime() + 3 * 24 * 60 * 60 * 1000),
      status: 'pending',
      price: 300,
      customerName: 'Pending Guest',
      customerEmail: 'pending@example.com',
      channel: 'online',
    },
  ];

  for (const data of bookingsData) {
    const existing = await Booking.findOne({ owner: owner._id, customerEmail: data.customerEmail, status: data.status });
    if (!existing) {
      const booking = await Booking.create({
        ...data,
        reservationId: `TEST-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      });
      console.log('Created booking', booking._id.toString(), data.status);
    }
  }

  const bookings = await Booking.find({ owner: owner._id });
  console.log('Bookings total', bookings.length);
  console.log(bookings.map((b) => ({ status: b.status, pickupDate: b.pickupDate, returnDate: b.returnDate, price: b.price })));

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});