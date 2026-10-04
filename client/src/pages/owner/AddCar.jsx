import React, { useEffect, useMemo, useState } from 'react'
import Title from '../../components/owner/Title'
import { assets } from '../../assets/assets'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../utils/apiError'
import { VEHICLE_CATEGORIES } from '../../utils/vehicleCategories'
import LocationMultiSelect from '../../components/owner/LocationMultiSelect'

const AddCar = () => {
  const { axios, currency, pickupLocations } = useAppContext()
  const { t } = useI18n()

  const cities = useMemo(() => {
    return [...new Set(pickupLocations.map((location) => location.city))].sort()
  }, [pickupLocations])

  const [image, setImage] = useState(null)
  const [car, setCar] = useState({
    brand: '',
    model: '',
    year: '',
    pricePerDay: '',
    category: '',
    transmission: '',
    fuel_type: '',
    seating_capacity: '',
    locations: [],
    description: '',
    fleetId: '',
    vin: '',
    licensePlate: '',
    branch: '',
    mileage: '',
  })

  const [isLoading, setIsLoading] = useState(false)
  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : ''), [image])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const onSubmitHandler = async (e) => {
    e.preventDefault()
    if (isLoading) return

    if (!image) {
      toast.error('Please upload a car image')
      return
    }
    if (!car.category || !car.transmission || !car.fuel_type) {
      toast.error('Please complete all vehicle details')
      return
    }
    if (!car.locations?.length) {
      toast.error(t('admin.addCar.locationsRequired'))
      return
    }
    if (!car.licensePlate?.trim()) {
      toast.error('License plate is required for each physical vehicle')
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', image)
      formData.append('carData', JSON.stringify(car))

      const { data } = await axios.post('/api/owner/add-car', formData)
      if (data.success) {
        toast.success(data.message)
        setImage(null)
        setCar({
          brand: '', model: '', year: '', pricePerDay: '', category: '',
          transmission: '', fuel_type: '', seating_capacity: '', locations: [], description: '',
          fleetId: '', vin: '', licensePlate: '', branch: '', mileage: '',
        })
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='px-4 py-8 md:px-8 lg:px-10 xl:px-12 md:py-10 flex-1 min-w-0 pb-12'>
      <Title title={t('admin.addCar.title')} subTitle={t('admin.addCar.subtitle')} />

      <form onSubmit={onSubmitHandler} className='flex flex-col gap-5 text-gray-500 text-sm mt-6 max-w-xl w-full'>
        <div className='flex items-center gap-2 w-full'>
          <label htmlFor="car-image">
            <img src={previewUrl || assets.upload_icon} alt="" className='h-14 rounded cursor-pointer'/>
            <input type="file" id="car-image" accept="image/*" required hidden onChange={(e) => setImage(e.target.files[0])} />
          </label>
          <p className='text-sm text-gray-500'>{t('admin.addCar.uploadHint')}</p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.brand')}</label>
            <input type="text" placeholder="e.g. BMW, Mercedes, Audi..." required className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.brand} onChange={(e) => setCar({ ...car, brand: e.target.value })} />
          </div>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.model')}</label>
            <input type="text" placeholder="e.g. X5, E-Class, M4..." required className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.model} onChange={(e) => setCar({ ...car, model: e.target.value })} />
          </div>
        </div>

        <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">{t('admin.addCar.assetIdentity')}</p>
          <p className="text-xs text-amber-800/80">{t('admin.addCar.assetHint')}</p>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div className='flex flex-col w-full'>
              <label>{t('admin.addCar.fleetId')}</label>
              <input type="text" placeholder="Auto if empty (FLT-XXXXXX)" className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none uppercase' value={car.fleetId} onChange={(e) => setCar({ ...car, fleetId: e.target.value })} />
            </div>
            <div className='flex flex-col w-full'>
              <label>{t('admin.addCar.vin')}</label>
              <input type="text" placeholder="17-character VIN" className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none uppercase' value={car.vin} onChange={(e) => setCar({ ...car, vin: e.target.value })} />
            </div>
            <div className='flex flex-col w-full'>
              <label>{t('admin.addCar.plate')} *</label>
              <input type="text" required placeholder="License plate" className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none uppercase' value={car.licensePlate} onChange={(e) => setCar({ ...car, licensePlate: e.target.value })} />
            </div>
            <div className='flex flex-col w-full'>
              <label>{t('admin.addCar.mileage')}</label>
              <input type="number" min="0" placeholder="0" className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.mileage} onChange={(e) => setCar({ ...car, mileage: e.target.value })} />
            </div>
            <div className='flex flex-col w-full sm:col-span-2'>
              <label>{t('admin.addCar.branch')}</label>
              <input type="text" placeholder="e.g. Casablanca Airport depot" className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.branch} onChange={(e) => setCar({ ...car, branch: e.target.value })} />
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.year')}</label>
            <input type="number" placeholder="2025" required className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.year} onChange={(e) => setCar({ ...car, year: e.target.value })} />
          </div>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.dailyPrice')} ({currency})</label>
            <input type="number" min="1" placeholder="100" required className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.pricePerDay} onChange={(e) => setCar({ ...car, pricePerDay: e.target.value })} />
          </div>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.category')}</label>
            <select required onChange={(e) => setCar({ ...car, category: e.target.value })} value={car.category} className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none'>
              <option value="">Select a category</option>
              {VEHICLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.transmission')}</label>
            <select required onChange={(e) => setCar({ ...car, transmission: e.target.value })} value={car.transmission} className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none'>
              <option value="">Select a transmission</option>
              <option value="Automatic">Automatic</option>
              <option value="Manual">Manual</option>
              <option value="Semi-Automatic">Semi-Automatic</option>
            </select>
          </div>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.fuelType')}</label>
            <select required onChange={(e) => setCar({ ...car, fuel_type: e.target.value })} value={car.fuel_type} className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none'>
              <option value="">Select a fuel type</option>
              <option value="Gas">ESSENCE</option>
              <option value="Diesel">DIESEL</option>
              <option value="Electric">Electric</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.seats')}</label>
            <input type="number" min="1" placeholder="4" required className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.seating_capacity} onChange={(e) => setCar({ ...car, seating_capacity: e.target.value })} />
          </div>
        </div>

        <LocationMultiSelect
          cities={cities}
          selected={car.locations}
          onChange={(locations) => setCar({ ...car, locations })}
          label={t('admin.addCar.locations')}
          selectAllLabel={t('admin.addCar.selectAllLocations')}
          hint={t('admin.addCar.locationsHint')}
          required
        />

        <div className='flex flex-col w-full'>
          <label>{t('admin.addCar.description')}</label>
          <textarea rows={5} placeholder="Describe the vehicle..." required className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.description} onChange={(e) => setCar({ ...car, description: e.target.value })} />
        </div>

        <button disabled={isLoading} className='flex items-center gap-2 px-4 py-2.5 mt-4 bg-primary text-white rounded-md font-medium w-max cursor-pointer disabled:opacity-60'>
          <img src={assets.tick_icon} alt="" />
          {isLoading ? t('admin.addCar.listing') : t('admin.addCar.submit')}
        </button>
      </form>
    </div>
  )
}

export default AddCar
