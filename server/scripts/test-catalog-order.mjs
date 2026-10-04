/**
 * Unit checks for catalog grouping + display-order helpers (no DB required).
 */
import assert from 'assert';
import {
  applyDisplayOrders,
  buildModelKey,
  buildOrderLookupKey,
  groupCarsForCatalog,
} from '../utils/carCatalog.js';
import { compareCarsForDisplay, groupCarsByCategory } from '../../client/src/utils/vehicleCategories.js';

const owner = 'owner-1';

const units = [
  {
    _id: 'u3',
    owner,
    brand: 'Volkswagen',
    model: 'T-Roc',
    category: 'SUV',
    pricePerDay: 450,
    createdAt: '2024-03-01T00:00:00.000Z',
  },
  {
    _id: 'u1',
    owner,
    brand: 'Hyundai',
    model: 'Tucson',
    category: 'SUV',
    pricePerDay: 500,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    _id: 'u2',
    owner,
    brand: 'Hyundai',
    model: 'Tucson',
    category: 'SUV',
    pricePerDay: 520,
    createdAt: '2024-02-01T00:00:00.000Z',
  },
  {
    _id: 'u4',
    owner,
    brand: 'Dacia',
    model: 'Duster',
    category: 'SUV',
    pricePerDay: 350,
    createdAt: '2024-04-01T00:00:00.000Z',
  },
];

const grouped = groupCarsForCatalog(units);
assert.strictEqual(grouped.length, 3, 'groups by brand+model');

const tucson = grouped.find((c) => c.brand === 'Hyundai' && c.model === 'Tucson');
assert.ok(tucson);
assert.strictEqual(tucson.unitCount, 2);
assert.strictEqual(String(tucson._id), 'u1', 'representative is oldest unit');
assert.deepStrictEqual(
  tucson.unitIds.map(String).sort(),
  ['u1', 'u2'],
  'tracks all unit ids'
);

const orderDocs = [
  {
    owner,
    category: 'SUV',
    brandKey: 'dacia',
    modelKey: 'duster',
    brand: 'Dacia',
    model: 'Duster',
    displayOrder: 0,
  },
  {
    owner,
    category: 'SUV',
    brandKey: 'hyundai',
    modelKey: 'tucson',
    brand: 'Hyundai',
    model: 'Tucson',
    displayOrder: 1,
  },
  {
    owner,
    category: 'SUV',
    brandKey: 'volkswagen',
    modelKey: 't-roc',
    brand: 'Volkswagen',
    model: 'T-Roc',
    displayOrder: 2,
  },
];

const withOrder = applyDisplayOrders(grouped, orderDocs);
const sections = groupCarsByCategory(withOrder);
assert.strictEqual(sections.length, 1);
assert.deepStrictEqual(
  sections[0].cars.map((c) => `${c.brand} ${c.model}`),
  ['Dacia Duster', 'Hyundai Tucson', 'Volkswagen T-Roc'],
  'manual order wins over price sort'
);

// Unordered models fall back to price after ordered ones
const partial = applyDisplayOrders(grouped, [orderDocs[0]]);
const partialSorted = [...partial].sort(compareCarsForDisplay);
assert.strictEqual(partialSorted[0].brand, 'Dacia');
assert.ok(
  Number(partialSorted[1].pricePerDay) <= Number(partialSorted[2].pricePerDay),
  'unordered remainder uses price'
);

assert.strictEqual(
  buildOrderLookupKey(owner, 'suv', 'Hyundai', 'Tucson'),
  buildOrderLookupKey(owner, 'SUV', 'hyundai', 'tucson')
);
assert.ok(buildModelKey(units[0]).includes('volkswagen|t-roc'));

console.log('test-catalog-order: all assertions passed');
