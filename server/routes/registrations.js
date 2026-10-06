import { Router } from 'express'
import { dbState } from '../configs/db.js'
import { DURATIONS, OFFER_IDS, Registration } from '../models/Registration.js'

export const registrationsRouter = Router()

const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5
const hits = new Map()

const rateLimited = (ip) => {
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > MAX_PER_WINDOW
}

const text = (value, max) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '')

const validate = (body = {}) => {
  const data = {
    offer: text(body.offer, 20),
    firstName: text(body.firstName, 60),
    lastName: text(body.lastName, 60),
    city: text(body.city, 80),
    amount: Number(body.amount),
    duration: text(body.duration, 4),
    locale: ['fr', 'en', 'ar'].includes(body.locale) ? body.locale : 'fr',
  }
  const errors = {}
  if (!OFFER_IDS.includes(data.offer)) errors.offer = 'invalid'
  if (data.firstName.length < 2) errors.firstName = 'required'
  if (data.lastName.length < 2) errors.lastName = 'required'
  if (data.city.length < 2) errors.city = 'required'
  if (!Number.isFinite(data.amount) || data.amount < 1 || data.amount > 100_000_000) errors.amount = 'invalid'
  if (!DURATIONS.includes(data.duration)) errors.duration = 'invalid'
  return { data, errors }
}

registrationsRouter.post('/', async (req, res, next) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Too many requests' })
  const { data, errors } = validate(req.body)
  if (Object.keys(errors).length) return res.status(422).json({ error: 'Invalid registration', fields: errors })
  if (dbState() !== 'connected') return res.status(503).json({ error: 'Database unavailable' })
  try {
    const doc = await Registration.create({ ...data, amount: Math.round(data.amount * 100) / 100 })
    res.status(201).json({ id: doc.id, createdAt: doc.createdAt })
  } catch (error) {
    next(error)
  }
})
