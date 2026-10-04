import { PLATFORM_NAME } from '../constants/brand.js'

/**
 * Platform SEO constants for Super Admin / default marketing content only.
 * Tenant storefronts must use storefrontProfile — never fall back to this NAP
 * when an agency context is active.
 */
export const SITE_ORIGIN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_ORIGIN) ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://kririder.com')

export const SITE_NAME = PLATFORM_NAME

/** @deprecated Platform-only — do not use on /s/:slug tenant surfaces. */
export const NAP = {
  legalName: '',
  streetAddress: '',
  addressLocality: '',
  addressCountry: 'MA',
  addressRegion: '',
  postalCode: '',
  telephone: '',
  telephoneDisplay: '',
  email: '',
  url: SITE_ORIGIN,
}

export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/images/main_car.webp`

export const absoluteUrl = (path = '/', origin = SITE_ORIGIN) => {
  if (!path) return origin
  if (path.startsWith('http')) return path
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}

/** Build contact/NAP-like object from public storefront profile (tenant-safe). */
export const napFromStorefront = (profile) => {
  if (!profile?.name && !profile?.agencyId) return null
  return {
    legalName: profile.name || '',
    streetAddress: profile.address || '',
    addressLocality: profile.city || '',
    addressCountry: profile.country || 'MA',
    addressRegion: profile.addressRegion || '',
    postalCode: profile.postalCode || '',
    telephone: profile.phone || profile.whatsapp || '',
    telephoneDisplay: profile.phone || profile.whatsapp || '',
    email: profile.email || '',
    url: profile.storefrontUrl || SITE_ORIGIN,
    logoUrl: profile.logoUrl || '',
    faviconUrl: profile.faviconUrl || profile.logoUrl || '',
    ogImageUrl: profile.seo?.ogImageUrl || profile.logoUrl || '',
    primaryBrandColor: profile.primaryBrandColor || '',
    socials: profile.socials || {},
    seo: profile.seo || {},
  }
}
