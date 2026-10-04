import 'dotenv/config';
import mongoose from 'mongoose';
import { buildMongoUri } from './configs/db.js';
import User from './models/User.js';

const run = async () => {
  await mongoose.connect(buildMongoUri(process.env.MONGODB_URI));
  const users = await User.find({ email: { $regex: 'owner-test', $options: 'i' } }).lean();
  console.log(JSON.stringify(users, null, 2));
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
