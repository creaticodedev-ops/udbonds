import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { assets } from '../../assets/assets'
import Title from '../../components/owner/Title'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import { getErrorMessage } from '../../utils/apiError'
import { formatLocationsDisplay } from '../../utils/carLocations'

const VehicleStatsListPage = () => {
  const navigate = useNavigate()
  const { isOwner, axios, currency } = useAppContext()
  const { t } = useI18n()
  const fallbackImage = assets.car_image1

  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOwner) return

    const loadVehicles = async () => {
      setLoading(true)
      try {
        const { data } = await axios.get('/api/owner/cars')
        if (data.success) {
          setVehicles(data.cars || [])
        } else {
          toast.error(data.message || t('admin.vehicleStats.loadError'))
        }
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        setLoading(false)
      }
    }

    loadVehicles()
  }, [axios, isOwner, t])

  return (
    <div className='px-4 py-8 md:px-8 lg:px-10 xl:px-12 md:py-10 w-full pb-12'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <Title title={t('admin.vehicleStats.title')} subTitle={t('admin.vehicleStats.subtitle')} />
          <p className='mt-3 text-sm text-gray-500'>
            {t('admin.vehicleStats.summary', { count: vehicles.length })}
          </p>
        </div>
      </div>

      {loading ? (
        <div className='mt-8 rounded-3xl border border-borderColor bg-white p-6 text-sm text-gray-500'>
          {t('admin.vehicleStats.loading')}
        </div>
      ) : vehicles.length === 0 ? (
        <div className='mt-8 rounded-3xl border border-borderColor bg-white p-6 text-sm text-gray-500'>
          {t('admin.vehicleStats.none')}
        </div>
      ) : (
        <div className='mt-8 grid gap-4 lg:grid-cols-2'>
          {vehicles.map((vehicle) => {
            const statusLabel = vehicle.status === 'maintenance'
              ? t('admin.vehicleStats.statusMaintenance')
              : vehicle.isAvaliable
                ? t('admin.vehicleStats.statusAvailable')
                : t('admin.vehicleStats.statusOffline')

            return (
              <div key={vehicle._id} className='rounded-3xl border border-borderColor bg-white p-5 shadow-sm'>
                <div className='flex items-start gap-4'>
                  <img
                    src={vehicle.image || fallbackImage}
                    alt={`${vehicle.brand} ${vehicle.model}`}
                    onError={(e) => { e.currentTarget.src = fallbackImage }}
                    className='h-20 w-20 rounded-2xl object-cover shadow-sm'
                  />
                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <h3 className='text-lg font-semibold text-gray-900'>{vehicle.brand} {vehicle.model}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${vehicle.status === 'maintenance' ? 'bg-amber-100 text-amber-700' : vehicle.isAvaliable ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className='mt-2 text-sm text-gray-500'>
                      {t('admin.vehicleStats.fleetId')}: <span className='font-medium text-gray-800'>{vehicle.fleetId || '—'}</span>
                    </p>
                    <p className='mt-1 text-sm text-gray-500'>
                      {t('admin.vehicleStats.plate')}: <span className='font-medium text-gray-800'>{vehicle.licensePlate || '—'}</span>
                    </p>
                    <p className='mt-1 text-sm text-gray-500'>
                      {t('admin.vehicleStats.locations')}: <span className='font-medium text-gray-800'>{formatLocationsDisplay(vehicle) || '—'}</span>
                    </p>
                    <p className='mt-1 text-sm text-gray-500'>
                      {t('admin.vehicleStats.price')}: <span className='font-medium text-gray-800'>{currency}{vehicle.pricePerDay}{t('admin.fleet.perDay')}</span>
                    </p>
                  </div>
                </div>

                <div className='mt-5 flex flex-wrap gap-3'>
                  <button
                    type='button'
                    onClick={() => navigate(`/owner/vehicle-stats/${vehicle._id}`)}
                    className='rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dull'
                  >
                    {t('admin.vehicleStats.viewStats')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default VehicleStatsListPage
