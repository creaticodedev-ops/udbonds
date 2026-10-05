const env = import.meta.env

/**
 * Public company details. Leave a value empty until it is confirmed —
 * empty fields are simply not rendered (nothing is invented).
 */
export const SITE = {
  name: 'U.D.Bonds',
  url: env.VITE_SITE_URL || '',
  contact: {
    email: env.VITE_CONTACT_EMAIL || '',
    phone: env.VITE_CONTACT_PHONE || '',
    whatsapp: env.VITE_CONTACT_WHATSAPP || '',
    address: env.VITE_COMPANY_ADDRESS || '',
  },
}

/** Landing page sections reachable from the navbar (order = display order). */
export const NAV_ITEMS = [
  { id: 'top', key: 'home' },
  { id: 'about', key: 'about' },
  { id: 'markets', key: 'markets' },
  { id: 'capital', key: 'investment' },
  { id: 'offers', key: 'offers' },
  { id: 'insights', key: 'insights' },
]

/** Where "Commencer" leads until registration exists. */
export const START_TARGET = 'offers'

export const contactHref = (subject = '') => {
  const { email } = SITE.contact
  if (!email) return '#contact'
  return subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`
}
