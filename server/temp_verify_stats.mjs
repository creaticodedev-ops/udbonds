import 'dotenv/config';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from './models/User.js';
import Car from './models/Car.js';
import { buildMongoUri } from './configs/db.js';

const run = async () => {
  await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
  const user = await User.findOne({ email: 'owner-test@example.com' }).lean();
  console.log('ownerFound', !!user);
  if (!user) process.exit(1);

  const loginRes = await axios.post('http://localhost:3000/api/user/login', {
    email: 'owner-test@example.com',
    password: 'Password123!',
  });
  console.log('loginStatus', loginRes.status);
  console.log('loginBody', loginRes.data);

  const token = jwt.sign({ _id: user._id.toString(), tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: '7d' });
  const headers = { Authorization: 'Bearer ' + token };
  const car = await Car.findOne({ owner: user._id }).lean();
  const carId = car?._id?.toString();

  if (!carId) {
    throw new Error('No car found for owner');
  }

  const vehicleRes = await axios.get(`http://localhost:3000/api/owner/vehicles/${carId}`, { headers });
  const statsRes = await axios.get(`http://localhost:3000/api/owner/vehicles/${carId}/stats`, { headers });

  console.log('vehicleStatus', vehicleRes.status);
  console.log('statsStatus', statsRes.status);
  console.log('overview', statsRes.data?.stats?.overview);
  console.log('analyticsKeys', Object.keys(statsRes.data?.stats?.analytics || {}));
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err.response?.status, err.response?.data || err.message);
  process.exit(1);
});
