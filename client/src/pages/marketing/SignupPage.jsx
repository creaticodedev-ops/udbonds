import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SeoHead from '../../seo/SeoHead'
import { useAppContext } from '../../context/AppContext'
import { getErrorMessage } from '../../utils/apiError'
import { resolveOwnerPermissions } from '../../utils/ownerPermissions'
import MarketingLayout from '../../marketing/MarketingLayout'
import { WhatsAppDemoCta } from '../../marketing/Ctas'
import { useMktI18n } from '../../marketing/i18n/MarketingI18n'
import { BRAND, TRIAL_DAYS } from '../../marketing/config'
import '../../marketing/signup.css'

const COUNTRIES = ['Morocco', 'France', 'Spain', 'Belgium', 'United Kingdom', 'United Arab Emirates', 'Tunisia', 'Algeria', 'Senegal', 'Other']

const empty = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  agencyName: '',
  country: 'Morocco',
  phone: '',
  city: '',
  fleetSize: '',
}

const Eye = ({ off = false }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    {off ? (
      <path d="M3 3l12 12M7.2 7.4A3 3 0 0011 12M8.1 5.2A6.8 6.8 0 019 5.1c3.4 0 6 2.3 7.4 3.9a.8.8 0 010 1c-.5.6-1.2 1.3-2.1 1.9M4.4 6.2C3.3 6.9 2.4 7.8 1.6 8.6a.8.8 0 000 1C3 11.3 5.6 13.5 9 13.5c.6 0 1.2-.1 1.7-.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    ) : (
      <>
        <path d="M1.6 9s2.8-4.4 7.4-4.4S16.4 9 16.4 9s-2.8 4.4-7.4 4.4S1.6 9 1.6 9z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="9" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.5" />
      </>
    )}
  </svg>
)

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
    <path d="M2.5 7.2l2.8 2.8 6.2-6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const SignupPage = () => (
  <MarketingLayout footer={false}>
    <SignupInner />
  </MarketingLayout>
)

const SignupInner = () => {
  const navigate = useNavigate()
  const { t, htmlLang, ogLocale, dir } = useMktI18n()
  const { axios, isOwner, setToken, setUser, setIsOwner, setOnboardingRequired, applyLicense, setShowLogin } =
    useAppContext()
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(null)
  const [trialDays, setTrialDays] = useState(TRIAL_DAYS)
  const [minPassword, setMinPassword] = useState(8)
  const [showPass, setShowPass] = useState(false)
  const [showPass2, setShowPass2] = useState(false)
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (isOwner && !created) navigate('/owner', { replace: true })
  }, [isOwner, created, navigate])

  useEffect(() => {
    let alive = true
    axios
      .get('/api/agency-onboarding/signup-info')
      .then(({ data }) => {
        if (!alive) return
        if (data?.trialDays) setTrialDays(data.trialDays)
        if (data?.passwordMinLength) setMinPassword(data.passwordMinLength)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [axios])

  const setField = (key) => (event) => {
    const value = event.target.value
    setForm((f) => ({ ...f, [key]: value }))
    if (error) setError('')
  }

  const blur = (key) => () => setTouched((prev) => ({ ...prev, [key]: true }))

  const fieldErrors = useMemo(() => {
    const next = {}
    if (touched.name && !form.name.trim()) next.name = t('signup.errName')
    if (touched.email && (!form.email.trim() || !form.email.includes('@'))) next.email = t('signup.errEmail')
    if (touched.password && form.password.length < minPassword) next.password = t('signup.errPassword', { min: minPassword })
    if (touched.confirmPassword && form.password !== form.confirmPassword) next.confirmPassword = t('signup.errMatch')
    if (touched.agencyName && !form.agencyName.trim()) next.agencyName = t('signup.errAgency')
    return next
  }, [form, touched, minPassword, t])

  const validate = () => {
    if (!form.name.trim()) return t('signup.errName')
    if (!form.email.trim() || !form.email.includes('@')) return t('signup.errEmail')
    if (form.password.length < minPassword) return t('signup.errPassword', { min: minPassword })
    if (form.password !== form.confirmPassword) return t('signup.errMatch')
    if (!form.agencyName.trim()) return t('signup.errAgency')
    return ''
  }

  const createWorkspace = async (event) => {
    event.preventDefault()
    if (submitting) return
    const msg = validate()
    if (msg) {
      setError(msg)
      setTouched({
        name: true,
        email: true,
        password: true,
        confirmPassword: true,
        agencyName: true,
      })
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const { data } = await axios.post('/api/agency-onboarding/signup', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        agencyName: form.agencyName.trim(),
        country: form.country,
        phone: form.phone.trim(),
        city: form.city.trim(),
        fleetSize: form.fleetSize.trim(),
      })
      if (!data?.success) {
        throw new Error(data?.message || t('signup.fail'))
      }
      if (data.approvalPending || !data.token) {
        setCreated(data)
        return
      }
      localStorage.setItem('token', data.token)
      axios.defaults.headers.common.Authorization = `Bearer ${data.token}`
      setCreated(data)
      setToken(data.token)
      setOnboardingRequired(false)
      setIsOwner(true)
      applyLicense?.(data.license, data.user)
      setUser({
        ...data.user,
        permissions: resolveOwnerPermissions(data.user?.permissions || []),
      })
    } catch (err) {
      setError(getErrorMessage(err, err.response?.data?.message || t('signup.fail')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SeoHead
        title={t('seo.signupTitle')}
        description={t('seo.signupDescription')}
        path="/signup"
        lang={htmlLang}
        dir={dir}
        locale={ogLocale}
        siteName={BRAND}
      />

      <section className="mkt-signup">
        <div className="mkt-signup-atmos" aria-hidden>
          <span className="mkt-signup-glow is-a" />
          <span className="mkt-signup-glow is-b" />
          <span className="mkt-signup-line" />
        </div>

        <div className="mkt-wrap mkt-signup-shell">
          <header className="mkt-signup-hero">
            <p className="mkt-signup-kicker">
              <i aria-hidden />
              {t('signup.kicker')}
            </p>
            <h1>
              {t('signup.titleBefore')}
              <em>{t('signup.titleEm')}</em>
            </h1>
            <p className="mkt-signup-lead">{t('signup.leadShort', { days: trialDays })}</p>
            <ul className="mkt-signup-checks">
              <li>
                <Check />
                <span>{t('signup.rail1t', { days: trialDays })} — {t('signup.rail1s')}</span>
              </li>
              <li>
                <Check />
                <span>{t('signup.rail3t')} — {t('signup.rail3s')}</span>
              </li>
              <li>
                <Check />
                <span>{t('signup.rail4t')} — {t('signup.rail4s')}</span>
              </li>
            </ul>
          </header>

          <div className="mkt-signup-panel">
            {created ? (
              <div className="mkt-signup-success" role="status">
                <div className="mkt-signup-success-mark" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <path d="M3.2 8.4l3 3.1 6.6-7" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="mkt-signup-kicker">
                  {created?.approvalPending ? t('signup.pendingKicker') : t('signup.readyKicker')}
                </p>
                <h2>{created?.approvalPending ? t('signup.pendingWelcome') : t('signup.welcome')}</h2>
                <p className="mkt-signup-lead">
                  {created?.approvalPending
                    ? t('signup.pendingLead', {
                        forAgency: created?.agency?.name ? t('signup.forAgency', { name: created.agency.name }) : '',
                      })
                    : t('signup.readyLead', {
                        forAgency: created?.agency?.name ? t('signup.forAgency', { name: created.agency.name }) : '',
                        days: created?.trialDays || trialDays,
                      })}
                </p>
                <div className="mkt-signup-success-actions">
                  {created?.approvalPending ? (
                    <Link to="/" className="mkt-btn mkt-btn-primary">
                      {t('signup.backToSite')}
                    </Link>
                  ) : (
                    <button type="button" className="mkt-btn mkt-btn-primary" onClick={() => navigate('/owner')}>
                      {t('signup.openDash')}
                    </button>
                  )}
                  <WhatsAppDemoCta className="mkt-signup-wa">{t('cta.whatsapp')}</WhatsAppDemoCta>
                </div>
              </div>
            ) : (
              <form className="mkt-signup-form" onSubmit={createWorkspace}>
                <div className="mkt-signup-form-head">
                  <p className="mkt-signup-form-eyebrow">{t('signup.stepAccount')}</p>
                  <h2>{t('signup.hAccount')}</h2>
                  <p className="mkt-signup-form-lead">{t('signup.leadAccount')}</p>
                </div>

                <div className="mkt-signup-fields">
                  <label className={`mkt-signup-field${fieldErrors.name ? ' is-bad' : ''}`}>
                    <span>{t('signup.name')}</span>
                    <input
                      id="su-name"
                      autoComplete="name"
                      required
                      value={form.name}
                      onChange={setField('name')}
                      onBlur={blur('name')}
                    />
                    {fieldErrors.name ? <em>{fieldErrors.name}</em> : null}
                  </label>

                  <label className={`mkt-signup-field${fieldErrors.email ? ' is-bad' : ''}`}>
                    <span>{t('signup.email')}</span>
                    <input
                      id="su-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={form.email}
                      onChange={setField('email')}
                      onBlur={blur('email')}
                    />
                    {fieldErrors.email ? <em>{fieldErrors.email}</em> : null}
                  </label>

                  <label className={`mkt-signup-field${fieldErrors.password ? ' is-bad' : ''}`}>
                    <span>{t('signup.password')}</span>
                    <div className="mkt-signup-pass">
                      <input
                        id="su-pass"
                        type={showPass ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={minPassword}
                        value={form.password}
                        onChange={setField('password')}
                        onBlur={blur('password')}
                      />
                      <button
                        type="button"
                        className="mkt-signup-eye"
                        aria-label={showPass ? t('signup.hidePassword') : t('signup.showPassword')}
                        onClick={() => setShowPass((v) => !v)}
                      >
                        <Eye off={showPass} />
                      </button>
                    </div>
                    {fieldErrors.password ? <em>{fieldErrors.password}</em> : null}
                  </label>

                  <label className={`mkt-signup-field${fieldErrors.confirmPassword ? ' is-bad' : ''}`}>
                    <span>{t('signup.confirm')}</span>
                    <div className="mkt-signup-pass">
                      <input
                        id="su-pass2"
                        type={showPass2 ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={form.confirmPassword}
                        onChange={setField('confirmPassword')}
                        onBlur={blur('confirmPassword')}
                      />
                      <button
                        type="button"
                        className="mkt-signup-eye"
                        aria-label={showPass2 ? t('signup.hidePassword') : t('signup.showPassword')}
                        onClick={() => setShowPass2((v) => !v)}
                      >
                        <Eye off={showPass2} />
                      </button>
                    </div>
                    {fieldErrors.confirmPassword ? <em>{fieldErrors.confirmPassword}</em> : null}
                  </label>

                  <label className={`mkt-signup-field is-full${fieldErrors.agencyName ? ' is-bad' : ''}`}>
                    <span>{t('signup.agency')}</span>
                    <input
                      id="su-agency"
                      required
                      value={form.agencyName}
                      onChange={setField('agencyName')}
                      onBlur={blur('agencyName')}
                    />
                    {fieldErrors.agencyName ? <em>{fieldErrors.agencyName}</em> : null}
                  </label>

                  <label className="mkt-signup-field is-full">
                    <span>{t('signup.country')}</span>
                    <select id="su-country" value={form.country} onChange={setField('country')}>
                      {COUNTRIES.map((country) => (
                        <option key={country} value={country}>
                          {t(`countries.${country}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <details className="mkt-signup-more">
                  <summary>{t('signup.moreOptional')}</summary>
                  <div className="mkt-signup-fields is-nested">
                    <label className="mkt-signup-field">
                      <span>{t('signup.phone')}</span>
                      <input id="su-phone" type="tel" autoComplete="tel" value={form.phone} onChange={setField('phone')} />
                    </label>
                    <label className="mkt-signup-field">
                      <span>{t('signup.city')}</span>
                      <input id="su-city" value={form.city} onChange={setField('city')} />
                    </label>
                    <label className="mkt-signup-field is-full">
                      <span>{t('signup.fleet')}</span>
                      <input id="su-fleet" placeholder={t('signup.fleetPh')} value={form.fleetSize} onChange={setField('fleetSize')} />
                    </label>
                  </div>
                </details>

                {error ? (
                  <p className="mkt-signup-error" role="alert">
                    {error}
                  </p>
                ) : null}

                <button type="submit" className="mkt-btn mkt-btn-primary mkt-signup-submit" disabled={submitting}>
                  {submitting ? <span className="mkt-signup-spin" aria-hidden /> : null}
                  {submitting ? t('signup.creating') : t('signup.create')}
                </button>

                <p className="mkt-signup-note">{t('signup.autoSignin')}</p>

                <div className="mkt-signup-footer-row">
                  <p className="mkt-signup-login">
                    {t('signup.already')}{' '}
                    <button type="button" onClick={() => setShowLogin(true)}>
                      {t('nav.login')}
                    </button>
                  </p>
                  <WhatsAppDemoCta className="mkt-signup-wa">{t('cta.whatsappShort')}</WhatsAppDemoCta>
                </div>
              </form>
            )}
          </div>

          <p className="mkt-signup-legal">
            © {new Date().getFullYear()} {BRAND}
          </p>
        </div>
      </section>
    </>
  )
}

export default SignupPage
