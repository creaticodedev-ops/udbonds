/** Tenant branding must come from `agency` — never platform HDN/Safi defaults. */
import { logoToDataUri } from '../utils/uploadPaths.js';
import { appendSignedQuery } from '../middleware/uploadAccess.js';
import { isSyntheticWalkInEmail } from '../utils/applyCompletionDetails.js';

export const TEMPLATE_VARIABLES = [
  { key: 'contract_number', label: 'Contract Number', group: 'contract' },
  { key: 'reservation_id', label: 'Reservation ID', group: 'booking' },
  { key: 'customer_name', label: 'Customer Name', group: 'customer' },
  { key: 'customer_email', label: 'Customer Email', group: 'customer' },
  { key: 'customer_phone', label: 'Customer Phone', group: 'customer' },
  { key: 'customer_nationality', label: 'Customer Nationality', group: 'customer' },
  { key: 'customer_dob', label: 'Date of Birth', group: 'customer' },
  { key: 'driver_license', label: 'Driver License No.', group: 'customer' },
  { key: 'driver_license_expiry', label: 'License Expiry', group: 'customer' },
  { key: 'passport_number', label: 'Passport Number', group: 'customer' },
  { key: 'identity_document', label: 'ID / Passport Number', group: 'customer' },
  { key: 'identity_issued_on', label: 'ID Issued On', group: 'customer' },
  { key: 'driver_license_issued_on', label: 'License Issued On', group: 'customer' },
  { key: 'customer_address', label: 'Customer Address', group: 'customer' },
  { key: 'customer_birth_place', label: 'Place of Birth', group: 'customer' },
  { key: 'car_brand', label: 'Car Brand', group: 'vehicle' },
  { key: 'car_model', label: 'Car Model', group: 'vehicle' },
  { key: 'car_make', label: 'Make (Brand + Model)', group: 'vehicle' },
  { key: 'car_year', label: 'Car Year', group: 'vehicle' },
  { key: 'car_category', label: 'Car Category', group: 'vehicle' },
  { key: 'car_registration', label: 'Registration', group: 'vehicle' },
  { key: 'delivered_by', label: 'Delivered By', group: 'rental' },
  { key: 'received_by', label: 'Received By', group: 'rental' },
  { key: 'fuel_level_start', label: 'Fuel Level (Start)', group: 'rental' },
  { key: 'km_depart', label: 'Km Departure', group: 'rental' },
  { key: 'km_retour', label: 'Km Return', group: 'rental' },
  { key: 'price_per_day', label: 'Daily Rate', group: 'pricing' },
  { key: 'franchise_amount', label: 'Franchise / Deposit', group: 'pricing' },
  { key: 'pickup_date', label: 'Pickup Date & Time', group: 'rental' },
  { key: 'return_date', label: 'Return Date & Time', group: 'rental' },
  { key: 'pickup_location', label: 'Pickup Location', group: 'rental' },
  { key: 'return_location', label: 'Return Location', group: 'rental' },
  { key: 'rental_days', label: 'Rental Duration (days)', group: 'rental' },
  { key: 'rental_price', label: 'Rental Price', group: 'pricing' },
  { key: 'pickup_fee', label: 'Pickup Delivery Fee', group: 'pricing' },
  { key: 'dropoff_fee', label: 'Drop-off Delivery Fee', group: 'pricing' },
  { key: 'discount_total', label: 'Discount Total', group: 'pricing' },
  { key: 'total_price', label: 'Total Price', group: 'pricing' },
  { key: 'currency', label: 'Currency', group: 'pricing' },
  { key: 'payment_status', label: 'Payment Status', group: 'pricing' },
  { key: 'booking_status', label: 'Booking Status', group: 'booking' },
  { key: 'booking_method', label: 'Booking Method', group: 'booking' },
  { key: 'notes', label: 'Notes', group: 'booking' },
  { key: 'second_driver_section', label: 'Second Driver Block', group: 'customer' },
  { key: 'second_driver_yes_no', label: 'Second Driver (Yes/No)', group: 'customer' },
  { key: 'second_driver_name', label: 'Second Driver Name', group: 'customer' },
  { key: 'second_driver_dob', label: 'Second Driver DOB', group: 'customer' },
  { key: 'second_driver_nationality', label: 'Second Driver Nationality', group: 'customer' },
  { key: 'second_driver_license', label: 'Second Driver License', group: 'customer' },
  { key: 'second_driver_license_expiry', label: 'Second Driver License Expiry', group: 'customer' },
  { key: 'second_driver_passport', label: 'Second Driver Passport', group: 'customer' },
  { key: 'second_driver_phone', label: 'Second Driver Phone', group: 'customer' },
  { key: 'agency_name', label: 'Agency Name', group: 'agency' },
  { key: 'agency_phone', label: 'Agency Phone', group: 'agency' },
  { key: 'agency_email', label: 'Agency Email', group: 'agency' },
  { key: 'agency_address', label: 'Agency Address', group: 'agency' },
  { key: 'agency_tax_id', label: 'Agency Tax ID', group: 'agency' },
  { key: 'company_signature_html', label: 'Company Signature / Stamp', group: 'agency' },
  { key: 'customer_signature_html', label: 'Customer Signature', group: 'customer' },
  { key: 'second_driver_signature_html', label: 'Second Driver Signature Image', group: 'customer' },
  { key: 'second_driver_signature_section', label: 'Second Driver Signature Box (empty if none)', group: 'customer' },
  { key: 'signatures_row_html', label: 'Agency + Customer + 2nd Driver Signatures Row', group: 'customer' },
  { key: 'generated_date', label: 'Generated Date', group: 'meta' },
  { key: 'generated_datetime', label: 'Generated Date & Time', group: 'meta' },
];

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-GB', { hour12: false });
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB');
};

const money = (amount, currency = 'MAD') => {
  const n = Number(amount) || 0;
  return `${currency} ${n.toFixed(2)}`;
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const val = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return '—';
  return escapeHtml(String(v));
};

/** Template keys that intentionally contain trusted server-built HTML. */
const RAW_HTML_VARIABLE_KEYS = new Set([
  'company_signature_html',
  'customer_signature_html',
  'second_driver_signature_html',
  'second_driver_signature_section',
  'second_driver_section',
  'signatures_row_html',
  'companySignatureHtml',
  'customerSignatureHtml',
  'secondDriverSignatureHtml',
  'secondDriverSignatureSection',
  'secondDriverSection',
  'signaturesRowHtml',
]);

const firstNonEmpty = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return undefined;
};

/**
 * Resolve image src for HTML/PDF.
 * Prefer local data-URI embeds (Puppeteer-safe). For protected /uploads/documents
 * URLs that are not local, use appendSignedQuery (never double-prefix the host).
 */
export const buildImageHtml = (imageUrl, alt, style = 'max-height:48px;max-width:140px;margin-top:6px;') => {
  if (!imageUrl) {
    return '';
  }
  try {
    const dataUri = logoToDataUri(imageUrl);
    if (dataUri) {
      return `<img src="${dataUri}" alt="${alt}" style="${style}" />`;
    }

    let src = String(imageUrl);
    // data: already handled above; remote CDN (ImageKit) left as https for PDF embedder
    if (src.includes('/uploads/documents') || src.includes('/uploads/templates')) {
      src = appendSignedQuery(src);
    }
    return `<img src="${src}" alt="${alt}" style="${style}" />`;
  } catch (error) {
    console.error('[IMAGE_HTML] Failed for', alt, error.message);
    return '';
  }
};

/** Full signature row for PDF: agency + renter (+ 2nd driver when enabled). */
export const buildSignaturesRowHtml = (booking, { template, includeCompanyStamp = true, agency = {} } = {}) => {
  const agencyName =
    template?.agencyName ||
    agency?.contractBranding?.companyName ||
    agency?.legalName ||
    agency?.name ||
    '—';
  const customerName = val(firstNonEmpty(booking, ['customerName']) || '—');
  const sd = booking?.secondDriver;
  const secondEnabled = Boolean(sd?.enabled);
  const cols = secondEnabled ? 3 : 2;
  const companySig = includeCompanyStamp
    ? buildImageHtml(template?.companySignatureUrl || template?.signatureUrl || '', 'Agency signature', 'max-height:80px;max-width:220px;margin-top:6px;')
    : '';
  const customerSig = buildImageHtml(
    booking?.completion?.signatureUrl || '',
    'Customer signature',
    'max-height:80px;max-width:220px;margin-top:6px;',
  );
  const secondSig = secondEnabled
    ? buildImageHtml(
        booking?.completion?.secondDriverSignatureUrl || '',
        'Second driver signature',
        'max-height:80px;max-width:220px;margin-top:6px;',
      )
    : '';
  const secondBox = secondEnabled
    ? `<div class="sign-box"><strong>Second Driver Signature</strong><br/><span class="muted">${val(sd.fullName)}</span><br/>${secondSig}</div>`
    : '';

  return `<div class="sign-row" style="grid-template-columns: repeat(${cols}, 1fr);">
  <div class="sign-box"><strong>Agency Signature</strong><br/><span class="muted">${agencyName}</span><br/>${companySig}</div>
  <div class="sign-box"><strong>Customer Signature</strong><br/><span class="muted">${customerName}</span><br/>${customerSig}</div>
  ${secondBox}
</div>`;
};

export const buildSecondDriverSignatureSection = (booking) => {
  const sd = booking?.secondDriver;
  if (!sd?.enabled) return '';
  const img = buildImageHtml(
    booking?.completion?.secondDriverSignatureUrl || '',
    'Second driver signature',
    'max-height:80px;max-width:220px;margin-top:6px;',
  );
  return `<div class="sign-box"><strong>Second Driver Signature</strong><br/><span class="muted">${val(sd.fullName)}</span><br/>${img}</div>`;
};

export const buildSecondDriverSection = (booking) => {
  const sd = booking?.secondDriver;
  if (!sd?.enabled) {
    return '<p class="muted"><strong>Deuxième conducteur:</strong> Non</p>';
  }
  return `
<h2>Deuxième conducteur</h2>
<table>
  <tr><td>Nom / Prénom</td><td>${val(sd.fullName)}</td></tr>
  <tr><td>Date de naissance</td><td>${val(sd.dateOfBirth)}</td></tr>
  <tr><td>Nationalité</td><td>${val(sd.nationality)}</td></tr>
  <tr><td>Pièce d'identité</td><td>${val(sd.passportNumber)}</td></tr>
  <tr><td>Permis de conduire</td><td>${val(sd.driverLicenseNumber)}</td></tr>
  <tr><td>Permis expire le</td><td>${val(sd.driverLicenseExpiry)}</td></tr>
  <tr><td>Tél.</td><td>${val(sd.phone)}</td></tr>
</table>`;
};

/**
 * Build variable map from booking (+ car, owner, contract) for template substitution.
 */
export const buildTemplateVariables = (booking, { contractNumber, owner, agency = {}, template = {}, includeCompanyStamp = true } = {}) => {
  // Customer/rental fields live on the booking root; completion holds workflow URLs only.
  const mergedBooking = { ...(booking || {}) };
  const car = mergedBooking?.car || {};
  const b = mergedBooking?.priceBreakdown || {};
  const currency = agency.currency || process.env.CURRENCY || 'MAD';
  const sd = mergedBooking?.secondDriver || {};
  // Keep ID and passport distinct — do not copy passport into identity_document
  // (that caused walk-in CIN/passport swaps when only passport was collected).
  const identityDoc =
    firstNonEmpty(mergedBooking, ['identityDocumentNumber', 'identity_document']) ||
    '—';
  const franchiseRaw = mergedBooking?.franchiseAmount;
  const franchise =
    franchiseRaw !== undefined && franchiseRaw !== null && franchiseRaw !== ''
      ? Number(franchiseRaw)
      : (car.securityDeposit ?? 0);
  const rawEmail = firstNonEmpty(mergedBooking, ['customerEmail', 'customer_email']);
  const customerEmail = rawEmail && !isSyntheticWalkInEmail(rawEmail) ? rawEmail : '—';
  console.log('[TEMPLATE_VARS] Building for booking:', booking?.reservationId, 'signature:', booking?.completion?.signatureUrl);

  const values = {
    contract_number: contractNumber || '—',
    reservation_id: firstNonEmpty(mergedBooking, ['reservationId', 'reservation_id']) || '—',
    customer_name: firstNonEmpty(mergedBooking, ['customerName', 'customer_name']) || '—',
    customer_email: customerEmail,
    customer_phone: firstNonEmpty(mergedBooking, ['customerPhone', 'customer_phone']) || '—',
    customer_nationality: firstNonEmpty(mergedBooking, ['nationality', 'customerNationality']) || '—',
    customer_dob: firstNonEmpty(mergedBooking, ['dateOfBirth', 'customerDob']) || '—',
    customer_birth_place: firstNonEmpty(mergedBooking, ['placeOfBirth', 'customerBirthPlace']) || '—',
    customer_address: firstNonEmpty(mergedBooking, ['customerAddress', 'customer_address']) || '—',
    driver_license: firstNonEmpty(mergedBooking, ['driverLicenseNumber', 'driverLicense']) || '—',
    driver_license_expiry: firstNonEmpty(mergedBooking, ['driverLicenseExpiry', 'driverLicenseExpiryDate']) || '—',
    driver_license_issued_on: firstNonEmpty(mergedBooking, ['driverLicenseIssuedOn', 'driverLicenseIssueDate']) || '—',
    passport_number: firstNonEmpty(mergedBooking, ['passportNumber', 'passport']) || '—',
    identity_document: identityDoc,
    identity_issued_on: firstNonEmpty(mergedBooking, ['identityIssuedOn', 'identityIssueDate']) || '—',
    car_brand: firstNonEmpty(car, ['brand', 'carBrand']) || '—',
    car_model: firstNonEmpty(car, ['model', 'carModel']) || '—',
    car_make: `${firstNonEmpty(car, ['brand', 'carBrand']) || ''} ${firstNonEmpty(car, ['model', 'carModel']) || ''}`.trim() || '—',
    car_year: firstNonEmpty(car, ['year', 'carYear']) ? String(firstNonEmpty(car, ['year', 'carYear'])) : '—',
    car_category: firstNonEmpty(car, ['category', 'carCategory']) || '—',
    car_registration: [
      car.licensePlate,
      car.registrationNumber,
      car.plateNumber,
      car.plate,
      car.fleetId,
      car.vin,
      mergedBooking?.registrationNumber,
      mergedBooking?.licensePlate,
      mergedBooking?.plateNumber,
      mergedBooking?.plate,
      mergedBooking?.fleetId,
      mergedBooking?.vin,
    ].find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '—',
    delivered_by: firstNonEmpty(mergedBooking, ['deliveredBy']) || agency?.contractBranding?.companyName || agency?.name || owner?.agencyName || '—',
    received_by: firstNonEmpty(mergedBooking, ['receivedBy']) || agency?.contractBranding?.companyName || agency?.name || owner?.agencyName || '—',
    fuel_level_start: firstNonEmpty(mergedBooking, ['fuelLevelStart']) || '—',
    km_depart: mergedBooking?.kmDepart != null && mergedBooking?.kmDepart !== '' ? String(mergedBooking.kmDepart) : (car.mileage != null ? String(car.mileage) : '—'),
    km_retour: mergedBooking?.kmRetour != null && mergedBooking?.kmRetour !== '' ? String(mergedBooking.kmRetour) : '—',
    pickup_date: formatDateTime(firstNonEmpty(mergedBooking, ['pickupDate', 'pickup_date'])),
    return_date: formatDateTime(firstNonEmpty(mergedBooking, ['returnDate', 'return_date'])),
    pickup_location: firstNonEmpty(mergedBooking, ['pickupLocation', 'pickup_location']) || '—',
    return_location: firstNonEmpty(mergedBooking, ['returnLocation', 'return_location']) || '—',
    rental_days: String(b.days || mergedBooking?.priceBreakdown?.days || 0),
    price_per_day: money(b.pricePerDay ?? car.pricePerDay ?? mergedBooking?.priceBreakdown?.pricePerDay, currency),
    rental_price: money(b.rentalPrice ?? mergedBooking?.price, currency),
    pickup_fee: money(b.pickupDeliveryFee, currency),
    dropoff_fee: money(b.dropoffDeliveryFee, currency),
    discount_total: money(b.discountTotal, currency),
    total_price: money(mergedBooking?.price ?? b.total ?? b.rentalPrice, currency),
    franchise_amount: money(franchise, currency),
    currency,
    payment_status: firstNonEmpty(mergedBooking, ['paymentStatus']) || '—',
    booking_status: firstNonEmpty(mergedBooking, ['status']) || '—',
    booking_method:
      booking?.channel === 'walk_in'
        ? 'Walk-in'
        : 'Online',
    notes: firstNonEmpty(mergedBooking, ['notes'])?.trim() || '—',
    second_driver_section: buildSecondDriverSection(booking),
    second_driver_yes_no: sd.enabled ? 'Oui' : 'Non',
    second_driver_name: sd.enabled ? val(sd.fullName) : '—',
    second_driver_dob: sd.enabled ? val(sd.dateOfBirth) : '—',
    second_driver_nationality: sd.enabled ? val(sd.nationality) : '—',
    second_driver_license: sd.enabled ? val(sd.driverLicenseNumber) : '—',
    second_driver_license_expiry: sd.enabled ? val(sd.driverLicenseExpiry) : '—',
    second_driver_passport: sd.enabled ? val(sd.passportNumber) : '—',
    second_driver_phone: sd.enabled ? val(sd.phone) : '—',
    agency_name: agency.contractBranding?.companyName || agency.name || agency.legalName || owner?.agencyName || '—',
    agency_phone: agency.phone || '—',
    agency_email: agency.email || '—',
    agency_address: agency.address || '—',
    agency_tax_id: agency.taxId || '—',
    agency_brand_color: agency.primaryBrandColor || '',
    company_signature_html: includeCompanyStamp ? buildImageHtml(template?.companySignatureUrl || template?.signatureUrl || '', 'Company signature') : '',
    customer_signature_html: buildImageHtml(booking?.completion?.signatureUrl || '', 'Customer signature', 'max-height:80px;max-width:220px;margin-top:6px;'),
    second_driver_signature_html: sd.enabled
      ? buildImageHtml(booking?.completion?.secondDriverSignatureUrl || '', 'Second driver signature', 'max-height:80px;max-width:220px;margin-top:6px;')
      : '',
    second_driver_signature_section: buildSecondDriverSignatureSection(booking),
    signatures_row_html: buildSignaturesRowHtml(booking, { template, includeCompanyStamp, agency }),
    generated_date: formatDate(new Date()),
    generated_datetime: formatDateTime(new Date()),
  };

  return {
    ...values,
    contractNumber: values.contract_number,
    reservationId: values.reservation_id,
    customerName: values.customer_name,
    customerEmail: values.customer_email,
    customerPhone: values.customer_phone,
    customerNationality: values.customer_nationality,
    dateOfBirth: values.customer_dob,
    placeOfBirth: values.customer_birth_place,
    customerAddress: values.customer_address,
    driverLicenseNumber: values.driver_license,
    driverLicenseExpiry: values.driver_license_expiry,
    driverLicenseIssuedOn: values.driver_license_issued_on,
    passportNumber: values.passport_number,
    identityDocumentNumber: values.identity_document,
    identityIssuedOn: values.identity_issued_on,
    carBrand: values.car_brand,
    carModel: values.car_model,
    carMake: values.car_make,
    carYear: values.car_year,
    carCategory: values.car_category,
    carRegistration: values.car_registration,
    pickupDate: values.pickup_date,
    returnDate: values.return_date,
    pickupLocation: values.pickup_location,
    returnLocation: values.return_location,
    rentalDays: values.rental_days,
    pricePerDay: values.price_per_day,
    rentalPrice: values.rental_price,
    pickupFee: values.pickup_fee,
    dropoffFee: values.dropoff_fee,
    discountTotal: values.discount_total,
    totalPrice: values.total_price,
    franchiseAmount: values.franchise_amount,
    paymentStatus: values.payment_status,
    bookingStatus: values.booking_status,
    bookingMethod: values.booking_method,
    secondDriverSection: values.second_driver_section,
    secondDriverName: values.second_driver_name,
    secondDriverDob: values.second_driver_dob,
    secondDriverNationality: values.second_driver_nationality,
    secondDriverLicense: values.second_driver_license,
    secondDriverLicenseExpiry: values.second_driver_license_expiry,
    secondDriverPassport: values.second_driver_passport,
    secondDriverPhone: values.second_driver_phone,
    _meta: {
      agencyLogoUrl:
        agency.contractBranding?.showLogoOnPdf === false
          ? ''
          : String(agency.logoUrl || agency.contractBranding?.logoUrl || '').trim(),
      logoUrl:
        agency.contractBranding?.showLogoOnPdf === false
          ? ''
          : String(agency.logoUrl || agency.contractBranding?.logoUrl || '').trim(),
    },
  };
};

const normalizeTemplateKey = (key) => String(key)
  .trim()
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/[^a-zA-Z0-9]+/g, '_')
  .toLowerCase();

/**
 * Replace {{variable}} placeholders in template HTML.
 * Guest-controlled values are HTML-escaped; only allowlisted *_html / *_section keys stay raw.
 */
export const renderTemplate = (html, variables) => {
  if (!html) return '';
  return String(html).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, key) => {
    const rawKey = String(key).trim();
    const candidates = [
      rawKey,
      rawKey.toLowerCase(),
      normalizeTemplateKey(rawKey),
      rawKey.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(),
    ];
    const matchedKey = candidates.find((candidate) => variables?.[candidate] !== undefined);
    const value = matchedKey !== undefined ? variables[matchedKey] : undefined;
    if (value === undefined || value === null) return '—';
    const asString = String(value);
    const allowRaw = candidates.some((candidate) => RAW_HTML_VARIABLE_KEYS.has(candidate));
    return allowRaw ? asString : escapeHtml(asString);
  });
};

/**
 * Wrap rendered sections into a full printable HTML document.
 */
export const buildDocumentHtml = (template, variables) => {
  const safeTemplate = template || {};
  const header = renderTemplate(safeTemplate.headerHtml || '', variables);
  const body = renderTemplate(safeTemplate.bodyHtml || '', variables);
  const footer = renderTemplate(safeTemplate.footerHtml || '', variables);
  const css = safeTemplate.customCss || '';
  // Use only Admin-stored termsHtml — no hardcoded duplicate fallback at render time.
  const termsBody = safeTemplate.termsHtml
    ? renderTemplate(safeTemplate.termsHtml, variables)
    : '';
  const twoPages = Boolean(termsBody);
  const footerPage1 = twoPages
    ? `${footer}<p class="page-indicator muted">Page 1 / 2</p>`
    : footer;
  const footerPage2 = twoPages
    ? `${footer}<p class="page-indicator muted">Page 2 / 2</p>`
    : '';
  const brandColor =
    String(variables?.agency_brand_color || '').trim() ||
    '#333333';
  const resolvedLogoUrl = String(
    safeTemplate.logoUrl ||
      variables?._meta?.logoUrl ||
      variables?._meta?.agencyLogoUrl ||
      '',
  ).trim();
  const logoDataUri = logoToDataUri(resolvedLogoUrl);
  const logoSrc = logoDataUri
    || (resolvedLogoUrl
      ? (String(resolvedLogoUrl).includes('/uploads/')
        ? appendSignedQuery(resolvedLogoUrl)
        : resolvedLogoUrl)
      : '');
  const logo = logoSrc
    ? `<img src="${logoSrc}" alt="Logo" style="max-height:48px;margin-bottom:8px;" />`
    : '';
  const docTitle = escapeHtml(
    String(safeTemplate.name || variables?.agency_name || 'Document'),
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #161210;
      margin: 0;
      padding: 0;
    }
    .doc-page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 16mm 14mm;
    }
    .doc-header { border-bottom: 2px solid ${brandColor}; padding-bottom: 12px; margin-bottom: 20px; }
    .doc-footer {
      border-top: 1px solid #ccc;
      margin-top: 32px;
      padding-top: 12px;
      font-size: 9pt;
      color: #666;
    }
    h1 { font-size: 18pt; color: ${brandColor}; margin: 0 0 8px; }
    h2 { font-size: 13pt; margin: 16px 0 8px; color: #333; }
    h3 { font-size: 11pt; margin: 12px 0 6px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 10pt; }
    th { background: #f5f5f5; font-weight: 600; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .section { margin-bottom: 16px; }
    .muted { color: #666; font-size: 9pt; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .doc-page { padding: 10mm; }
      .no-print { display: none !important; }
    }
    ${css}
  </style>
</head>
<body>
  <div class="doc-page doc-page-1">
    <div class="doc-header">${logo}${header}</div>
    <div class="doc-body">${body}</div>
    <div class="doc-footer">${footerPage1}</div>
  </div>
  ${
    termsBody
      ? `<div class="doc-page doc-page-terms page-break-before">
    <div class="doc-body">${termsBody}</div>
    <div class="doc-footer">${footerPage2}</div>
  </div>`
      : ''
  }
</body>
</html>`;
};

export default {
  TEMPLATE_VARIABLES,
  buildTemplateVariables,
  buildImageHtml,
  buildSecondDriverSection,
  buildSignaturesRowHtml,
  buildSecondDriverSignatureSection,
  renderTemplate,
  buildDocumentHtml,
};
