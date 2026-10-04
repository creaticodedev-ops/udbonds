import mongoose from 'mongoose';
import { buildMongoUri } from './configs/db.js';
import ExportTemplate from './models/ExportTemplate.js';

const run = async () => {
  await mongoose.connect(buildMongoUri(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'));
  const ownerId = '6a6bf339ab432b5c456d32db';
  const templates = await ExportTemplate.find({ owner: ownerId, type: 'contract' }).sort({ isDefault: -1, updatedAt: -1 }).lean();
  for (const t of templates) {
    const body = String(t.bodyHtml || '');
    const matches = [...body.matchAll(/\{\{\s*([a-zA-Z0-9_\.\-]+)\s*\}\}/g)].map((m) => m[1]);
    console.log(JSON.stringify({
      id: t._id.toString(),
      name: t.name,
      systemKey: t.systemKey,
      isDefault: t.isDefault,
      isActive: t.isActive,
      placeholderCount: matches.length,
      placeholders: [...new Set(matches)].slice(0, 80),
      bodyPreview: body.slice(0, 400),
    }, null, 2));
  }
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
