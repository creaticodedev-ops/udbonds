import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Title from '../../components/owner/Title'
import ChannelBadge from '../../components/owner/ChannelBadge'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../utils/apiError'
import { getCarLocations } from '../../utils/carLocations'
import { calculateBookingPricePreview, resolveLocationDeliveryFees } from '../../utils/pricing'
import PhoneInput, { isPhoneValid } from '../../components/PhoneInput'

const emptyForm = {
  car: '',
  fullName: '',
  email: '',
  phone: '',
  pickupDate: '',
  returnDate: '',
  pickupLocationId: '',
  returnLocationId: '',
  notes: '',
  status: 'confirmed',
  markPaid: false,
  sendCompletionLink: false,
  nationality: '',
  dateOfBirth: '',
  customerAddress: '',
  placeOfBirth: '',
  identityDocumentNumber: '',
  identityIssuedOn: '',
  driverLicenseNumber: '',
  driverLicenseExpiry: '',
  driverLicenseIssuedOn: '',
  passportNumber: '',
  deliveredBy: '',
  receivedBy: '',
  fuelLevelStart: '',
  kmDepart: '',
  kmRetour: '',
  franchiseAmount: '',
  secondDriverEnabled: false,
  secondDriverFullName: '',
  secondDriverDob: '',
  secondDriverNationality: '',
  secondDriverPhone: '',
  secondDriverLicenseNumber: '',
  secondDriverLicenseExpiry: '',
  secondDriverPassportNumber: '',
  promoCode: '',
}

const WalkInBooking = () => {
  const { axios, currency, pickupLocations } = useAppContext()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [cars, setCars] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [quote, setQuote] = useState(null)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)
  const [docFiles, setDocFiles] = useState({
    driving_license: null,
    national_id: null,
    passport: null,
  })
  const [uploadingDoc, setUploadingDoc] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await axios.get('/api/owner/cars')
        if (data.success) {
          setCars((data.cars || []).filter((c) => c.status !== 'maintenance' && c.isAvaliable !== false))
        }
      } catch (error) {
        toast.error(getErrorMessage(error))
      }
    })()
  }, [axios])

  const selectedCar = useMemo(() => cars.find((c) => c._id === form.car), [cars, form.car])

  const bookableLocations = useMemo(() => {
    if (!selectedCar) return pickupLocations
    const cities = getCarLocations(selectedCar)
    if (!cities.length) return pickupLocations
    const citySet = new Set(cities.map((c) => c.toLowerCase()))
    return pickupLocations.filter((l) => citySet.has(String(l.city || '').toLowerCase()))
  }, [selectedCar, pickupLocations])

  useEffect(() => {
    const ids = new Set(bookableLocations.map((l) => String(l._id)))
    setForm((f) => {
      const pickupOk = !f.pickupLocationId || ids.has(String(f.pickupLocationId))
      const returnOk = !f.returnLocationId || ids.has(String(f.returnLocationId))
      if (pickupOk && returnOk) return f
      return {
        ...f,
        pickupLocationId: pickupOk ? f.pickupLocationId : '',
        returnLocationId: returnOk ? f.returnLocationId : '',
      }
    })
  }, [bookableLocations])

  // Prefill deposit / departure km from the selected vehicle (same as online create).
  useEffect(() => {
    if (!selectedCar) return
    setForm((f) => ({
      ...f,
      franchiseAmount:
        f.franchiseAmount === '' || f.franchiseAmount == null
          ? (selectedCar.securityDeposit != null ? String(selectedCar.securityDeposit) : '')
          : f.franchiseAmount,
      kmDepart:
        f.kmDepart === '' || f.kmDepart == null
          ? (selectedCar.mileage != null ? String(selectedCar.mileage) : '')
          : f.kmDepart,
    }))
  }, [selectedCar?._id]) // eslint-disable-line react-hooks/exhaustive-deps -- only when vehicle changes

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  useEffect(() => {
    if (!selectedCar || !form.pickupDate || !form.returnDate) {
      setQuote(null)
      return
    }
    const start = new Date(form.pickupDate)
    const end = new Date(form.returnDate)
    if (!(end > start)) {
      setQuote(null)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.post('/api/bookings/quote', {
          car: selectedCar._id,
          pickupDate: form.pickupDate,
          returnDate: form.returnDate,
          pickupLocationId: form.pickupLocationId,
          returnLocationId: form.returnLocationId,
          promoCode: form.promoCode,
          email: form.email,
        })
        if (cancelled) return
        if (data.success && data.priceBreakdown) {
          setQuote({
            days: data.priceBreakdown.days,
            rental: data.priceBreakdown.rentalPrice,
            pickupFee: data.priceBreakdown.pickupDeliveryFee,
            dropoffFee: data.priceBreakdown.dropoffDeliveryFee,
            discount: data.priceBreakdown.discountTotal || 0,
            total: data.price,
          })
          return
        }
        // Server rejected the quote (e.g. min rental duration) — do not show a local price.
        if (data?.code === 'MIN_RENTAL_DAYS' || data?.code === 'MAX_RENTAL_DAYS') {
          setQuote(null)
          if (data.message) toast.error(data.message)
          return
        }
      } catch (error) {
        const payload = error.response?.data || {}
        if (payload.code === 'MIN_RENTAL_DAYS' || payload.code === 'MAX_RENTAL_DAYS') {
          if (!cancelled) {
            setQuote(null)
            if (payload.message) toast.error(payload.message)
          }
          return
        }
        /* other failures: fall back to local preview */
      }
      if (cancelled) return
      const pickup = pickupLocations.find((l) => l._id === form.pickupLocationId)
      const dropoff = pickupLocations.find((l) => l._id === form.returnLocationId)
      const { pickupDeliveryFee, dropoffDeliveryFee } = resolveLocationDeliveryFees(pickup, dropoff)
      const preview = calculateBookingPricePreview({
        pricePerDay: selectedCar.pricePerDay,
        pickupDate: form.pickupDate,
        returnDate: form.returnDate,
        pickupDeliveryFee,
        dropoffDeliveryFee,
      })
      if (!preview.ready) {
        setQuote(null)
        return
      }
      setQuote({
        days: preview.days,
        rental: preview.rentalPrice,
        pickupFee: preview.pickupDeliveryFee,
        dropoffFee: preview.dropoffDeliveryFee,
        discount: preview.discountTotal || 0,
        total: preview.total,
      })
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [
    axios,
    selectedCar,
    form.pickupDate,
    form.returnDate,
    form.pickupLocationId,
    form.returnLocationId,
    form.promoCode,
    form.email,
    pickupLocations,
  ])

  const uploadDocument = async (bookingId, file, docType, identityType) => {
    if (!file || !bookingId) return
    setUploadingDoc(docType)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('docType', docType)
      if (docType === 'identity') formData.append('identityType', identityType || 'national_id')
      const { data } = await axios.post(`/api/bookings/owner/${bookingId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (data.success) toast.success(data.message)
      else toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setUploadingDoc('')
    }
  }

  const uploadPendingDocuments = async (bookingId) => {
    if (docFiles.driving_license) {
      await uploadDocument(bookingId, docFiles.driving_license, 'driving_license')
    }
    if (docFiles.national_id) {
      await uploadDocument(bookingId, docFiles.national_id, 'identity', 'national_id')
    }
    if (docFiles.passport) {
      await uploadDocument(bookingId, docFiles.passport, 'passport')
    }
    setDocFiles({ driving_license: null, national_id: null, passport: null })
  }

  const buildPayload = () => ({
    car: form.car,
    fullName: form.fullName,
    email: form.email,
    phone: form.phone,
    pickupDate: form.pickupDate,
    returnDate: form.returnDate,
    pickupLocationId: form.pickupLocationId,
    returnLocationId: form.returnLocationId,
    notes: form.notes,
    status: form.status,
    markPaid: form.markPaid,
    sendCompletionLink: form.sendCompletionLink,
    paymentStatus: form.markPaid ? 'paid' : 'pending',
    nationality: form.nationality,
    dateOfBirth: form.dateOfBirth,
    customerAddress: form.customerAddress,
    placeOfBirth: form.placeOfBirth,
    identityDocumentNumber: form.identityDocumentNumber,
    identityIssuedOn: form.identityIssuedOn,
    driverLicenseNumber: form.driverLicenseNumber,
    driverLicenseExpiry: form.driverLicenseExpiry,
    driverLicenseIssuedOn: form.driverLicenseIssuedOn,
    passportNumber: form.passportNumber,
    deliveredBy: form.deliveredBy,
    receivedBy: form.receivedBy,
    fuelLevelStart: form.fuelLevelStart,
    kmDepart: form.kmDepart,
    kmRetour: form.kmRetour,
    franchiseAmount: form.franchiseAmount === '' ? undefined : form.franchiseAmount,
    secondDriver: {
      enabled: Boolean(form.secondDriverEnabled),
      fullName: form.secondDriverFullName,
      dateOfBirth: form.secondDriverDob,
      nationality: form.secondDriverNationality,
      phone: form.secondDriverPhone,
      driverLicenseNumber: form.secondDriverLicenseNumber,
      driverLicenseExpiry: form.secondDriverLicenseExpiry,
      passportNumber: form.secondDriverPassportNumber,
    },
    promoCode: form.promoCode,
  })

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!form.car || !form.fullName || !form.phone || !form.pickupDate || !form.returnDate) {
      toast.error(t('admin.walkIn.required'))
      return
    }
    if (!form.pickupLocationId || !form.returnLocationId) {
      toast.error(t('admin.walkIn.selectLocations'))
      return
    }
    if (!isPhoneValid(form.phone)) {
      toast.error(t('admin.walkIn.invalidPhone'))
      return
    }
    setSaving(true)
    try {
      const { data } = await axios.post('/api/bookings/owner/walk-in', buildPayload())
      if (data.success) {
        toast.success(data.message)
        if (data.booking?._id) {
          await uploadPendingDocuments(data.booking._id)
        }
        setCreated(data)
        setForm(emptyForm)
        setQuote(null)
      } else toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const input = 'border border-borderColor rounded-md px-3 py-2 text-sm w-full outline-none focus:border-primary bg-white'

  return (
    <div className="px-4 pt-8 md:px-8 lg:px-10 xl:px-12 md:pt-10 flex-1 pb-12 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <Title title={t('admin.walkIn.title')} subTitle={t('admin.walkIn.subtitle')} />
        <div className="flex items-center gap-2">
          <ChannelBadge channel="walk_in" />
          <Link to="/owner/manage-bookings" className="text-sm text-primary hover:underline">
            {t('admin.walkIn.viewAll')}
          </Link>
        </div>
      </div>

      {created && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-emerald-900">
              {t('admin.walkIn.created', { id: created.reservationId })}
            </p>
            <ChannelBadge channel="walk_in" />
          </div>
          <div className="rounded-lg border border-emerald-100 bg-white/70 p-3 space-y-2">
            <p className="font-medium text-sm">{t('admin.walkIn.uploadDocuments')}</p>
            <p className="text-xs text-gray-500">{t('admin.walkIn.uploadDocumentsHint')}</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500">{t('admin.walkIn.uploadLicense')}</label>
                <input
                  type="file"
                  accept="image/*"
                  className="block text-xs mt-1 w-full"
                  disabled={!!uploadingDoc}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file && created.booking?._id) uploadDocument(created.booking._id, file, 'driving_license')
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">{t('admin.walkIn.uploadNationalId')}</label>
                <input
                  type="file"
                  accept="image/*"
                  className="block text-xs mt-1 w-full"
                  disabled={!!uploadingDoc}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file && created.booking?._id) uploadDocument(created.booking._id, file, 'identity', 'national_id')
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">{t('admin.walkIn.uploadPassport')}</label>
                <input
                  type="file"
                  accept="image/*"
                  className="block text-xs mt-1 w-full"
                  disabled={!!uploadingDoc}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file && created.booking?._id) uploadDocument(created.booking._id, file, 'passport')
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(`/owner/contracts?bookingId=${created.booking?._id || ''}`)}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs"
            >
              {t('admin.walkIn.openContract')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/owner/manage-bookings')}
              className="px-3 py-1.5 border rounded-lg text-xs"
            >
              {t('admin.walkIn.openBookings')}
            </button>
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="px-3 py-1.5 border rounded-lg text-xs"
            >
              {t('admin.walkIn.createAnother')}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5 rounded-xl border border-borderColor bg-white p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{t('admin.walkIn.customer')}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.fullName')} *</label>
              <input className={input} required value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.phone')} *</label>
              <PhoneInput value={form.phone} onChange={(phone) => setField('phone', phone)} required />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.email')}</label>
              <input type="email" className={input} value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.address')}</label>
              <input className={input} value={form.customerAddress} onChange={(e) => setField('customerAddress', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.nationality')}</label>
              <input className={input} value={form.nationality} onChange={(e) => setField('nationality', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.dateOfBirth')}</label>
              <input type="date" className={input} value={form.dateOfBirth} onChange={(e) => setField('dateOfBirth', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.placeOfBirth')}</label>
              <input className={input} value={form.placeOfBirth} onChange={(e) => setField('placeOfBirth', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.identityNumber')}</label>
              <input className={input} value={form.identityDocumentNumber} onChange={(e) => setField('identityDocumentNumber', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.identityIssued')}</label>
              <input type="date" className={input} value={form.identityIssuedOn} onChange={(e) => setField('identityIssuedOn', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.license')}</label>
              <input className={input} value={form.driverLicenseNumber} onChange={(e) => setField('driverLicenseNumber', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.licenseIssued')}</label>
              <input type="date" className={input} value={form.driverLicenseIssuedOn} onChange={(e) => setField('driverLicenseIssuedOn', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.licenseExpiry')}</label>
              <input type="date" className={input} value={form.driverLicenseExpiry} onChange={(e) => setField('driverLicenseExpiry', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.passport')}</label>
              <input className={input} value={form.passportNumber} onChange={(e) => setField('passportNumber', e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border border-borderColor bg-gray-50 p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={form.secondDriverEnabled}
                onChange={(e) => setField('secondDriverEnabled', e.target.checked)}
              />
              {t('admin.walkIn.secondDriver')}
            </label>
            {form.secondDriverEnabled && (
              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs text-gray-500">{t('admin.walkIn.secondDriverName')}</label>
                  <input className={input} value={form.secondDriverFullName} onChange={(e) => setField('secondDriverFullName', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('admin.walkIn.secondDriverDob')}</label>
                  <input type="date" className={input} value={form.secondDriverDob} onChange={(e) => setField('secondDriverDob', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('admin.walkIn.nationality')}</label>
                  <input className={input} value={form.secondDriverNationality} onChange={(e) => setField('secondDriverNationality', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('admin.walkIn.phone')}</label>
                  <input className={input} value={form.secondDriverPhone} onChange={(e) => setField('secondDriverPhone', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('admin.walkIn.license')}</label>
                  <input className={input} value={form.secondDriverLicenseNumber} onChange={(e) => setField('secondDriverLicenseNumber', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('admin.walkIn.licenseExpiry')}</label>
                  <input type="date" className={input} value={form.secondDriverLicenseExpiry} onChange={(e) => setField('secondDriverLicenseExpiry', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500">{t('admin.walkIn.passport')}</label>
                  <input className={input} value={form.secondDriverPassportNumber} onChange={(e) => setField('secondDriverPassportNumber', e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide pt-2">{t('admin.walkIn.rental')}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500">{t('admin.walkIn.vehicle')} *</label>
              <select
                className={input}
                required
                value={form.car}
                onChange={(e) => {
                  const carId = e.target.value
                  const car = cars.find((c) => c._id === carId)
                  setForm((f) => ({
                    ...f,
                    car: carId,
                    franchiseAmount: car?.securityDeposit != null ? String(car.securityDeposit) : '',
                    kmDepart: car?.mileage != null ? String(car.mileage) : '',
                  }))
                }}
              >
                <option value="">{t('admin.walkIn.selectVehicle')}</option>
                {cars.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.fleetId ? `[${c.fleetId}] ` : ''}{c.brand} {c.model} — {currency}{c.pricePerDay}/day
                    {c.licensePlate ? ` · ${c.licensePlate}` : ''}
                    {c.branch ? ` · ${c.branch}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.pickup')} *</label>
              <input type="datetime-local" className={input} required value={form.pickupDate} onChange={(e) => setField('pickupDate', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.return')} *</label>
              <input type="datetime-local" className={input} required value={form.returnDate} onChange={(e) => setField('returnDate', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.pickupLoc')} *</label>
              <select className={input} required value={form.pickupLocationId} onChange={(e) => setField('pickupLocationId', e.target.value)}>
                <option value="">{t('admin.walkIn.selectLoc')}</option>
                {bookableLocations.map((l) => (
                  <option key={l._id} value={l._id}>{l.city} — {l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.returnLoc')} *</label>
              <select className={input} required value={form.returnLocationId} onChange={(e) => setField('returnLocationId', e.target.value)}>
                <option value="">{t('admin.walkIn.selectLoc')}</option>
                {bookableLocations.map((l) => (
                  <option key={l._id} value={l._id}>{l.city} — {l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.franchise')}</label>
              <input type="number" min="0" step="0.01" className={input} value={form.franchiseAmount} onChange={(e) => setField('franchiseAmount', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.fuelLevel')}</label>
              <input className={input} value={form.fuelLevelStart} onChange={(e) => setField('fuelLevelStart', e.target.value)} placeholder="e.g. 1/1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.kmDepart')}</label>
              <input className={input} value={form.kmDepart} onChange={(e) => setField('kmDepart', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.kmRetour')}</label>
              <input className={input} value={form.kmRetour} onChange={(e) => setField('kmRetour', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.deliveredBy')}</label>
              <input className={input} value={form.deliveredBy} onChange={(e) => setField('deliveredBy', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.receivedBy')}</label>
              <input className={input} value={form.receivedBy} onChange={(e) => setField('receivedBy', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.settings.promoCode')}</label>
              <input
                className={`${input} uppercase`}
                value={form.promoCode}
                onChange={(e) => setField('promoCode', e.target.value.toUpperCase())}
                placeholder={t('admin.settings.promoCodeHint')}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500">{t('admin.walkIn.notes')}</label>
              <textarea rows={2} className={input} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border border-borderColor bg-gray-50 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{t('admin.walkIn.uploadDocuments')}</h2>
            <p className="text-xs text-gray-500">{t('admin.walkIn.uploadDocumentsHint')}</p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500">{t('admin.walkIn.uploadLicense')} *</label>
                <input
                  type="file"
                  accept="image/*"
                  className="block text-xs mt-1 w-full"
                  onChange={(e) => setDocFiles((d) => ({ ...d, driving_license: e.target.files?.[0] || null }))}
                />
                {docFiles.driving_license && <p className="text-[11px] text-emerald-700 mt-1 truncate">{docFiles.driving_license.name}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-500">{t('admin.walkIn.uploadNationalId')} *</label>
                <input
                  type="file"
                  accept="image/*"
                  className="block text-xs mt-1 w-full"
                  onChange={(e) => setDocFiles((d) => ({ ...d, national_id: e.target.files?.[0] || null }))}
                />
                {docFiles.national_id && <p className="text-[11px] text-emerald-700 mt-1 truncate">{docFiles.national_id.name}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-500">{t('admin.walkIn.uploadPassport')}</label>
                <input
                  type="file"
                  accept="image/*"
                  className="block text-xs mt-1 w-full"
                  onChange={(e) => setDocFiles((d) => ({ ...d, passport: e.target.files?.[0] || null }))}
                />
                {docFiles.passport && <p className="text-[11px] text-emerald-700 mt-1 truncate">{docFiles.passport.name}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-borderColor bg-white p-4 sm:p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">{t('admin.walkIn.options')}</h2>
            <div>
              <label className="text-xs text-gray-500">{t('admin.walkIn.initialStatus')}</label>
              <select className={input} value={form.status} onChange={(e) => setField('status', e.target.value)}>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="ready_for_pickup">Ready for pickup</option>
                <option value="active">Active (out)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.markPaid} onChange={(e) => setField('markPaid', e.target.checked)} />
              {t('admin.walkIn.markPaid')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.sendCompletionLink}
                onChange={(e) => setField('sendCompletionLink', e.target.checked)}
                disabled={!form.email}
              />
              {t('admin.walkIn.sendLink')}
            </label>
            <p className="text-xs text-gray-400">{t('admin.walkIn.sendLinkHint')}</p>
          </div>

          <div className="rounded-xl border border-borderColor bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">{t('admin.walkIn.estimate')}</h2>
            {quote ? (
              <ul className="text-sm space-y-1.5 text-gray-600">
                <li className="flex justify-between"><span>{t('admin.walkIn.days', { count: quote.days })}</span><span>{currency}{quote.rental}</span></li>
                {quote.pickupFee > 0 && <li className="flex justify-between"><span>Pickup fee</span><span>{currency}{quote.pickupFee}</span></li>}
                {quote.dropoffFee > 0 && <li className="flex justify-between"><span>Return fee</span><span>{currency}{quote.dropoffFee}</span></li>}
                {(quote.discount || 0) > 0 && (
                  <li className="flex justify-between text-emerald-700">
                    <span>{t('admin.bookings.discounts')}</span>
                    <span>−{currency}{quote.discount}</span>
                  </li>
                )}
                {form.franchiseAmount !== '' && (
                  <li className="flex justify-between"><span>{t('admin.walkIn.franchise')}</span><span>{currency}{form.franchiseAmount}</span></li>
                )}
                <li className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-borderColor">
                  <span>{t('admin.walkIn.total')}</span>
                  <span>{currency}{quote.total}</span>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-gray-400">{t('admin.walkIn.estimateHint')}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="mt-5 w-full bg-primary hover:bg-primary-dull text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {saving ? t('admin.walkIn.saving') : t('admin.walkIn.submit')}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default WalkInBooking
