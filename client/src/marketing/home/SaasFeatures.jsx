import { motion, useReducedMotion } from 'motion/react'
import { useMktI18n } from '../i18n/MarketingI18n'

const FEATURE_KEYS = ['operations', 'customers', 'documents', 'finance', 'insights', 'storefront']

export const SaasFeatures = () => {
  const { t, ta } = useMktI18n()
  const reduce = useReducedMotion()

  return (
    <section className="saas-section saas-features" id="capabilities">
      <div className="mkt-wrap">
        <div className="saas-intro">
          <p className="saas-kicker">{t('saas.featuresKicker')}</p>
          <h2 className="saas-h2">{t('saas.featuresTitle')}</h2>
          <p className="saas-lead">{t('saas.featuresLead')}</p>
        </div>
        <div className="saas-feat-grid">
          {FEATURE_KEYS.map((key, index) => (
            <motion.article
              key={key}
              className="saas-feat"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.25) }}
            >
              <p className="saas-feat-index">{String(index + 1).padStart(2, '0')}</p>
              <h3>{t(`saas.feat.${key}.title`)}</h3>
              <p>{t(`saas.feat.${key}.body`)}</p>
              <ul>
                {ta(`saas.feat.${key}.items`).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default SaasFeatures
