import React, { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { clockParts, fetchCityTemperature } from './heroTelemetry'

const CX = 50
const CY = 50
const R = 36
const ARC_START = 135
const ARC_SWEEP = 270

const polar = (deg, radius = R) => {
  const rad = (deg * Math.PI) / 180
  return {
    x: CX + radius * Math.cos(rad),
    y: CY + radius * Math.sin(rad),
  }
}

const arcPath = () => {
  const start = polar(ARC_START)
  const end = polar(ARC_START + ARC_SWEEP)
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${R} ${R} 0 1 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`
}

const ticks = Array.from({ length: 10 }, (_, i) => {
  const deg = ARC_START + (i / 9) * ARC_SWEEP
  const a = polar(deg, R - 0.6)
  const b = polar(deg, i % 3 === 0 ? R - 5.5 : R - 3.2)
  return { i, a, b }
})

const HeroHud = ({ city, timeZone }) => {
  const { t } = useI18n()
  const needleRef = useRef(null)
  const timeRef = useRef(null)
  const [temp, setTemp] = useState(null)
  const cityLabel = String(city || '').trim().toUpperCase()

  useEffect(() => {
    let id = 0
    const loop = () => {
      if (document.visibilityState !== 'hidden') {
        const parts = clockParts(new Date(), timeZone)
        const progress = (parts.fraction % 60) / 60
        const needleDeg = ARC_START + progress * ARC_SWEEP
        const tip = polar(needleDeg, R - 7)
        const needle = needleRef.current
        if (needle) {
          needle.setAttribute('x2', String(tip.x))
          needle.setAttribute('y2', String(tip.y))
        }
        if (timeRef.current && timeRef.current.textContent !== parts.label) {
          timeRef.current.textContent = parts.label
        }
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [timeZone])

  useEffect(() => {
    if (!city) return undefined
    const ac = new AbortController()
    fetchCityTemperature(city, ac.signal)
      .then((value) => {
        if (Number.isFinite(value)) setTemp(value)
      })
      .catch(() => {})
    return () => ac.abort()
  }, [city])

  return (
    <div className="hero-hud" aria-hidden="true">
      <svg className="hero-hud-dial" viewBox="0 0 100 100" role="presentation">
        <path className="hero-hud-track" d={arcPath()} />
        {ticks.map((tick) => (
          <line
            key={tick.i}
            className={tick.i % 3 === 0 ? 'hero-hud-tick hero-hud-tick-major' : 'hero-hud-tick'}
            x1={tick.a.x}
            y1={tick.a.y}
            x2={tick.b.x}
            y2={tick.b.y}
          />
        ))}
        <line
          ref={needleRef}
          className="hero-hud-needle"
          x1={CX}
          y1={CY}
          x2={polar(ARC_START, R - 7).x}
          y2={polar(ARC_START, R - 7).y}
        />
        <circle className="hero-hud-hub" cx={CX} cy={CY} r="1.8" />
      </svg>

      <div className="hero-hud-readout">
        <p ref={timeRef} className="hero-hud-time">
          {clockParts(new Date(), timeZone).label}
        </p>
        {Number.isFinite(temp) ? <p className="hero-hud-temp">{temp}°</p> : null}
        {cityLabel ? (
          <p className="hero-hud-live">
            <span className="hero-hud-dot" />
            {t('hero.hudLive')} · {cityLabel}
          </p>
        ) : null}
        <p className="hero-hud-meta">
          {t('hero.hudRoad')} · {t('hero.hudLocal')}
        </p>
      </div>
    </div>
  )
}

export default HeroHud
