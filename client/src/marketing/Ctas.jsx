import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import { demoWhatsAppHref } from './config'
import { useMktI18n } from './i18n/MarketingI18n'

export const trialTo = () => '/signup'

const Arrow = () => (
  <svg className="mkt-btn-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const WhatsAppIcon = () => (
  <svg className="mkt-wa-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.5 3.5A11.8 11.8 0 0 0 12.05 0C5.5 0 .15 5.35.15 11.9c0 2.1.55 4.15 1.6 5.95L0 24l6.3-1.65a11.85 11.85 0 0 0 5.75 1.47h.01c6.55 0 11.9-5.35 11.9-11.9 0-3.18-1.24-6.17-3.46-8.42ZM12.05 21.7h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.74.98 1-3.64-.24-.37a9.8 9.8 0 0 1-1.5-5.2c0-5.42 4.41-9.83 9.84-9.83 2.63 0 5.1 1.02 6.96 2.88a9.78 9.78 0 0 1 2.87 6.96c0 5.43-4.42 9.84-9.82 9.84Zm5.4-7.36c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.04-.17-.3-.02-.46.13-.6.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
  </svg>
)

const useMagnetic = (enabled) => {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const onMove = (event) => {
    if (!enabled || reduce || !ref.current) return
    if (typeof window === 'undefined' || !window.matchMedia('(pointer:fine)').matches) return
    const box = ref.current.getBoundingClientRect()
    const x = (event.clientX - box.left - box.width / 2) * 0.07
    const y = (event.clientY - box.top - box.height / 2) * 0.09
    ref.current.style.transition = 'none'
    ref.current.style.setProperty('--mx', `${x}px`)
    ref.current.style.setProperty('--my', `${y}px`)
    ref.current.style.setProperty('--hx', `${((event.clientX - box.left) / box.width) * 100}%`)
    ref.current.style.setProperty('--hy', `${((event.clientY - box.top) / box.height) * 100}%`)
  }
  const onLeave = () => {
    if (!ref.current) return
    ref.current.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)'
    ref.current.style.setProperty('--mx', '0px')
    ref.current.style.setProperty('--my', '0px')
  }
  return { ref, onMove, onLeave }
}

export const PrimaryCta = ({ children, className = '', variant = 'primary', arrow = true, onClick, magnetic = true }) => {
  const { t } = useMktI18n()
  const isLight = variant === 'light'
  const skipMag = !magnetic || className.includes('mkt-menu-cta')
  const mag = useMagnetic(!skipMag)
  return (
    <Link
      ref={mag.ref}
      to="/signup"
      className={`mkt-btn ${isLight ? 'mkt-btn-light' : 'mkt-btn-primary'} mkt-cta ${className}`.trim()}
      onClick={onClick}
      onMouseMove={mag.onMove}
      onMouseLeave={mag.onLeave}
    >
      {children ?? t('cta.trial')}
      {arrow ? <Arrow /> : null}
    </Link>
  )
}

export const DemoCta = ({ children, className = '' }) => {
  const { t } = useMktI18n()
  return (
    <Link to="/signup" className={`mkt-btn mkt-btn-ghost ${className}`.trim()}>
      {children ?? t('cta.account')}
    </Link>
  )
}

export const ContactCta = ({ children, className = '' }) => {
  const { t } = useMktI18n()
  return (
    <Link to="/contact" className={`mkt-btn mkt-btn-ghost ${className}`.trim()}>
      {children ?? t('cta.talk')}
    </Link>
  )
}

export const DemoRequestCta = ({ children, className = '', arrow = true, magnetic = true, onClick }) => {
  const { t } = useMktI18n()
  const mag = useMagnetic(magnetic)
  return (
    <Link
      ref={mag.ref}
      to="/contact?intent=demo"
      className={`mkt-btn mkt-btn-primary mkt-cta ${className}`.trim()}
      onClick={onClick}
      onMouseMove={mag.onMove}
      onMouseLeave={mag.onLeave}
    >
      {children ?? t('cta.demo')}
      {arrow ? <Arrow /> : null}
    </Link>
  )
}

export const SignupNavCta = ({ children, className = '', onClick }) => {
  const { t } = useMktI18n()
  return (
    <Link to="/signup" className={`mkt-btn mkt-btn-ghost mkt-nav-signup ${className}`.trim()} onClick={onClick}>
      {children ?? t('cta.register')}
    </Link>
  )
}

export const WhatsAppDemoCta = ({ children, className = '', onClick }) => {
  const { t } = useMktI18n()
  return (
    <a
      href={demoWhatsAppHref()}
      className={`mkt-btn mkt-btn-whatsapp ${className}`.trim()}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
    >
      <WhatsAppIcon />
      <span>{children ?? t('cta.whatsapp')}</span>
    </a>
  )
}

export default PrimaryCta
