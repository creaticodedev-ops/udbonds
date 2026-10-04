import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Caption, Crop, Frame, Reveal, SHOTS, StickyScene } from './experience'
import { useMktI18n } from './i18n/MarketingI18n'

const StepLabel = ({ progress, steps }) => {
  const [index, setIndex] = useState(0)
  useMotionValueEvent(progress, 'change', (value) => {
    const next = Math.min(steps.length - 1, Math.max(0, Math.floor(value * steps.length)))
    setIndex((prev) => (prev === next ? prev : next))
  })
  return <em className="mkt-xp-live">{steps[index]}</em>
}

const clampUnit = (value) => Math.min(1, Math.max(0, value))

/** WAAPI/Motion keyframe offsets must stay in [0, 1] and never decrease. */
const unitKeyframes = (values) => {
  const next = values.map(clampUnit)
  for (let i = 1; i < next.length; i += 1) {
    if (next[i] < next[i - 1]) next[i] = next[i - 1]
  }
  return next
}

const FilmCell = ({ progress, index, count, children }) => {
  const reduce = useReducedMotion()
  const span = 1 / Math.max(1, count - 1)
  const mid = clampUnit(index * span)
  const stops = unitKeyframes([mid - span * 0.72, mid, mid + span * 0.72])
  const opacity = useTransform(progress, stops, [0.42, 1, 0.42])
  const scale = useTransform(progress, stops, [0.965, 1, 0.965])
  if (reduce) return <div className="mkt-xp-film-cell-wrap">{children}</div>
  return (
    <motion.div className="mkt-xp-film-cell-wrap" style={{ opacity, scale }}>
      {children}
    </motion.div>
  )
}

const FinancePin = ({ progress }) => {
  const { t, ta, isRtl } = useMktI18n()
  const reduce = useReducedMotion()
  const x = useTransform(progress, [0, 1], reduce ? ['0%', '0%'] : ['0%', isRtl ? '75%' : '-75%'])
  const rail = useTransform(progress, [0, 1], [0, 1])
  const slides = [
    { src: SHOTS.revenues, title: t('frames.revenues'), alt: t('alts.revenues') },
    { src: SHOTS.invoices, title: t('frames.invoices'), alt: t('alts.invoices') },
    { src: SHOTS.analytics, title: t('frames.analytics'), alt: t('alts.analytics') },
    { src: SHOTS.reports, title: t('frames.reports'), alt: t('alts.reports') },
  ]
  return (
    <div className="mkt-xp-chapter mkt-cockpit">
      <div className="mkt-cockpit-haze" aria-hidden />
      <div className="mkt-xp-copy">
        <p className="mkt-kicker">{t('finance.kicker')}</p>
        <h2 className="mkt-h2">{t('finance.title')}</h2>
        <p className="mkt-lead">{t('finance.lead')}</p>
        <div className="mkt-cockpit-readout">
          <StepLabel progress={progress} steps={ta('finance.steps')} />
        </div>
        <div className="mkt-cockpit-rail" aria-hidden>
          <span className="mkt-cockpit-ticks">
            {slides.map((slide) => (
              <i key={slide.title} />
            ))}
          </span>
          <motion.i className="mkt-cockpit-fill" style={{ scaleX: rail }} />
        </div>
      </div>
      <div className="mkt-xp-film">
        <motion.div className="mkt-xp-film-track" style={{ x }}>
          {slides.map((slide, index) => (
            <FilmCell key={slide.title} progress={progress} index={index} count={slides.length}>
              <Frame title={slide.title} className="mkt-xp-film-cell">
                <Crop src={slide.src} pos="50% 16%" alt={slide.alt} />
              </Frame>
            </FilmCell>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

export const FinanceChapter = () => {
  const reduce = useReducedMotion()
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 979px)')
    const apply = () => setCompact(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  const height = reduce ? 'auto' : compact ? '128vh' : '240vh'
  return (
    <StickyScene id="finance" height={height} className="is-chapter is-dark is-cockpit">
      {(progress) => <FinancePin progress={progress} />}
    </StickyScene>
  )
}

const EcoNode = ({ node, pullX, pullY, reduce }) => (
  <motion.div
    className={`mkt-xp-eco-s is-${node.key}`}
    initial={reduce ? false : { opacity: 0, scale: 0.96, x: node.from.x, y: node.from.y }}
    whileInView={reduce ? undefined : { opacity: 1, scale: 1, x: 0, y: 0 }}
    viewport={{ once: true, margin: '-8%' }}
    transition={{ duration: 1, delay: node.delay, ease: [0.22, 1, 0.36, 1] }}
  >
    <motion.div style={{ x: pullX, y: pullY }}>
      <Frame hover title={node.title}>
        <Crop src={node.src} pos="50% 20%" alt={node.alt} />
      </Frame>
    </motion.div>
  </motion.div>
)

export const Ecosystem = () => {
  const { t } = useMktI18n()
  const reduce = useReducedMotion()
  const stage = useRef(null)
  const { scrollYProgress } = useScroll({
    target: stage,
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
  const inwardL = useTransform(scrollYProgress, [0, 0.5, 1], live ? [10, 0, -6] : [0, 0, 0])
  const inwardR = useTransform(scrollYProgress, [0, 0.5, 1], live ? [-10, 0, 6] : [0, 0, 0])
  const inwardY = useTransform(scrollYProgress, [0, 0.5, 1], live ? [8, 0, -5] : [0, 0, 0])
  const coreS = useTransform(scrollYProgress, [0, 0.5, 1], live ? [0.985, 1, 1.012] : [1, 1, 1])
  const nodes = [
    { key: 'a', title: t('frames.walkin'), src: SHOTS.walkin, alt: t('alts.walkin'), delay: 0.08, from: { x: -16, y: -8 }, side: 'l' },
    { key: 'b', title: t('frames.customers'), src: SHOTS.customers, alt: t('alts.customers'), delay: 0.14, from: { x: 16, y: -6 }, side: 'r' },
    { key: 'c', title: t('frames.storefront'), src: SHOTS.storefront, alt: t('alts.storefront'), delay: 0.2, from: { x: -14, y: 10 }, side: 'l' },
    { key: 'd', title: t('frames.templates'), src: SHOTS.templates, alt: t('alts.templates'), delay: 0.26, from: { x: 14, y: 8 }, side: 'r' },
    { key: 'e', title: t('frames.accounting'), src: SHOTS.accounting, alt: t('alts.accounting'), delay: 0.32, from: { x: 0, y: -12 }, side: 'y' },
  ]
  return (
    <section className="mkt-xp-eco" id="workspace">
      <div className="mkt-act-veil is-top is-from-dark" aria-hidden />
      <div className="mkt-wrap">
        <Reveal className="mkt-intro">
          <p className="mkt-kicker">{t('eco.kicker')}</p>
          <h2 className="mkt-h2">{t('eco.title')}</h2>
          <p className="mkt-lead">{t('eco.lead')}</p>
        </Reveal>
        <div className="mkt-xp-eco-stage" ref={stage}>
          <svg className="mkt-eco-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {[
              ['50', '52', '12', '18', 0.12],
              ['50', '52', '88', '14', 0.18],
              ['50', '52', '14', '86', 0.24],
              ['50', '52', '86', '82', 0.3],
              ['50', '52', '50', '8', 0.2],
            ].map(([x1, y1, x2, y2, delay]) => (
              <motion.line
                key={`${x2}-${y2}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                whileInView={reduce ? undefined : { pathLength: 1, opacity: 1 }}
                viewport={{ once: true, margin: '-12%' }}
                transition={{ duration: 1.2, delay, ease: [0.22, 1, 0.36, 1] }}
              />
            ))}
          </svg>
          <motion.div className="mkt-xp-eco-core" style={{ scale: coreS }}>
            <Frame hover title={t('frames.dashboard')} className="is-hero">
              <Crop src={SHOTS.dashboard} pos="50% 10%" alt={t('alts.dashboard')} />
            </Frame>
          </motion.div>
          {nodes.map((node) => (
            <EcoNode
              key={node.key}
              node={node}
              reduce={reduce}
              pullX={node.side === 'l' ? inwardL : node.side === 'r' ? inwardR : 0}
              pullY={inwardY}
            />
          ))}
        </div>
        <Caption />
      </div>
    </section>
  )
}
