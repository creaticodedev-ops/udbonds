/** Normalize text into URL-safe slugs (French-friendly). */
export const slugify = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

export const carSlug = (car) => {
  if (!car) return ''
  if (car.seoSlug) return slugify(car.seoSlug)
  return slugify(`${car.brand || ''}-${car.model || ''}`)
}

/** Prefer unique slug; append short id suffix on collisions. */
export const uniqueCarSlug = (car, allCars = []) => {
  const base = carSlug(car)
  if (!base) return ''
  const clashes = allCars.filter((c) => c?._id !== car?._id && carSlug(c) === base)
  if (!clashes.length) return base
  const suffix = String(car._id || '').slice(-6)
  return suffix ? `${base}-${suffix}` : base
}
