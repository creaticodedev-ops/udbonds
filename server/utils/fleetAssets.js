/** Canonical rental categories — public browse order */
export const VEHICLE_CATEGORIES = [
  'Economy',
  'Compact',
  'Sedan',
  'SUV',
  'Luxury',
  'Van',
  'Pickup',
  'Sports',
  'Electric',
  'Other',
];

export const normalizeCategory = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Other';
  const found = VEHICLE_CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  return found || raw;
};

/** Generate a human fleet asset ID, e.g. FLT-A3K9M2 */
export const generateFleetId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `FLT-${code}`;
};

export const normalizePlate = (plate) =>
  String(plate || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

export const normalizeVin = (vin) =>
  String(vin || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
