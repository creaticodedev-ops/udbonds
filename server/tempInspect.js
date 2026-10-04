import 'dotenv/config';
import mongoose from "mongoose";
import User from "./models/User.js";
import Booking from "./models/Booking.js";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}
await mongoose.connect(uri, { autoIndex: false });
const owners = await User.find({ role: "owner" }).lean();
console.log("Owners:", owners.length);
for (const o of owners) {
  console.log(JSON.stringify({ id: o._id.toString(), email: o.email, status: o.accountStatus, licenseStatus: o.licenseStatus, tokenVersion: o.tokenVersion, permissions: o.permissions?.slice(0,10) }));
}
const bookingCounts = await Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
console.log("Booking status counts:", JSON.stringify(bookingCounts));
const sample = await Booking.findOne().lean();
console.log("Sample booking:", sample ? JSON.stringify({ id: sample._id.toString(), owner: sample.owner.toString(), status: sample.status, pickupDate: sample.pickupDate, returnDate: sample.returnDate, price: sample.price }) : null);
await mongoose.disconnect();
