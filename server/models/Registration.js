import mongoose from 'mongoose'

export const OFFER_IDS = ['essential', 'advanced', 'premium']
export const DURATIONS = ['15d', '1m']

const registrationSchema = new mongoose.Schema(
  {
    offer: { type: String, enum: OFFER_IDS, required: true },
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 1, max: 100_000_000 },
    currency: { type: String, default: 'USD' },
    duration: { type: String, enum: DURATIONS, required: true },
    locale: { type: String, enum: ['fr', 'en', 'ar'], default: 'fr' },
    status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' },
  },
  { timestamps: true },
)

export const Registration = mongoose.models.Registration || mongoose.model('Registration', registrationSchema)
