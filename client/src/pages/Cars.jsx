import React, { useEffect, useMemo, useState } from 'react'
import Title from '../components/Title'
import { assets } from '../assets/assets'
import CarCard from '../components/CarCard'
import { useSearchParams } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'
import { motion as Motion } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext'
import { getErrorMessage } from '../utils/apiError'
import { VEHICLE_CATEGORIES, groupCarsByCategory } from '../utils/vehicleCategories'
import { getCarLocations } from '../utils/carLocations'
import { booking } from '../components/ui/bookingUi'
import { trackSearch } from '../analytics/ga4'

const Cars = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const pickupLocation = searchParams.get('pickupLocation')
  const urlPickupDate = searchParams.get('pickupDate')
  const urlReturnDate = searchParams.get('returnDate')
  const categoryParam = searchParams.get('category') || ''
  const { t } = useI18n()

  const { cars, carsLoading, axios, setPickupDate, setReturnDate } = useAppContext()

  const [input, setInput] = useState('')
  const isSearchData = pickupLocation && urlPickupDate && urlReturnDate
  const [filteredCars, setFilteredCars] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState(categoryParam)

  useEffect(() => {
    if (urlPickupDate) setPickupDate(urlPickupDate.includes('T') ? urlPickupDate : `${urlPickupDate}T10:00`)
    if (urlReturnDate) setReturnDate(urlReturnDate.includes('T') ? urlReturnDate : `${urlReturnDate}T10:00`)
  }, [urlPickupDate, urlReturnDate, setPickupDate, setReturnDate])

  useEffect(() => {
    setActiveCategory(categoryParam)
  }, [categoryParam])

  const applyFilter = () => {
    let list = cars
    if (input.trim()) {
      const q = input.toLowerCase()
      list = list.filter((car) =>
        car.brand.toLowerCase().includes(q) ||
        car.model.toLowerCase().includes(q) ||
        car.category.toLowerCase().includes(q) ||
        car.transmission.toLowerCase().includes(q) ||
        getCarLocations(car).some((loc) => loc.toLowerCase().includes(q))
      )
    }
    setFilteredCars(list)
  }

  const searchCarAvailability = async () => {
    setSearchLoading(true)
    try {
      const { data } = await axios.post('/api/bookings/check-availability', {
        location: pickupLocation,
        pickupDate: urlPickupDate,
        returnDate: urlReturnDate,
      })
      if (data.success) {
        setFilteredCars(data.availableCars)
        trackSearch({
          location: pickupLocation,
          has_dates: true,
          result_count: (data.availableCars || []).length,
          source: 'availability',
          category: categoryParam || undefined,
        })
        if (data.availableCars.length === 0) {
          toast.error(t('cars.noCars'))
        }
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSearchLoading(false)
    }
  }

  useEffect(() => {
    if (isSearchData) searchCarAvailability()
    else if (cars.length) applyFilter()
    else setFilteredCars([])
  }, [isSearchData, pickupLocation, urlPickupDate, urlReturnDate, cars])

  useEffect(() => {
    if (!isSearchData) applyFilter()
  }, [input, cars, isSearchData])

  const sections = useMemo(() => {
    let list = filteredCars
    if (activeCategory) {
      list = list.filter(
        (c) => String(c.category || '').toLowerCase() === activeCategory.toLowerCase()
      )
    }
    return groupCarsByCategory(list)
  }, [filteredCars, activeCategory])

  const availableCategories = useMemo(() => {
    const present = new Set(filteredCars.map((c) => c.category).filter(Boolean))
    return VEHICLE_CATEGORIES.filter((c) => present.has(c)).concat(
      [...present].filter((c) => !VEHICLE_CATEGORIES.includes(c))
    )
  }, [filteredCars])

  const selectCategory = (cat) => {
    setActiveCategory(cat)
    const next = new URLSearchParams(searchParams)
    if (cat) next.set('category', cat)
    else next.delete('category')
    setSearchParams(next, { replace: true })
  }

  const resultCount = sections.reduce((n, s) => n + s.cars.length, 0)

  return (
    <div className={booking.pageBottom}>
      <Motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex flex-col items-center overflow-hidden px-0 py-14 sm:py-16 md:py-20"
        style={{
          background: 'linear-gradient(180deg, #EDE8E4 0%, #F8F6F5 55%, #F8F6F5 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(165, 22, 36,0.12), transparent 60%)',
          }}
        />
        <div className="relative z-10 page-pad page-shell flex w-full flex-col items-center">
          <Title title={t('cars.title')} subTitle={t('cars.subtitle')} />

          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
            className={`${booking.fieldShell} relative z-10 mt-7 max-w-xl shadow-[0_12px_40px_-24px_rgba(22,18,16,0.3)]`}
          >
            <img src={assets.search_icon} alt="" className="h-4 w-4 shrink-0 opacity-60" />
            <input
              onChange={(e) => setInput(e.target.value)}
              value={input}
              type="search"
              enterKeyHint="search"
              placeholder={t('cars.searchPlaceholder')}
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted/55"
              aria-label={t('cars.searchPlaceholder')}
            />
          </Motion.div>

          {availableCategories.length > 0 && (
            <div className="relative z-10 mt-7 flex w-full max-w-4xl gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => selectCategory('')}
                className={`${booking.chip} booking-tap shrink-0 ${!activeCategory ? booking.chipActive : booking.chipIdle}`}
              >
                {t('cars.allCategories')}
              </button>
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => selectCategory(cat)}
                  className={`${booking.chip} booking-tap shrink-0 ${
                    activeCategory.toLowerCase() === cat.toLowerCase()
                      ? booking.chipPrimaryActive
                      : booking.chipIdle
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </Motion.div>

      <div className="page-pad page-shell mt-2 sm:mt-4">
        <p className="mb-7 text-sm text-muted sm:mb-8">
          {carsLoading || searchLoading
            ? t('common.loading')
            : t('cars.showing', { count: resultCount })}
        </p>

        {(carsLoading || searchLoading) && !filteredCars.length ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="overflow-hidden rounded-[1.25rem]">
                <div className="aspect-[16/10] animate-pulse bg-sand/80" />
                <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-sand/70" />
              </div>
            ))}
          </div>
        ) : sections.length === 0 ? (
          <div className={`${booking.cardQuiet} mx-auto max-w-md px-6 py-14 text-center`}>
            <p className="font-display text-2xl text-ink">{t('cars.noCars')}</p>
            <p className="mt-2 text-sm text-muted">{t('cars.subtitle')}</p>
          </div>
        ) : (
          <div className="space-y-14 sm:space-y-16 md:space-y-20">
            {sections.map((section, sIdx) => (
              <Motion.section
                key={section.category}
                id={`category-${section.category.toLowerCase()}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.12 }}
                transition={{ duration: 0.45, delay: Math.min(sIdx * 0.04, 0.16) }}
              >
                <div className="mb-6 flex flex-col gap-2 border-b border-borderColor/80 pb-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className={booking.eyebrow}>{t('cars.categoryLabel')}</p>
                    <h2 className="mt-1.5 font-display text-3xl leading-none text-ink sm:text-4xl">
                      {section.category}
                    </h2>
                  </div>
                  <p className="text-sm text-muted">
                    {t('cars.categoryCount', { count: section.cars.length })}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
                  {section.cars.map((car, index) => (
                    <Motion.div
                      key={car._id}
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.2) }}
                    >
                      <CarCard car={car} />
                    </Motion.div>
                  ))}
                </div>
              </Motion.section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Cars
