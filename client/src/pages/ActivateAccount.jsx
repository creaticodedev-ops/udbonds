import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { resolveApiBaseUrl } from '../utils/apiBase'
import { getErrorMessage } from '../utils/apiError'
import { BRAND_NAME } from '../constants/brand'
import NoIndexHead from '../seo/NoIndexHead'
import Loader from '../components/Loader'
import { useAppContext } from '../context/AppContext'

const guestApi = axios.create({ baseURL: resolveApiBaseUrl() })

const ActivateAccount = () => {
  const { token } = useParams()
  const navigate = useNavigate()
  const { setToken, setOnboardingRequired, setIsOwner, setUser } = useAppContext()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invite, setInvite] = useState(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const { data } = await guestApi.get(`/api/agency-onboarding/${token}`)
        if (!data.success) throw new Error(data.message || 'Invalid invite')
        if (cancelled) return
        setInvite(data.invite)
        setName(data.invite?.ownerName || '')
        if (data.invite?.passwordAlreadySet) {
          setError('This invitation was already used. Sign in to continue setup if needed.')
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Invalid or expired invitation link'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const submit = async (e) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setSaving(true)
    try {
      const { data } = await guestApi.post(`/api/agency-onboarding/${token}/set-password`, {
        password,
        name,
      })
      if (!data.success) throw new Error(data.message || 'Failed')
      localStorage.setItem('token', data.token)
      axios.defaults.headers.common.Authorization = `Bearer ${data.token}`
      // Must update AppContext — otherwise /agency-setup sees token=null and blocks the wizard
      setToken(data.token)
      setOnboardingRequired?.(true)
      setIsOwner?.(false)
      if (data.user) setUser?.(data.user)
      toast.success('Password saved')
      navigate('/agency-setup', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not set password'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-svh bg-[#0c1219] text-slate-200 flex items-center justify-center px-4 py-10">
      <NoIndexHead />
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-600/80">{BRAND_NAME}</p>
          <h1 className="mt-2 font-display text-3xl text-white">Activate your account</h1>
          <p className="mt-2 text-sm text-slate-500">
            Create your password to continue agency setup. You will not access the dashboard until setup is complete.
          </p>
        </div>

        {loading && <Loader />}

        {!loading && error && (
          <div className="border border-rose-800/50 bg-rose-950/30 p-4 space-y-3">
            <p className="text-sm text-rose-300">{error}</p>
            <Link to="/" className="text-xs text-cyan-500 hover:text-cyan-400">
              Back to home
            </Link>
          </div>
        )}

        {!loading && invite && !error && (
          <form onSubmit={submit} className="border border-white/10 bg-white/[0.03] p-5 space-y-4">
            <div>
              <p className="text-[11px] uppercase text-slate-500">Agency</p>
              <p className="text-white mt-0.5">{invite.agencyName}</p>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Your name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Email</label>
              <input
                readOnly
                value={invite.ownerEmail || ''}
                className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">New password</label>
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Confirm password</label>
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-[#0a0f14] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-600/60"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-cyan-700 hover:bg-cyan-600 disabled:opacity-60 text-white text-sm py-2.5"
            >
              {saving ? 'Saving…' : 'Continue to agency setup'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default ActivateAccount
