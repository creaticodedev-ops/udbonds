import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SeoHead from '../../seo/SeoHead'
import MarketingLayout from '../../marketing/MarketingLayout'
import { WhatsAppDemoCta } from '../../marketing/Ctas'
import { BRAND, CONTACT_EMAIL } from '../../marketing/config'
import { useMktI18n } from '../../marketing/i18n/MarketingI18n'
import '../../marketing/demo.css'

export const ContactPage = () => (
  <MarketingLayout>
    <ContactInner />
  </MarketingLayout>
)

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
    <path d="M2.5 7.2l2.8 2.8 6.2-6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ContactInner = () => {
  const { t, htmlLang, ogLocale, dir } = useMktI18n()
  const [params] = useSearchParams()
  const intentParam = params.get('intent') === 'demo' ? 'demo' : 'trial'
  const isDemo = intentParam === 'demo'
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    fleet: '',
    intent: intentParam,
    message: '',
  })

  useEffect(() => {
    setForm((prev) => ({ ...prev, intent: intentParam }))
  }, [intentParam])

  const who = form.company || form.name
  const subject = useMemo(
    () => (form.intent === 'demo' ? t('contact.subjectDemo', { who }) : t('contact.subjectTrial', { who })),
    [form.intent, t, who],
  )

  const body = useMemo(
    () =>
      [
        `${t('contact.bodyName')}: ${form.name}`,
        `${t('contact.bodyEmail')}: ${form.email}`,
        `${t('contact.bodyCompany')}: ${form.company}`,
        `${t('contact.bodyFleet')}: ${form.fleet || '—'}`,
        `${t('contact.bodyRequest')}: ${form.intent === 'demo' ? t('contact.intentDemo') : t('contact.intentTrial')}`,
        '',
        form.message || '',
      ].join('\n'),
    [form, t],
  )

  const onSubmit = (event) => {
    event.preventDefault()
    setSubmitting(true)
    if (CONTACT_EMAIL) {
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    }
    window.setTimeout(() => {
      setSent(true)
      setSubmitting(false)
    }, 180)
  }

  const setField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  return (
    <>
      <SeoHead
        title={isDemo ? t('contact.seoDemoTitle') : t('seo.contactTitle')}
        description={isDemo ? t('contact.seoDemoDescription') : t('seo.contactDescription')}
        path="/contact"
        lang={htmlLang}
        dir={dir}
        locale={ogLocale}
        siteName={BRAND}
      />

      <section className={`mkt-demo${isDemo ? ' is-demo' : ''}`}>
        <div className="mkt-demo-atmos" aria-hidden>
          <span className="mkt-demo-glow is-a" />
          <span className="mkt-demo-glow is-b" />
          <span className="mkt-demo-rule" />
          <span className="mkt-demo-orb" />
          <span className="mkt-demo-mark">{BRAND}</span>
        </div>

        <div className="mkt-wrap mkt-demo-shell">
          <aside className="mkt-demo-brand">
            <div className="mkt-demo-brand-inner">
              <p className="mkt-demo-kicker">
                <i aria-hidden />
                {isDemo ? t('contact.demoKicker') : t('contact.kicker')}
              </p>
              <h1 className="mkt-demo-title">
                {isDemo ? (
                  <>
                    {t('contact.demoTitleBefore')}
                    <em>{t('contact.demoTitleEm')}</em>
                  </>
                ) : form.intent === 'demo' ? (
                  t('contact.titleDemo')
                ) : (
                  t('contact.titleTrial')
                )}
              </h1>
              <p className="mkt-demo-lead">
                {isDemo ? (
                  t('contact.demoLead')
                ) : (
                  <>
                    {t('contact.leadBefore')} <Link to="/signup">{t('contact.leadLink')}</Link>. {t('contact.leadAfter')}
                  </>
                )}
              </p>

              <ul className="mkt-demo-checks">
                <li>
                  <Check />
                  <span>{t('contact.point1')}</span>
                </li>
                <li>
                  <Check />
                  <span>{t('contact.point2')}</span>
                </li>
                <li>
                  <Check />
                  <span>{t('contact.point3')}</span>
                </li>
              </ul>

              <ol className="mkt-demo-steps" aria-label={t('contact.stepsAria')}>
                <li>
                  <strong>01</strong>
                  <span>{t('contact.step1')}</span>
                </li>
                <li>
                  <strong>02</strong>
                  <span>{t('contact.step2')}</span>
                </li>
                <li>
                  <strong>03</strong>
                  <span>{t('contact.step3')}</span>
                </li>
              </ol>

              <div className="mkt-demo-alt">
                <WhatsAppDemoCta className="mkt-demo-wa">{t('cta.whatsapp')}</WhatsAppDemoCta>
              </div>
            </div>
          </aside>

          <div className="mkt-demo-stage">
            <div className="mkt-demo-panel">
              {sent ? (
                <div className="mkt-demo-success" role="status">
                  <div className="mkt-demo-success-mark" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                      <path d="M3.2 8.4l3 3.1 6.6-7" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="mkt-demo-kicker">{t('contact.successKicker')}</p>
                  <h2>{t('contact.successTitle')}</h2>
                  <p className="mkt-demo-lead">{t('contact.sentManual')}</p>
                  <div className="mkt-demo-success-actions">
                    <Link to="/" className="mkt-btn mkt-btn-primary">
                      {t('contact.backHome')}
                    </Link>
                    <WhatsAppDemoCta className="mkt-demo-wa">{t('cta.whatsapp')}</WhatsAppDemoCta>
                  </div>
                </div>
              ) : (
                <form className="mkt-demo-form" onSubmit={onSubmit} noValidate={false}>
                  <div className="mkt-demo-form-head">
                    <p className="mkt-demo-form-label">{isDemo ? t('contact.formKickerDemo') : t('contact.formKicker')}</p>
                    <h2>{isDemo ? t('contact.formTitleDemo') : t('contact.formTitle')}</h2>
                    <p className="mkt-demo-form-lead">{isDemo ? t('contact.formLeadDemo') : t('contact.formLead')}</p>
                  </div>

                  <div className="mkt-demo-fields">
                    <label className="mkt-demo-field">
                      <span>{t('contact.name')}</span>
                      <input name="name" autoComplete="name" required value={form.name} onChange={setField('name')} />
                    </label>
                    <label className="mkt-demo-field">
                      <span>{t('contact.email')}</span>
                      <input name="email" type="email" autoComplete="email" required value={form.email} onChange={setField('email')} />
                    </label>
                    <label className="mkt-demo-field">
                      <span>{t('contact.company')}</span>
                      <input name="company" autoComplete="organization" required value={form.company} onChange={setField('company')} />
                    </label>
                    <label className="mkt-demo-field">
                      <span>{t('contact.fleet')}</span>
                      <input name="fleet" value={form.fleet} onChange={setField('fleet')} placeholder={t('contact.fleetPh')} />
                    </label>
                    {!isDemo ? (
                      <label className="mkt-demo-field is-full">
                        <span>{t('contact.request')}</span>
                        <select name="intent" value={form.intent} onChange={setField('intent')}>
                          <option value="trial">{t('contact.intentTrial')}</option>
                          <option value="demo">{t('contact.intentDemo')}</option>
                        </select>
                      </label>
                    ) : null}
                    <label className="mkt-demo-field is-full">
                      <span>{t('contact.message')}</span>
                      <textarea
                        name="message"
                        rows={3}
                        value={form.message}
                        onChange={setField('message')}
                        placeholder={isDemo ? t('contact.messagePhDemo') : t('contact.messagePh')}
                      />
                    </label>
                  </div>

                  <button type="submit" className="mkt-btn mkt-btn-primary mkt-demo-submit" disabled={submitting}>
                    {submitting ? <span className="mkt-demo-spin" aria-hidden /> : null}
                    {isDemo ? t('cta.demo') : t('contact.send')}
                  </button>

                  <p className="mkt-demo-note">
                    {t('contact.orTrial')}{' '}
                    <Link to="/signup">{t('contact.leadLink')}</Link>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default ContactPage
