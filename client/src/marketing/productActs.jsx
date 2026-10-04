import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Caption, Crop, Frame, SHOTS } from './experience'
import { useMktI18n } from './i18n/MarketingI18n'

const ease = [0.22, 1, 0.36, 1]

const useStageScroll = () => {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const [fine, setFine] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(pointer:fine) and (min-width: 980px)')
    const apply = () => setFine(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  const live = fine && !reduce
  return { ref, scrollYProgress, live, reduce }
}

export const DeskAct = () => {
  const { t } = useMktI18n()
  const { ref, scrollYProgress, live, reduce } = useStageScroll()
  const calY = useTransform(scrollYProgress, [0, 1], live ? [14, -10] : [0, 0])
  const listX = useTransform(scrollYProgress, [0, 1], live ? [-8, 8] : [0, 0])
  const mainS = useTransform(scrollYProgress, [0, 0.5, 1], live ? [0.985, 1, 1.012] : [1, 1, 1])

  return (
    <section id="product" ref={ref} className="mkt-act mkt-act-desk">
      <div className="mkt-act-veil is-bottom" aria-hidden />
      <div className="mkt-wrap mkt-act-desk-grid">
        <div className="mkt-act-copy">
          <span className="mkt-act-index">{t('act.desk.index')}</span>
          <p className="mkt-kicker">{t('act.desk.kicker')}</p>
          <h2 className="mkt-h2">{t('act.desk.title')}</h2>
          <p className="mkt-lead">{t('act.desk.lead')}</p>
          <p className="mkt-act-aside">{t('act.desk.aside')}</p>
          <div className="mkt-actions">
            <a className="mkt-btn mkt-btn-ghost-light" href="#features">
              {t('act.desk.cta')}
            </a>
          </div>
        </div>
        <div className="mkt-act-stage">
          <div className="mkt-act-shots">
            <motion.div
              className="mkt-act-main"
              initial={reduce ? false : { opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
              whileInView={reduce ? undefined : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
              viewport={{ once: true, margin: '-12%' }}
              transition={{ duration: 1.05, ease }}
            >
              <motion.div style={{ scale: mainS }}>
                <Frame hover title={t('frames.dashboard')}>
                  <Crop src={SHOTS.dashboard} pos="50% 8%" alt={t('alts.dashboard')} />
                </Frame>
              </motion.div>
            </motion.div>
            <motion.div
              className="mkt-act-float is-cal"
              initial={reduce ? false : { opacity: 0, scale: 0.94, x: 28 }}
              whileInView={reduce ? undefined : { opacity: 1, scale: 1, x: 0 }}
              viewport={{ once: true, margin: '-8%' }}
              transition={{ duration: 1, delay: 0.18, ease }}
            >
              <motion.div style={{ y: calY }}>
                <Frame hover title={t('frames.calendar')}>
                  <Crop src={SHOTS.calendar} pos="50% 28%" alt={t('alts.calendar')} />
                </Frame>
              </motion.div>
            </motion.div>
            <motion.div
              className="mkt-act-float is-list"
              initial={reduce ? false : { opacity: 0, clipPath: 'inset(0 42% 0 0)' }}
              whileInView={reduce ? undefined : { opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
              viewport={{ once: true, margin: '-8%' }}
              transition={{ duration: 1.05, delay: 0.28, ease }}
            >
              <motion.div style={{ x: listX }}>
                <Frame hover title={t('frames.reservation')}>
                  <Crop src={SHOTS.reservations} pos="74% 30%" alt={t('alts.reservations')} />
                </Frame>
              </motion.div>
            </motion.div>
          </div>
          <Caption />
        </div>
      </div>
    </section>
  )
}

export const AssetAct = () => {
  const { t } = useMktI18n()
  const { ref, scrollYProgress, live, reduce } = useStageScroll()
  const fleetReveal = useTransform(scrollYProgress, [0.15, 0.55], live ? ['inset(0 18% 0 18%)', 'inset(0 0% 0 0%)'] : ['inset(0 0% 0 0%)', 'inset(0 0% 0 0%)'])
  const docY = useTransform(scrollYProgress, [0, 1], live ? [18, -8] : [0, 0])

  return (
    <section id="features" ref={ref} className="mkt-act mkt-act-asset">
      <div className="mkt-act-veil is-top" aria-hidden />
      <div className="mkt-act-veil is-bottom is-into-dark" aria-hidden />
      <div className="mkt-wrap">
        <div className="mkt-act-asset-head">
          <span className="mkt-act-index">{t('act.asset.index')}</span>
          <div>
            <p className="mkt-kicker">{t('act.asset.kicker')}</p>
            <h2 className="mkt-h2">{t('act.asset.title')}</h2>
            <p className="mkt-lead">{t('act.asset.lead')}</p>
            <p className="mkt-act-aside">{t('act.asset.aside')}</p>
            <div className="mkt-actions">
              <a className="mkt-btn mkt-btn-ghost" href="#finance">
                {t('act.asset.cta')}
              </a>
            </div>
          </div>
        </div>
        <div className="mkt-act-pair">
          <motion.div
            className="mkt-act-pair-a"
            style={{ clipPath: fleetReveal }}
            initial={reduce ? false : { opacity: 0, scale: 0.97 }}
            whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 1.05, ease }}
          >
            <Frame hover title={t('frames.manageCars')}>
              <Crop src={SHOTS.fleet} pos="48% 16%" alt={t('alts.fleet')} />
            </Frame>
            <p className="mkt-act-plate">{t('frames.fleet')}</p>
          </motion.div>
          <div className="mkt-act-pair-b">
            <motion.div
              initial={reduce ? false : { opacity: 0, scale: 0.96, x: 22 }}
              whileInView={reduce ? undefined : { opacity: 1, scale: 1, x: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 1, delay: 0.12, ease }}
            >
              <Frame hover title={t('frames.contracts')}>
                <Crop src={SHOTS.contracts} pos="52% 14%" alt={t('alts.contracts')} />
              </Frame>
            </motion.div>
            <motion.div
              className="mkt-act-doc"
              initial={reduce ? false : { opacity: 0, scale: 0.93 }}
              whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.95, delay: 0.28, ease }}
            >
              <motion.div style={{ y: docY }}>
                <Frame hover title={t('frames.signatures')}>
                  <Crop src={SHOTS.signatures} pos="68% 35%" alt={t('alts.signatures')} />
                </Frame>
              </motion.div>
            </motion.div>
          </div>
        </div>
        <Caption />
      </div>
    </section>
  )
}
