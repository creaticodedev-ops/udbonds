import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { Crop, Frame, SHOTS } from './experience'
import { useMktI18n } from './i18n/MarketingI18n'

const useFinePointer = () => {
  const [fine, setFine] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(pointer:fine) and (min-width: 1180px)')
    const apply = () => setFine(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return fine
}

const Layer = ({ mx, my, depth, className, children }) => {
  const reduce = useReducedMotion()
  const x = useTransform(mx, [-0.5, 0.5], reduce ? [0, 0] : [-10 * depth, 10 * depth])
  const y = useTransform(my, [-0.5, 0.5], reduce ? [0, 0] : [-7 * depth, 7 * depth])
  return (
    <motion.div className={className} style={{ x, y }}>
      {children}
    </motion.div>
  )
}

export const SignupStage = () => {
  const { t } = useMktI18n()
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const root = useRef(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 52, damping: 26, mass: 0.8 })
  const sy = useSpring(my, { stiffness: 52, damping: 26, mass: 0.8 })
  const plate = (delay) => ({ duration: 0.95, delay, ease: [0.22, 1, 0.36, 1] })

  return (
    <div
      className="onboard-stage"
      ref={root}
      onMouseMove={(event) => {
        if (!fine || reduce || !root.current) return
        const box = root.current.getBoundingClientRect()
        mx.set((event.clientX - box.left) / box.width - 0.5)
        my.set((event.clientY - box.top) / box.height - 0.5)
      }}
      onMouseLeave={() => {
        mx.set(0)
        my.set(0)
      }}
    >
      <Layer mx={sx} my={sy} depth={0.35} className="onboard-stage-main">
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={plate(0.12)}
        >
          <Frame title={t('frames.workspace')} className="is-hero">
            <Crop src={SHOTS.dashboard} pos="50% 8%" alt={t('alts.dashboard')} eager />
          </Frame>
        </motion.div>
      </Layer>
      <Layer mx={sx} my={sy} depth={1.1} className="onboard-float is-a">
        <motion.div initial={reduce ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={plate(0.32)}>
          <Frame hover title={t('frames.reservations')}>
            <Crop src={SHOTS.reservations} pos="72% 28%" alt="" />
          </Frame>
        </motion.div>
      </Layer>
      <Layer mx={sx} my={sy} depth={1.18} className="onboard-float is-b">
        <motion.div initial={reduce ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={plate(0.42)}>
          <Frame hover title={t('frames.fleet')}>
            <Crop src={SHOTS.fleet} pos="48% 18%" alt="" />
          </Frame>
        </motion.div>
      </Layer>
      <Layer mx={sx} my={sy} depth={1.22} className="onboard-float is-d">
        <motion.div initial={reduce ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={plate(0.52)}>
          <Frame hover title={t('frames.calendar')}>
            <Crop src={SHOTS.calendar} pos="55% 32%" alt="" />
          </Frame>
        </motion.div>
      </Layer>
      <p className="onboard-caption">{t('caption')}</p>
    </div>
  )
}

export default SignupStage
