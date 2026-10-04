import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Title from '../../components/owner/Title'
import { assets } from '../../assets/assets'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../utils/apiError'
import { VEHICLE_CATEGORIES } from '../../utils/vehicleCategories'
import LocationMultiSelect from '../../components/owner/LocationMultiSelect'
import { getCarLocations } from '../../utils/carLocations'

const EditCar = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { axios, currency, pickupLocations } = useAppContext()
  const { t } = useI18n()

  const cities = useMemo(() => {
    return [...new Set(pickupLocations.map((location) => location.city))].sort()
  }, [pickupLocations])

  const [image, setImage] = useState(null)
  const [existingImage, setExistingImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : ''), [image])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])
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
    licensePlate: '',
    mileage: '',
    fleetId: '',
    vin: '',
    branch: '',
  })

  useEffect(() => {
    const fetchCar = async () => {
      try {
        const { data } = await axios.get(`/api/owner/cars/${id}`)
        if (data.success) {
          const c = data.car
          setCar({
            brand: c.brand || '',
            model: c.model || '',
            year: c.year || '',
            pricePerDay: c.pricePerDay || '',
            category: c.category || '',
            transmission: c.transmission || '',
            fuel_type: c.fuel_type || '',
            seating_capacity: c.seating_capacity || '',
            locations: getCarLocations(c),
            description: c.description || '',
            licensePlate: c.licensePlate || '',
            mileage: c.mileage || '',
            fleetId: c.fleetId || '',
            vin: c.vin || '',
            branch: c.branch || '',
          })
          setExistingImage(c.image || '')
        } else {
          toast.error(data.message)
          navigate('/owner/manage-cars')
        }
      } catch (error) {
        toast.error(getErrorMessage(error))
        navigate('/owner/manage-cars')
      } finally {
        setLoading(false)
      }
    }
    fetchCar()
  }, [id])

  const onSubmitHandler = async (e) => {
    e.preventDefault()
    if (isSaving) return
    if (!car.locations?.length) {
      toast.error(t('admin.addCar.locationsRequired'))
      return
    }

    setIsSaving(true)
    try {
      const formData = new FormData()
      if (image) formData.append('image', image)
      formData.append('carId', id)
      formData.append('carData', JSON.stringify(car))

      const { data } = await axios.post('/api/owner/update-car', formData)
      if (data.success) {
        toast.success(data.message)
        navigate('/owner/manage-cars')
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return <div className="px-4 py-8 md:px-8 lg:px-10 xl:px-12 md:py-10 text-gray-500">{t('admin.fleet.loading')}</div>
  }

  return (
    <div className='px-4 py-8 md:px-8 lg:px-10 xl:px-12 md:py-10 flex-1 min-w-0 pb-12'>
      <Title title={`${t('admin.common.edit')} ${t('admin.fleet.car')}`} subTitle={t('admin.fleet.subtitle')} />

      <form onSubmit={onSubmitHandler} className='flex flex-col gap-5 text-gray-500 text-sm mt-6 max-w-xl w-full'>
        <div className='flex items-center gap-2 w-full'>
          <label htmlFor="car-image">
            <img
              src={previewUrl || existingImage || assets.car_image1}
              alt=""
              className='h-14 w-20 rounded object-cover cursor-pointer'
            />
            <input type="file" id="car-image" accept="image/*" hidden onChange={(e) => setImage(e.target.files[0])} />
          </label>
          <p className='text-sm text-gray-500'>Upload a new image (optional)</p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.brand')}</label>
            <input type="text" required className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.brand} onChange={(e) => setCar({ ...car, brand: e.target.value })} />
          </div>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.model')}</label>
            <input type="text" required className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.model} onChange={(e) => setCar({ ...car, model: e.target.value })} />
          </div>
        </div>

        <div className='w-full rounded-xl border border-borderColor bg-gray-50/80 p-4 space-y-4'>
          <div>
            <p className='text-sm font-semibold text-gray-900'>{t('admin.addCar.assetIdentity')}</p>
            <p className='text-xs text-gray-500 mt-0.5'>{t('admin.addCar.assetHint')}</p>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4'>
            <div className='flex flex-col w-full'>
              <label>{t('admin.addCar.fleetId')}</label>
              <input type="text" className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none bg-white' value={car.fleetId} onChange={(e) => setCar({ ...car, fleetId: e.target.value })} placeholder="AC-0001" />
            </div>
            <div className='flex flex-col w-full'>
              <label>{t('admin.addCar.vin')}</label>
              <input type="text" className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none bg-white' value={car.vin} onChange={(e) => setCar({ ...car, vin: e.target.value })} />
            </div>
            <div className='flex flex-col w-full'>
              <label>{t('admin.addCar.plate')} *</label>
              <input type="text" required className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none bg-white' value={car.licensePlate} onChange={(e) => setCar({ ...car, licensePlate: e.target.value })} />
            </div>
            <div className='flex flex-col w-full'>
              <label>{t('admin.addCar.mileage')}</label>
              <input type="number" min="0" className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none bg-white' value={car.mileage} onChange={(e) => setCar({ ...car, mileage: e.target.value })} />
            </div>
            <div className='flex flex-col w-full sm:col-span-2'>
              <label>{t('admin.addCar.branch')}</label>
              <input type="text" className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none bg-white' value={car.branch} onChange={(e) => setCar({ ...car, branch: e.target.value })} placeholder={car.locations?.[0] || ''} />
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.year')}</label>
            <input type="number" required className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.year} onChange={(e) => setCar({ ...car, year: e.target.value })} />
          </div>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.dailyPrice')} ({currency})</label>
            <input type="number" required className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.pricePerDay} onChange={(e) => setCar({ ...car, pricePerDay: e.target.value })} />
          </div>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.category')}</label>
            <select required value={car.category} onChange={(e) => setCar({ ...car, category: e.target.value })} className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none'>
              <option value="">Select a category</option>
              {VEHICLE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.transmission')}</label>
            <select required value={car.transmission} onChange={(e) => setCar({ ...car, transmission: e.target.value })} className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none'>
              <option value="">Select a transmission</option>
              <option value="Automatic">Automatic</option>
              <option value="Manual">Manual</option>
              <option value="Semi-Automatic">Semi-Automatic</option>
            </select>
          </div>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.fuelType')}</label>
            <select required value={car.fuel_type} onChange={(e) => setCar({ ...car, fuel_type: e.target.value })} className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none'>
              <option value="">Select a fuel type</option>
              <option value="Gas">ESSENCE</option>
              <option value="Diesel">DIESEL</option>
              <option value="Electric">Electric</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
          <div className='flex flex-col w-full'>
            <label>{t('admin.addCar.seats')}</label>
            <input type="number" required className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.seating_capacity} onChange={(e) => setCar({ ...car, seating_capacity: e.target.value })} />
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
          <textarea rows={5} required className='px-3 py-2 mt-1 border border-borderColor rounded-md outline-none' value={car.description} onChange={(e) => setCar({ ...car, description: e.target.value })} />
        </div>

        <div className='flex flex-wrap gap-3'>
          <button type="button" onClick={() => navigate('/owner/manage-cars')} className='px-4 py-2.5 border border-borderColor rounded-md cursor-pointer'>
            {t('admin.common.cancel')}
          </button>
          <button type="button" onClick={() => navigate(`/owner/vehicle-stats/${id}`)} className='px-4 py-2.5 border border-primary text-primary rounded-md cursor-pointer'>
            {t('admin.vehicleStats.viewStats')}
          </button>
          <button className='flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-md font-medium cursor-pointer disabled:opacity-60'>
            <img src={assets.tick_icon} alt="" />
            {isSaving ? t('admin.common.loading') : t('admin.common.save')}
          </button>
        </div>
      </form>

    </div>
  )
}

export default EditCar
