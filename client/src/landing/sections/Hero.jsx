import { useRef } from 'react'
import { useI18n } from '../../i18n/I18nProvider'
import { useScrollProgress } from '../hooks'
import { ButtonLink } from '../ui'
import { HeroVisual } from '../visuals/HeroVisual'

export const Hero = () => {
  const { t, tm } = useI18n()
  const ref = useRef(null)
  useScrollProgress(ref)
  const pillars = tm('hero.pillars') || []

  return (
    <section ref={ref} className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true">
        <span className="hero-grid" />
        <span className="hero-glow" />
      </div>
      <div className="hero-art">
        <HeroVisual label={t('hero.visual')} />
      </div>

      <div className="hero-content container">
        <p className="hero-eyebrow">
          <i aria-hidden="true" />
          {t('hero.eyebrow')}
        </p>
        <h1 className="hero-title" id="hero-title">
          <span className="hero-line">{t('hero.titleA')}</span>
          <span className="hero-line is-soft">{t('hero.titleB')}</span>
        </h1>
        <p className="hero-lead">{t('hero.lead')}</p>
        <div className="hero-actions">
          <ButtonLink href="#offers" arrow>
            {t('hero.ctaPrimary')}
          </ButtonLink>
          <ButtonLink href="#about" variant="ghost">
            {t('hero.ctaSecondary')}
          </ButtonLink>
        </div>
        <ul className="hero-pillars">
          {pillars.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>

      <a className="hero-scroll" href="#about" aria-label={t('hero.ctaSecondary')}>
        <span>{t('hero.scroll')}</span>
        <i aria-hidden="true" />
      </a>
    </section>
  )
}

export default Hero
