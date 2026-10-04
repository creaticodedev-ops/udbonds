import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Title from '../../components/owner/Title'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../utils/apiError'

const toInputDate = (v) => {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d)) return ''
  return d.toISOString().split('T')[0]
}

const STATUS_STYLES = {
  available: 'bg-emerald-100 text-emerald-700',
  booked: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-amber-100 text-amber-800',
}

const TYPE_LABELS = {
  oil_change: 'Oil change',
  tire_replacement: 'Tire replacement',
  general_service: 'General service',
  repair: 'Repair',
  inspection: 'Technical inspection',
  insurance: 'Insurance',
  registration: 'Registration',
  other: 'Other',
}

const emptyRecord = {
  carId: '',
  type: 'general_service',
  title: '',
  description: '',
  status: 'scheduled',
  scheduledDate: '',
  completedDate: '',
  mileageAtService: '',
  cost: '',
  vendor: '',
  invoiceRef: '',
  nextDueDate: '',
  nextDueMileage: '',
  notes: '',
  setCarInMaintenance: true,
}

const formatUnit = (car) => {
  if (!car) return '—'
  const fleet = car.fleetId ? `[${car.fleetId}] ` : ''
  const plate = car.licensePlate ? ` · ${car.licensePlate}` : ''
  const branch = car.branch ? ` · ${car.branch}` : ''
  return `${fleet}${car.brand || ''} ${car.model || ''}${plate}${branch}`.trim()
}

const Maintenance = () => {
  const { axios, currency } = useAppContext()
  const { t } = useI18n()
  const [tab, setTab] = useState('fleet')
  const [cars, setCars] = useState([])
  const [branches, setBranches] = useState([])
  const [alerts, setAlerts] = useState([])
  const [summary, setSummary] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [records, setRecords] = useState([])
  const [events, setEvents] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [showRecord, setShowRecord] = useState(false)
  const [recordForm, setRecordForm] = useState(emptyRecord)
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1)
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [filters, setFilters] = useState({
    search: '',
    fleetId: '',
    vin: '',
    plate: '',
    status: '',
    branch: '',
  })
  const [applied, setApplied] = useState(filters)

  const loadFleet = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      Object.entries(applied).forEach(([k, v]) => {
        if (v) params[k] = v
      })
      const { data } = await axios.get('/api/owner/maintenance', { params })
      if (data.success) {
        setCars(data.cars)
        setAlerts(data.alerts)
        setSummary(data.summary)
        setUpcoming(data.upcoming || [])
        setBranches(data.branches || [])
      } else toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [axios, applied])

  const loadRecords = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/owner/maintenance/records', { params: { limit: 50 } })
      if (data.success) setRecords(data.records)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }, [axios])

  const loadCalendar = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/owner/maintenance/calendar', {
        params: { month: calMonth, year: calYear },
      })
      if (data.success) setEvents(data.events || [])
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }, [axios, calMonth, calYear])

  const loadReport = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/owner/maintenance/report')
      if (data.success) setReport(data.report)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }, [axios])

  useEffect(() => { loadFleet() }, [loadFleet])
  useEffect(() => {
    if (tab === 'history') loadRecords()
    if (tab === 'calendar') loadCalendar()
    if (tab === 'reports') loadReport()
  }, [tab, loadRecords, loadCalendar, loadReport])

  const startEdit = (car) => {
    setEditing(car)
    setForm({
      mileage: car.mileage || '',
      nextServiceMileage: car.nextServiceMileage || '',
      nextServiceDate: toInputDate(car.nextServiceDate),
      lastServiceDate: toInputDate(car.lastServiceDate),
      insuranceExpiry: toInputDate(car.insuranceExpiry),
      registrationExpiry: toInputDate(car.registrationExpiry),
      inspectionExpiry: toInputDate(car.inspectionExpiry),
      oilLastChangedAt: toInputDate(car.oilLastChangedAt),
      oilNextDueAt: toInputDate(car.oilNextDueAt),
      oilNextDueMileage: car.oilNextDueMileage || '',
      tireLastChangedAt: toInputDate(car.tireLastChangedAt),
      tireNextDueAt: toInputDate(car.tireNextDueAt),
      tireNextDueMileage: car.tireNextDueMileage || '',
      maintenanceNotes: car.maintenanceNotes || '',
      licensePlate: car.licensePlate || '',
      status: car.status || 'available',
    })
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    try {
      const { data } = await axios.post('/api/owner/maintenance/update', {
        carId: editing._id,
        ...form,
        nextServiceDate: form.nextServiceDate || null,
        lastServiceDate: form.lastServiceDate || null,
        insuranceExpiry: form.insuranceExpiry || null,
        registrationExpiry: form.registrationExpiry || null,
        inspectionExpiry: form.inspectionExpiry || null,
        oilLastChangedAt: form.oilLastChangedAt || null,
        oilNextDueAt: form.oilNextDueAt || null,
        tireLastChangedAt: form.tireLastChangedAt || null,
        tireNextDueAt: form.tireNextDueAt || null,
      })
      if (data.success) {
        toast.success(data.message)
        setEditing(null)
        loadFleet()
      } else toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const saveRecord = async (e) => {
    e.preventDefault()
    try {
      const { data } = await axios.post('/api/owner/maintenance/records', {
        ...recordForm,
        mileageAtService: recordForm.mileageAtService || null,
        cost: recordForm.cost || 0,
        nextDueMileage: recordForm.nextDueMileage || null,
        scheduledDate: recordForm.scheduledDate || null,
        completedDate: recordForm.completedDate || null,
        nextDueDate: recordForm.nextDueDate || null,
      })
      if (data.success) {
        toast.success(data.message)
        setShowRecord(false)
        setRecordForm(emptyRecord)
        loadFleet()
        if (tab === 'history') loadRecords()
      } else toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const completeRecord = async (recordId) => {
    try {
      const { data } = await axios.patch('/api/owner/maintenance/records', {
        recordId,
        status: 'completed',
        completedDate: new Date().toISOString(),
      })
      if (data.success) {
        toast.success('Marked complete')
        loadRecords()
        loadFleet()
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const daysInMonth = useMemo(() => new Date(calYear, calMonth, 0).getDate(), [calYear, calMonth])
  const eventsByDay = useMemo(() => {
    const map = {}
    for (const ev of events) {
      const d = new Date(ev.scheduledDate || ev.completedDate || ev.nextDueDate)
      if (isNaN(d)) continue
      if (d.getMonth() + 1 !== calMonth || d.getFullYear() !== calYear) continue
      const day = d.getDate()
      map[day] = map[day] || []
      map[day].push(ev)
    }
    return map
  }, [events, calMonth, calYear])

  const inputClass = 'border border-borderColor rounded-md px-3 py-2 text-sm w-full outline-none focus:border-primary'
  const tabs = [
    { id: 'fleet', label: t('admin.maintenance.tabFleet') },
    { id: 'schedule', label: t('admin.maintenance.tabSchedule') },
    { id: 'history', label: t('admin.maintenance.tabHistory') },
    { id: 'calendar', label: t('admin.maintenance.tabCalendar') },
    { id: 'reports', label: t('admin.maintenance.tabReports') },
  ]

  return (
    <div className="px-4 pt-8 md:px-8 lg:px-10 xl:px-12 md:pt-10 flex-1 pb-12 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <Title title={t('admin.maintenance.title')} subTitle={t('admin.maintenance.subtitle')} />
        <button
          type="button"
          onClick={() => { setRecordForm(emptyRecord); setShowRecord(true) }}
          className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dull"
        >
          {t('admin.maintenance.scheduleWork')}
        </button>
      </div>

      {summary && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: t('admin.maintenance.totalFleet'), value: summary.total },
            { label: t('admin.maintenance.available'), value: summary.available, tone: 'text-emerald-600' },
            { label: t('admin.maintenance.rented'), value: summary.rented, tone: 'text-blue-600' },
            { label: t('admin.maintenance.inShop'), value: summary.maintenance, tone: 'text-amber-700' },
            { label: t('admin.maintenance.critical'), value: summary.criticalAlerts, tone: 'text-red-600' },
            { label: t('admin.maintenance.costs'), value: `${currency}${summary.totalMaintenanceCost || 0}` },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-borderColor bg-white p-3 min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 truncate">{k.label}</p>
              <p className={`text-lg font-semibold mt-1 ${k.tone || 'text-gray-800'}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-borderColor">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
              tab === tb.id ? 'border-primary text-primary font-medium' : 'border-transparent text-gray-500'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'fleet' && (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); setApplied({ ...filters }) }}
            className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-borderColor bg-white p-4"
          >
            <input
              className={inputClass}
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
              <option value="available">{t('admin.fleet.available')}</option>
              <option value="booked">{t('admin.maintenance.rented')}</option>
              <option value="maintenance">{t('admin.maintenance.inShop')}</option>
            </select>
            <select
              className={inputClass}
              value={filters.branch}
              onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
            >
              <option value="">{t('admin.fleet.allBranches')}</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dull">
                {t('admin.fleet.apply')}
              </button>
              <button
                type="button"
                className="px-4 py-2 border border-borderColor text-sm rounded-lg"
                onClick={() => {
                  const empty = { search: '', fleetId: '', vin: '', plate: '', status: '', branch: '' }
                  setFilters(empty)
                  setApplied(empty)
                }}
              >
                {t('admin.fleet.clear')}
              </button>
            </div>
          </form>

          {alerts.length > 0 && (
            <div className="mt-6 space-y-2">
              <h2 className="text-sm font-semibold text-gray-700">{t('admin.maintenance.activeAlerts')}</h2>
              {alerts.slice(0, 12).map((a, i) => (
                <div
                  key={`${a.carId}-${a.type}-${i}`}
                  className={`rounded-lg border px-4 py-3 text-sm ${a.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}
                >
                  <span className="font-medium">{a.vehicle}</span> — {a.message}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-borderColor bg-white overflow-hidden">
            {loading ? (
              <p className="p-6 text-gray-400 text-sm">{t('admin.maintenance.loading')}</p>
            ) : cars.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">{t('admin.fleet.none')}</p>
            ) : (
              <div className="overflow-x-auto table-scroll">
                <table className="w-full text-sm text-left min-w-[1100px]">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">{t('admin.fleet.fleetId')}</th>
                      <th className="px-4 py-3">{t('admin.maintenance.vehicle')}</th>
                      <th className="px-4 py-3">{t('admin.fleet.plate')}</th>
                      <th className="px-4 py-3">{t('admin.fleet.vin')}</th>
                      <th className="px-4 py-3">{t('admin.fleet.branch')}</th>
                      <th className="px-4 py-3">{t('admin.maintenance.mileage')}</th>
                      <th className="px-4 py-3">{t('admin.maintenance.nextService')}</th>
                      <th className="px-4 py-3">{t('admin.maintenance.oil')}</th>
                      <th className="px-4 py-3">{t('admin.maintenance.tires')}</th>
                      <th className="px-4 py-3">{t('admin.maintenance.insurance')}</th>
                      <th className="px-4 py-3">{t('admin.maintenance.inspection')}</th>
                      <th className="px-4 py-3">{t('admin.maintenance.status')}</th>
                      <th className="px-4 py-3">{t('admin.maintenance.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cars.map((car) => (
                      <tr key={car._id} className="border-t border-borderColor hover:bg-gray-50/80">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{car.fleetId || '—'}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{car.brand} {car.model}</p>
                          <p className="text-xs text-gray-400">{car.year} · {car.category}</p>
                        </td>
                        <td className="px-4 py-3 font-medium">{car.licensePlate || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{car.vin || '—'}</td>
                        <td className="px-4 py-3 text-xs">{car.branch || car.location || '—'}</td>
                        <td className="px-4 py-3">{car.mileage || 0} km</td>
                        <td className="px-4 py-3 text-xs">
                          {car.nextServiceDate ? new Date(car.nextServiceDate).toLocaleDateString() : '—'}
                          {car.nextServiceMileage ? <span className="block text-gray-400">@{car.nextServiceMileage} km</span> : null}
                        </td>
                        <td className="px-4 py-3 text-xs">{car.oilNextDueAt ? new Date(car.oilNextDueAt).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3 text-xs">{car.tireNextDueAt ? new Date(car.tireNextDueAt).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3 text-xs">{car.insuranceExpiry ? new Date(car.insuranceExpiry).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3 text-xs">{car.inspectionExpiry ? new Date(car.inspectionExpiry).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[car.displayStatus] || STATUS_STYLES.available}`}>
                            {car.displayStatusLabel || car.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => startEdit(car)} className="text-primary text-xs hover:underline">
                            {t('admin.maintenance.update')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'schedule' && (
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">{t('admin.maintenance.upcoming30')}</h2>
          {upcoming.length === 0 && <p className="text-sm text-gray-400">{t('admin.maintenance.noUpcoming')}</p>}
          {upcoming.map((r) => (
            <div key={r._id} className="rounded-xl border border-borderColor bg-white p-4 flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-medium text-gray-800">{r.title}</p>
                <p className="text-xs text-gray-500">
                  {formatUnit(r.car)} · {TYPE_LABELS[r.type] || r.type} · {r.status}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                {r.scheduledDate ? new Date(r.scheduledDate).toLocaleDateString() : '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="mt-6 rounded-xl border border-borderColor bg-white overflow-hidden">
          <div className="overflow-x-auto table-scroll">
            <table className="w-full text-sm text-left min-w-[800px]">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id} className="border-t border-borderColor">
                    <td className="px-4 py-3 text-xs">
                      {r.completedDate
                        ? new Date(r.completedDate).toLocaleDateString()
                        : r.scheduledDate
                          ? new Date(r.scheduledDate).toLocaleDateString()
                          : '—'}
                    </td>
                    <td className="px-4 py-3">{formatUnit(r.car)}</td>
                    <td className="px-4 py-3 text-xs">{TYPE_LABELS[r.type] || r.type}</td>
                    <td className="px-4 py-3">{r.title}</td>
                    <td className="px-4 py-3">{currency}{r.cost || 0}</td>
                    <td className="px-4 py-3 capitalize text-xs">{r.status}</td>
                    <td className="px-4 py-3">
                      {r.status !== 'completed' && r.status !== 'cancelled' && (
                        <button type="button" onClick={() => completeRecord(r._id)} className="text-xs text-primary hover:underline">
                          Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!records.length && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No service history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'calendar' && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <button type="button" className="px-3 py-1.5 border rounded-lg text-sm" onClick={() => {
              if (calMonth === 1) { setCalMonth(12); setCalYear((y) => y - 1) }
              else setCalMonth((m) => m - 1)
            }}>Prev</button>
            <p className="text-sm font-medium text-gray-800 min-w-[8rem] text-center">
              {new Date(calYear, calMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </p>
            <button type="button" className="px-3 py-1.5 border rounded-lg text-sm" onClick={() => {
              if (calMonth === 12) { setCalMonth(1); setCalYear((y) => y + 1) }
              else setCalMonth((m) => m + 1)
            }}>Next</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-gray-400 py-1 font-medium">{d}</div>
            ))}
            {Array.from({ length: new Date(calYear, calMonth - 1, 1).getDay() }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayEvents = eventsByDay[day] || []
              return (
                <div key={day} className="min-h-[4.5rem] border border-borderColor rounded-md p-1 bg-white">
                  <p className="text-[10px] text-gray-400">{day}</p>
                  {dayEvents.slice(0, 3).map((ev) => (
                    <p key={ev._id} className="text-[9px] leading-tight truncate text-amber-800 bg-amber-50 rounded px-0.5 mt-0.5">
                      {ev.title}
                    </p>
                  ))}
                  {dayEvents.length > 3 && <p className="text-[9px] text-gray-400">+{dayEvents.length - 3}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'reports' && report && (
        <div className="mt-6 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-400 uppercase">Total cost (YTD)</p>
              <p className="text-2xl font-semibold text-primary mt-1">{currency}{report.totalCost}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-400 uppercase">Jobs completed</p>
              <p className="text-2xl font-semibold mt-1">{report.recordCount}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-400 uppercase">By type</p>
              <ul className="mt-2 text-xs space-y-1 max-h-24 overflow-y-auto">
                {Object.entries(report.byType || {}).map(([type, v]) => (
                  <li key={type} className="flex justify-between gap-2">
                    <span>{TYPE_LABELS[type] || type}</span>
                    <span>{v.count} · {currency}{v.cost}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded-xl border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Vehicle</th>
                  <th className="px-4 py-3 text-left">Jobs</th>
                  <th className="px-4 py-3 text-left">Cost</th>
                </tr>
              </thead>
              <tbody>
                {(report.byVehicle || []).map((v) => (
                  <tr key={v.vehicle} className="border-t">
                    <td className="px-4 py-3">{v.vehicle}</td>
                    <td className="px-4 py-3">{v.count}</td>
                    <td className="px-4 py-3">{currency}{v.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit vehicle profile modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <form onSubmit={saveProfile} className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-2xl max-h-[90svh] overflow-y-auto p-5 sm:p-6 space-y-4">
            <h3 className="text-lg font-semibold">
              {editing.fleetId ? `[${editing.fleetId}] ` : ''}{editing.brand} {editing.model}
              {editing.licensePlate ? ` · ${editing.licensePlate}` : ''}
            </h3>
            <p className="text-xs text-gray-500 -mt-2">
              {editing.vin ? `VIN ${editing.vin}` : 'No VIN'} · {editing.branch || editing.location || 'No branch'}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ['licensePlate', 'Plate'],
                ['mileage', 'Mileage (km)'],
                ['status', 'Status'],
                ['nextServiceMileage', 'Next service km'],
                ['nextServiceDate', 'Next service date', 'date'],
                ['lastServiceDate', 'Last service', 'date'],
                ['oilNextDueAt', 'Oil due date', 'date'],
                ['oilNextDueMileage', 'Oil due km'],
                ['tireNextDueAt', 'Tires due date', 'date'],
                ['tireNextDueMileage', 'Tires due km'],
                ['insuranceExpiry', 'Insurance expiry', 'date'],
                ['registrationExpiry', 'Registration expiry', 'date'],
                ['inspectionExpiry', 'Inspection expiry', 'date'],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500">{label}</label>
                  {key === 'status' ? (
                    <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="available">Available</option>
                      <option value="booked">Rented</option>
                      <option value="maintenance">In Maintenance</option>
                    </select>
                  ) : (
                    <input
                      type={type || 'text'}
                      className={inputClass}
                      value={form[key] ?? ''}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500">Notes</label>
                <textarea className={inputClass} rows={2} value={form.maintenanceNotes} onChange={(e) => setForm({ ...form, maintenanceNotes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg text-sm">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* Schedule / log work modal */}
      {showRecord && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <form onSubmit={saveRecord} className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-lg max-h-[90svh] overflow-y-auto p-5 sm:p-6 space-y-3">
            <h3 className="text-lg font-semibold">{t('admin.maintenance.scheduleWork')}</h3>
            <div>
              <label className="text-xs text-gray-500">Vehicle *</label>
              <select required className={inputClass} value={recordForm.carId} onChange={(e) => setRecordForm({ ...recordForm, carId: e.target.value })}>
                <option value="">Select…</option>
                {cars.map((c) => (
                  <option key={c._id} value={c._id}>{formatUnit(c)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Type</label>
                <select className={inputClass} value={recordForm.type} onChange={(e) => setRecordForm({ ...recordForm, type: e.target.value })}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Status</label>
                <select className={inputClass} value={recordForm.status} onChange={(e) => setRecordForm({ ...recordForm, status: e.target.value })}>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Title *</label>
              <input required className={inputClass} value={recordForm.title} onChange={(e) => setRecordForm({ ...recordForm, title: e.target.value })} placeholder="e.g. 10,000 km service" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Scheduled</label>
                <input type="date" className={inputClass} value={recordForm.scheduledDate} onChange={(e) => setRecordForm({ ...recordForm, scheduledDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Cost</label>
                <input type="number" min="0" step="0.01" className={inputClass} value={recordForm.cost} onChange={(e) => setRecordForm({ ...recordForm, cost: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Mileage</label>
                <input type="number" className={inputClass} value={recordForm.mileageAtService} onChange={(e) => setRecordForm({ ...recordForm, mileageAtService: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Vendor</label>
                <input className={inputClass} value={recordForm.vendor} onChange={(e) => setRecordForm({ ...recordForm, vendor: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Next due date</label>
                <input type="date" className={inputClass} value={recordForm.nextDueDate} onChange={(e) => setRecordForm({ ...recordForm, nextDueDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Next due km</label>
                <input type="number" className={inputClass} value={recordForm.nextDueMileage} onChange={(e) => setRecordForm({ ...recordForm, nextDueMileage: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={recordForm.setCarInMaintenance} onChange={(e) => setRecordForm({ ...recordForm, setCarInMaintenance: e.target.checked })} />
              Mark vehicle In Maintenance while work is open
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowRecord(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg text-sm">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default Maintenance
