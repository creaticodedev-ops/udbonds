import { DemoRequestCta, WhatsAppDemoCta } from '../Ctas'
import { useMktI18n } from '../i18n/MarketingI18n'

export const SaasFinalCta = () => {
  const { t } = useMktI18n()

  return (
    <section className="saas-final" aria-labelledby="saas-final-title">
      <div className="saas-final-atmos" aria-hidden>
        <span className="saas-final-glow" />
        <span className="saas-final-line" />
      </div>
      <div className="mkt-wrap saas-final-inner">
        <p className="saas-kicker">{t('final.kicker')}</p>
        <h2 id="saas-final-title" className="saas-h2">
          {t('saas.finalTitle')}
        </h2>
        <p className="saas-lead">{t('saas.finalLead')}</p>
        <div className="saas-final-actions">
          <DemoRequestCta className="saas-final-demo">{t('cta.demo')}</DemoRequestCta>
          <WhatsAppDemoCta className="saas-final-wa">{t('cta.whatsapp')}</WhatsAppDemoCta>
        </div>
      </div>
    </section>
  )
}

export default SaasFinalCta
