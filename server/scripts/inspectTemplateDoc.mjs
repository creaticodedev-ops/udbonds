import mongoose from 'mongoose';
import { buildMongoUri } from '../configs/db.js';
import ExportTemplate from '../models/ExportTemplate.js';

await mongoose.connect(buildMongoUri(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'));
const template = await ExportTemplate.findOne({ type: 'contract', systemKey: 'builtin_contract' }).sort({ updatedAt: -1 }).lean();
console.log(JSON.stringify({
  id: template?._id?.toString(),
  owner: template?.owner?.toString(),
  name: template?.name,
  hasBody: Boolean(template?.bodyHtml),
  bodyPreview: template?.bodyHtml?.slice(0, 600),
  containsCustomerName: template?.bodyHtml?.includes('{{customer_name}}'),
  containsCustomerDob: template?.bodyHtml?.includes('{{customer_dob}}'),
  containsSecondDriverSection: template?.bodyHtml?.includes('{{second_driver_section}}'),
  containsCarMake: template?.bodyHtml?.includes('{{car_make}}'),
}, null, 2));
await mongoose.disconnect();
