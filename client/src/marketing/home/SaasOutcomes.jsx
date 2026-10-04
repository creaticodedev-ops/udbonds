import { motion, useReducedMotion } from 'motion/react'
import { useMktI18n } from '../i18n/MarketingI18n'

const KEYS = ['time', 'desk', 'fleet', 'docs', 'money', 'one']

export const SaasOutcomes = () => {
  const { t } = useMktI18n()
  const reduce = useReducedMotion()

  return (
    <section className="saas-section saas-outcomes">
      <div className="mkt-wrap">
        <div className="saas-intro">
          <p className="saas-kicker">{t('saas.outcomesKicker')}</p>
          <h2 className="saas-h2">{t('saas.outcomesTitle')}</h2>
          <p className="saas-lead">{t('saas.outcomesLead')}</p>
        </div>
        <div className="saas-outcome-grid">
          {KEYS.map((key, index) => (
            <motion.article
              key={key}
              className="saas-outcome"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.2) }}
            >
              <strong>{t(`saas.outcome.${key}.title`)}</strong>
              <p>{t(`saas.outcome.${key}.body`)}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default SaasOutcomes
