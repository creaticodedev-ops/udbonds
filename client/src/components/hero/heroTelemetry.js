/** Known Morocco pickup cities — used only for live temperature, never as invented claims. */
const CITY_COORDS = {
  agadir: [30.4278, -9.5981],
  casablanca: [33.5731, -7.5898],
  dakhla: [23.7148, -15.936],
  'el jadida': [33.2549, -8.506],
  essaouira: [31.5085, -9.7595],
  fes: [34.0331, -5.0003],
  'fès': [34.0331, -5.0003],
  'laayoune': [27.1253, -13.1625],
  'laâyoune': [27.1253, -13.1625],
  marrakech: [31.6295, -7.9811],
  marrakesh: [31.6295, -7.9811],
  meknes: [33.8731, -5.5407],
  'meknès': [33.8731, -5.5407],
  oujda: [34.6867, -1.9114],
  rabat: [34.0209, -6.8416],
  safi: [32.2994, -9.2372],
  tanger: [35.7595, -5.834],
  tangier: [35.7595, -5.834],
  tetouan: [35.5889, -5.3626],
  'tétouan': [35.5889, -5.3626],
}

const WEATHER_TTL_MS = 20 * 60 * 1000

export const resolveHeroCity = (storefrontProfile, pickupLocations = []) => {
  const fromProfile = String(storefrontProfile?.city || '').trim()
  if (fromProfile) return fromProfile
  const first = pickupLocations.find((loc) => String(loc?.city || '').trim())
  return String(first?.city || '').trim()
}

export const resolveHeroCountry = (storefrontProfile) => {
  const raw = String(storefrontProfile?.country || '').trim()
  if (raw) return raw
  const tz = String(storefrontProfile?.timezone || '')
  if (tz === 'Africa/Casablanca') return 'Morocco'
  return ''
}

export const countryDisplayKey = (country) => {
  if (/^(ma|maroc|morocco|marruecos)$/i.test(String(country || '').trim())) return 'morocco'
  return ''
}

export const coordsForCity = (city) => {
  const key = String(city || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return CITY_COORDS[key] || CITY_COORDS[String(city || '').trim().toLowerCase()] || null
}

export const clockParts = (date, timeZone) => {
  const parts = (() => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: timeZone || 'Africa/Casablanca',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(date)
    } catch {
      return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(date)
    }
  })()
  const get = (type) => parts.find((p) => p.type === type)?.value || '00'
  const hour = Number(get('hour'))
  const minute = Number(get('minute'))
  const second = Number(get('second'))
  const ms = date.getMilliseconds()
  return {
    label: `${get('hour')}:${get('minute')}`,
    second,
    fraction: hour * 3600 + minute * 60 + second + ms / 1000,
  }
}

export async function fetchCityTemperature(city, signal) {
  const coords = coordsForCity(city)
  if (!coords) return null

  const cacheKey = `hero-temp:${coords[0].toFixed(3)},${coords[1].toFixed(3)}`
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (parsed?.at && Date.now() - parsed.at < WEATHER_TTL_MS && Number.isFinite(parsed.temp)) {
        return parsed.temp
      }
    }
  } catch {
    /* ignore */
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords[0]}&longitude=${coords[1]}&current=temperature_2m`
  const res = await fetch(url, { signal })
  if (!res.ok) return null
  const data = await res.json()
  const temp = data?.current?.temperature_2m
  if (!Number.isFinite(temp)) return null

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ temp, at: Date.now() }))
  } catch {
    /* ignore */
  }
  return Math.round(temp)
}

export const heroVehicleHint = (cars = []) => {
  const available = cars.filter(
    (car) => car && car.isAvaliable !== false && Number(car.pricePerDay) > 0 && car.category,
  )
  if (!available.length) return null

  const by = (re) => available.filter((car) => re.test(String(car.category)))
  const pool = by(/suv/i).length
    ? by(/suv/i)
    : by(/luxury|luxe/i).length
      ? by(/luxury|luxe/i)
      : available

  const from = Math.min(...pool.map((car) => Number(car.pricePerDay)))
  if (!Number.isFinite(from)) return null

  return {
    category: String(pool[0].category).trim(),
    from,
  }
}
