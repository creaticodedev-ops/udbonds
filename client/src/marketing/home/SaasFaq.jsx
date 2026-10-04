import { useMktI18n } from '../i18n/MarketingI18n'

export const SaasFaq = () => {
  const { t, ta } = useMktI18n()
  const items = ta('saas.faq')

  return (
    <section className="saas-section" id="faq">
      <div className="mkt-wrap">
        <div className="saas-intro is-center">
          <p className="saas-kicker">{t('saas.faqKicker')}</p>
          <h2 className="saas-h2">{t('saas.faqTitle')}</h2>
          <p className="saas-lead">{t('saas.faqLead')}</p>
        </div>
        <div className="saas-faq-list">
          {items.map((item) => (
            <details key={item.q} className="saas-faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export default SaasFaq
