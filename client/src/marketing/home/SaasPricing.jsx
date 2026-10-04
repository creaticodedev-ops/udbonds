import { motion, useReducedMotion } from 'motion/react'
import { ContactCta, PrimaryCta } from '../Ctas'
import { PLANS, TRIAL_DAYS } from '../config'
import { useMktI18n } from '../i18n/MarketingI18n'

const Tick = () => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3.2 8.4l3 3.1 6.6-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const SaasPricing = () => {
  const { t, ta } = useMktI18n()
  const reduce = useReducedMotion()

  return (
    <section className="saas-section saas-pricing" id="pricing">
      <div className="mkt-wrap">
        <div className="saas-intro is-center">
          <p className="saas-kicker">{t('pricing.kicker')}</p>
          <h2 className="saas-h2">{t('pricing.title')}</h2>
          <p className="saas-lead">{t('pricing.lead', { days: TRIAL_DAYS })}</p>
        </div>

        <div className="saas-plans">
          {PLANS.map((plan, index) => (
            <motion.article
              key={plan.id}
              className={`saas-plan${plan.popular ? ' is-pop' : ''}`}
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
            >
              {plan.popular ? <span className="saas-plan-badge">{t('pricing.popular')}</span> : null}
              <h3>{t(`pricing.${plan.id}.name`)}</h3>
              <p className="saas-plan-price">
                {plan.id === 'business' ? t('pricing.business.price') : plan.price}
                {plan.currency ? (
                  <small>
                    {plan.currency}/{t('pricing.month')}
                  </small>
                ) : null}
              </p>
              <p className="saas-plan-audience">{t(`pricing.${plan.id}.audience`)}</p>
              <ul>
                {ta(`pricing.${plan.id}.features`).map((feature) => (
                  <li key={feature}>
                    <Tick />
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.id === 'business' ? (
                <ContactCta>{t('cta.talk')}</ContactCta>
              ) : (
                <PrimaryCta magnetic={false}>{t('cta.trial')}</PrimaryCta>
              )}
            </motion.article>
          ))}
        </div>
        <p className="saas-pricing-note">{t('pricing.note')}</p>
      </div>
    </section>
  )
}

export default SaasPricing
