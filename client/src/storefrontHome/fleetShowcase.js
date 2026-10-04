import { groupCarsByCategory } from '../utils/vehicleCategories'

const carImage = (car) => String(car?.image || car?.images?.[0] || '').trim()

const priced = (cars = []) =>
  cars.filter((car) => car && Number(car.pricePerDay) > 0)

export const buildCategoryShowcase = (cars = []) =>
  groupCarsByCategory(priced(cars))
    .map(({ category, cars: list }) => {
      const available = list.filter((car) => car.isAvaliable !== false)
      const pool = available.length ? available : list
      const pictured = pool.find((car) => carImage(car)) || pool[0]
      const from = Math.min(...list.map((car) => Number(car.pricePerDay)))
      const image = carImage(pictured)
      if (!image || !Number.isFinite(from)) return null
      return {
        category,
        from,
        count: list.length,
        image,
        car: pictured,
      }
    })
    .filter(Boolean)

export const featuredVehicles = (cars = [], limit = 7) => {
  const ready = priced(cars).filter((car) => carImage(car))
  const preferred = ready.filter((car) => car.isAvaliable !== false)
  const list = (preferred.length ? preferred : ready).slice().sort((a, b) => {
    const ao = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 9999
    const bo = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 9999
    if (ao !== bo) return ao - bo
    return Number(a.pricePerDay) - Number(b.pricePerDay)
  })
  return list.slice(0, limit)
}

export const uniqueCities = (pickupLocations = []) => {
  const seen = new Set()
  const out = []
  for (const loc of pickupLocations) {
    const city = String(loc?.city || '').trim()
    if (!city) continue
    const key = city.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(city)
  }
  return out.sort((a, b) => a.localeCompare(b))
}

export const groupedLocations = (pickupLocations = []) => {
  const map = new Map()
  for (const loc of pickupLocations) {
    if (!loc) continue
    const city = String(loc.city || '').trim() || '—'
    if (!map.has(city)) map.set(city, [])
    map.get(city).push(loc)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}

export const realAdvantages = ({ cars = [], pickupLocations = [], storefrontProfile }) => {
  const items = []
  const fleet = cars.length
  if (fleet > 0) {
    items.push({ key: 'fleet', count: fleet })
  }
  if (pickupLocations.length > 0) {
    items.push({
      key: 'locations',
      count: pickupLocations.length,
      cities: uniqueCities(pickupLocations),
    })
  }
  if (pickupLocations.some((loc) => loc?.locationType === 'airport')) {
    items.push({ key: 'airport' })
  }
  if (String(storefrontProfile?.whatsapp || '').trim()) {
    items.push({ key: 'whatsapp' })
  }
  return items
}
