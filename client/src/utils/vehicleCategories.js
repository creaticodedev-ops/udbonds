/** Public browse order for vehicle categories */
export const VEHICLE_CATEGORIES = [
  'Economy',
  'Compact',
  'Sedan',
  'SUV',
  'Luxury',
  'Van',
  'Pickup',
  'Sports',
  'Electric',
  'Other',
]

export const categorySortIndex = (category) => {
  const i = VEHICLE_CATEGORIES.findIndex(
    (c) => c.toLowerCase() === String(category || '').toLowerCase()
  )
  return i === -1 ? VEHICLE_CATEGORIES.length : i
}

/** Manual catalog order first; price then name as stable fallbacks. */
export const compareCarsForDisplay = (x, y) => {
  const ox = Number.isFinite(Number(x?.displayOrder)) ? Number(x.displayOrder) : Number.POSITIVE_INFINITY
  const oy = Number.isFinite(Number(y?.displayOrder)) ? Number(y.displayOrder) : Number.POSITIVE_INFINITY
  if (ox !== oy) return ox - oy

  const px = Number(x?.pricePerDay) || 0
  const py = Number(y?.pricePerDay) || 0
  if (px !== py) return px - py

  return `${x?.brand || ''} ${x?.model || ''}`.localeCompare(`${y?.brand || ''} ${y?.model || ''}`)
}

export const groupCarsByCategory = (cars = []) => {
  const map = new Map()
  for (const car of cars) {
    const key = car.category || 'Other'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(car)
  }
  return [...map.entries()]
    .sort(([a], [b]) => categorySortIndex(a) - categorySortIndex(b))
    .map(([category, items]) => ({
      category,
      cars: [...items].sort(compareCarsForDisplay),
    }))
}
