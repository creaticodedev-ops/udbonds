import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { assets } from '../../assets/assets'
import Title from '../../components/owner/Title'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../utils/apiError'
import { VEHICLE_CATEGORIES } from '../../utils/vehicleCategories'
import { formatLocationsDisplay } from '../../utils/carLocations'

const statusBadge = (car) => {
  if (car.status === 'maintenance') {
    return 'bg-amber-100 text-amber-800'
  }
  if (car.isAvaliable) {
    return 'bg-emerald-100 text-emerald-700'
  }
  return 'bg-gray-100 text-gray-600'
}

const statusLabel = (car) => {
  if (car.status === 'maintenance') return 'In Maintenance'
  if (car.isAvaliable) return 'Available'
  return 'Offline'
}

const ManageCars = () => {
  const { isOwner, axios, currency } = useAppContext()
  const { t } = useI18n()
  const navigate = useNavigate()
  const fallbackImage = assets.car_image1

  const [cars, setCars] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    fleetId: '',
    vin: '',
    plate: '',
    status: '',
    branch: '',
    category: '',
  })
  const [applied, setApplied] = useState(filters)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(applied).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    return params.toString()
  }, [applied])

  const fetchOwnerCars = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`/api/owner/cars${query ? `?${query}` : ''}`)
      if (data.success) {
        setCars(data.cars)
        setBranches(data.branches || [])
      } else toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const toggleAvailability = async (carId) => {
    try {
      const { data } = await axios.post('/api/owner/toggle-car', { carId })
      if (data.success) {
        toast.success(data.message)
        fetchOwnerCars()
      } else toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const openVehicleStats = (car) => {
    navigate(`/owner/vehicle-stats/${car._id}`)
  }

  const deleteCar = async (carId) => {
    if (!window.confirm('Remove this physical vehicle from the fleet?')) return
    try {
      const { data } = await axios.post('/api/owner/delete-car', { carId })
      if (data.success) {
        toast.success(data.message)
        fetchOwnerCars()
      } else toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  useEffect(() => {
    if (isOwner) fetchOwnerCars()
  }, [isOwner, query])

  const inputClass =
    'border border-borderColor rounded-lg px-3 py-2.5 text-sm w-full min-w-0 outline-none focus:border-primary bg-white'

  const emptyFilters = {
    search: '',
    fleetId: '',
    vin: '',
    plate: '',
    status: '',
    branch: '',
    category: '',
  }

  const CarActions = ({ car, layout = 'row' }) => (
    <div
      className={
        layout === 'stack'
          ? 'grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2'
          : 'flex flex-wrap items-center gap-2'
      }
    >
      <button
        type="button"
        onClick={() => openVehicleStats(car)}
        className="text-xs font-medium text-primary hover:underline px-2 py-1 rounded-md bg-primary/5 sm:bg-transparent sm:px-0 sm:py-0"
      >
        Stats
      </button>
      <button
        type="button"
        onClick={() => navigate(`/owner/edit-car/${car._id}`)}
        className="text-xs font-medium text-primary hover:underline px-2 py-1 rounded-md bg-primary/5 sm:bg-transparent sm:px-0 sm:py-0"
      >
        {t('admin.common.edit')}
      </button>
      <button
        type="button"
        onClick={() => toggleAvailability(car._id)}
        className="text-xs text-gray-600 hover:underline px-2 py-1 rounded-md bg-gray-50 sm:bg-transparent sm:px-0 sm:py-0"
      >
        {t('admin.fleet.toggle')}
      </button>
      <button
        type="button"
        onClick={() => deleteCar(car._id)}
        className="text-xs text-red-600 hover:underline px-2 py-1 rounded-md bg-red-50 sm:bg-transparent sm:px-0 sm:py-0 col-span-2 sm:col-span-1"
      >
        {t('admin.common.delete')}
      </button>
    </div>
  )

  return (
    <div className="admin-page px-4 pt-6 sm:pt-8 md:px-8 lg:px-10 xl:px-12 md:pt-10 w-full pb-10 min-w-0 max-w-[1600px]">
      <Title title={t('admin.fleet.title')} subTitle={t('admin.fleet.subtitle')} />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setApplied({ ...filters })
        }}
        className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-borderColor bg-white p-4 sm:p-5 shadow-sm"
      >
        <input
          className={`${inputClass} lg:col-span-2`}
          placeholder={t('admin.fleet.searchAll')}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder={t('admin.fleet.fleetId')}
          value={filters.fleetId}
          onChange={(e) => setFilters({ ...filters, fleetId: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder={t('admin.fleet.vin')}
          value={filters.vin}
          onChange={(e) => setFilters({ ...filters, vin: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder={t('admin.fleet.plate')}
          value={filters.plate}
          onChange={(e) => setFilters({ ...filters, plate: e.target.value })}
        />
        <select
          className={inputClass}
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">{t('admin.fleet.allStatuses')}</option>
          <option value="available">Available</option>
          <option value="booked">Rented</option>
          <option value="maintenance">In Maintenance</option>
        </select>
        <select
          className={inputClass}
          value={filters.branch}
          onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
        >
          <option value="">{t('admin.fleet.allBranches')}</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
        >
          <option value="">{t('admin.fleet.allCategories')}</option>
          {VEHICLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="flex flex-col sm:flex-row gap-2 sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            className="flex-1 px-3 py-2.5 bg-primary text-white text-sm rounded-lg font-medium"
          >
            {t('admin.fleet.apply')}
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(emptyFilters)
              setApplied(emptyFilters)
            }}
            className="px-3 py-2.5 border border-borderColor rounded-lg text-sm bg-white"
          >
            {t('admin.fleet.clear')}
          </button>
        </div>
      </form>

      <div className="w-full rounded-xl overflow-hidden border border-borderColor mt-6 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">{t('admin.fleet.loading')}</p>
        ) : cars.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">{t('admin.fleet.none')}</p>
        ) : (
          <>
            {/* Mobile / tablet cards */}
            <div className="lg:hidden divide-y divide-borderColor">
              {cars.map((car) => (
                <article key={car._id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex gap-3 min-w-0">
                    <img
                      src={car.image || fallbackImage}
                      onError={(e) => {
                        e.currentTarget.src = fallbackImage
                      }}
                      alt={`${car.brand} ${car.model}`}
                      className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-semibold text-primary truncate">
                        {car.fleetId || '—'}
                      </p>
                      <p className="font-semibold text-gray-900 truncate">
                        {car.brand} {car.model}
                      </p>
                      <p className="text-xs text-gray-500">
                        {car.year} · {car.seating_capacity} seats · {car.category}
                      </p>
                      <span
                        className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${statusBadge(car)}`}
                      >
                        {statusLabel(car)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 shrink-0">
                      {currency}
                      {car.pricePerDay}
                      <span className="text-xs font-normal text-gray-500">{t('admin.fleet.perDay')}</span>
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-gray-600">
                    <div>
                      <dt className="text-gray-400">{t('admin.fleet.plate')}</dt>
                      <dd className="font-medium text-gray-800 truncate">{car.licensePlate || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">{t('admin.fleet.vin')}</dt>
                      <dd className="font-mono truncate">{car.vin || '—'}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-gray-400">{t('admin.fleet.locationsCol')}</dt>
                      <dd className="truncate">{formatLocationsDisplay(car)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">{t('admin.fleet.mileage')}</dt>
                      <dd>{car.mileage || 0} km</dd>
                    </div>
                  </dl>
                  <CarActions car={car} layout="stack" />
                </article>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block table-scroll">
              <table className="w-full border-collapse text-left text-sm text-gray-600 min-w-[960px]">
                <thead className="text-gray-500 bg-gray-50 sticky top-0 z-[1]">
                  <tr>
                    <th className="p-3 font-medium whitespace-nowrap">{t('admin.fleet.fleetId')}</th>
                    <th className="p-3 font-medium">{t('admin.fleet.car')}</th>
                    <th className="p-3 font-medium">{t('admin.fleet.vin')}</th>
                    <th className="p-3 font-medium">{t('admin.fleet.plate')}</th>
                    <th className="p-3 font-medium">{t('admin.fleet.locationsCol')}</th>
                    <th className="p-3 font-medium">{t('admin.fleet.mileage')}</th>
                    <th className="p-3 font-medium">{t('admin.fleet.category')}</th>
                    <th className="p-3 font-medium">{t('admin.fleet.price')}</th>
                    <th className="p-3 font-medium">{t('admin.fleet.status')}</th>
                    <th className="p-3 font-medium">{t('admin.fleet.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cars.map((car) => (
                    <tr key={car._id} className="border-t border-borderColor hover:bg-gray-50/60">
                      <td className="p-3 font-mono text-xs text-primary font-semibold whitespace-nowrap">
                        {car.fleetId || '—'}
                      </td>
                      <td className="p-3 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <img
                            src={car.image || fallbackImage}
                            onError={(e) => {
                              e.currentTarget.src = fallbackImage
                            }}
                            alt={`${car.brand} ${car.model}`}
                            className="h-12 w-12 shrink-0 rounded-md object-cover"
                          />
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {car.brand} {car.model}
                            </p>
                            <p className="text-xs text-gray-500">
                              {car.year} · {car.seating_capacity} seats
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs max-w-[120px] truncate">{car.vin || '—'}</td>
                      <td className="p-3 font-medium whitespace-nowrap">{car.licensePlate || '—'}</td>
                      <td className="p-3 max-w-[160px]">
                        <p className="text-sm truncate">{formatLocationsDisplay(car)}</p>
                        {car.branch ? <p className="text-xs text-gray-400 truncate">{car.branch}</p> : null}
                      </td>
                      <td className="p-3 whitespace-nowrap">{car.mileage || 0} km</td>
                      <td className="p-3">{car.category}</td>
                      <td className="p-3 whitespace-nowrap">
                        {currency}
                        {car.pricePerDay}
                        {t('admin.fleet.perDay')}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${statusBadge(car)}`}>
                          {statusLabel(car)}
                        </span>
                      </td>
                      <td className="p-3">
                        <CarActions car={car} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ManageCars
