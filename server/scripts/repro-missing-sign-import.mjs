/**
 * Confirms the former signUploadAccess crash path is fixed.
 */
import { buildTemplateVariables } from '../services/templateEngine.js';

process.env.API_PUBLIC_URL = 'https://other-host.example.com';

const booking = {
  reservationId: 'RES-X',
  customerName: 'A',
  completion: {
    signatureUrl: 'https://other-host.example.com/uploads/documents/files/missing.png',
  },
  car: {},
};

const v = buildTemplateVariables(booking, {
  contractNumber: 'C1',
  owner: { _id: 'o1' },
  template: {},
});

if (!v.customer_signature_html?.includes('<img')) {
  console.error('FAIL: expected signature img html');
  process.exit(1);
}
if (v.customer_signature_html.includes('https://other-host.example.comhttps://')) {
  console.error('FAIL: doubled host in signature src');
  process.exit(1);
}

console.log('PASS: protected signature URL no longer crashes template build');
