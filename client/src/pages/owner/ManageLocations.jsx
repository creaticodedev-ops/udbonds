import React, { useEffect, useRef, useState } from 'react'
import Title from '../../components/owner/Title'
import { assets } from '../../assets/assets'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../utils/apiError'

const emptyForm = {
  name: '',
  city: '',
  address: '',
  googleMapsLink: '',
  locationType: 'custom',
  deliveryFee: '0',
  latitude: '',
  longitude: '',
  isActive: true,
}

const ManageLocations = () => {
  const { isOwner, axios, fetchPickupLocations, currency } = useAppContext()
  const { t } = useI18n()
  const formRef = useRef(null)

  const [locations, setLocations] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchLocations = async () => {
    try {
      const { data } = await axios.get('/api/pickup-locations/all')
      data.success ? setLocations(data.locations) : toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLoading) return

    const fee = Number(form.deliveryFee)
    if (!Number.isFinite(fee) || fee < 0) {
      toast.error(t('admin.locations.invalidFee'))
      return
    }

    if (form.latitude !== '' || form.longitude !== '') {
      const lat = Number(form.latitude)
      const lng = Number(form.longitude)
      if (form.latitude === '' || form.longitude === '' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        toast.error(t('admin.locations.invalidCoords'))
        return
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        toast.error(t('admin.locations.invalidCoords'))
        return
      }
    }

    setIsLoading(true)
    try {
      const payload = {
        name: form.name,
        city: form.city,
        address: form.address,
        googleMapsLink: form.googleMapsLink,
        locationType: form.locationType,
        deliveryFee: fee,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
        isActive: form.isActive,
      }
      const endpoint = editingId ? '/api/pickup-locations/update' : '/api/pickup-locations/create'
      const body = editingId ? { locationId: editingId, ...payload } : payload
      const { data } = await axios.post(endpoint, body)

      if (data.success) {
        toast.success(data.message)
        resetForm()
        fetchLocations()
        fetchPickupLocations()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const startEdit = (location) => {
    setEditingId(location._id)
    setForm({
      name: location.name || '',
      city: location.city || '',
      address: location.address || '',
      googleMapsLink: location.googleMapsLink || '',
      locationType: location.locationType || 'custom',
      deliveryFee: String(location.deliveryFee ?? 0),
      latitude: location.latitude != null && location.latitude !== '' ? String(location.latitude) : '',
      longitude: location.longitude != null && location.longitude !== '' ? String(location.longitude) : '',
      isActive: location.isActive !== false,
    })
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const toggleLocation = async (locationId) => {
    try {
      const { data } = await axios.post('/api/pickup-locations/toggle', { locationId })
      if (data.success) {
        toast.success(data.message)
        if (editingId === locationId && data.location) {
          setForm((prev) => ({ ...prev, isActive: data.location.isActive }))
        }
        fetchLocations()
        fetchPickupLocations()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const deleteLocation = async (locationId) => {
    if (!window.confirm(t('admin.locations.deleteConfirm'))) return

    try {
      const { data } = await axios.post('/api/pickup-locations/delete', { locationId })
      if (data.success) {
        toast.success(data.message)
        if (editingId === locationId) resetForm()
        fetchLocations()
        fetchPickupLocations()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  useEffect(() => {
    isOwner && fetchLocations()
  }, [isOwner])

  const money = currency || 'MAD '

  return (
    <div className='px-4 pt-8 md:px-8 lg:px-10 xl:px-12 md:pt-10 w-full pb-12'>
      <Title
        title={t('admin.locations.title')}
        subTitle={t('admin.locations.subtitle')}
      />

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className='mt-6 max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500'
      >
        {editingId && (
          <p className='md:col-span-2 text-sm text-primary font-medium'>
            {t('admin.locations.editing')}
          </p>
        )}
        <div className='flex flex-col'>
          <label>{t('admin.locations.name')}</label>
          <input
            type="text"
            required
            placeholder="Casablanca Airport"
            className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none'
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className='flex flex-col'>
          <label>{t('admin.locations.city')}</label>
          <input
            type="text"
            required
            placeholder="Casablanca"
            className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none'
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <div className='flex flex-col md:col-span-2'>
          <label>{t('admin.locations.address')}</label>
          <input
            type="text"
            required
            placeholder="Mohammed V International Airport, Casablanca"
            className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none'
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className='flex flex-col'>
          <label>{t('admin.locations.mapsLink')}</label>
          <input
            type="url"
            placeholder="https://maps.google.com/..."
            className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none'
            value={form.googleMapsLink}
            onChange={(e) => setForm({ ...form, googleMapsLink: e.target.value })}
          />
        </div>
        <div className='flex flex-col'>
          <label>{t('admin.locations.type')}</label>
          <select
            className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none'
            value={form.locationType}
            onChange={(e) => setForm({ ...form, locationType: e.target.value })}
          >
            <option value="airport">{t('admin.locations.typeAirport')}</option>
            <option value="hotel">{t('admin.locations.typeHotel')}</option>
            <option value="office">{t('admin.locations.typeOffice')}</option>
            <option value="custom">{t('admin.locations.typeCustom')}</option>
          </select>
        </div>
        <div className='flex flex-col'>
          <label>{t('admin.locations.latitude')}</label>
          <input
            type="number"
            step="any"
            min="-90"
            max="90"
            placeholder="33.3675"
            className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none'
            value={form.latitude}
            onChange={(e) => setForm({ ...form, latitude: e.target.value })}
          />
        </div>
        <div className='flex flex-col'>
          <label>{t('admin.locations.longitude')}</label>
          <input
            type="number"
            step="any"
            min="-180"
            max="180"
            placeholder="-7.5898"
            className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none'
            value={form.longitude}
            onChange={(e) => setForm({ ...form, longitude: e.target.value })}
          />
        </div>
        <div className='flex flex-col md:col-span-2'>
          <label>{t('admin.locations.deliveryFee')}</label>
          <div className='flex items-center gap-2 mt-1'>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              className='px-3 py-2 border border-borderColor rounded-md outline-none w-40'
              value={form.deliveryFee}
              onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })}
            />
            <span className='text-gray-600 text-sm'>{t('admin.locations.deliveryFeeHint')}</span>
          </div>
        </div>
        <div className='md:col-span-2 flex items-center gap-2'>
          <input
            id="location-is-active"
            type="checkbox"
            className='h-4 w-4 rounded border-borderColor'
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <label htmlFor="location-is-active" className='cursor-pointer text-gray-700'>
            {t('admin.locations.available')}
          </label>
        </div>
        <div className='md:col-span-2 flex items-center gap-3'>
          <button type="submit" className='flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-md font-medium cursor-pointer'>
            <img src={assets.tick_icon} alt="" />
            {isLoading ? t('admin.locations.saving') : editingId ? t('admin.locations.update') : t('admin.locations.add')}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className='px-4 py-2.5 border border-borderColor rounded-md cursor-pointer'>
              {t('admin.common.cancel')}
            </button>
          )}
        </div>
      </form>

      <div className="max-w-5xl w-full rounded-md overflow-hidden border border-borderColor mt-8 bg-white">
        <div className="table-scroll">
        <table className="w-full border-collapse text-left text-sm text-gray-600 max-lg:min-w-[720px]">
          <thead className="text-gray-500 bg-gray-50">
            <tr>
              <th className="p-3 font-medium">{t('admin.locations.colLocation')}</th>
              <th className="p-3 font-medium max-md:hidden">{t('admin.locations.colCity')}</th>
              <th className="p-3 font-medium max-md:hidden">{t('admin.locations.colType')}</th>
              <th className="p-3 font-medium">{t('admin.locations.colFee')}</th>
              <th className="p-3 font-medium max-lg:hidden">{t('admin.locations.colCoords')}</th>
              <th className="p-3 font-medium">{t('admin.locations.colStatus')}</th>
              <th className="p-3 font-medium">{t('admin.locations.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((location) => {
              const fee = Number(location.deliveryFee) || 0
              const hasCoords = location.latitude != null && location.longitude != null
              return (
                <tr
                  key={location._id}
                  className={`border-t border-borderColor ${editingId === location._id ? 'bg-primary/5' : ''}`}
                >
                  <td className="p-3">
                    <p className="font-medium">{location.name}</p>
                    <p className="text-xs text-gray-500 max-w-xs truncate">{location.address}</p>
                  </td>
                  <td className="p-3 max-md:hidden">{location.city}</td>
                  <td className="p-3 max-md:hidden capitalize">{location.locationType}</td>
                  <td className="p-3">
                    {fee <= 0 ? (
                      <span className="text-green-600 font-medium">{t('admin.locations.free')}</span>
                    ) : (
                      <span className="font-medium text-gray-800">{money}{fee}</span>
                    )}
                  </td>
                  <td className="p-3 max-lg:hidden text-xs text-gray-500">
                    {hasCoords ? `${location.latitude}, ${location.longitude}` : '—'}
                  </td>
                  <td className="p-3">
                    <span className={`px-3 py-1 rounded-full text-xs ${location.isActive ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500'}`}>
                      {location.isActive ? t('admin.locations.active') : t('admin.locations.inactive')}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                    <img
                      onClick={() => toggleLocation(location._id)}
                      src={location.isActive ? assets.eye_close_icon : assets.eye_icon}
                      alt=""
                      title={location.isActive ? t('admin.locations.inactive') : t('admin.locations.active')}
                      className="cursor-pointer"
                    />
                    <img
                      onClick={() => startEdit(location)}
                      src={assets.edit_icon}
                      alt=""
                      title={t('admin.locations.update')}
                      className="cursor-pointer"
                    />
                    <img
                      onClick={() => deleteLocation(location._id)}
                      src={assets.delete_icon}
                      alt=""
                      title={t('admin.common.delete')}
                      className="cursor-pointer"
                    />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

export default ManageLocations
