const origin = 'https://www.hdncar.com'
const api = 'https://api.hdncar.com'

const check = async (name, fn) => {
  try {
    const ok = await fn()
    console.log(ok ? 'PASS' : 'FAIL', name)
    return ok
  } catch (e) {
    console.log('FAIL', name, e.message)
    return false
  }
}

let failed = 0
const cars = await (await fetch(`${api}/api/user/cars`)).json()
const locs = await (await fetch(`${api}/api/pickup-locations`)).json()

if (!(await check('API cars', () => cars.success && cars.cars?.length > 0))) failed++
if (!(await check('API pickup locations', () => locs.success && locs.locations?.length > 0))) failed++

const car = cars.cars[0]
if (!(await check('Car details page', async () => {
  const res = await fetch(`${origin}/car-details/${car._id}`)
  const html = await res.text()
  return res.status === 200 && html.includes('id="root"')
}))) failed++

if (!(await check('Cars listing', async () => (await fetch(`${origin}/cars`)).status === 200))) failed++
if (!(await check('Cars category filter URL', async () => (await fetch(`${origin}/cars?category=SUV`)).status === 200))) failed++
if (!(await check('Owner shell', async () => (await fetch(`${origin}/owner`)).status === 200))) failed++
if (!(await check('Home WhatsApp module chunk referenced', async () => {
  const html = await (await fetch(origin)).text()
  return /whatsapp|wa\.me|HDN/i.test(html)
}))) failed++

console.log(failed ? `smoke failed: ${failed}` : 'smoke: all passed')
process.exitCode = failed ? 1 : 0
