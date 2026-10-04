import mongoose from 'mongoose';
import { buildMongoUri } from '../configs/db.js';
import ExportTemplate from '../models/ExportTemplate.js';
import { TEMPLATE_VARIABLES } from '../services/templateEngine.js';

await mongoose.connect(buildMongoUri(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'));
const template = await ExportTemplate.findOne({ owner: '6a68cd7069804c8feec7a8d9', type: 'contract', isDefault: true, isActive: true }).lean();
await mongoose.disconnect();

const body = `${template?.headerHtml || ''}\n${template?.bodyHtml || ''}\n${template?.footerHtml || ''}`;
const matches = [...body.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((m) => m[1].trim());
const unique = [...new Set(matches)];
const known = new Set(TEMPLATE_VARIABLES.map((v) => v.key));
const missing = unique.filter((key) => !known.has(key));
console.log(JSON.stringify({ placeholders: unique, missing }, null, 2));
