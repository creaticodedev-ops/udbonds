/** Platform identity — Super Admin, trial/license, system auth screens only. */
export const PLATFORM_NAME =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PLATFORM_NAME) ||
  'RSZ CAR'

/** @deprecated Prefer storefrontProfile.name on tenant surfaces. */
export const BRAND_NAME = PLATFORM_NAME

/** Platform Instagram — never use on agency storefronts. */
export const PLATFORM_INSTAGRAM_URL = ''

/** @deprecated Use storefrontProfile.socials.instagram on tenant surfaces. */
export const INSTAGRAM_URL = PLATFORM_INSTAGRAM_URL

export default PLATFORM_NAME
