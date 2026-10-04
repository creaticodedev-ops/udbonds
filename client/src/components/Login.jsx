import React from 'react'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'
import { useI18n } from '../i18n/I18nContext'
import { getErrorMessage } from '../utils/apiError'
import { resolveOwnerPermissions } from '../utils/ownerPermissions'
import { BRAND_NAME } from '../constants/brand'

const Login = () => {
  const {
    setShowLogin,
    axios,
    setToken,
    navigate,
    setUser,
    setIsOwner,
    setOnboardingRequired,
    applyLicense,
  } = useAppContext()
  const { t } = useI18n()

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const dialogRef = React.useRef(null)

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) setShowLogin(false)
    }
    window.addEventListener('keydown', onKey)
    // Focus first field for keyboard users
    dialogRef.current?.querySelector('input')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [loading, setShowLogin])

  const onSubmitHandler = async (event) => {
    try {
      event.preventDefault()
      setLoading(true)
      const { data } = await axios.post('/api/user/login', { email, password })

      if (data.success) {
        const token = data.token
        localStorage.setItem('token', token)
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

        if (data.onboardingRequired) {
          setToken(token)
          setIsOwner(false)
          setOnboardingRequired?.(true)
          setShowLogin(false)
          toast.success('Continue agency setup')
          navigate('/agency-setup', { replace: true })
          return
        }

        const profile = await axios.get('/api/user/data')
        if (profile.data.success && profile.data.user?.role === 'owner') {
          if (profile.data.onboardingRequired) {
            setUser(profile.data.user)
            setIsOwner(false)
            setOnboardingRequired?.(true)
            setToken(token)
            setShowLogin(false)
            navigate('/agency-setup', { replace: true })
            return
          }
          const normalizedUser = {
            ...profile.data.user,
            permissions: resolveOwnerPermissions(profile.data.user.permissions || []),
          }
          setUser(normalizedUser)
          setIsOwner(true)
          setOnboardingRequired?.(false)
          applyLicense?.(profile.data.license || data.license, normalizedUser)
          setToken(token)
          setShowLogin(false)
          const returnTo = sessionStorage.getItem('ownerReturnTo') || '/owner'
          sessionStorage.removeItem('ownerReturnTo')
          navigate(returnTo.startsWith('/owner') ? returnTo : '/owner')
        } else {
          localStorage.removeItem('token')
          delete axios.defaults.headers.common['Authorization']
          toast.error(t('login.adminOnly'))
        }
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      const code = error.response?.data?.code
      if (code === 'ONBOARDING_REQUIRED') {
        toast.error(error.response?.data?.message || 'Use your invitation link to activate')
      } else {
        toast.error(getErrorMessage(error))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={() => {
        if (!loading) setShowLogin(false)
      }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center text-sm text-gray-600 bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-title"
    >
      <form
        ref={dialogRef}
        onSubmit={onSubmitHandler}
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col gap-4 w-full sm:w-[352px] items-stretch p-6 sm:p-8 py-8 sm:py-12 rounded-t-2xl sm:rounded-xl shadow-xl border border-gray-200 bg-white"
      >
        <p id="admin-login-title" className="text-2xl font-medium text-center">
          <span className="block text-sm font-normal tracking-wide text-gray-500 mb-1">{BRAND_NAME}</span>
          <span className="text-primary">{t('login.title')}</span>
        </p>
        <div className="w-full">
          <label htmlFor="admin-login-email" className="block">
            {t('login.email')}
          </label>
          <input
            id="admin-login-email"
            onChange={(e) => setEmail(e.target.value)}
            value={email}
            placeholder={t('login.placeholder')}
            className="border border-gray-200 rounded w-full p-2.5 mt-1 outline-primary"
            type="email"
            autoComplete="username"
            required
          />
        </div>
        <div className="w-full">
          <label htmlFor="admin-login-password" className="block">
            {t('login.password')}
          </label>
          <input
            id="admin-login-password"
            onChange={(e) => setPassword(e.target.value)}
            value={password}
            placeholder={t('login.placeholder')}
            className="border border-gray-200 rounded w-full p-2.5 mt-1 outline-primary"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-primary hover:bg-primary-dull transition-all text-white w-full py-2.5 rounded-md cursor-pointer disabled:opacity-60"
        >
          {t('login.submit')}
        </button>
      </form>
    </div>
  )
}

export default Login
