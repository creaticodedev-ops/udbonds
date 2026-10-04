import dashboard from './shots/dashboard.webp'
import dashboard640 from './shots/dashboard-640.webp'
import dashboardJpg from './shots/dashboard.jpg'
import reservations from './shots/reservations.webp'
import reservations640 from './shots/reservations-640.webp'
import reservationsJpg from './shots/reservations.jpg'
import calendar from './shots/calendar.webp'
import calendar640 from './shots/calendar-640.webp'
import calendarJpg from './shots/calendar.jpg'
import fleet from './shots/fleet.webp'
import fleet640 from './shots/fleet-640.webp'
import fleetJpg from './shots/fleet.jpg'
import contracts from './shots/contracts.webp'
import contracts640 from './shots/contracts-640.webp'
import contractsJpg from './shots/contracts.jpg'
import invoices from './shots/invoices.webp'
import invoices640 from './shots/invoices-640.webp'
import invoicesJpg from './shots/invoices.jpg'
import statistics from './shots/statistics.webp'
import statistics640 from './shots/statistics-640.webp'
import statisticsJpg from './shots/statistics.jpg'
import walkin from './shots/walkin.webp'
import walkin640 from './shots/walkin-640.webp'
import walkinJpg from './shots/walkin.jpg'

/* Legacy PNG shots still referenced by older marketing scenes */
import booking from './shots/booking.png'
import customers from './shots/customers.png'
import signatures from './shots/signatures.png'
import accounting from './shots/accounting.png'
import revenues from './shots/revenues.png'
import analytics from './shots/analytics.png'
import reports from './shots/reports.png'
import maintenance from './shots/maintenance.png'
import storefront from './shots/storefront.png'
import locations from './shots/locations.png'
import templates from './shots/templates.png'

export const SHOT_META = {
  dashboard: { webp: dashboard, webp640: dashboard640, jpg: dashboardJpg, w: 900, h: 506 },
  reservations: { webp: reservations, webp640: reservations640, jpg: reservationsJpg, w: 900, h: 506 },
  calendar: { webp: calendar, webp640: calendar640, jpg: calendarJpg, w: 900, h: 506 },
  fleet: { webp: fleet, webp640: fleet640, jpg: fleetJpg, w: 900, h: 506 },
  contracts: { webp: contracts, webp640: contracts640, jpg: contractsJpg, w: 900, h: 506 },
  invoices: { webp: invoices, webp640: invoices640, jpg: invoicesJpg, w: 900, h: 506 },
  statistics: { webp: statistics, webp640: statistics640, jpg: statisticsJpg, w: 900, h: 506 },
  walkin: { webp: walkin, webp640: walkin640, jpg: walkinJpg, w: 900, h: 506 },
}

/** Simple URL map for places that still need a single src string. */
export const SHOTS = {
  dashboard,
  reservations,
  calendar,
  booking,
  fleet,
  customers,
  contracts,
  signatures,
  invoices,
  accounting,
  revenues,
  analytics,
  reports,
  maintenance,
  walkin,
  storefront,
  locations,
  templates,
  statistics,
}

export const ProductShot = ({
  id,
  alt = '',
  className = '',
  eager = false,
  sizes = '(max-width: 720px) 92vw, min(900px, 68vw)',
}) => {
  const shot = SHOT_META[id]
  if (!shot) return null
  return (
    <picture>
      <source
        type="image/webp"
        srcSet={`${shot.webp640} 640w, ${shot.webp} 900w`}
        sizes={sizes}
      />
      <img
        className={className}
        src={shot.jpg}
        alt={alt}
        width={shot.w}
        height={shot.h}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'auto'}
        draggable="false"
      />
    </picture>
  )
}
