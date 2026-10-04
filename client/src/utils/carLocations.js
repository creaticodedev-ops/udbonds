/** Effective pickup cities for a car (supports legacy `location`). */
export const getCarLocations = (car = {}) => {
  const raw = []
  if (Array.isArray(car.locations)) raw.push(...car.locations)
  if (car.location) raw.push(car.location)
  const seen = new Set()
  const out = []
  for (const item of raw) {
    const value = String(item || '').trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

export const formatLocationsDisplay = (car) => {
  const list = getCarLocations(car)
  if (!list.length) return '—'
  if (list.length <= 2) return list.join(', ')
  return `${list.slice(0, 2).join(', ')} +${list.length - 2}`
}

export const carServesCity = (car, city) => {
  const target = String(city || '').trim().toLowerCase()
  if (!target) return false
  return getCarLocations(car).some((c) => c.toLowerCase() === target)
}
