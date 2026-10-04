import React, { useMemo } from 'react'
import { inputClass, labelClass, textareaClass } from './DocumentEditPanel'

/** Mirrors server TEMPLATE_VARIABLES — fallback if /variables API unavailable */
export const DOCUMENT_FIELD_CATALOG = [
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
  { key: 'second_driver_signature_section', label: 'Second Driver Signature Box', group: 'customer' },
  { key: 'signatures_row_html', label: 'Signatures Row', group: 'customer' },
  { key: 'generated_date', label: 'Generated Date', group: 'meta' },
  { key: 'generated_datetime', label: 'Generated Date & Time', group: 'meta' },
]

/** Keep camelCase aliases in sync when snake_case template keys are edited */
export const FIELD_ALIASES = {
  contract_number: 'contractNumber',
  reservation_id: 'reservationId',
  customer_name: 'customerName',
  customer_email: 'customerEmail',
  customer_phone: 'customerPhone',
  customer_nationality: 'customerNationality',
  customer_dob: 'dateOfBirth',
  customer_birth_place: 'placeOfBirth',
  customer_address: 'customerAddress',
  driver_license: 'driverLicenseNumber',
  driver_license_expiry: 'driverLicenseExpiry',
  driver_license_issued_on: 'driverLicenseIssuedOn',
  passport_number: 'passportNumber',
  identity_document: 'identityDocumentNumber',
  identity_issued_on: 'identityIssuedOn',
  car_brand: 'carBrand',
  car_model: 'carModel',
  car_make: 'carMake',
  car_year: 'carYear',
  car_category: 'carCategory',
  car_registration: 'carRegistration',
  pickup_date: 'pickupDate',
  return_date: 'returnDate',
  pickup_location: 'pickupLocation',
  return_location: 'returnLocation',
  rental_days: 'rentalDays',
  price_per_day: 'pricePerDay',
  rental_price: 'rentalPrice',
  pickup_fee: 'pickupFee',
  dropoff_fee: 'dropoffFee',
  discount_total: 'discountTotal',
  total_price: 'totalPrice',
  franchise_amount: 'franchiseAmount',
  payment_status: 'paymentStatus',
  booking_status: 'bookingStatus',
  booking_method: 'bookingMethod',
  second_driver_section: 'secondDriverSection',
  second_driver_name: 'secondDriverName',
  second_driver_dob: 'secondDriverDob',
  second_driver_nationality: 'secondDriverNationality',
  second_driver_license: 'secondDriverLicense',
  second_driver_license_expiry: 'secondDriverLicenseExpiry',
  second_driver_passport: 'secondDriverPassport',
  second_driver_phone: 'secondDriverPhone',
}

const SKIP_KEYS = new Set(['_meta', 'invoice'])
const ALIAS_VALUES = new Set(Object.values(FIELD_ALIASES))

const isHtmlField = (key) => /(_html|_section)$/.test(key)
const isLongField = (key) => isHtmlField(key) || key === 'notes' || key === 'customer_address' || key === 'agency_address'

export const displayFieldValue = (value) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** Signature/HTML assets — never invent empty strings that wipe persisted values on save */
const PROTECTED_EDIT_KEYS = new Set([
  'company_signature_html',
  'customer_signature_html',
  'second_driver_signature_html',
  'second_driver_signature_section',
  'signatures_row_html',
])

/**
 * Ensure every catalog key is present (prefilled from sourceData) so the form
 * shows the full document surface, not only keys that happen to exist.
 */
export const normalizeSourceDataForEdit = (sourceData = {}, catalog = DOCUMENT_FIELD_CATALOG) => {
  const next = { ...(sourceData || {}) }
  for (const { key } of catalog) {
    if (next[key] === undefined || next[key] === null) {
      const alias = FIELD_ALIASES[key]
      if (alias && next[alias] !== undefined && next[alias] !== null) {
        next[key] = next[alias]
      } else if (PROTECTED_EDIT_KEYS.has(key)) {
        // Leave absent so PATCH merge keeps existing rendered HTML assets
        continue
      } else {
        next[key] = ''
      }
    }
  }
  return next
}

export const setSourceField = (sourceData, key, rawValue) => {
  let value = rawValue
  if (typeof rawValue === 'string' && rawValue.trim().startsWith('{') && rawValue.trim().endsWith('}')) {
    try {
      value = JSON.parse(rawValue)
    } catch {
      value = rawValue
    }
  }
  const next = { ...(sourceData || {}), [key]: value }
  if (FIELD_ALIASES[key]) {
    next[FIELD_ALIASES[key]] = value
  }
  return next
}

const groupTitle = (group, t) => {
  const key = `admin.documents.group.${group}`
  const translated = t?.(key)
  if (translated && translated !== key) return translated
  return group.charAt(0).toUpperCase() + group.slice(1)
}

/**
 * Editable form for every document template variable, prefilled from sourceData.
 */
const DocumentSourceFields = ({
  sourceData = {},
  setSourceData,
  catalog = DOCUMENT_FIELD_CATALOG,
  t,
  title,
  excludeKeys = [],
}) => {
  const exclude = useMemo(() => new Set(excludeKeys), [excludeKeys])

  const fields = useMemo(() => {
    const byKey = new Map()
    for (const item of catalog) {
      if (!exclude.has(item.key)) byKey.set(item.key, item)
    }
    // Include any extra scalar keys present on the document that aren't aliases
    for (const [key, value] of Object.entries(sourceData || {})) {
      if (SKIP_KEYS.has(key) || ALIAS_VALUES.has(key) || exclude.has(key) || byKey.has(key)) continue
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) continue
      byKey.set(key, {
        key,
        label: key.replace(/_/g, ' '),
        group: 'other',
      })
    }
    return Array.from(byKey.values())
  }, [catalog, sourceData, exclude])

  const grouped = useMemo(() => {
    const groups = {}
    for (const field of fields) {
      const g = field.group || 'other'
      if (!groups[g]) groups[g] = []
      groups[g].push(field)
    }
    return groups
  }, [fields])

  const groupOrder = ['contract', 'booking', 'customer', 'vehicle', 'rental', 'pricing', 'agency', 'meta', 'other']

  return (
    <div className="space-y-6">
      {title && <p className="text-sm font-medium text-gray-700">{title}</p>}
      {groupOrder.filter((g) => grouped[g]?.length).map((group) => (
        <div key={group} className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-borderColor pb-1">
            {groupTitle(group, t)}
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            {grouped[group].map(({ key, label }) => {
              const html = isLongField(key)
              const value = displayFieldValue(sourceData?.[key])
              return (
                <div key={key} className={`space-y-1 ${html ? 'md:col-span-2' : ''}`}>
                  <label className={labelClass} htmlFor={`doc-field-${key}`}>{label}</label>
                  {html ? (
                    <textarea
                      id={`doc-field-${key}`}
                      className={textareaClass}
                      value={value}
                      onChange={(e) => setSourceData((s) => setSourceField(s, key, e.target.value))}
                      rows={isHtmlField(key) ? 5 : 3}
                    />
                  ) : (
                    <input
                      id={`doc-field-${key}`}
                      className={inputClass}
                      value={value}
                      onChange={(e) => setSourceData((s) => setSourceField(s, key, e.target.value))}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default DocumentSourceFields
