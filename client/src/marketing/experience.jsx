import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'
import { SHOTS } from './productPreviews'
import { useMktI18n } from './i18n/MarketingI18n'

const ease = [0.22, 1, 0.36, 1]
const finePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer:fine) and (min-width: 900px)').matches

export const Caption = () => {
  const { t } = useMktI18n()
  return <p className="mkt-caption">{t('caption')}</p>
}

export const Frame = ({ title = 'RSZ CAR', className = '', children, hover = false }) => {
  const root = useRef(null)
  const reduce = useReducedMotion()

  const reset = () => {
    const el = root.current
    if (!el) return
    el.style.transform = ''
    el.style.willChange = ''
    el.style.setProperty('--mx', '50%')
    el.style.setProperty('--my', '18%')
    const pane = el.querySelector('.mkt-xp-pane')
    if (pane) pane.style.transform = ''
  }

  return (
    <figure
      ref={root}
      className={`mkt-xp-frame${hover ? ' is-hoverable' : ''} ${className}`.trim()}
      onMouseMove={(event) => {
        if (!hover || reduce || !finePointer() || !root.current) return
        const box = root.current.getBoundingClientRect()
        const px = (event.clientX - box.left) / box.width - 0.5
        const py = (event.clientY - box.top) / box.height - 0.5
        root.current.style.willChange = 'transform'
        root.current.style.transform = `perspective(1400px) rotateY(${px * 4.2}deg) rotateX(${-py * 3}deg) translate3d(0, -2px, 0)`
        root.current.style.setProperty('--mx', `${(px + 0.5) * 100}%`)
        root.current.style.setProperty('--my', `${(py + 0.5) * 100}%`)
        const pane = root.current.querySelector('.mkt-xp-pane')
        if (pane) pane.style.transform = `translate3d(${px * 5}px, ${py * 3.5}px, 0)`
      }}
      onMouseLeave={reset}
    >
      <div className="mkt-xp-bar" aria-hidden>
        <i className="mkt-xp-lamp" />
        <span>{title}</span>
      </div>
      <div className="mkt-xp-pane">{children}</div>
    </figure>
  )
}

export const Crop = ({ src, pos = '50% 12%', alt = '', eager = false }) => (
  <img
    className="mkt-xp-img"
    src={src}
    alt={alt}
    style={{ objectPosition: pos }}
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
  />
)

export const Reveal = ({ children, className = '', delay = 0 }) => {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.85, delay, ease }}
    >
      {children}
    </motion.div>
  )
}

export const StickyScene = ({ height = '210vh', children, className = '', id }) => {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })
  return (
    <div id={id} ref={ref} className={`mkt-xp-track ${className}`.trim()} style={{ height }}>
      <div className="mkt-xp-pin">{children(scrollYProgress)}</div>
    </div>
  )
}

const useFinePointer = () => {
  const [fine, setFine] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(pointer:fine) and (min-width: 980px)')
    const apply = () => setFine(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return fine
}

const Layer = ({ mx, my, depth, className, children }) => {
  const reduce = useReducedMotion()
  const x = useTransform(mx, [-0.5, 0.5], reduce ? [0, 0] : [-5.5 * depth, 5.5 * depth])
  const y = useTransform(my, [-0.5, 0.5], reduce ? [0, 0] : [-3.8 * depth, 3.8 * depth])
  return (
    <motion.div className={className} style={{ x, y }}>
      {children}
    </motion.div>
  )
}

export const HeroScene = () => {
  const { t } = useMktI18n()
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const root = useRef(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 48, damping: 26, mass: 0.85 })
  const sy = useSpring(my, { stiffness: 48, damping: 26, mass: 0.85 })

  const onMove = (event) => {
    if (!fine || reduce || !root.current) return
    const box = root.current.getBoundingClientRect()
    mx.set((event.clientX - box.left) / box.width - 0.5)
    my.set((event.clientY - box.top) / box.height - 0.5)
  }

  const plateIn = (extra = {}) =>
    reduce ? false : { opacity: 0, scale: 0.94, filter: 'blur(10px)', ...extra }
  const plateMove = (delay) => ({ duration: 1.15, delay, ease })

  return (
    <div
      className="mkt-xp-hero-scene"
      ref={root}
      onMouseMove={onMove}
      onMouseLeave={() => {
        mx.set(0)
        my.set(0)
      }}
    >
      <div className="mkt-xp-hero-lamp" aria-hidden />
      <Layer mx={sx} my={sy} depth={0.22} className="mkt-xp-layer is-back-left">
        <motion.div
          initial={plateIn({ rotate: -6 })}
          animate={{ opacity: 0.58, scale: 1, rotate: -6, filter: 'blur(0px)' }}
          transition={plateMove(0.48)}
          className="mkt-xp-tilt"
        >
          <Frame title={t('frames.reservations')}>
            <Crop src={SHOTS.reservations} pos="70% 30%" alt="" eager />
          </Frame>
        </motion.div>
      </Layer>
      <Layer mx={sx} my={sy} depth={0.18} className="mkt-xp-layer is-back-right">
        <motion.div
          initial={plateIn({ rotate: 5 })}
          animate={{ opacity: 0.5, scale: 1, rotate: 5, filter: 'blur(0px)' }}
          transition={plateMove(0.58)}
          className="mkt-xp-tilt"
        >
          <Frame title={t('frames.fleet')}>
            <Crop src={SHOTS.fleet} pos="48% 20%" alt="" />
          </Frame>
        </motion.div>
      </Layer>
      <Layer mx={sx} my={sy} depth={0.82} className="mkt-xp-layer is-main">
        <motion.div
          initial={plateIn({ scale: 0.96 })}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={plateMove(0.78)}
        >
          <Frame title={t('frames.workspace')} className="is-hero">
            <Crop src={SHOTS.dashboard} pos="50% 8%" alt={t('alts.dashboard')} eager />
          </Frame>
        </motion.div>
      </Layer>
      <Layer mx={sx} my={sy} depth={1.28} className="mkt-xp-layer is-chip-a">
        <motion.div initial={plateIn()} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} transition={plateMove(1.05)}>
          <Frame title={t('frames.calendar')}>
            <Crop src={SHOTS.calendar} pos="55% 35%" alt="" />
          </Frame>
          <span>{t('frames.reservations')}</span>
        </motion.div>
      </Layer>
      <Layer mx={sx} my={sy} depth={1.38} className="mkt-xp-layer is-chip-b">
        <motion.div initial={plateIn()} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} transition={plateMove(1.18)}>
          <Frame title={t('frames.analytics')}>
            <Crop src={SHOTS.analytics} pos="52% 18%" alt="" />
          </Frame>
          <span>{t('frames.revenue')}</span>
        </motion.div>
      </Layer>
    </div>
  )
}

export { SHOTS }
