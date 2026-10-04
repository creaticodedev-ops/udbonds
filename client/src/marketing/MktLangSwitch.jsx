import { useEffect, useRef, useState } from 'react'
import { useMktI18n } from './i18n/MarketingI18n'
import { MKT_LOCALES } from './i18n/locales'

export const MktLangSwitch = ({ className = '', compact = false }) => {
  const { locale, setLocale, t } = useMktI18n()
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const current = MKT_LOCALES.find((item) => item.code === locale) || MKT_LOCALES[0]

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`mkt-lang${compact ? ' is-compact' : ''} ${className}`.trim()} ref={root}>
      <button
        type="button"
        className="mkt-lang-btn"
        aria-label={t('nav.language')}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2 8h12M8 2c2.2 1.8 3.2 3.8 3.2 6S10.2 12.2 8 14C5.8 12.2 4.8 10.2 4.8 8S5.8 3.8 8 2z" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <span>{compact ? current.short : current.native}</span>
      </button>
      {open ? (
        <ul className="mkt-lang-menu" role="listbox" aria-label={t('nav.language')}>
          {MKT_LOCALES.map((item) => (
            <li key={item.code}>
              <button
                type="button"
                role="option"
                aria-selected={item.code === locale}
                className={item.code === locale ? 'is-on' : ''}
                onClick={() => {
                  setLocale(item.code)
                  setOpen(false)
                }}
              >
                <b>{item.short}</b>
                {item.native}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default MktLangSwitch
