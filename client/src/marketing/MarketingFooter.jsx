import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandMark from './BrandMark'
import { DemoRequestCta, WhatsAppDemoCta } from './Ctas'
import { BRAND, demoWhatsAppHref } from './config'
import { useMktI18n } from './i18n/MarketingI18n'

/**
 * Footer IA mirrors real owner modules (see `ownerNavGroups` in assets.js)
 * and public marketing anchors — labels only, no app routes.
 */
const PLATFORM_LINKS = [
  { to: '/#product', labelKey: 'footer.module.dashboard' },
  { to: '/#product', labelKey: 'footer.module.reservations' },
  { to: '/#product', labelKey: 'footer.module.calendar' },
  { to: '/#product', labelKey: 'footer.module.fleet' },
  { to: '/#product', labelKey: 'footer.module.customers' },
  { to: '/#product', labelKey: 'footer.module.contracts' },
  { to: '/#product', labelKey: 'footer.module.invoices' },
  { to: '/#product', labelKey: 'footer.module.analytics' },
]

const AGENCY_LINKS = [
  { to: '/#product', labelKey: 'footer.module.walkIn' },
  { to: '/#product', labelKey: 'footer.module.maintenance' },
  { to: '/#product', labelKey: 'footer.module.locations' },
  { to: '/#product', labelKey: 'footer.module.reports' },
]

const RESOURCE_LINKS = [
  { to: '/#product', labelKey: 'nav.product' },
  { to: '/#features', labelKey: 'nav.features' },
  { to: '/#pricing', labelKey: 'nav.pricing' },
  { to: '/#faq', labelKey: 'nav.faq' },
  { to: '/about', labelKey: 'nav.about' },
  { to: '/privacy', labelKey: 'footer.privacy' },
  { to: '/terms', labelKey: 'footer.terms' },
]

export const MarketingFooter = () => {
  const { t } = useMktI18n()
  const rootRef = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = rootRef.current
    if (!node) return undefined
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setInView(true)
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])

  return (
    <footer ref={rootRef} className={`mkt-foot mkt-foot-pro${inView ? ' is-in' : ''}`}>
      <div className="mkt-foot-atmos" aria-hidden>
        <span className="mkt-foot-glow" />
        <span className="mkt-foot-gridlines" />
      </div>

      <div className="mkt-wrap mkt-foot-inner">
        <div className="mkt-foot-stage">
          <div className="mkt-foot-brand">
            <BrandMark variant="light" size="foot" className="mkt-foot-logo" />
            <p className="mkt-foot-statement">{t('footer.statement')}</p>
          </div>
          <div className="mkt-foot-stage-actions">
            <DemoRequestCta className="mkt-foot-demo" magnetic={false}>
              {t('cta.demo')}
            </DemoRequestCta>
            <WhatsAppDemoCta className="mkt-foot-wa">{t('footer.whatsappCta')}</WhatsAppDemoCta>
          </div>
        </div>

        <div className="mkt-foot-divider" aria-hidden>
          <span />
        </div>

        <div className="mkt-foot-cols">
          <nav className="mkt-foot-col" aria-label={t('footer.platform')}>
            <h2>{t('footer.platform')}</h2>
            <ul>
              {PLATFORM_LINKS.map((item) => (
                <li key={item.labelKey}>
                  <Link to={item.to}>{t(item.labelKey)}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="mkt-foot-col" aria-label={t('footer.agency')}>
            <h2>{t('footer.agency')}</h2>
            <ul>
              {AGENCY_LINKS.map((item) => (
                <li key={item.labelKey}>
                  <Link to={item.to}>{t(item.labelKey)}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="mkt-foot-col" aria-label={t('footer.resources')}>
            <h2>{t('footer.resources')}</h2>
            <ul>
              {RESOURCE_LINKS.map((item) => (
                <li key={item.labelKey}>
                  <Link to={item.to}>{t(item.labelKey)}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="mkt-foot-col" aria-label={t('footer.contact')}>
            <h2>{t('footer.contact')}</h2>
            <ul>
              <li>
                <Link to="/contact?intent=demo">{t('cta.demo')}</Link>
              </li>
              <li>
                <Link to="/contact">{t('footer.contactPage')}</Link>
              </li>
              <li>
                <a href={demoWhatsAppHref()} target="_blank" rel="noopener noreferrer">
                  {t('footer.whatsappCta')}
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mkt-foot-sign">
          <p className="mkt-foot-mark" aria-hidden>
            {BRAND}
          </p>
          <div className="mkt-foot-legal">
            <p>
              © {new Date().getFullYear()} {BRAND}. {t('footer.rights')}
            </p>
            <p>{t('footer.built')}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default MarketingFooter
