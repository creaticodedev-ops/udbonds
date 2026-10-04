import React, { useState } from 'react'
import { useI18n } from '../i18n/I18nContext'

const LanguageSwitcher = ({ className = '', variant = 'default' }) => {
  const { language, setLanguage, t, languages } = useI18n()
  const [open, setOpen] = useState(false)

  const isLight = variant === 'light'
  const isBare = variant === 'bare'
  const btnClass = isBare
    ? 'border-transparent text-ink/80 hover:text-ink min-h-11 min-w-11 justify-center px-1.5'
    : isLight
      ? 'border-white/25 text-white/90 hover:bg-white/10'
      : 'border-borderColor text-ink hover:bg-sand/80'

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-lg border text-sm transition-colors cursor-pointer ${
          isBare ? btnClass : `gap-1.5 px-2.5 py-1.5 ${btnClass}`
        }`}
        aria-label={t('nav.language')}
      >
        <span className="font-medium tracking-wide">{language.toUpperCase()}</span>
        {!isBare && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 min-w-40 rounded-xl border border-borderColor bg-white py-1 shadow-[0_16px_40px_-20px_rgba(22,18,16,0.35)]">
            {languages.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setLanguage(code)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-sand/70 cursor-pointer ${
                  language === code ? 'text-primary font-medium' : 'text-muted'
                }`}
              >
                <span className="w-6 text-[11px] font-semibold tracking-wide">{code.toUpperCase()}</span>
                <span>{t(`languages.${code}`)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default LanguageSwitcher
