import 'dotenv/config';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import mongoose from 'mongoose';
import User from './models/User.js';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: 'owner-test@example.com' }).lean();
  const token = jwt.sign({ _id: user._id.toString(), tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: '7d' });
  const base = 'http://localhost:3000';
  const carId = '6a68d8af5dc5c65394d77696';
  const headers = { Authorization: 'Bearer ' + token };

  try {
    const res1 = await axios.get(`${base}/api/owner/vehicles/${carId}`, { headers });
    console.log('vehicle status', res1.status);
    console.log(JSON.stringify(res1.data));
  } catch (err) {
    console.error('vehicle error', err.response?.status, err.response?.data);
  }

  try {
    const res2 = await axios.get(`${base}/api/owner/vehicles/${carId}/stats`, { headers });
    console.log('stats status', res2.status);
    console.log(JSON.stringify(res2.data));
  } catch (err) {
    console.error('stats error', err.response?.status, err.response?.data);
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
