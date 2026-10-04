import React, { useEffect, useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import { getErrorMessage } from '../../utils/apiError'
import toast from 'react-hot-toast'

const VehicleStatsModal = ({ car, isOpen, onClose }) => {
  const { axios, currency } = useAppContext()
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!isOpen || !car?._id) {
      setStats(null)
      return
    }

    const load = async () => {
      setLoading(true)
      setStats(null)
      try {
        const { data } = await axios.get(`/api/owner/cars/${car._id}/stats`)
        if (data.success) {
          setStats(data.stats)
        } else {
          toast.error(data.message || t('admin.vehicleStats.loadError'))
        }
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [axios, car?._id, isOpen, t])

  if (!isOpen || !car) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4' onClick={onClose}>
      <div className='max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl' onClick={(e) => e.stopPropagation()}>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <p className='text-sm font-semibold text-primary'>{t('admin.vehicleStats.title')}</p>
            <h3 className='text-xl font-semibold text-gray-900'>{car.brand} {car.model}</h3>
            <p className='text-sm text-gray-500'>{car.licensePlate || car.fleetId || t('admin.vehicleStats.fleetId')}</p>
          </div>
          <button type='button' onClick={onClose} className='rounded-full border border-borderColor px-3 py-1 text-sm text-gray-500'>{t('common.close')}</button>
        </div>

        {loading ? (
          <p className='mt-6 text-sm text-gray-500'>{t('admin.vehicleStats.loading')}</p>
        ) : !stats ? (
          <p className='mt-6 text-sm text-gray-500'>{t('admin.vehicleStats.none')}</p>
        ) : (
          <div className='mt-6 space-y-6'>
            <div className='grid gap-3 md:grid-cols-4'>
              <div className='rounded-xl border border-borderColor bg-gray-50 p-3'>
                <p className='text-xs uppercase text-gray-400'>{t('admin.vehicleStats.bookings')}</p>
                <p className='mt-1 text-xl font-semibold text-gray-900'>{stats.overview.totalBookings}</p>
              </div>
              <div className='rounded-xl border border-borderColor bg-gray-50 p-3'>
                <p className='text-xs uppercase text-gray-400'>{t('admin.vehicleStats.revenue')}</p>
                <p className='mt-1 text-xl font-semibold text-gray-900'>{currency}{Number(stats.overview.totalRevenue || 0).toLocaleString()}</p>
              </div>
              <div className='rounded-xl border border-borderColor bg-gray-50 p-3'>
                <p className='text-xs uppercase text-gray-400'>{t('admin.vehicleStats.utilization')}</p>
                <p className='mt-1 text-xl font-semibold text-gray-900'>{stats.overview.utilizationRate}</p>
              </div>
              <div className='rounded-xl border border-borderColor bg-gray-50 p-3'>
                <p className='text-xs uppercase text-gray-400'>{t('admin.vehicleStats.averageRental')}</p>
                <p className='mt-1 text-xl font-semibold text-gray-900'>{stats.overview.averageRentalDuration}</p>
              </div>
            </div>

            <div className='grid gap-6 lg:grid-cols-[1.1fr_0.9fr]'>
              <div className='rounded-xl border border-borderColor p-4'>
                <div className='mb-3 flex items-center justify-between'>
                  <h4 className='font-semibold text-gray-800'>{t('admin.vehicleStats.upcomingReservations')}</h4>
                  <span className='text-xs text-gray-400'>{t('admin.vehicleStats.upcomingHint')}</span>
                </div>
                {stats.upcomingReservations?.length ? (
                  <ul className='space-y-2 text-sm text-gray-600'>
                    {stats.upcomingReservations.map((booking) => (
                      <li key={booking._id} className='rounded-lg border border-borderColor bg-gray-50 px-3 py-2'>
                        <div className='flex items-center justify-between gap-2'>
                          <span className='font-medium text-gray-800'>{booking.customerName || t('admin.vehicleStats.guest')}</span>
                          <span className='text-xs uppercase text-gray-400'>{booking.status}</span>
                        </div>
                        <p className='mt-1 text-xs text-gray-500'>{new Date(booking.pickupDate).toLocaleDateString()} → {new Date(booking.returnDate).toLocaleDateString()}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className='text-sm text-gray-500'>{t('admin.vehicleStats.noUpcoming')}</p>}
              </div>

              <div className='rounded-xl border border-borderColor p-4'>
                <div className='mb-3 flex items-center justify-between'>
                  <h4 className='font-semibold text-gray-800'>{t('admin.vehicleStats.maintenanceHistory')}</h4>
                  <span className='text-xs text-gray-400'>{t('admin.vehicleStats.maintenanceHint')}</span>
                </div>
                {stats.maintenanceHistory?.length ? (
                  <ul className='space-y-2 text-sm text-gray-600'>
                    {stats.maintenanceHistory.slice(0, 5).map((record) => (
                      <li key={record._id} className='rounded-lg border border-borderColor bg-gray-50 px-3 py-2'>
                        <div className='flex items-center justify-between gap-2'>
                          <span className='font-medium text-gray-800'>{record.type || t('admin.vehicleStats.maintenanceDefault')}</span>
                          <span className='text-xs uppercase text-gray-400'>{record.status || t('admin.vehicleStats.logged')}</span>
                        </div>
                        <p className='mt-1 text-xs text-gray-500'>{record.scheduledDate ? new Date(record.scheduledDate).toLocaleDateString() : 'No date'}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className='text-sm text-gray-500'>{t('admin.vehicleStats.noMaintenance')}</p>}
              </div>
            </div>

            <div className='grid gap-6 lg:grid-cols-2'>
              <div className='rounded-xl border border-borderColor p-4'>
                <h4 className='font-semibold text-gray-800'>{t('admin.vehicleStats.monthlyPerformance')}</h4>
                <div className='mt-3 space-y-2'>
                  {stats.monthlyPerformance?.map((item) => (
                    <div key={item.label} className='flex items-center justify-between text-sm text-gray-600'>
                      <span>{item.label}</span>
                      <span>{item.bookings} bookings · {currency}{Number(item.revenue || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className='rounded-xl border border-borderColor p-4'>
                <h4 className='font-semibold text-gray-800'>{t('admin.vehicleStats.yearlyComparison')}</h4>
                <div className='mt-3 space-y-2'>
                  {stats.yearlyPerformance?.map((item) => (
                    <div key={item.label} className='flex items-center justify-between text-sm text-gray-600'>
                      <span>{item.label}</span>
                      <span>{item.bookings} bookings · {currency}{Number(item.revenue || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className='rounded-xl border border-borderColor p-4'>
              <h4 className='font-semibold text-gray-800'>{t('admin.vehicleStats.availabilityTimeline')}</h4>
              <div className='mt-3 grid grid-cols-7 gap-2'>
                {stats.availabilityCalendar?.slice(0, 7).map((day) => (
                  <div key={day.date} className='rounded-lg border border-borderColor bg-gray-50 p-2 text-center text-xs'>
                    <p className='font-medium text-gray-700'>{day.label}</p>
                    <p className={`mt-2 rounded-full px-2 py-1 text-[10px] ${day.isBooked ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {day.isBooked ? t('admin.vehicleStats.booked') : t('admin.vehicleStats.free')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VehicleStatsModal
