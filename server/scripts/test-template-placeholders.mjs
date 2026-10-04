import assert from 'node:assert/strict';
import { buildTemplateVariables, renderTemplate } from '../services/templateEngine.js';

const variables = buildTemplateVariables(
  {
    reservationId: 'RES-100',
    customerName: 'Alice Johnson',
    customerEmail: 'alice@example.com',
    customerPhone: '+212600000000',
    priceBreakdown: {
      days: 2,
      pricePerDay: 250,
      rentalPrice: 500,
      total: 500,
    },
    car: {
      brand: 'BMW',
      model: 'X5',
      year: 2024,
      category: 'SUV',
      licensePlate: 'XYZ-123',
    },
  },
  {
    contractNumber: 'CTR-42',
    owner: {},
    agency: {},
    includeCompanyStamp: false,
  }
);

const html = renderTemplate(
  'Customer={{customerName}} | CustomerSnake={{customer_name}} | Address={{customerAddress}} | Driver={{driverLicenseNumber}} | Passport={{passportNumber}} | Contract={{contractNumber}} | Total={{total_price}} | TotalCamel={{totalPrice}} | Car={{carMake}}',
  variables
);

assert.match(html, /Customer=Alice Johnson/);
assert.match(html, /CustomerSnake=Alice Johnson/);
assert.match(html, /Address=—/);
assert.match(html, /Driver=—/);
assert.match(html, /Passport=—/);
assert.match(html, /Contract=CTR-42/);
assert.match(html, /Total=MAD 500.00/);
assert.match(html, /TotalCamel=MAD 500.00/);
assert.match(html, /Car=BMW X5/);

console.log('Template placeholder regression passed');
