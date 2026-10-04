/**
 * RSZ CAR marketing site copy & commercial presentation.
 *
 * Pricing / limits below mirror `server/services/planCatalog.js` public plans
 * (basic, pro, enterprise). Display names are marketing labels only —
 * do not change application billing logic from this file.
 *
 * Edit prices here when the commercial offering changes.
 */
export const BRAND = 'RSZ CAR'

export const SEO = {
  title: 'RSZ CAR — Car Rental Management Software',
  description:
    'RSZ CAR helps car rental companies manage reservations, fleet, customers, contracts, invoices and daily operations from one workspace.',
}

export const CONTACT_EMAIL = String(import.meta.env.VITE_PLATFORM_SUPPORT_EMAIL || '').trim()
export const CONTACT_WHATSAPP = String(import.meta.env.VITE_PLATFORM_SUPPORT_WHATSAPP || '').replace(/\D/g, '')

/** Sales WhatsApp for marketing demo requests (digits only). */
export const DEMO_WHATSAPP = '212778616837'

export const DEMO_WHATSAPP_MESSAGE =
  'Bonjour, je souhaite découvrir RSZ CAR et demander une démonstration de la plateforme.'

export const demoWhatsAppHref = (message = DEMO_WHATSAPP_MESSAGE) => {
  const phone = DEMO_WHATSAPP
  const text = encodeURIComponent(String(message || DEMO_WHATSAPP_MESSAGE))
  return `https://wa.me/${phone}?text=${text}`
}

export const TRIAL_DAYS = 7

/** Agencies operating on RSZ CAR — presented only as clients, never as the product. */
export const CLIENTS = [
  { name: 'HDN Car', note: 'Rental agency' },
  { name: 'Americonfort', note: 'Rental agency' },
]

export const PLANS = [
  {
    id: 'starter',
    productCode: 'basic',
    name: 'Starter',
    audience: 'For small rental businesses starting to centralize their operations.',
    price: '299',
    currency: 'MAD',
    interval: 'month',
    cta: 'Start Free Trial',
    intent: 'trial',
    features: [
      'Up to 15 vehicles',
      '2 staff seats',
      'Reservations and walk-in bookings',
      'Customer records',
      'Digital contracts (PDF)',
      'WhatsApp operational settings',
      'Agency subdomain storefront',
    ],
  },
  {
    id: 'professional',
    productCode: 'pro',
    name: 'Professional',
    audience: 'For growing rental companies that need more automation and operational control.',
    price: '599',
    currency: 'MAD',
    interval: 'month',
    popular: true,
    cta: 'Start Free Trial',
    intent: 'trial',
    features: [
      'Up to 50 vehicles',
      '5 staff seats',
      'Everything in Starter',
      'Analytics dashboards',
      'Custom domain',
      'Promotions',
      'Priority support',
    ],
  },
  {
    id: 'business',
    productCode: 'enterprise',
    name: 'Business',
    audience: 'For established rental companies requiring advanced operational and financial capabilities.',
    price: 'Custom',
    currency: '',
    interval: '',
    cta: 'Book a Demo',
    intent: 'demo',
    features: [
      'Custom vehicle and staff limits',
      'Everything in Professional',
      'API access',
      'Priority support',
      'Tailored commercial terms',
    ],
  },
]
