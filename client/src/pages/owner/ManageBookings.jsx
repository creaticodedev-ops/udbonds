import React, { useEffect, useMemo, useState } from 'react'
import Title from '../../components/owner/Title'
import ChannelBadge from '../../components/owner/ChannelBadge'
import BookingRowActions from '../../components/owner/BookingRowActions'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import toast from 'react-hot-toast'
import { escapeHtml, getErrorMessage } from '../../utils/apiError'
import PhoneInput, { isPhoneValid } from '../../components/PhoneInput'
import { Link } from 'react-router-dom'
import { buildOwnerCompletionWaUrl, buildWaMeUrl } from '../../utils/whatsapp'

const emptyFilters = {
  customerName: '',
  phone: '',
  email: '',
  reservationId: '',
  vehicle: '',
  licensePlate: '',
  status: '',
  paymentStatus: '',
  channel: '',
  pickupLocation: '',
  pickupDateFrom: '',
  pickupDateTo: '',
}

const emptyEdit = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  pickupDate: '',
  returnDate: '',
  pickupLocation: '',
  returnLocation: '',
  notes: '',
  status: 'pending',
  paymentStatus: 'pending',
  carId: '',
}

const toInputDateTime = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  return isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

const statusClass = (status) => {
  if (status === 'confirmed') return 'bg-green-100 text-green-600'
  if (status === 'ready_for_pickup') return 'bg-emerald-100 text-emerald-700'
  if (status === 'active') return 'bg-blue-100 text-blue-600'
  if (status === 'completed') return 'bg-purple-100 text-purple-600'
  if (status === 'cancelled') return 'bg-red-100 text-red-600'
  return 'bg-yellow-100 text-yellow-700'
}

const ManageBookings = () => {
  const { currency, axios, hasPermission } = useAppContext()
  const { t } = useI18n()

  const [bookings, setBookings] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 })
  const [filters, setFilters] = useState(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(emptyEdit)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [fleetCars, setFleetCars] = useState([])
  const [assigningVehicle, setAssigningVehicle] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState('')
  const [identityType, setIdentityType] = useState('national_id')
  const [completionLinkCache, setCompletionLinkCache] = useState({})
  const [openingWhatsApp, setOpeningWhatsApp] = useState(false)
  const [whatsappDials, setWhatsappDials] = useState({
    reservationDial: '',
    confirmationDial: '',
  })

  const resolveCompletionUrl = (booking) =>
    booking?.completion?.shareableCompletionUrl ||
    booking?.completion?.completionUrl ||
    completionLinkCache[booking?._id] ||
    ''

  const cacheCompletionUrl = (bookingId, url) => {
    if (!bookingId || !url) return
    setCompletionLinkCache((prev) => ({ ...prev, [bookingId]: url }))
  }

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    params.set('page', String(pagination.page))
    params.set('limit', String(pagination.limit))
    params.set('sortBy', 'createdAt')
    params.set('sortOrder', 'desc')
    return params.toString()
  }, [appliedFilters, pagination.page, pagination.limit])

  const fetchOwnerBookings = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`/api/bookings/owner?${queryString}`)
      if (data.success) {
        setBookings(data.bookings)
        setPagination((prev) => ({ ...prev, ...data.pagination }))
        if (selectedBooking) {
          const refreshed = data.bookings.find((b) => b._id === selectedBooking._id)
          if (refreshed) setSelectedBooking(refreshed)
        }
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOwnerBookings()
  }, [queryString])

  useEffect(() => {
    axios.get('/api/owner/cars')
      .then(({ data }) => { if (data.success) setFleetCars(data.cars || []) })
      .catch(() => {})
  }, [axios])

  useEffect(() => {
    axios
      .get('/api/owner/settings')
      .then(({ data }) => {
        if (data.success) {
          setWhatsappDials({
            reservationDial: data.settings?.effective?.reservationDial || '',
            confirmationDial: data.settings?.effective?.confirmationDial || '',
          })
        }
      })
      .catch(() => {})
  }, [axios])

  const compatibleVehicles = useMemo(() => {
    if (!selectedBooking?.car) return []
    const brand = selectedBooking.car.brand
    const model = selectedBooking.car.model
    return fleetCars.filter(
      (c) => c.brand === brand && c.model === model && c.status !== 'maintenance' && c.isAvaliable !== false,
    )
  }, [fleetCars, selectedBooking])

  const editVehicleOptions = useMemo(() => {
    if (!editing?.car) return []
    const brand = editing.car.brand
    const model = editing.car.model
    return fleetCars.filter(
      (c) => c.brand === brand && c.model === model && c.status !== 'maintenance' && c.isAvaliable !== false,
    )
  }, [fleetCars, editing])

  const applyFilters = (e) => {
    e?.preventDefault()
    setPagination((prev) => ({ ...prev, page: 1 }))
    setAppliedFilters({ ...filters })
  }

  const clearFilters = () => {
    setFilters(emptyFilters)
    setAppliedFilters(emptyFilters)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const changeBookingStatus = async (bookingId, status) => {
    try {
      const { data } = await axios.post('/api/bookings/change-status', { bookingId, status })
      if (data.success) {
        if (status === 'confirmed') {
          if (data.completion?.completionUrl) {
            cacheCompletionUrl(bookingId, data.completion.completionUrl)
          }
          if (data.completion?.emailSent) {
            toast.success(data.message)
          } else {
            toast.error(data.message, { duration: 8000 })
            if (data.completion?.completionUrl) {
              try {
                await navigator.clipboard.writeText(data.completion.completionUrl)
                toast.success(t('admin.bookings.linkCopied'))
              } catch { /* ignore */ }
            }
          }
        } else {
          toast.success(data.message)
        }
        fetchOwnerBookings()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const resendCompletionLink = async (bookingId) => {
    try {
      const { data } = await axios.post('/api/booking-completion/owner/resend-link', { bookingId })
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message || t('admin.bookings.emailFailed'), { duration: 8000 })
      }
      if (data.completionUrl) {
        cacheCompletionUrl(bookingId, data.completionUrl)
        try {
          await navigator.clipboard.writeText(data.completionUrl)
          toast.success(t('admin.bookings.linkCopied'))
        } catch { /* ignore */ }
      }
      fetchOwnerBookings()
    } catch (error) {
      toast.error(getErrorMessage(error), { duration: 8000 })
    }
  }

  const ensureCompletionLinkPayload = async (booking) => {
    const bookingId = booking._id
    const tryEnsure = async (url) => {
      const { data } = await axios.post(url, { bookingId })
      return data
    }

    let data
    try {
      data = await tryEnsure('/api/booking-completion/owner/ensure-link')
    } catch (err) {
      if (err.response?.status === 404) {
        data = await tryEnsure('/api/bookings/owner/completion/ensure-link')
      } else {
        throw err
      }
    }

    const url = data.shareableCompletionUrl || data.completionUrl
    if (!data.success || !url) {
      throw new Error(data.message || t('admin.bookings.noCompletionLink'))
    }
    cacheCompletionUrl(bookingId, url)
    return data
  }

  const ensureCompletionUrl = async (booking) => {
    const cached = resolveCompletionUrl(booking)
    if (cached) return cached
    const data = await ensureCompletionLinkPayload(booking)
    return data.shareableCompletionUrl || data.completionUrl
  }

  const openCompletionWaMe = (booking, completionUrl, dial) => {
    const url = buildOwnerCompletionWaUrl(booking, completionUrl, {
      currency,
      dial: dial || whatsappDials.confirmationDial,
    })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  /** Ensures completion link exists, then opens wa.me (no WhatsApp send API). */
  const confirmViaWhatsApp = async (booking) => {
    if (!booking?._id) return
    setOpeningWhatsApp(true)
    try {
      const data = await ensureCompletionLinkPayload(booking)
      const completionUrl = data.shareableCompletionUrl || data.completionUrl
      if (data.whatsappConfirmationUrl) {
        window.open(data.whatsappConfirmationUrl, '_blank', 'noopener,noreferrer')
      } else {
        openCompletionWaMe(
          booking,
          completionUrl,
          data.whatsappConfirmationDial || whatsappDials.confirmationDial,
        )
      }
      fetchOwnerBookings()
    } catch (error) {
      toast.error(getErrorMessage(error), { duration: 8000 })
    } finally {
      setOpeningWhatsApp(false)
    }
  }

  const changePaymentStatus = async (bookingId, paymentStatus) => {
    try {
      const { data } = await axios.post('/api/bookings/change-payment-status', { bookingId, paymentStatus })
      if (data.success) {
        toast.success(data.message)
        fetchOwnerBookings()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const startEdit = (booking) => {
    setEditing(booking)
    setEditForm({
      customerName: booking.customerName || '',
      customerEmail: booking.customerEmail || '',
      customerPhone: booking.customerPhone || '',
      pickupDate: toInputDateTime(booking.pickupDate),
      returnDate: toInputDateTime(booking.returnDate),
      pickupLocation: booking.pickupLocation || '',
      returnLocation: booking.returnLocation || '',
      notes: booking.notes || '',
      status: booking.status || 'pending',
      paymentStatus: booking.paymentStatus || 'pending',
      carId: booking.car?._id || booking.car || '',
    })
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!isPhoneValid(editForm.customerPhone)) {
      toast.error(t('admin.bookings.invalidPhone'))
      return
    }
    try {
      const { data } = await axios.post('/api/bookings/update', {
        bookingId: editing._id,
        ...editForm,
      })
      if (data.success) {
        toast.success(data.message)
        setEditing(null)
        fetchOwnerBookings()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const deleteBooking = async (bookingId) => {
    if (!window.confirm('Delete this reservation permanently?')) return
    try {
      const { data } = await axios.post('/api/bookings/delete', { bookingId })
      if (data.success) {
        toast.success(data.message)
        if (selectedBooking?._id === bookingId) setSelectedBooking(null)
        fetchOwnerBookings()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const downloadDocument = async (bookingId, docType) => {
    try {
      const { data } = await axios.get(`/api/bookings/owner/${bookingId}/documents/${docType}`)
      if (data.success && data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      } else {
        toast.error(data.message || t('admin.bookings.documentMissing'))
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const uploadDocument = async (bookingId, file, docType) => {
    if (!file) return
    setUploadingDoc(docType)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('docType', docType)
      if (docType === 'identity') formData.append('identityType', identityType)

      const { data } = await axios.post(`/api/bookings/owner/${bookingId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (data.success) {
        toast.success(data.message)
        fetchOwnerBookings()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setUploadingDoc('')
    }
  }

  const assignVehicle = async (bookingId, carId) => {
    if (!carId) return
    setAssigningVehicle(true)
    try {
      const { data } = await axios.post('/api/bookings/assign-vehicle', { bookingId, carId })
      if (data.success) {
        toast.success(data.message)
        setSelectedBooking(data.booking)
        fetchOwnerBookings()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setAssigningVehicle(false)
    }
  }

  const generateInvoiceForBooking = async (booking) => {
    try {
      const { data } = await axios.post('/api/invoices/generate', {
        bookingId: booking._id,
        includeCompanyStamp: true,
      })
      if (data.success) {
        toast.success(data.message)
        if (data.invoice?.pdfUrl) {
          window.open(data.invoice.pdfUrl, '_blank', 'noopener,noreferrer')
        }
        fetchOwnerBookings()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const openWhatsApp = (booking) => {
    const vehicle = booking.car
      ? `${booking.car.brand} ${booking.car.model}`
      : '—'
    const text = [
      'Hello, regarding this reservation:',
      '',
      `ID: ${booking.reservationId || '—'}`,
      `Customer: ${booking.customerName || '—'}`,
      `Phone: ${booking.customerPhone || '—'}`,
      `Vehicle: ${vehicle}`,
      `Status: ${booking.status || '—'}`,
    ].join('\n')
    window.open(
      buildWaMeUrl(text, whatsappDials.confirmationDial || whatsappDials.reservationDial),
      '_blank',
      'noopener,noreferrer',
    )
  }

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams()
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params.set(key, value)
      })
      const response = await axios.get(`/api/bookings/owner/export?${params.toString()}`, {
        responseType: 'blob',
      })
      const contentType = response.headers['content-type'] || ''
      if (contentType.includes('application/json')) {
        const text = await response.data.text()
        const json = JSON.parse(text)
        toast.error(json.message || 'Export failed')
        return
      }
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `reservations-${Date.now()}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const printBooking = (booking) => {
    const reservationId = booking.reservationId || `RES-${booking._id?.toString().slice(-8).toUpperCase()}`
    const vehicle = booking.car ? `${booking.car.brand} ${booking.car.model}` : '-'
    const html = `
      <html>
        <head>
          <title>Reservation ${escapeHtml(reservationId)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
            h1 { margin-bottom: 4px; }
            .muted { color: #666; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 8px 4px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
            td:first-child { font-weight: 600; width: 40%; color: #374151; }
          </style>
        </head>
        <body>
          <h1>Reservation ${escapeHtml(reservationId)}</h1>
          <p class="muted">Printed ${escapeHtml(new Date().toLocaleString())}</p>
          <table>
            <tr><td>Customer</td><td>${escapeHtml(booking.customerName || '-')}</td></tr>
            <tr><td>Phone</td><td>${escapeHtml(booking.customerPhone || '-')}</td></tr>
            <tr><td>Email</td><td>${escapeHtml(booking.customerEmail || '-')}</td></tr>
            <tr><td>Vehicle</td><td>${escapeHtml(vehicle)}</td></tr>
            <tr><td>Pickup Location</td><td>${escapeHtml(booking.pickupLocation || '-')}</td></tr>
            <tr><td>Drop-off Location</td><td>${escapeHtml(booking.returnLocation || '-')}</td></tr>
            <tr><td>Pickup</td><td>${escapeHtml(formatDateTime(booking.pickupDate))}</td></tr>
            <tr><td>Return</td><td>${escapeHtml(formatDateTime(booking.returnDate))}</td></tr>
            <tr><td>Status</td><td>${escapeHtml(booking.status)}</td></tr>
            <tr><td>Payment</td><td>${escapeHtml(booking.paymentStatus)}</td></tr>
            <tr><td>Total</td><td>${escapeHtml(String(currency))}${escapeHtml(String(booking.price))}</td></tr>
            <tr><td>Notes</td><td>${escapeHtml(booking.notes || '-')}</td></tr>
          </table>
          <script>window.onload = () => { window.print(); }</script>
        </body>
      </html>
    `
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) {
      toast.error('Please allow pop-ups to print')
      return
    }
    win.document.write(html)
    win.document.close()
  }

  const inputClass = 'border border-borderColor rounded-md px-3 py-2 text-sm outline-none focus:border-primary w-full'
  const labelClass = 'text-xs font-medium text-gray-500 mb-1 block'

  return (
    <div className='px-4 pt-8 md:px-8 lg:px-10 xl:px-12 md:pt-10 w-full pb-16 min-w-0'>
      <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
        <Title title={t('admin.bookings.title')} subTitle={t('admin.bookings.subtitle')} />
        <div className='flex flex-wrap gap-2'>
          <Link to="/owner/walk-in" className='px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700'>
            {t('admin.walkIn.menu')}
          </Link>
          <button type="button" onClick={() => setShowFilters((v) => !v)} className='px-4 py-2 text-sm border border-borderColor rounded-lg hover:bg-gray-50 cursor-pointer'>
            {showFilters ? t('admin.bookings.hideFilters') : t('admin.bookings.showFilters')}
          </button>
          <button type="button" onClick={exportCsv} className='px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dull cursor-pointer'>
            {t('admin.bookings.exportCsv')}
          </button>
        </div>
      </div>

      {showFilters && (
        <form onSubmit={applyFilters} className='mt-6 rounded-xl border border-borderColor bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'>
          <div>
            <label className={labelClass}>{t('admin.bookings.customerName')}</label>
            <input className={inputClass} value={filters.customerName} onChange={(e) => setFilters({ ...filters, customerName: e.target.value })} placeholder="Name" />
          </div>
          <div>
            <label className={labelClass}>{t('admin.bookings.phone')}</label>
            <input className={inputClass} value={filters.phone} onChange={(e) => setFilters({ ...filters, phone: e.target.value })} placeholder="Phone" />
          </div>
          <div>
            <label className={labelClass}>{t('admin.bookings.email')}</label>
            <input className={inputClass} value={filters.email} onChange={(e) => setFilters({ ...filters, email: e.target.value })} placeholder="Email" />
          </div>
          <div>
            <label className={labelClass}>{t('admin.bookings.reservationId')}</label>
            <input className={inputClass} value={filters.reservationId} onChange={(e) => setFilters({ ...filters, reservationId: e.target.value })} placeholder="RES-XXXXXXXX" />
          </div>
          <div>
            <label className={labelClass}>{t('admin.bookings.vehicle')}</label>
            <input className={inputClass} value={filters.vehicle} onChange={(e) => setFilters({ ...filters, vehicle: e.target.value })} placeholder="Brand or model" />
          </div>
          <div>
            <label className={labelClass}>{t('admin.bookings.licensePlate')}</label>
            <input className={inputClass} value={filters.licensePlate} onChange={(e) => setFilters({ ...filters, licensePlate: e.target.value })} placeholder={t('admin.bookings.licensePlatePlaceholder')} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.bookings.status')}</label>
            <select className={inputClass} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="ready_for_pickup">Ready for Pickup</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('admin.bookings.paymentStatus')}</label>
            <select className={inputClass} value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}>
              <option value="">All payments</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('admin.bookings.channel')}</label>
            <select className={inputClass} value={filters.channel} onChange={(e) => setFilters({ ...filters, channel: e.target.value })}>
              <option value="">All channels</option>
              <option value="online">Online</option>
              <option value="walk_in">Walk-in</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('admin.bookings.pickupLocation')}</label>
            <input className={inputClass} value={filters.pickupLocation} onChange={(e) => setFilters({ ...filters, pickupLocation: e.target.value })} placeholder="Location" />
          </div>
          <div>
            <label className={labelClass}>{t('admin.bookings.pickupFrom')}</label>
            <input type="date" className={inputClass} value={filters.pickupDateFrom} onChange={(e) => setFilters({ ...filters, pickupDateFrom: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.bookings.pickupTo')}</label>
            <input type="date" className={inputClass} value={filters.pickupDateTo} onChange={(e) => setFilters({ ...filters, pickupDateTo: e.target.value })} />
          </div>
          <div className='sm:col-span-2 lg:col-span-3 xl:col-span-4 flex flex-wrap gap-2 pt-1'>
            <button type="submit" className='px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dull cursor-pointer'>{t('admin.bookings.applyFilters')}</button>
            <button type="button" onClick={clearFilters} className='px-4 py-2 text-sm border border-borderColor rounded-lg hover:bg-gray-50 cursor-pointer'>{t('admin.bookings.clear')}</button>
            <span className='text-sm text-gray-500 self-center ml-auto'>
              {pagination.total === 1
                ? t('admin.bookings.count', { count: pagination.total })
                : t('admin.bookings.count_plural', { count: pagination.total })}
            </span>
          </div>
        </form>
      )}

      <div className='mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.95fr]'>
        <div className='w-full rounded-xl overflow-hidden border border-borderColor bg-white'>
          <div className='table-scroll'>
            <table className='w-full border-collapse text-left text-sm text-gray-600 max-lg:min-w-[640px]'>
              <thead className='text-gray-500 bg-gray-50'>
                <tr>
                  <th className="p-3 font-medium">{t('admin.bookings.reservation')}</th>
                  <th className="p-3 font-medium">{t('admin.bookings.customer')}</th>
                  <th className="p-3 font-medium max-md:hidden">{t('admin.bookings.dates')}</th>
                  <th className="p-3 font-medium">{t('admin.bookings.total')}</th>
                  <th className="p-3 font-medium">{t('admin.bookings.status')}</th>
                  <th className="p-3 font-medium text-right w-[1%] whitespace-nowrap">{t('admin.bookings.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className='p-6 text-center text-gray-400'>{t('admin.bookings.loading')}</td></tr>
                ) : bookings.length === 0 ? (
                  <tr><td colSpan="6" className='p-6 text-center text-gray-400'>{t('admin.bookings.none')}</td></tr>
                ) : bookings.map((booking) => (
                  <tr key={booking._id} className='border-t border-borderColor hover:bg-gray-50/60'>
                    <td className='p-3'>
                      <button type="button" onClick={() => setSelectedBooking(booking)} className='text-left cursor-pointer'>
                        <p className='font-medium text-primary'>{booking.reservationId || `RES-${booking._id.toString().slice(-8).toUpperCase()}`}</p>
                        <p className='text-xs text-gray-500'>{booking.car?.brand} {booking.car?.model}</p>
                        {booking.car?.licensePlate && (
                          <p className='text-[10px] text-gray-400'>{booking.car.licensePlate}</p>
                        )}
                        <ChannelBadge channel={booking.channel || 'online'} className="mt-1" />
                      </button>
                    </td>
                    <td className='p-3'>
                      <p className='font-medium text-gray-700'>{booking.customerName || t('admin.common.guest')}</p>
                      <p className='text-xs'>{booking.customerPhone || '-'}</p>
                    </td>
                    <td className='p-3 max-md:hidden text-xs'>
                      {formatDateTime(booking.pickupDate)}
                      <br />to {formatDateTime(booking.returnDate)}
                    </td>
                    <td className='p-3'>{currency}{booking.price}</td>
                    <td className='p-3'>
                      <select
                        onChange={(e) => changeBookingStatus(booking._id, e.target.value)}
                        value={booking.status}
                        className='px-2 py-1.5 text-xs border border-borderColor rounded-md outline-none'
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="ready_for_pickup">Ready for Pickup</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <p className='text-[11px] mt-1 capitalize text-gray-400'>
                        Pay: {booking.paymentStatus}
                      </p>
                    </td>
                    <td className='p-2 sm:p-3 text-right align-middle'>
                      <BookingRowActions
                        t={t}
                        onView={() => setSelectedBooking(booking)}
                        onEdit={() => startEdit(booking)}
                        onDownloadLicense={() => downloadDocument(booking._id, 'driving_license')}
                        onDownloadId={() => downloadDocument(booking._id, 'identity')}
                        onDownloadPassport={() => downloadDocument(booking._id, 'passport')}
                        onWhatsApp={() => openWhatsApp(booking)}
                        onPrint={() => printBooking(booking)}
                        onDelete={() => deleteBooking(booking._id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className='flex items-center justify-between px-4 py-3 border-t border-borderColor text-sm'>
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className='px-3 py-1.5 border rounded-lg disabled:opacity-40 cursor-pointer'
              >
                {t('admin.bookings.previous')}
              </button>
              <span>{t('admin.bookings.pageOf', { page: pagination.page, total: pagination.totalPages })}</span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                className='px-3 py-1.5 border rounded-lg disabled:opacity-40 cursor-pointer'
              >
                {t('admin.bookings.next')}
              </button>
            </div>
          )}
        </div>

        {selectedBooking ? (
          <div className='rounded-xl border border-borderColor bg-white p-5 text-sm text-gray-600 h-max xl:sticky xl:top-24 min-w-0'>
            <div className='flex items-start justify-between gap-3'>
              <div className="min-w-0">
                <h2 className='text-lg font-semibold text-gray-800'>{t('admin.bookings.details')}</h2>
                <p className='text-primary font-medium mt-1 break-all'>
                  {selectedBooking.reservationId || `RES-${selectedBooking._id.toString().slice(-8).toUpperCase()}`}
                </p>
                <ChannelBadge channel={selectedBooking.channel || 'online'} className="mt-2" />
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize shrink-0 ${statusClass(selectedBooking.status)}`}>
                {selectedBooking.status}
              </span>
            </div>

            <div className='mt-4 space-y-2 break-words'>
              <p><span className='font-medium'>{t('admin.bookings.customer')}:</span> {selectedBooking.customerName || '-'}</p>
              <p><span className='font-medium'>{t('admin.bookings.email')}:</span> {selectedBooking.customerEmail || '-'}</p>
              <p><span className='font-medium'>{t('admin.bookings.phone')}:</span> {selectedBooking.customerPhone || '-'}</p>
              <p><span className='font-medium'>{t('admin.bookings.vehicle')}:</span> {selectedBooking.car?.brand} {selectedBooking.car?.model}</p>
              {selectedBooking.car?.licensePlate && (
                <p><span className='font-medium'>{t('admin.bookings.licensePlate')}:</span> {selectedBooking.car.licensePlate}</p>
              )}
              {compatibleVehicles.length > 0 && (
                <div className='rounded-lg border border-borderColor bg-gray-50 p-3'>
                  <label className={labelClass}>{t('admin.bookings.assignVehicle')}</label>
                  <select
                    className={inputClass}
                    disabled={assigningVehicle}
                    value={selectedBooking.car?._id || ''}
                    onChange={(e) => assignVehicle(selectedBooking._id, e.target.value)}
                  >
                    {compatibleVehicles.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.licensePlate || c.fleetId || c._id.slice(-6)} — {c.brand} {c.model}
                      </option>
                    ))}
                  </select>
                  <p className='mt-2 text-[11px] text-gray-500'>Same-model vehicles available for the selected dates are shown.</p>
                </div>
              )}
              <p><span className='font-medium'>Pickup:</span> {formatDateTime(selectedBooking.pickupDate)}</p>
              <p><span className='font-medium'>Return:</span> {formatDateTime(selectedBooking.returnDate)}</p>
              <p><span className='font-medium'>{t('admin.bookings.pickupLocation')}:</span> {selectedBooking.pickupLocation || '-'}</p>
              <p><span className='font-medium'>Drop-off Location:</span> {selectedBooking.returnLocation || '-'}</p>
              <p><span className='font-medium'>{t('admin.bookings.paymentStatus')}:</span> {selectedBooking.paymentStatus}</p>
              {selectedBooking.priceBreakdown ? (
                <div className='rounded-lg border border-borderColor bg-gray-50 px-3 py-2 space-y-1 text-sm'>
                  <p className='text-xs uppercase text-gray-400 font-medium'>{t('admin.bookings.priceBreakdown')}</p>
                  <p className='flex justify-between gap-2'><span>{t('admin.bookings.rentalPrice')}</span><span>{currency}{selectedBooking.priceBreakdown.rentalPrice ?? 0}</span></p>
                  <p className='flex justify-between gap-2'><span>{t('admin.bookings.pickupFee')}</span><span>{(selectedBooking.priceBreakdown.pickupDeliveryFee || 0) <= 0 ? t('admin.bookings.free') : `${currency}${selectedBooking.priceBreakdown.pickupDeliveryFee}`}</span></p>
                  <p className='flex justify-between gap-2'><span>{t('admin.bookings.dropoffFee')}</span><span>{(selectedBooking.priceBreakdown.dropoffDeliveryFee || 0) <= 0 ? t('admin.bookings.free') : `${currency}${selectedBooking.priceBreakdown.dropoffDeliveryFee}`}</span></p>
                  {(selectedBooking.priceBreakdown.discountTotal || 0) > 0 && (
                    <p className='flex justify-between gap-2 text-green-700'><span>{t('admin.bookings.discounts')}</span><span>−{currency}{selectedBooking.priceBreakdown.discountTotal}</span></p>
                  )}
                  <p className='flex justify-between gap-2 font-semibold border-t border-borderColor pt-1'><span>{t('admin.bookings.total')}</span><span>{currency}{selectedBooking.price}</span></p>
                </div>
              ) : (
                <p><span className='font-medium'>{t('admin.bookings.total')}:</span> {currency}{selectedBooking.price}</p>
              )}
              <p><span className='font-medium'>Notes:</span> {selectedBooking.notes || 'No notes'}</p>
            </div>

            <div className='mt-5 grid grid-cols-2 gap-2'>
              <button onClick={() => changeBookingStatus(selectedBooking._id, 'confirmed')} className='px-3 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-medium cursor-pointer'>{t('admin.bookings.confirm')}</button>
              <button onClick={() => changeBookingStatus(selectedBooking._id, 'cancelled')} className='px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-medium cursor-pointer'>{t('admin.bookings.cancel')}</button>
              <button onClick={() => changeBookingStatus(selectedBooking._id, 'completed')} className='px-3 py-2 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium cursor-pointer'>{t('admin.bookings.complete')}</button>
              <button onClick={() => changeBookingStatus(selectedBooking._id, 'active')} className='px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium cursor-pointer'>{t('admin.bookings.markActive')}</button>
              {(selectedBooking.status === 'confirmed' || selectedBooking.status === 'pending') && (
                <button
                  onClick={() => resendCompletionLink(selectedBooking._id)}
                  className='col-span-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-xs font-medium cursor-pointer'
                >
                  {t('admin.bookings.resendLink')}
                </button>
              )}
              {(selectedBooking.status === 'confirmed' || selectedBooking.status === 'pending') && (
                <button
                  type="button"
                  disabled={openingWhatsApp}
                  onClick={() => confirmViaWhatsApp(selectedBooking)}
                  className='col-span-2 px-3 py-2 rounded-lg bg-green-50 text-green-800 text-xs font-medium cursor-pointer disabled:opacity-50'
                >
                  {openingWhatsApp ? '…' : t('admin.bookings.confirmViaWhatsApp')}
                </button>
              )}
              {hasPermission('contracts') && selectedBooking.status !== 'cancelled' && (
                <>
                  <button
                    type="button"
                    onClick={() => generateInvoiceForBooking(selectedBooking)}
                    className='col-span-2 px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium cursor-pointer'
                  >
                    {t('admin.bookings.generateInvoice')}
                  </button>
                  <Link
                    to={`/owner/contracts?bookingId=${selectedBooking._id}`}
                    className='col-span-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium text-center hover:bg-primary/15'
                  >
                    {t('admin.bookings.generateContract')}
                  </Link>
                </>
              )}
            </div>

            {selectedBooking.completion && (
              <div className='mt-4 rounded-lg border border-borderColor bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-1'>
                <p className='font-medium text-gray-800'>{t('admin.bookings.completionProgress')}</p>
                <p>{t('admin.bookings.docs')}: {selectedBooking.completion.documentsComplete ? '✓' : '—'}</p>
                <p>{t('admin.bookings.pay')}: {selectedBooking.completion.paymentComplete ? '✓' : '—'}</p>
                <p>{t('admin.bookings.sign')}: {selectedBooking.completion.signatureComplete ? '✓' : '—'}</p>
              </div>
            )}

            <div className='mt-4 rounded-lg border border-borderColor bg-gray-50 px-3 py-3 space-y-2'>
              <p className='font-medium text-gray-800 text-xs'>{t('admin.bookings.uploadDocuments')}</p>
              <div className='flex flex-wrap gap-2'>
                <button
                  type="button"
                  onClick={() => downloadDocument(selectedBooking._id, 'driving_license')}
                  className='px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50'
                >
                  ↓ {t('admin.bookings.downloadLicense')}
                </button>
                <button
                  type="button"
                  onClick={() => downloadDocument(selectedBooking._id, 'identity')}
                  className='px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50'
                >
                  ↓ {t('admin.bookings.downloadId')}
                </button>
                <button
                  type="button"
                  onClick={() => downloadDocument(selectedBooking._id, 'passport')}
                  className='px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50'
                >
                  ↓ {t('admin.bookings.downloadPassport')}
                </button>
              </div>
              <div className='grid gap-2 pt-1'>
                <label className='text-xs text-gray-500'>{t('admin.bookings.uploadLicense')}</label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingDoc === 'driving_license'}
                  onChange={(e) => {
                    uploadDocument(selectedBooking._id, e.target.files?.[0], 'driving_license')
                    e.target.value = ''
                  }}
                  className='text-xs'
                />
                <div className='flex flex-wrap items-center gap-2'>
                  <select
                    className='border border-borderColor rounded px-2 py-1 text-xs'
                    value={identityType}
                    onChange={(e) => setIdentityType(e.target.value)}
                  >
                    <option value="national_id">{t('admin.bookings.nationalId')}</option>
                    <option value="passport">{t('admin.bookings.passport')}</option>
                  </select>
                  <label className='text-xs text-gray-500'>{t('admin.bookings.uploadIdentity')}</label>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingDoc === 'identity'}
                  onChange={(e) => {
                    uploadDocument(selectedBooking._id, e.target.files?.[0], 'identity')
                    e.target.value = ''
                  }}
                  className='text-xs'
                />
                <label className='text-xs text-gray-500'>{t('admin.bookings.downloadPassport')} (upload)</label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingDoc === 'passport'}
                  onChange={(e) => {
                    uploadDocument(selectedBooking._id, e.target.files?.[0], 'passport')
                    e.target.value = ''
                  }}
                  className='text-xs'
                />
              </div>
            </div>

            <div className='mt-3'>
              <label className={labelClass}>{t('admin.bookings.paymentStatus')}</label>
              <select
                className={inputClass}
                value={selectedBooking.paymentStatus || 'pending'}
                onChange={(e) => changePaymentStatus(selectedBooking._id, e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <div className='mt-4 flex flex-wrap gap-2'>
              <button onClick={() => startEdit(selectedBooking)} className='px-3 py-2 text-xs border rounded-lg cursor-pointer'>{t('admin.bookings.edit')}</button>
              <button onClick={() => openWhatsApp(selectedBooking)} className='px-3 py-2 text-xs border border-green-200 text-green-700 rounded-lg cursor-pointer'>{t('admin.bookings.whatsapp')}</button>
              <button onClick={() => printBooking(selectedBooking)} className='px-3 py-2 text-xs border rounded-lg cursor-pointer'>{t('admin.bookings.print')}</button>
              <button onClick={() => deleteBooking(selectedBooking._id)} className='px-3 py-2 text-xs border border-red-200 text-red-600 rounded-lg cursor-pointer'>{t('admin.bookings.delete')}</button>
            </div>
          </div>
        ) : (
          <div className='rounded-xl border border-dashed border-borderColor bg-white p-8 text-center text-gray-400 h-max'>
            {t('admin.bookings.selectHint')}
          </div>
        )}
      </div>

      {editing && (
        <div className='fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4' onClick={() => setEditing(null)}>
          <form
            onSubmit={saveEdit}
            onClick={(e) => e.stopPropagation()}
            className='bg-white rounded-t-2xl sm:rounded-xl w-full max-w-2xl max-h-[92svh] overflow-y-auto p-5 sm:p-6 space-y-3'
          >
            <h3 className='text-lg font-semibold text-gray-800'>{t('admin.bookings.edit')} {t('admin.bookings.reservation')}</h3>
            <p className='text-sm text-primary'>{editing.reservationId}</p>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div>
                <label className={labelClass}>{t('admin.bookings.customerName')}</label>
                <input className={inputClass} value={editForm.customerName} onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })} required />
              </div>
              <div>
                <label className={labelClass}>{t('admin.bookings.phone')}</label>
                <PhoneInput value={editForm.customerPhone} onChange={(customerPhone) => setEditForm({ ...editForm, customerPhone })} required />
              </div>
              <div>
                <label className={labelClass}>{t('admin.bookings.email')}</label>
                <input type="email" className={inputClass} value={editForm.customerEmail} onChange={(e) => setEditForm({ ...editForm, customerEmail: e.target.value })} required />
              </div>
              <div>
                <label className={labelClass}>{t('admin.bookings.status')}</label>
                <select className={inputClass} value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="ready_for_pickup">Ready for Pickup</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Pickup Date & Time</label>
                <input type="datetime-local" className={inputClass} value={editForm.pickupDate} onChange={(e) => setEditForm({ ...editForm, pickupDate: e.target.value })} required />
              </div>
              <div>
                <label className={labelClass}>Return Date & Time</label>
                <input type="datetime-local" className={inputClass} value={editForm.returnDate} onChange={(e) => setEditForm({ ...editForm, returnDate: e.target.value })} required />
              </div>
              <div>
                <label className={labelClass}>{t('admin.bookings.pickupLocation')}</label>
                <input className={inputClass} value={editForm.pickupLocation} onChange={(e) => setEditForm({ ...editForm, pickupLocation: e.target.value })} required />
              </div>
              <div>
                <label className={labelClass}>Drop-off Location</label>
                <input className={inputClass} value={editForm.returnLocation} onChange={(e) => setEditForm({ ...editForm, returnLocation: e.target.value })} required />
              </div>
              <div>
                <label className={labelClass}>{t('admin.bookings.paymentStatus')}</label>
                <select className={inputClass} value={editForm.paymentStatus} onChange={(e) => setEditForm({ ...editForm, paymentStatus: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <div className='sm:col-span-2'>
                <label className={labelClass}>{t('admin.bookings.assignVehicle')}</label>
                <select className={inputClass} value={editForm.carId} onChange={(e) => setEditForm({ ...editForm, carId: e.target.value })}>
                  {editVehicleOptions.length === 0 ? (
                    <option value="">No compatible vehicle available</option>
                  ) : (
                    editVehicleOptions.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.licensePlate || c.fleetId || c._id.slice(-6)} — {c.brand} {c.model}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className='sm:col-span-2'>
                <label className={labelClass}>Notes</label>
                <textarea className={inputClass} rows="3" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>
            </div>

            <div className='flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2'>
              <button type="button" onClick={() => setEditing(null)} className='px-4 py-2.5 text-sm border rounded-lg cursor-pointer'>{t('admin.common.cancel')}</button>
              <button type="submit" className='px-4 py-2.5 text-sm bg-primary text-white rounded-lg cursor-pointer'>{t('admin.common.save')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default ManageBookings
