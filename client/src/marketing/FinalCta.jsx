import { useEffect, useId, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { ContactCta, PrimaryCta } from './Ctas'
import { TRIAL_DAYS } from './config'
import { useMktI18n } from './i18n/MarketingI18n'

const Car = ({ uid }) => (
  <svg className="mkt-final-car" viewBox="0 0 720 220" aria-hidden>
    <defs>
      <linearGradient id={`${uid}-body`} x1="80" y1="40" x2="640" y2="180" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
        <stop offset="0.35" stopColor="#f3e7e2" stopOpacity="0.38" />
        <stop offset="0.72" stopColor="#c9b3b0" stopOpacity="0.22" />
        <stop offset="1" stopColor="#1a0a0a" stopOpacity="0.55" />
      </linearGradient>
      <linearGradient id={`${uid}-glass`} x1="240" y1="48" x2="520" y2="108" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fff" stopOpacity="0.42" />
        <stop offset="1" stopColor="#3a1818" stopOpacity="0.18" />
      </linearGradient>
      <linearGradient id={`${uid}-beam`} x1="680" y1="120" x2="760" y2="120" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fff6e4" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fff6e4" stopOpacity="0" />
      </linearGradient>
    </defs>
    <ellipse className="mkt-final-shadow" cx="360" cy="200" rx="272" ry="11" />
    <path
      fill={`url(#${uid}-body)`}
      fillRule="evenodd"
      d="M46 134C50 116 66 108 90 104C108 78 150 54 230 46C310 38 400 40 478 52C520 62 552 80 576 96C620 100 662 110 688 124C704 130 714 138 712 148H78C56 150 44 144 46 134ZM136 168A34 34 0 1 0 204 168A34 34 0 1 0 136 168ZM492 168A34 34 0 1 0 560 168A34 34 0 1 0 492 168Z"
    />
    <path
      className="mkt-final-window"
      fill={`url(#${uid}-glass)`}
      d="M250 78C310 54 400 50 470 62C492 70 506 82 510 92H262C252 92 244 86 250 78Z"
    />
    <path className="mkt-final-chrome" d="M108 116h492" />
    <path className="mkt-final-pillar" d="M368 52l-12 40" />
    <ellipse cx="682" cy="126" rx="15" ry="7" className="mkt-final-lamp" />
    <ellipse cx="734" cy="126" rx="54" ry="14" fill={`url(#${uid}-beam)`} />
    <rect x="54" y="118" width="13" height="6" rx="1.5" className="mkt-final-tail" />
    <g className="mkt-final-wheel">
      <circle cx="170" cy="168" r="33" />
      <circle cx="170" cy="168" r="20" />
      <path d="M170 148v40M150 168h40" />
    </g>
    <g className="mkt-final-wheel">
      <circle cx="526" cy="168" r="33" />
      <circle cx="526" cy="168" r="20" />
      <path d="M526 148v40M506 168h40" />
    </g>
  </svg>
)

export const FinalCta = () => {
  const { t } = useMktI18n()
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const uid = useId().replace(/:/g, '')

  useEffect(() => {
    const el = ref.current
    if (!el || reduce) return undefined
    const io = new IntersectionObserver(
      ([entry]) => el.classList.toggle('is-off', !entry.isIntersecting),
      { rootMargin: '80px 0px', threshold: 0.08 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduce])

  return (
    <section ref={ref} className={`mkt-final${reduce ? ' is-static' : ''}`}>
      <div className="mkt-final-scene" aria-hidden>
        <div className="mkt-final-atmos" />
        <div className="mkt-final-haze mkt-final-haze-a" />
        <div className="mkt-final-haze mkt-final-haze-b" />
        <div className="mkt-final-ground" />
        <svg className="mkt-final-road" viewBox="0 0 1000 400" preserveAspectRatio="none">
          <path className="mkt-final-edge" d="M0 368L760 168" />
          <path className="mkt-final-edge" d="M1000 372L760 168" />
          <path className="mkt-final-dash" d="M220 400L760 168" />
        </svg>
        <div className="mkt-final-streaks">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="mkt-final-reflect">
          <i />
          <i />
          <i />
        </div>
        <div className="mkt-final-drive">
          <Car uid={uid} />
        </div>
      </div>
      <div className="mkt-final-scrim" aria-hidden />
      <div className="mkt-wrap mkt-final-copy">
        <p className="mkt-kicker">{t('final.kicker')}</p>
        <h2 className="mkt-h2">{t('final.title')}</h2>
        <p className="mkt-lead">{t('final.lead', { days: TRIAL_DAYS })}</p>
        <div className="mkt-actions">
          <PrimaryCta variant="light" arrow>
            {t('cta.trialLong')}
          </PrimaryCta>
          <ContactCta className="mkt-btn-ghost-light">{t('cta.talk')}</ContactCta>
        </div>
      </div>
    </section>
  )
}

export default FinalCta
