import { NAV_ITEMS, SITE } from '../../config/site'
import { useI18n } from '../../i18n/I18nProvider'
import { LangSwitch, Logo } from '../ui'

const COMPANY_LINKS = ['services', 'why', 'how', 'approach']

const ContactList = () => {
  const { t } = useI18n()
  const { email, phone, whatsapp, address } = SITE.contact
  const items = [
    email && { key: 'email', href: `mailto:${email}`, value: email },
    phone && { key: 'phone', href: `tel:${phone.replace(/\s+/g, '')}`, value: phone },
    whatsapp && { key: 'whatsapp', href: `https://wa.me/${whatsapp.replace(/\D/g, '')}`, value: whatsapp, external: true },
    address && { key: 'address', value: address },
  ].filter(Boolean)

  if (!items.length) return <p className="foot-muted">{t('footer.contactSoon')}</p>

  return (
    <ul className="foot-list">
      {items.map((item) => (
        <li key={item.key}>
          <span className="foot-label">{t(`footer.${item.key}`)}</span>
          {item.href ? (
            <a
              href={item.href}
              dir="ltr"
              {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {item.value}
            </a>
          ) : (
            <span>{item.value}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export const Footer = () => {
  const { t } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="foot" aria-labelledby="foot-title">
      <h2 id="foot-title" className="sr-only">
        US Bonds
      </h2>
      <div className="container">
        <div className="foot-top">
          <div className="foot-brand">
            <Logo className="foot-logo" />
            <p>{t('footer.statement')}</p>
          </div>
          <div className="foot-lang">
            <span>{t('footer.language')}</span>
            <LangSwitch />
          </div>
        </div>

        <div className="foot-grid">
          <nav className="foot-col" aria-label={t('footer.navTitle')}>
            <h3>{t('footer.navTitle')}</h3>
            <ul className="foot-list">
              {NAV_ITEMS.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`}>{t(`nav.${item.key}`)}</a>
                </li>
              ))}
            </ul>
          </nav>
          <nav className="foot-col" aria-label={t('footer.companyTitle')}>
            <h3>{t('footer.companyTitle')}</h3>
            <ul className="foot-list">
              {COMPANY_LINKS.map((id) => (
                <li key={id}>
                  <a href={`#${id}`}>{t(`footer.company.${id}`)}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="foot-col" id="contact">
            <h3>{t('footer.contactTitle')}</h3>
            <ContactList />
          </div>
          <div className="foot-col">
            <h3>{t('footer.legalTitle')}</h3>
            <ul className="foot-list">
              <li>
                <a href="#risk">{t('footer.riskLink')}</a>
              </li>
              <li className="foot-muted">{t('footer.legalSoon')}</li>
            </ul>
          </div>
        </div>

        <section className="foot-risk" id="risk" aria-labelledby="risk-title">
          <h3 id="risk-title">{t('footer.riskTitle')}</h3>
          <p>{t('footer.riskText')}</p>
        </section>

        <div className="foot-bottom">
          <p>{t('footer.rights', { year })}</p>
          <a href="#top">{t('footer.backToTop')}</a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
