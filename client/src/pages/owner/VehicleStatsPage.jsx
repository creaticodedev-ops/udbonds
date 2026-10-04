import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAppContext } from '../../context/AppContext'
import { getErrorMessage } from '../../utils/apiError'
import Title from '../../components/owner/Title'
import { useI18n } from '../../i18n/I18nContext'

const formatCurrency = (value, currency = '$') => `${currency}${Number(value || 0).toLocaleString()}`

const StatCard = ({ label, value, hint, icon, accent = 'from-primary/10 to-primary/5' }) => (
  <div className={`rounded-3xl border border-borderColor bg-gradient-to-br ${accent} p-4 shadow-sm`}>
    <div className='flex items-start justify-between gap-3'>
      <div>
        <p className='text-[11px] uppercase tracking-[0.18em] text-gray-500'>{label}</p>
        <p className='mt-3 text-2xl font-semibold text-gray-900'>{value}</p>
        {hint ? <p className='mt-1 text-sm text-gray-500'>{hint}</p> : null}
      </div>
      <div className='rounded-2xl bg-white/70 p-2 text-primary shadow-sm'>{icon}</div>
    </div>
  </div>
)

const MetricTile = ({ label, value, hint, accent = 'from-slate-50 to-white' }) => (
  <div className={`rounded-3xl border border-borderColor bg-gradient-to-br ${accent} p-4 shadow-sm`}>
    <p className='text-[11px] uppercase tracking-[0.18em] text-gray-500'>{label}</p>
    <p className='mt-3 text-xl font-semibold text-gray-900'>{value}</p>
    {hint ? <p className='mt-1 text-sm text-gray-500'>{hint}</p> : null}
  </div>
)

const TrendChart = ({ data, color, fillColor, valueKey, labelKey, formatter }) => {
  const [activeIndex, setActiveIndex] = useState(data.length ? data.length - 1 : 0)
  const values = data.map((item) => Number(item[valueKey] || 0))
  const max = Math.max(...values, 1)
  const width = 320
  const height = 140
  const step = values.length > 1 ? width / (values.length - 1) : width
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : index * step
    const y = height - (value / max) * (height - 24) - 12
    return `${x},${y}`
  })
  const area = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`
  const line = points.join(' L ')
  const activeItem = data[activeIndex] || data[0] || null

  return (
    <div className='mt-4 rounded-2xl border border-borderColor bg-gray-50/70 p-3'>
      {activeItem ? (
        <div className='mb-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm text-gray-700 shadow-sm'>
          <span>{activeItem[labelKey]}</span>
          <span className='font-semibold text-gray-900'>{formatter ? formatter(activeItem[valueKey]) : activeItem[valueKey]}</span>
        </div>
      ) : null}
      <svg viewBox={`0 0 ${width} ${height}`} className='h-36 w-full'>
        <path d={area} fill={fillColor} />
        <path d={`M ${line}`} fill='none' stroke={color} strokeWidth='3' strokeLinecap='round' />
        {values.map((value, index) => {
          const x = values.length === 1 ? width / 2 : index * step
          const y = height - (value / max) * (height - 24) - 12
          return (
            <circle
              key={`${labelKey}-${index}`}
              cx={x}
              cy={y}
              r='4'
              fill={color}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              className='cursor-pointer'
            />
          )
        })}
      </svg>
      <div className='mt-2 flex justify-between gap-2 text-xs text-gray-500'>
        {data.map((item, index) => (
          <button key={`${item[labelKey]}-${index}`} type='button' className='truncate text-center hover:text-gray-900' onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)}>{item[labelKey]}</button>
        ))}
      </div>
    </div>
  )
}

const ProgressRing = ({ value }) => {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0))
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (safeValue / 100) * circumference

  return (
    <div className='flex items-center gap-4 rounded-3xl border border-borderColor bg-gray-50 p-4'>
      <div className='relative flex h-24 w-24 items-center justify-center'>
        <svg viewBox='0 0 100 100' className='h-24 w-24 -rotate-90'>
          <circle cx='50' cy='50' r={radius} stroke='#e5e7eb' strokeWidth='10' fill='none' />
          <circle cx='50' cy='50' r={radius} stroke='#A51624' strokeWidth='10' fill='none' strokeLinecap='round' strokeDasharray={circumference} strokeDashoffset={offset} />
        </svg>
        <div className='absolute text-center'>
          <p className='text-xl font-semibold text-gray-900'>{safeValue}%</p>
          <p className='text-[11px] uppercase tracking-[0.16em] text-gray-500'>{safeValue > 70 ? 'Healthy' : 'Watch'}</p>
        </div>
      </div>
      <div className='flex-1'>
        <p className='text-sm font-semibold text-gray-900'>{safeValue > 70 ? 'Strong utilization' : 'Room to improve'}</p>
        <p className='mt-2 text-sm text-gray-500'>The current utilization trend indicates how often this car is actively rented.</p>
      </div>
    </div>
  )
}

const VehicleStatsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { axios, currency } = useAppContext()
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [car, setCar] = useState(null)
  const [viewMode, setViewMode] = useState('monthly')
  const [rangePreset, setRangePreset] = useState('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const analytics = stats?.analytics || {}

  const exportReport = (type = 'csv') => {
    if (!analytics || !Object.keys(analytics).length) {
      toast.error(t('admin.vehicleStats.exportError'))
      return
    }

    if (type === 'pdf') {
      window.print()
      return
    }

    const rows = [
      ['Metric', 'Value'],
      [t('admin.vehicleStats.revenueToday'), formatCurrency(analytics.revenueToday, currency)],
      [t('admin.vehicleStats.revenueThisWeek'), formatCurrency(analytics.revenueThisWeek, currency)],
      [t('admin.vehicleStats.revenueThisMonth'), formatCurrency(analytics.revenueThisMonth, currency)],
      [t('admin.vehicleStats.revenueThisYear'), formatCurrency(analytics.revenueThisYear, currency)],
      [t('admin.vehicleStats.lifetimeRevenue'), formatCurrency(analytics.lifetimeRevenue, currency)],
      [t('admin.vehicleStats.avgRevenuePerBooking'), formatCurrency(analytics.averageRevenuePerBooking, currency)],
      [t('admin.vehicleStats.avgDailyRevenue'), formatCurrency(analytics.averageDailyRevenue, currency)],
      [t('admin.vehicleStats.revenuePerRentalDay'), formatCurrency(analytics.revenuePerRentalDay, currency)],
      [t('admin.vehicleStats.estimatedProfit'), formatCurrency(analytics.estimatedProfit, currency)],
      [t('admin.vehicleStats.bestPerformingPeriod'), `${analytics.bestPerformingPeriod?.label || '—'} · ${analytics.bestPerformingPeriod?.revenue ? formatCurrency(analytics.bestPerformingPeriod.revenue, currency) : '—'}`],
    ]

    const csvContent = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${car?.fleetId || car?.licensePlate || 'vehicle'}-analytics.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(t('admin.vehicleStats.exportSuccess'))
  }

  useEffect(() => {
    if (!id) {
      navigate('/owner/manage-cars')
      return
    }

    const load = async () => {
      setLoading(true)
      try {
        const [{ data: carData }, { data: statsData }] = await Promise.all([
          axios.get(`/api/owner/vehicles/${id}`),
          axios.get(`/api/owner/vehicles/${id}/stats`),
        ])

        if (carData.success) {
          setCar(carData.car)
        } else {
          throw new Error(carData.message || t('admin.vehicleStats.notFound'))
        }

        if (statsData.success) {
          setStats(statsData.stats)
        } else {
          throw new Error(statsData.message || t('admin.vehicleStats.loadError'))
        }
      } catch (error) {
        toast.error(getErrorMessage(error))
        navigate('/owner/manage-cars')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [axios, id, navigate, t])

  const overview = stats?.overview || {}
  const monthly = useMemo(() => stats?.monthlyPerformance || [], [stats?.monthlyPerformance])
  const yearly = useMemo(() => stats?.yearlyPerformance || [], [stats?.yearlyPerformance])
  const availability = stats?.availabilityCalendar || []
  const upcoming = stats?.upcomingReservations || []
  const maintenance = stats?.maintenanceHistory || []

  const activeSeries = useMemo(() => (viewMode === 'yearly' ? yearly : monthly), [monthly, yearly, viewMode])

  const currentStatus = useMemo(() => {
    if (!stats?.vehicle?.availability && stats?.vehicle?.status !== 'maintenance') return t('admin.vehicleStats.statusOffline')
    if (stats?.vehicle?.status === 'maintenance') return t('admin.vehicleStats.statusMaintenance')
    return t('admin.vehicleStats.statusAvailable')
  }, [stats, t])

  const filters = [
    { key: 'today', label: t('admin.vehicleStats.today') },
    { key: 'week', label: t('admin.vehicleStats.thisWeek') },
    { key: 'month', label: t('admin.vehicleStats.thisMonth') },
    { key: 'year', label: t('admin.vehicleStats.thisYear') },
    { key: 'custom', label: t('admin.vehicleStats.customRange') },
  ]

  if (loading) {
    return <div className='px-4 py-8 md:px-8 lg:px-10 xl:px-12 md:py-10 text-gray-500'>{t('admin.vehicleStats.loadingDetail')}</div>
  }

  return (
    <div className='px-4 py-8 md:px-8 lg:px-10 xl:px-12 md:py-10 w-full pb-12'>
      <div className='rounded-[28px] border border-borderColor bg-white p-4 shadow-[0_18px_55px_-28px_rgba(22,18,16,0.24)] sm:p-6 lg:p-8'>
        <div className='flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
          <div>
            <Title title={t('admin.vehicleStats.title')} subTitle={t('admin.vehicleStats.subtitle')} />
            <p className='mt-3 text-sm text-gray-500'>
              {car?.brand} {car?.model} • {car?.licensePlate || car?.fleetId || t('admin.vehicleStats.fleetId')} • {t('admin.vehicleStats.currentStatus')}: <span className='font-semibold text-gray-800'>{currentStatus}</span>
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            {filters.map((filter) => (
              <button
                key={filter.key}
                type='button'
                onClick={() => setRangePreset(filter.key)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${rangePreset === filter.key ? 'border-primary bg-primary/10 text-primary' : 'border-borderColor text-gray-600 hover:text-gray-900'}`}
              >
                {filter.label}
              </button>
            ))}
            <button type='button' onClick={() => exportReport('csv')} className='rounded-full border border-borderColor px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900'>{t('admin.vehicleStats.exportCsv')}</button>
            <button type='button' onClick={() => exportReport('pdf')} className='rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/20'>{t('admin.vehicleStats.exportPdf')}</button>
          </div>
        </div>

        <div className='mt-6 flex flex-wrap items-center gap-2'>
          <button type='button' onClick={() => setViewMode('monthly')} className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${viewMode === 'monthly' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{t('admin.vehicleStats.monthlyView')}</button>
          <button type='button' onClick={() => setViewMode('yearly')} className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${viewMode === 'yearly' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{t('admin.vehicleStats.yearlyView')}</button>
          <button type='button' onClick={() => navigate('/owner/vehicle-stats')} className='ml-auto rounded-full border border-borderColor px-3.5 py-2 text-sm text-gray-700'>{t('admin.vehicleStats.backToStats')}</button>
        </div>

        <div className='mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5'>
          <StatCard label={t('admin.vehicleStats.bookings')} value={overview.totalBookings ?? 0} hint={t('admin.vehicleStats.bookingsHint') || t('admin.vehicleStats.bookings')} icon={<svg viewBox='0 0 24 24' className='h-5 w-5'><path fill='currentColor' d='M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 3v10h12V7H6z' /></svg>} accent='from-sky-50 to-sky-100' />
          <StatCard label={t('admin.vehicleStats.revenue')} value={formatCurrency(overview.totalRevenue, currency)} hint={t('admin.vehicleStats.revenueHint') || t('admin.vehicleStats.revenue')} icon={<svg viewBox='0 0 24 24' className='h-5 w-5'><path fill='currentColor' d='M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 5h-2v2h2zm0 6h-2v4h2z' /></svg>} accent='from-emerald-50 to-emerald-100' />
          <StatCard label={t('admin.vehicleStats.utilization')} value={overview.utilizationRate ?? '0.0%'} hint={t('admin.vehicleStats.utilizationHint') || t('admin.vehicleStats.utilization')} icon={<svg viewBox='0 0 24 24' className='h-5 w-5'><path fill='currentColor' d='M4 4h16v2H4zm4 4h8v2H8zm-2 4h12v2H6zm2 4h8v2H8z' /></svg>} accent='from-violet-50 to-violet-100' />
          <StatCard label={t('admin.vehicleStats.rentalDays')} value={overview.rentalDays ?? 0} hint={t('admin.vehicleStats.rentalDaysHint') || t('admin.vehicleStats.rentalDays')} icon={<svg viewBox='0 0 24 24' className='h-5 w-5'><path fill='currentColor' d='M7 2h2v2h6V2h2v2h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2zM5 8v10h14V8H5z' /></svg>} accent='from-amber-50 to-amber-100' />
          <StatCard label={t('admin.vehicleStats.averageRental')} value={overview.averageRentalDuration ?? '0.0 days'} hint={t('admin.vehicleStats.averageRentalHint') || t('admin.vehicleStats.averageRental')} icon={<svg viewBox='0 0 24 24' className='h-5 w-5'><path fill='currentColor' d='M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 2a8 8 0 1 1-8 8 8 8 0 0 1 8-8zm-.5 2h1v6l4.2 2.5-0.6 1-4.6-2.8z' /></svg>} accent='from-rose-50 to-rose-100' />
        </div>

        <div className='mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-4'>
          <StatCard label={t('admin.vehicleStats.monthlyRevenue')} value={formatCurrency(overview.monthlyRevenue, currency)} hint={t('admin.vehicleStats.monthlyRevenueHint') || t('admin.vehicleStats.monthlyRevenue')} icon={<svg viewBox='0 0 24 24' className='h-5 w-5'><path fill='currentColor' d='M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 4v10h10V7H7zm2 2h6v2H9zm0 4h4v2H9z' /></svg>} accent='from-cyan-50 to-cyan-100' />
          <StatCard label={t('admin.vehicleStats.yearlyRevenue')} value={formatCurrency(overview.yearlyRevenue, currency)} hint={t('admin.vehicleStats.yearlyRevenueHint') || t('admin.vehicleStats.yearlyRevenue')} icon={<svg viewBox='0 0 24 24' className='h-5 w-5'><path fill='currentColor' d='M4 4h16v2H4zm0 4h10v2H4zm0 4h16v2H4zm0 4h6v2H4z' /></svg>} accent='from-indigo-50 to-indigo-100' />
          <StatCard label={t('admin.vehicleStats.avgRevenuePerBooking')} value={formatCurrency(overview.averageRevenuePerBooking, currency)} hint={t('admin.vehicleStats.avgRevenuePerBookingHint') || t('admin.vehicleStats.avgRevenuePerBooking')} icon={<svg viewBox='0 0 24 24' className='h-5 w-5'><path fill='currentColor' d='M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 5h-2v2h2zm0 6h-2v4h2z' /></svg>} accent='from-orange-50 to-orange-100' />
          <StatCard label={t('admin.vehicleStats.outstandingBalance')} value={formatCurrency(overview.outstandingBalance, currency)} hint={t('admin.vehicleStats.outstandingBalanceHint') || t('admin.vehicleStats.outstandingBalance')} icon={<svg viewBox='0 0 24 24' className='h-5 w-5'><path fill='currentColor' d='M4 7h16v10H4zm2 2v6h12v-6zm2 2h4v2H8z' /></svg>} accent='from-amber-50 to-amber-100' />
        </div>

        <div className='mt-8 rounded-3xl border border-borderColor bg-white p-6 shadow-sm'>
          <div className='flex flex-col gap-2 md:flex-row md:items-end md:justify-between'>
            <div>
              <p className='text-sm font-semibold text-gray-900'>{t('admin.vehicleStats.businessIntelligence')}</p>
              <p className='text-sm text-gray-500'>{t('admin.vehicleStats.businessIntelligenceHint')}</p>
            </div>
            <div className='rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'>
              {t('admin.vehicleStats.bestPerformingPeriod')}: {analytics.bestPerformingPeriod?.label || '—'}
            </div>
          </div>
          <div className='mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
            <MetricTile label={t('admin.vehicleStats.revenueToday')} value={formatCurrency(analytics.revenueToday, currency)} hint={t('admin.vehicleStats.revenueTodayHint')} accent='from-emerald-50 to-white' />
            <MetricTile label={t('admin.vehicleStats.revenueThisWeek')} value={formatCurrency(analytics.revenueThisWeek, currency)} hint={t('admin.vehicleStats.revenueThisWeekHint')} accent='from-sky-50 to-white' />
            <MetricTile label={t('admin.vehicleStats.revenueThisMonth')} value={formatCurrency(analytics.revenueThisMonth, currency)} hint={t('admin.vehicleStats.revenueThisMonthHint')} accent='from-violet-50 to-white' />
            <MetricTile label={t('admin.vehicleStats.revenueThisYear')} value={formatCurrency(analytics.revenueThisYear, currency)} hint={t('admin.vehicleStats.revenueThisYearHint')} accent='from-amber-50 to-white' />
            <MetricTile label={t('admin.vehicleStats.lifetimeRevenue')} value={formatCurrency(analytics.lifetimeRevenue, currency)} hint={t('admin.vehicleStats.lifetimeRevenueHint')} accent='from-cyan-50 to-white' />
            <MetricTile label={t('admin.vehicleStats.avgDailyRevenue')} value={formatCurrency(analytics.averageDailyRevenue, currency)} hint={t('admin.vehicleStats.avgDailyRevenueHint')} accent='from-indigo-50 to-white' />
            <MetricTile label={t('admin.vehicleStats.revenuePerRentalDay')} value={formatCurrency(analytics.revenuePerRentalDay, currency)} hint={t('admin.vehicleStats.revenuePerRentalDayHint')} accent='from-orange-50 to-white' />
            <MetricTile label={t('admin.vehicleStats.estimatedProfit')} value={formatCurrency(analytics.estimatedProfit, currency)} hint={`${t('admin.vehicleStats.profitMargin')}: ${analytics.profitMargin ?? 0}%`} accent='from-rose-50 to-white' />
          </div>
          <div className='mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]'>
            <div className='rounded-2xl border border-borderColor bg-gray-50/70 p-4'>
              <p className='text-sm font-semibold text-gray-900'>{t('admin.vehicleStats.periodComparison')}</p>
              <div className='mt-4 space-y-3'>
                <div className='flex items-center justify-between rounded-2xl border border-borderColor bg-white px-3 py-3 text-sm'>
                  <span>{t('admin.vehicleStats.weeklyComparison')}</span>
                  <span className='font-semibold text-gray-900'>{analytics.growth?.weekly >= 0 ? '+' : ''}{analytics.growth?.weekly ?? 0}%</span>
                </div>
                <div className='flex items-center justify-between rounded-2xl border border-borderColor bg-white px-3 py-3 text-sm'>
                  <span>{t('admin.vehicleStats.monthlyComparison')}</span>
                  <span className='font-semibold text-gray-900'>{analytics.growth?.monthly >= 0 ? '+' : ''}{analytics.growth?.monthly ?? 0}%</span>
                </div>
                <div className='flex items-center justify-between rounded-2xl border border-borderColor bg-white px-3 py-3 text-sm'>
                  <span>{t('admin.vehicleStats.yearlyComparison')}</span>
                  <span className='font-semibold text-gray-900'>{analytics.growth?.yearly >= 0 ? '+' : ''}{analytics.growth?.yearly ?? 0}%</span>
                </div>
              </div>
            </div>
            <div className='rounded-2xl border border-borderColor bg-gray-50/70 p-4'>
              <p className='text-sm font-semibold text-gray-900'>{t('admin.vehicleStats.operationalOutlook')}</p>
              <div className='mt-4 space-y-3 text-sm text-gray-600'>
                <div className='flex justify-between rounded-2xl border border-borderColor bg-white px-3 py-3'>
                  <span>{t('admin.vehicleStats.bookingsWeek')}</span>
                  <span className='font-semibold text-gray-900'>{analytics.bookingsByWeek?.[analytics.bookingsByWeek.length - 1]?.bookings ?? 0}</span>
                </div>
                <div className='flex justify-between rounded-2xl border border-borderColor bg-white px-3 py-3'>
                  <span>{t('admin.vehicleStats.bookingsMonth')}</span>
                  <span className='font-semibold text-gray-900'>{analytics.bookingsByMonth?.[analytics.bookingsByMonth.length - 1]?.bookings ?? 0}</span>
                </div>
                <div className='flex justify-between rounded-2xl border border-borderColor bg-white px-3 py-3'>
                  <span>{t('admin.vehicleStats.bookingsYear')}</span>
                  <span className='font-semibold text-gray-900'>{analytics.bookingsByYear?.[analytics.bookingsByYear.length - 1]?.bookings ?? 0}</span>
                </div>
                <div className='flex justify-between rounded-2xl border border-borderColor bg-white px-3 py-3'>
                  <span>{t('admin.vehicleStats.occupancyRate')}</span>
                  <span className='font-semibold text-gray-900'>{analytics.occupancyByMonth?.[analytics.occupancyByMonth.length - 1]?.occupancyRate ?? 0}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]'>
          <div className='rounded-3xl border border-borderColor bg-white p-6 shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-semibold text-gray-900'>{t('admin.vehicleStats.revenueTrend')}</p>
                <p className='text-sm text-gray-500'>{t('admin.vehicleStats.revenueTrendHint')}</p>
              </div>
              <div className='rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'>{rangePreset === 'custom' ? t('admin.vehicleStats.customRange') : t('admin.vehicleStats.currentFocus')}</div>
            </div>
            <TrendChart data={activeSeries} color='#A51624' fillColor='rgba(165, 22, 36, 0.13)' valueKey='revenue' labelKey='label' formatter={formatCurrency} />
          </div>

          <div className='rounded-3xl border border-borderColor bg-white p-6 shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-semibold text-gray-900'>{t('admin.vehicleStats.vehicleProfile')}</p>
                <p className='text-sm text-gray-500'>{t('admin.vehicleStats.vehicleProfileHint')}</p>
              </div>
            </div>
            <div className='mt-5 space-y-3 text-sm text-gray-600'>
              <div className='flex justify-between border-b border-borderColor pb-2'><span>{t('admin.vehicleStats.brand')}</span><span className='font-medium text-gray-900'>{car?.brand || '—'}</span></div>
              <div className='flex justify-between border-b border-borderColor pb-2'><span>{t('admin.vehicleStats.model')}</span><span className='font-medium text-gray-900'>{car?.model || '—'}</span></div>
              <div className='flex justify-between border-b border-borderColor pb-2'><span>{t('admin.vehicleStats.category')}</span><span className='font-medium text-gray-900'>{car?.category || '—'}</span></div>
              <div className='flex justify-between border-b border-borderColor pb-2'><span>{t('admin.vehicleStats.fleetPlate')}</span><span className='font-medium text-gray-900'>{car?.licensePlate || '—'}</span></div>
              <div className='flex justify-between'><span>{t('admin.vehicleStats.fleetIdLabel')}</span><span className='font-medium text-gray-900'>{car?.fleetId || '—'}</span></div>
            </div>
          </div>
        </div>

        <div className='mt-8 grid gap-6 lg:grid-cols-2'>
          <div className='rounded-3xl border border-borderColor bg-white p-6 shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-semibold text-gray-900'>{t('admin.vehicleStats.bookingTrend')}</p>
                <p className='text-sm text-gray-500'>{t('admin.vehicleStats.bookingTrendHint')}</p>
              </div>
            </div>
            <TrendChart data={activeSeries} color='#0F766E' fillColor='rgba(15, 118, 110, 0.14)' valueKey='bookings' labelKey='label' formatter={(value) => `${value}`} />
          </div>

          <div className='rounded-3xl border border-borderColor bg-white p-6 shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-semibold text-gray-900'>{t('admin.vehicleStats.utilizationTrend')}</p>
                <p className='text-sm text-gray-500'>{t('admin.vehicleStats.utilizationTrendHint')}</p>
              </div>
            </div>
            <div className='mt-4 space-y-4'>
              <ProgressRing value={Number(overview.utilizationRate?.replace('%', '') || 0)} />
              <div className='grid gap-2 sm:grid-cols-2'>
                <div className='rounded-2xl border border-borderColor bg-gray-50 p-3'>
                  <p className='text-[11px] uppercase tracking-[0.16em] text-gray-500'>{t('admin.vehicleStats.completed')}</p>
                  <p className='mt-1 text-xl font-semibold text-gray-900'>{overview.completedBookings ?? 0}</p>
                </div>
                <div className='rounded-2xl border border-borderColor bg-gray-50 p-3'>
                  <p className='text-[11px] uppercase tracking-[0.16em] text-gray-500'>{t('admin.vehicleStats.activeBookings')}</p>
                  <p className='mt-1 text-xl font-semibold text-gray-900'>{overview.activeBookings ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]'>
          <div className='rounded-3xl border border-borderColor bg-white p-6 shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-semibold text-gray-900'>{t('admin.vehicleStats.availabilityTimeline')}</p>
                <p className='text-sm text-gray-500'>{t('admin.vehicleStats.availabilityHint')}</p>
              </div>
            </div>
            <div className='mt-5 grid gap-2 md:grid-cols-7'>
              {availability.slice(0, 7).map((day) => (
                <div key={day.date} className='rounded-2xl border border-borderColor bg-gray-50 p-3 text-center text-sm'>
                  <p className='font-medium text-gray-700'>{day.label}</p>
                  <p className='mt-2 text-xs text-gray-500'>{day.date}</p>
                  <p className={`mt-2 rounded-full px-2 py-1 text-[11px] font-semibold ${day.isBooked ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{day.isBooked ? t('admin.vehicleStats.booked') : t('admin.vehicleStats.free')}</p>
                </div>
              ))}
            </div>
          </div>

          <div className='rounded-3xl border border-borderColor bg-white p-6 shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-semibold text-gray-900'>{t('admin.vehicleStats.operations')}</p>
                <p className='text-sm text-gray-500'>{t('admin.vehicleStats.operationsHint')}</p>
              </div>
            </div>
            <div className='mt-5 space-y-3'>
              <div className='rounded-2xl border border-borderColor bg-gray-50 p-4'>
                <div className='flex items-center justify-between'>
                  <span className='font-medium text-gray-800'>{t('admin.vehicleStats.upcomingReservations')}</span>
                  <span className='text-sm font-semibold text-gray-900'>{upcoming.length}</span>
                </div>
                <p className='mt-2 text-sm text-gray-500'>{t('admin.vehicleStats.upcomingHint')}</p>
              </div>
              <div className='rounded-2xl border border-borderColor bg-gray-50 p-4'>
                <div className='flex items-center justify-between'>
                  <span className='font-medium text-gray-800'>{t('admin.vehicleStats.maintenanceHistory')}</span>
                  <span className='text-sm font-semibold text-gray-900'>{maintenance.length}</span>
                </div>
                <p className='mt-2 text-sm text-gray-500'>{t('admin.vehicleStats.maintenanceHint')}</p>
              </div>
              {rangePreset === 'custom' && (
                <div className='rounded-2xl border border-dashed border-borderColor bg-white p-4'>
                  <p className='text-sm font-medium text-gray-800'>{t('admin.vehicleStats.customRange')}</p>
                  <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                    <label className='text-sm text-gray-600'>
                      <span className='mb-1 block'>{t('admin.vehicleStats.from')}</span>
                      <input type='date' value={customStart} onChange={(e) => setCustomStart(e.target.value)} className='w-full rounded-xl border border-borderColor px-3 py-2 text-sm' />
                    </label>
                    <label className='text-sm text-gray-600'>
                      <span className='mb-1 block'>{t('admin.vehicleStats.to')}</span>
                      <input type='date' value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className='w-full rounded-xl border border-borderColor px-3 py-2 text-sm' />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VehicleStatsPage
