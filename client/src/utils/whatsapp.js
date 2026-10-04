/** wa.me deep links — no Meta API. Never invent another agency's WhatsApp number. */

export const normalizeWhatsAppDial = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0') && digits.length === 10) return `212${digits.slice(1)}`
  return digits
}

/** @deprecated Prefer storefront dial — returns empty when unset (no HDN leak). */
export const getAgencyWhatsAppDial = () => {
  const raw =
    import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER ||
    import.meta.env.VITE_WHATSAPP_NUMBER ||
    ''
  return normalizeWhatsAppDial(raw)
}

const formatDateTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString()
}

export const buildWaMeUrl = (text, dial = '') => {
  const to = normalizeWhatsAppDial(dial)
  if (!to) return ''
  if (!text?.trim()) return `https://wa.me/${to}`
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`
}

/**
 * Open WhatsApp (or any external URL) in a new tab without navigating the current page.
 */
export const createExternalTabOpener = () => {
  let tab = null
  try {
    tab = window.open('about:blank', '_blank')
  } catch {
    tab = null
  }

  return {
    prepared: Boolean(tab && !tab.closed),
    navigate(url) {
      if (!url) return false
      if (tab && !tab.closed) {
        try {
          tab.location.href = url
          try {
            tab.opener = null
          } catch {
            /* ignore */
          }
          return true
        } catch {
          /* fall through */
        }
      }
      try {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
        anchor.style.display = 'none'
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        return true
      } catch {
        return false
      }
    },
    close() {
      if (tab && !tab.closed) {
        try {
          tab.close()
        } catch {
          /* ignore */
        }
      }
      tab = null
    },
  }
}

/** Guest reservation after form submit */
export const buildGuestReservationWaUrl = (reservation, { currency = 'MAD', dial, agencyName = '' } = {}) => {
  const brand = agencyName || reservation.agencyName || 'car rental'
  const lines = [
    `Hello, I would like to confirm my ${brand} reservation.`,
    '',
    `Reservation: ${reservation.reservationId || '—'}`,
    `Name: ${reservation.customerName || '—'}`,
    `Phone: ${reservation.phone || reservation.customerPhone || '—'}`,
    `Email: ${reservation.email || reservation.customerEmail || '—'}`,
    `Vehicle: ${reservation.carName || reservation.vehicle || '—'}`,
    `Pickup: ${formatDateTime(reservation.pickupDate)} — ${reservation.pickupLocation || '—'}`,
    `Return: ${formatDateTime(reservation.returnDate)} — ${reservation.returnLocation || '—'}`,
    `Total: ${currency}${reservation.price ?? '—'}`,
  ]
  if (reservation.notes?.trim()) lines.push(`Notes: ${reservation.notes.trim()}`)
  return buildWaMeUrl(
    lines.join('\n'),
    dial || reservation.whatsappDial || getAgencyWhatsAppDial(),
  )
}

/** Owner dashboard — open WhatsApp to agency with message to forward to customer */
export const buildOwnerCompletionWaUrl = (booking, completionUrl, { currency = 'MAD', dial, agencyName = '' } = {}) => {
  const reservationId = booking.reservationId || `RES-${booking._id?.toString().slice(-8).toUpperCase()}`
  const vehicle = booking.car
    ? `${booking.car.brand} ${booking.car.model}${booking.car.licensePlate ? ` (${booking.car.licensePlate})` : ''}`
    : booking.carName || '—'
  const brand = agencyName || booking.agencyName || 'Booking'

  const lines = [
    `${brand} — booking confirmation (message for customer):`,
    '',
    `Hello ${booking.customerName || 'Customer'},`,
    '',
    'Your reservation is confirmed.',
    `Reservation: ${reservationId}`,
    `Vehicle: ${vehicle}`,
    `Pickup: ${formatDateTime(booking.pickupDate)} — ${booking.pickupLocation || '—'}`,
    `Return: ${formatDateTime(booking.returnDate)} — ${booking.returnLocation || '—'}`,
    `Total: ${currency}${booking.price ?? '—'}`,
    '',
    'Complete your booking securely here:',
    completionUrl,
    '',
    `(Customer: ${booking.customerPhone || '—'})`,
  ]
  return buildWaMeUrl(lines.join('\n'), dial || getAgencyWhatsAppDial())
}

/** @deprecated use buildOwnerCompletionWaUrl */
export const buildCompletionWhatsAppUrl = buildOwnerCompletionWaUrl

export const buildGuestToAgencyWhatsAppUrlFromDial = (dial, reservation, opts) =>
  buildGuestReservationWaUrl(reservation, { ...opts, dial })

export default {
  buildGuestReservationWaUrl,
  buildOwnerCompletionWaUrl,
  buildWaMeUrl,
  getAgencyWhatsAppDial,
  createExternalTabOpener,
}
