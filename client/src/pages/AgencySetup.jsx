import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useAppContext } from '../context/AppContext'
import { getErrorMessage } from '../utils/apiError'
import { BRAND_NAME } from '../constants/brand'
import NoIndexHead from '../seo/NoIndexHead'
import Loader from '../components/Loader'

const STEPS = [
  { key: 'account', label: 'Account' },
  { key: 'agency', label: 'Agency' },
  { key: 'branding', label: 'Branding' },
  { key: 'complete', label: 'Complete' },
]

const AgencySetup = () => {
  const navigate = useNavigate()
  const {
    token,
    setToken,
    setUser,
    setIsOwner,
    setOnboardingRequired,
    applyLicense,
    fetchUser,
    logout,
  } = useAppContext()
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [session, setSession] = useState(null)
  const [form, setForm] = useState({
    ownerName: '',
    agencyName: '',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    country: '',
    logoUrl: '',
    primaryBrandColor: '#0e7490',
    contractCompanyName: '',
    contractLogoUrl: '',
    showLogoOnPdf: true,
    footerNote: '',
    whatsappReservationNumber: '',
    whatsappConfirmationNumber: '',
  })

  const load = useCallback(async () => {
    const effectiveToken = token || localStorage.getItem('token')
    if (!effectiveToken) {
      setLoading(false)
      return
    }
    if (!token && effectiveToken) {
      axios.defaults.headers.common.Authorization = `Bearer ${effectiveToken}`
      setToken(effectiveToken)
    }
    setLoading(true)
    try {
      const { data } = await axios.get('/api/agency-onboarding/session/me')
      if (!data.success) throw new Error(data.message || 'Failed')
      setSession(data)
      setForm((f) => ({
        ...f,
        ownerName: data.user?.name || '',
        agencyName: data.agency?.name || '',
        phone: data.agency?.phone || '',
        whatsapp: data.agency?.whatsapp || '',
        address: data.agency?.address || '',
        city: data.agency?.city || '',
        country: data.agency?.country || '',
        logoUrl: data.agency?.logoUrl || '',
        primaryBrandColor: data.agency?.primaryBrandColor || '#0e7490',
        contractCompanyName: data.agency?.contractBranding?.companyName || data.agency?.name || '',
        contractLogoUrl: data.agency?.contractBranding?.logoUrl || data.agency?.logoUrl || '',
        showLogoOnPdf: data.agency?.contractBranding?.showLogoOnPdf !== false,
        footerNote: data.agency?.contractBranding?.footerNote || '',
        whatsappReservationNumber:
          data.settings?.whatsappReservationNumber || data.agency?.whatsapp || '',
        whatsappConfirmationNumber:
          data.settings?.whatsappConfirmationNumber || data.agency?.whatsapp || '',
      }))
    } catch (error) {
      const code = error.response?.data?.code
      if (code === 'ONBOARDING_NOT_REQUIRED' || code === 'ONBOARDING_ALREADY_COMPLETE') {
        toast.success('Setup already complete')
        navigate('/owner', { replace: true })
        return
      }
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error(getErrorMessage(error, 'Please use your invitation link'))
      } else {
        toast.error(getErrorMessage(error))
      }
    } finally {
      setLoading(false)
    }
  }, [token, navigate, setToken])

  useEffect(() => {
    load()
  }, [load])

  const patch = async (payload) => {
    const { data } = await axios.patch('/api/agency-onboarding/session/me', payload)
    if (!data.success) throw new Error(data.message || 'Save failed')
    return data
  }

  const uploadLogo = async (file, kind = 'agency') => {
    const body = new FormData()
    body.append('logo', file)
    body.append('kind', kind === 'contract' ? 'contract' : 'agency')
    const { data } = await axios.post('/api/agency-onboarding/session/logo', body)
    if (!data.success) throw new Error(data.message || 'Upload failed')
    return data
  }

  const nextFromAccount = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await patch({ ownerName: form.ownerName })
      setStep(1)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const nextFromAgency = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await patch({
        agencyName: form.agencyName,
        phone: form.phone,
        whatsapp: form.whatsapp,
        address: form.address,
        city: form.city,
        country: form.country,
        logoUrl: form.logoUrl,
      })
      setStep(2)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const nextFromBranding = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await patch({
        logoUrl: form.logoUrl,
        primaryBrandColor: form.primaryBrandColor,
        whatsapp: form.whatsapp,
        whatsappReservationNumber: form.whatsappReservationNumber,
        whatsappConfirmationNumber: form.whatsappConfirmationNumber,
        contractBranding: {
          companyName: form.contractCompanyName || form.agencyName,
          logoUrl: form.contractLogoUrl || form.logoUrl,
          showLogoOnPdf: form.showLogoOnPdf,
          footerNote: form.footerNote,
        },
      })
      setStep(3)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const finish = async () => {
    setSaving(true)
    try {
      const { data } = await axios.post('/api/agency-onboarding/session/complete', {
        ownerName: form.ownerName,
        agencyName: form.agencyName,
        phone: form.phone,
        whatsapp: form.whatsapp,
        address: form.address,
        city: form.city,
        country: form.country,
        logoUrl: form.logoUrl,
        primaryBrandColor: form.primaryBrandColor,
        whatsappReservationNumber: form.whatsappReservationNumber,
        whatsappConfirmationNumber: form.whatsappConfirmationNumber,
        contractBranding: {
          companyName: form.contractCompanyName || form.agencyName,
          logoUrl: form.contractLogoUrl || form.logoUrl,
          showLogoOnPdf: form.showLogoOnPdf,
          footerNote: form.footerNote,
        },
      })
      if (!data.success) throw new Error(data.message || 'Failed')
      localStorage.setItem('token', data.token)
      axios.defaults.headers.common.Authorization = `Bearer ${data.token}`
      setToken(data.token)
      setOnboardingRequired?.(false)
      if (data.user) {
        setUser(data.user)
        setIsOwner(true)
      }
      applyLicense(data.license, data.user)
      toast.success('Agency is ready')
      await fetchUser()
      navigate('/owner', { replace: true })
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-svh bg-[#0c1219] text-slate-300 flex items-center justify-center px-4">
        <NoIndexHead />
        <div className="max-w-md text-center space-y-3">
          <h1 className="font-display text-2xl text-white">Agency setup</h1>
          <p className="text-sm text-slate-500">
            Open your invitation link to create a password, or sign in if you already set one.
          </p>
          <Link to="/" className="text-cyan-500 text-sm hover:text-cyan-400">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-svh bg-[#0c1219] flex items-center justify-center">
        <NoIndexHead />
        <Loader />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-svh bg-[#0c1219] text-slate-300 flex items-center justify-center px-4">
        <NoIndexHead />
        <div className="max-w-md text-center space-y-3">
          <p className="text-sm">Unable to load onboarding session.</p>
          <button type="button" onClick={logout} className="text-cyan-500 text-sm">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-[#0c1219] text-slate-200 px-4 py-8 sm:py-12">
      <NoIndexHead />
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-600/80">{BRAND_NAME}</p>
            <h1 className="mt-2 font-display text-3xl text-white">Agency setup</h1>
            <p className="mt-1 text-sm text-slate-500">
              {session.agency?.name || 'Your agency'} — finish setup to unlock the dashboard.
            </p>
          </div>
          <button type="button" onClick={logout} className="text-xs text-slate-500 hover:text-slate-300">
            Sign out
          </button>
        </div>

        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((s, i) => (
            <li
              key={s.key}
              className={`border px-2 py-2 text-center text-[11px] sm:text-xs ${
                i === step
                  ? 'border-cyan-600/50 text-cyan-300 bg-cyan-950/30'
                  : i < step
                    ? 'border-emerald-800/40 text-emerald-400/80'
                    : 'border-white/10 text-slate-600'
              }`}
            >
              <span className="block font-medium">{i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <form onSubmit={nextFromAccount} className="border border-white/10 p-5 space-y-4">
            <h2 className="text-sm uppercase tracking-wider text-slate-400">Step 1 — Account</h2>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Owner name</label>
              <input
                required
                value={form.ownerName}
                onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Email</label>
              <input
                readOnly
                value={session.user?.email || ''}
                className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm text-slate-400"
              />
            </div>
            <p className="text-xs text-slate-500">
              Your password was set on the activation page and is never shown here.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-60 text-white text-sm px-5 py-2.5"
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={nextFromAgency} className="border border-white/10 p-5 space-y-4">
            <h2 className="text-sm uppercase tracking-wider text-slate-400">Step 2 — Agency information</h2>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Agency name</label>
              <input
                required
                value={form.agencyName}
                onChange={(e) => setForm((f) => ({ ...f, agencyName: e.target.value }))}
                className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const data = await uploadLogo(file, 'agency')
                    setForm((f) => ({
                      ...f,
                      logoUrl: data.logoUrl,
                      contractLogoUrl: f.contractLogoUrl || data.logoUrl,
                    }))
                    toast.success('Logo uploaded')
                  } catch (err) {
                    toast.error(getErrorMessage(err))
                  }
                }}
                className="block w-full text-xs text-slate-400"
              />
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="" className="mt-2 h-12 object-contain" />
              ) : null}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">WhatsApp</label>
                <input
                  value={form.whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                  className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">City</label>
                <input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Country</label>
                <input
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="border border-white/10 text-slate-300 text-sm px-4 py-2.5"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-60 text-white text-sm px-5 py-2.5"
              >
                {saving ? 'Saving…' : 'Continue'}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={nextFromBranding} className="border border-white/10 p-5 space-y-4">
            <h2 className="text-sm uppercase tracking-wider text-slate-400">Step 3 — Branding</h2>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Primary brand color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={form.primaryBrandColor || '#0e7490'}
                  onChange={(e) => setForm((f) => ({ ...f, primaryBrandColor: e.target.value }))}
                  className="h-10 w-14 bg-transparent border border-white/10"
                />
                <input
                  value={form.primaryBrandColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryBrandColor: e.target.value }))}
                  className="flex-1 bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm font-mono outline-none focus:border-cyan-600/60"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Contract / PDF company name</label>
              <input
                value={form.contractCompanyName}
                onChange={(e) => setForm((f) => ({ ...f, contractCompanyName: e.target.value }))}
                className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Contract / PDF logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const data = await uploadLogo(file, 'contract')
                    setForm((f) => ({ ...f, contractLogoUrl: data.logoUrl }))
                    toast.success('Contract logo uploaded')
                  } catch (err) {
                    toast.error(getErrorMessage(err))
                  }
                }}
                className="block w-full text-xs text-slate-400"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.showLogoOnPdf}
                onChange={(e) => setForm((f) => ({ ...f, showLogoOnPdf: e.target.checked }))}
                className="accent-cyan-600"
              />
              Show logo on contracts / PDFs
            </label>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">PDF footer note</label>
              <input
                value={form.footerNote}
                onChange={(e) => setForm((f) => ({ ...f, footerNote: e.target.value }))}
                className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">WhatsApp (reservations)</label>
                <input
                  value={form.whatsappReservationNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsappReservationNumber: e.target.value }))
                  }
                  className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">WhatsApp (confirmations)</label>
                <input
                  value={form.whatsappConfirmationNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsappConfirmationNumber: e.target.value }))
                  }
                  className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="border border-white/10 text-slate-300 text-sm px-4 py-2.5"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-60 text-white text-sm px-5 py-2.5"
              >
                {saving ? 'Saving…' : 'Continue'}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="border border-white/10 p-5 space-y-4">
            <h2 className="text-sm uppercase tracking-wider text-slate-400">Step 4 — Complete</h2>
            <p className="text-sm text-slate-300">
              <span className="text-white font-medium">{form.agencyName || session.agency?.name}</span>{' '}
              is ready. Completing setup activates your agency and unlocks the owner dashboard.
            </p>
            <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
              <li>Owner: {form.ownerName || session.user?.name}</li>
              <li>Email: {session.user?.email}</li>
              <li>
                Location: {[form.city, form.country].filter(Boolean).join(', ') || '—'}
              </li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="border border-white/10 text-slate-300 text-sm px-4 py-2.5"
              >
                Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={finish}
                className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-60 text-white text-sm px-5 py-2.5"
              >
                {saving ? 'Activating…' : 'Go to Dashboard'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AgencySetup
