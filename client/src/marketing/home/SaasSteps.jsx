import { useMktI18n } from '../i18n/MarketingI18n'

export const SaasSteps = () => {
  const { t, ta } = useMktI18n()
  const steps = ta('saas.steps')

  return (
    <section className="saas-section" id="how">
      <div className="mkt-wrap">
        <div className="saas-intro is-center">
          <p className="saas-kicker">{t('saas.stepsKicker')}</p>
          <h2 className="saas-h2">{t('saas.stepsTitle')}</h2>
          <p className="saas-lead">{t('saas.stepsLead')}</p>
        </div>
        <div className="saas-steps-grid">
          {steps.map((step) => (
            <article key={step.title} className="saas-step">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default SaasSteps
