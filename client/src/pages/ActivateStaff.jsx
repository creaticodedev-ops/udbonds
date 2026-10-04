import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import axios from 'axios'
import { resolveApiBaseUrl } from '../utils/apiBase'
import { getErrorMessage } from '../utils/apiError'
import { useAppContext } from '../context/AppContext'

axios.defaults.baseURL = resolveApiBaseUrl()

const ActivateStaff = () => {
  const { token } = useParams()
  const navigate = useNavigate()
  const { setToken, fetchUser } = useAppContext()
  const [invite, setInvite] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const { data } = await axios.get(`/api/staff-onboarding/${token}`)
        if (!cancelled) {
          if (data.success) setInvite(data.invite)
          else setError(data.message || 'Invalid invite')
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err) || 'Invalid or expired invite')
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
    setSubmitting(true)
    try {
      const { data } = await axios.post(`/api/staff-onboarding/${token}/activate`, { password })
      if (!data.success) throw new Error(data.message || 'Activation failed')
      localStorage.setItem('token', data.token)
      axios.defaults.headers.common.Authorization = `Bearer ${data.token}`
      setToken(data.token)
      await fetchUser()
      toast.success('Account activated')
      navigate(data.redirectTo || '/owner', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center text-muted text-sm">
        Loading invite…
      </div>
    )
  }

  if (error || !invite) {
    return (
      <div className="min-h-svh flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-borderColor bg-white p-8 text-center">
          <h1 className="font-display text-2xl text-ink">Invite unavailable</h1>
          <p className="mt-2 text-sm text-muted">{error || 'This invite link is invalid or expired.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-4 py-12 bg-light">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-borderColor bg-white p-8 shadow-[0_18px_50px_-28px_rgba(22,18,16,0.3)]"
      >
        <p className="text-[11px] uppercase tracking-[0.18em] text-primary font-medium">Staff invite</p>
        <h1 className="font-display text-3xl text-ink mt-1">Activate your account</h1>
        <p className="mt-2 text-sm text-muted">
          {invite.agencyName ? (
            <>
              Join <span className="font-medium text-ink">{invite.agencyName}</span> as{' '}
              <span className="capitalize">{invite.staffRole}</span>.
            </>
          ) : (
            'Set your password to access the agency dashboard.'
          )}
        </p>
        <p className="mt-3 text-xs text-muted">{invite.email}</p>

        <label className="block mt-6 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full min-h-12 rounded-2xl border border-borderColor px-3.5 text-[15px] outline-none focus:border-primary/40"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <label className="block mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Confirm password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1.5 w-full min-h-12 rounded-2xl border border-borderColor px-3.5 text-[15px] outline-none focus:border-primary/40"
          autoComplete="new-password"
          required
          minLength={8}
        />

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full min-h-12 rounded-2xl bg-primary text-white font-semibold disabled:opacity-55"
        >
          {submitting ? 'Activating…' : 'Activate & continue'}
        </button>
      </form>
    </div>
  )
}

export default ActivateStaff
