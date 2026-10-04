import mongoose from 'mongoose';
import { buildMongoUri } from './configs/db.js';
import './models/Car.js';
import Booking from './models/Booking.js';

const run = async () => {
  await mongoose.connect(buildMongoUri(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'));
  const booking = await Booking.findOne({ reservationId: 'RES-8LCFKW4N' }).populate('car');
  const plain = booking.toObject();
  console.log(JSON.stringify({
    bookingFields: {
      customerName: booking.customerName,
      customerAddress: booking.customerAddress,
      dateOfBirth: booking.dateOfBirth,
      nationality: booking.nationality,
      placeOfBirth: booking.placeOfBirth,
      driverLicenseNumber: booking.driverLicenseNumber,
      passportNumber: booking.passportNumber,
      secondDriver: booking.secondDriver,
    },
    plainFields: {
      customerName: plain.customerName,
      customerAddress: plain.customerAddress,
      dateOfBirth: plain.dateOfBirth,
      nationality: plain.nationality,
      placeOfBirth: plain.placeOfBirth,
      driverLicenseNumber: plain.driverLicenseNumber,
      passportNumber: plain.passportNumber,
      secondDriver: plain.secondDriver,
    },
    hasCar: !!plain.car,
    carRegistration: plain.car?.licensePlate || plain.car?.registrationNumber || plain.car?.plateNumber || plain.car?.plate,
  }, null, 2));
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
