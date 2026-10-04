import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { DemoRequestCta, WhatsAppDemoCta } from '../Ctas'
import { ProductShot } from '../productPreviews'
import { useMktI18n } from '../i18n/MarketingI18n'

const SIGNAL = ['fleet', 'reservations', 'customers', 'contracts']

export const SaasHero = () => {
  const { t } = useMktI18n()
  const reduce = useReducedMotion()
  const [ready, setReady] = useState(false)
  const [settled, setSettled] = useState(false)
  const machineRef = useRef(null)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setReady(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (!ready || reduce) {
      if (ready) setSettled(true)
      return undefined
    }
    const timer = window.setTimeout(() => setSettled(true), 1400)
    return () => window.clearTimeout(timer)
  }, [ready, reduce])

  useEffect(() => {
    if (reduce || !machineRef.current) return undefined
    if (!window.matchMedia('(pointer:fine)').matches) return undefined
    const node = machineRef.current
    let raf = 0
    const onMove = (event) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const box = node.getBoundingClientRect()
        const x = ((event.clientX - box.left) / box.width - 0.5) * 2
        const y = ((event.clientY - box.top) / box.height - 0.5) * 2
        node.style.setProperty('--mx', x.toFixed(3))
        node.style.setProperty('--my', y.toFixed(3))
        node.style.setProperty('--glow-x', `${((event.clientX - box.left) / box.width) * 100}%`)
        node.style.setProperty('--glow-y', `${((event.clientY - box.top) / box.height) * 100}%`)
      })
    }
    const onLeave = () => {
      node.style.setProperty('--mx', '0')
      node.style.setProperty('--my', '0')
    }
    node.addEventListener('pointermove', onMove, { passive: true })
    node.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      node.removeEventListener('pointermove', onMove)
      node.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce])

  return (
    <section
      className={`saas-hero${ready ? ' is-ready' : ''}${settled ? ' is-settled' : ''}${reduce ? ' is-reduced' : ''}`}
      aria-label={t('saas.heroAria')}
    >
      <div className="saas-hero-bg" aria-hidden>
        <span className="saas-hero-gridlines" />
        <span className="saas-hero-beam" />
        <span className="saas-hero-orb is-a" />
        <span className="saas-hero-orb is-b" />
      </div>

      <div className="mkt-wrap saas-hero-shell">
        <div className="saas-hero-intro">
          <p className="saas-hero-eyebrow">
            <i aria-hidden />
            {t('saas.heroEyebrow')}
          </p>
          <h1 className="saas-hero-title">
            <span className="saas-hero-line">{t('saas.heroLine1')}</span>
            <span className="saas-hero-line is-accent">{t('saas.heroLine2')}</span>
          </h1>
          <p className="saas-hero-lead">{t('saas.heroLead')}</p>

          <div className="saas-hero-actions">
            <DemoRequestCta className="saas-hero-demo">{t('cta.demo')}</DemoRequestCta>
            <WhatsAppDemoCta className="saas-hero-wa">{t('cta.whatsapp')}</WhatsAppDemoCta>
          </div>

          <ul className="saas-hero-signal" aria-label={t('saas.heroSignalLabel')}>
            {SIGNAL.map((key) => (
              <li key={key}>{t(`saas.heroSignal.${key}`)}</li>
            ))}
          </ul>
        </div>

        <div ref={machineRef} className="saas-hero-machine">
          <div className="saas-hero-glow" aria-hidden />
          <div className="saas-hero-sweep" aria-hidden />

          <div className="saas-hero-layer is-back-a" aria-hidden>
            <ProductShot id="fleet" alt="" sizes="(max-width: 900px) 70vw, 420px" />
          </div>
          <div className="saas-hero-layer is-back-b" aria-hidden>
            <ProductShot id="calendar" alt="" sizes="(max-width: 900px) 70vw, 400px" />
          </div>

          <div className="saas-hero-core">
            <div className="saas-hero-chrome" aria-hidden>
              <span />
              <span />
              <span />
              <p>RSZ CAR</p>
            </div>
            <div className="saas-hero-screen">
              <ProductShot
                id="dashboard"
                alt={t('alts.dashboard')}
                eager
                sizes="(max-width: 720px) 94vw, min(920px, 78vw)"
              />
            </div>
          </div>

          <div className="saas-hero-pill is-left" aria-hidden>
            <strong>{t('saas.heroPill.desk')}</strong>
            <span>{t('saas.heroPill.deskSub')}</span>
          </div>
          <div className="saas-hero-pill is-right" aria-hidden>
            <strong>{t('saas.heroPill.ops')}</strong>
            <span>{t('saas.heroPill.opsSub')}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default SaasHero
