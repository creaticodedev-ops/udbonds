import { motion, useReducedMotion } from 'motion/react'
import { useMktI18n } from '../i18n/MarketingI18n'

export const SaasProblem = () => {
  const { t, ta } = useMktI18n()
  const reduce = useReducedMotion()
  const problems = ta('saas.problems')
  const solutions = ta('saas.solutions')

  return (
    <section className="saas-section saas-problem" id="features">
      <div className="mkt-wrap">
        <div className="saas-intro">
          <p className="saas-kicker">{t('saas.problemKicker')}</p>
          <h2 className="saas-h2">{t('saas.problemTitle')}</h2>
          <p className="saas-lead">{t('saas.problemLead')}</p>
        </div>
        <div className="saas-problem-grid">
          <motion.div
            className="saas-panel"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.55 }}
          >
            <h3>{t('saas.problemPanel')}</h3>
            <ul>
              {problems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            className="saas-panel is-dark"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.55, delay: 0.08 }}
          >
            <p className="saas-kicker">{t('saas.solutionKicker')}</p>
            <h3>{t('saas.solutionPanel')}</h3>
            <ul>
              {solutions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default SaasProblem
