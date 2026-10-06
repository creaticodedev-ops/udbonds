import { Router } from 'express'
import { dbState } from '../configs/db.js'
import { Notification, toNotification } from '../models/Notification.js'
import { DURATIONS, OFFER_IDS, Registration, toApplication } from '../models/Registration.js'
import { publish } from '../services/adminEvents.js'

export const registrationsRouter = Router()

const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE = /^\+[1-9]\d{7,14}$/
const hits = new Map()

/** "+212 6 12-34 56 78" or "00212…" → "+212612345678" (E.164). */
const normalizePhone = (value) => {
  const compact = typeof value === 'string' ? value.trim().replace(/[\s().\-\u00a0\u202f]/g, '') : ''
  return compact.startsWith('00') ? `+${compact.slice(2)}` : compact
}

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
    email: text(body.email, 254).toLowerCase(),
    phone: normalizePhone(text(body.phone, 32)),
    amount: Number(body.amount),
    duration: text(body.duration, 4),
    locale: ['fr', 'en', 'ar'].includes(body.locale) ? body.locale : 'fr',
  }
  const errors = {}
  if (!OFFER_IDS.includes(data.offer)) errors.offer = 'invalid'
  if (data.firstName.length < 2) errors.firstName = 'required'
  if (data.lastName.length < 2) errors.lastName = 'required'
  if (data.city.length < 2) errors.city = 'required'
  if (!EMAIL.test(data.email)) errors.email = 'invalid'
  if (!PHONE.test(data.phone)) errors.phone = 'invalid'
  if (!Number.isFinite(data.amount) || data.amount < 1 || data.amount > 100_000_000) errors.amount = 'invalid'
  if (!DURATIONS.includes(data.duration)) errors.duration = 'invalid'
  return { data, errors }
}

/** Stores the admin notification; a failure here must never fail the visitor's submission. */
const notifyAdmin = async (doc) => {
  try {
    const notification = await Notification.create({
      registration: doc._id,
      name: `${doc.firstName} ${doc.lastName}`,
      amount: doc.amount,
      currency: doc.currency,
      duration: doc.duration,
      offer: doc.offer,
    })
    publish('registration', { notification: toNotification(notification), application: toApplication(doc) })
  } catch (error) {
    console.error('[admin] Notification failed:', error.message)
  }
}

registrationsRouter.post('/', async (req, res, next) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Too many requests' })
  const { data, errors } = validate(req.body)
  if (Object.keys(errors).length) return res.status(422).json({ error: 'Invalid registration', fields: errors })
  if (dbState() !== 'connected') return res.status(503).json({ error: 'Database unavailable' })
  try {
    const doc = await Registration.create({ ...data, amount: Math.round(data.amount * 100) / 100 })
    res.status(201).json({ id: doc.id, createdAt: doc.createdAt })
    notifyAdmin(doc)
  } catch (error) {
    next(error)
  }
})
