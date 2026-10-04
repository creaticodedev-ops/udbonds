/**
 * Client-side presentation helpers for promotion badges / price labels.
 * Server attaches `displayPromotion`; this only formats labels.
 */

const OCCASION_BADGES = {
  summer: 'SUMMER OFFER',
  winter: 'WINTER OFFER',
  new_year: 'NEW YEAR DEAL',
  ramadan: 'RAMADAN OFFER',
  eid: 'EID OFFER',
  black_friday: 'BLACK FRIDAY',
  special_event: 'SPECIAL OFFER',
  last_minute: 'LIMITED OFFER',
  long_stay: 'LONG STAY DEAL',
  custom: 'SPECIAL OFFER',
}

const toMoney = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

/** Short elegant badge title derived from promotion data (never hard-coded per vehicle). */
export const getPromotionBadgeLabel = (promo) => {
  if (!promo) return ''
  if (promo.discountType === 'percentage' && Number(promo.discountValue) > 0) {
    return `-${Math.round(Number(promo.discountValue))}%`
  }
  if (promo.discountType === 'fixed' && Number(promo.discountValue) > 0) {
    return OCCASION_BADGES[promo.occasion] || 'SPECIAL OFFER'
  }
  if (promo.occasion && OCCASION_BADGES[promo.occasion]) {
    return OCCASION_BADGES[promo.occasion]
  }
  const name = String(promo.name || '').trim()
  if (name && name.length <= 18) return name.toUpperCase()
  return 'SPECIAL OFFER'
}

export const getPromotionOfferLabel = (promo) => {
  if (!promo) return ''
  if (promo.occasion && OCCASION_BADGES[promo.occasion] && promo.occasion !== 'custom') {
    return OCCASION_BADGES[promo.occasion]
  }
  const name = String(promo.name || '').trim()
  if (name) return name.length > 28 ? `${name.slice(0, 27)}…` : name
  return 'SPECIAL OFFER'
}

export const getPromotionDiscountCaption = (promo, currency = 'MAD ') => {
  if (!promo) return ''
  if (promo.discountType === 'percentage') return `-${Math.round(Number(promo.discountValue) || 0)}%`
  if (promo.discountType === 'fixed') return `−${currency}${toMoney(promo.discountValue)}`
  return ''
}

export const getDisplayDailyPrices = (carOrPromo) => {
  const promo = carOrPromo?.displayPromotion || carOrPromo
  if (!promo) return null
  const original = toMoney(promo.pricePerDay ?? carOrPromo?.pricePerDay)
  if (!original) return null
  if (promo.discountType === 'percentage' && promo.discountedPricePerDay != null) {
    return {
      original,
      final: toMoney(promo.discountedPricePerDay),
      caption: getPromotionDiscountCaption(promo),
      showStrike: true,
    }
  }
  return {
    original,
    final: original,
    caption: getPromotionDiscountCaption(promo),
    showStrike: false,
  }
}

export default {
  getPromotionBadgeLabel,
  getPromotionOfferLabel,
  getPromotionDiscountCaption,
  getDisplayDailyPrices,
}
