import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import { buildWaMeUrl } from '../utils/whatsapp'

const HomeCta = ({ image }) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { publicPath, storefrontProfile } = useAppContext()
  const brand = storefrontProfile?.name || ''
  const dial = String(storefrontProfile?.whatsapp || storefrontProfile?.phone || '').replace(/\D/g, '')
  const whatsappUrl = dial
    ? buildWaMeUrl(t('whyChoose.whatsappMessage', { brand: brand || 'car rental' }), dial)
    : ''

  return (
    <section className="sf-cta">
      {image ? (
        <img src={image} alt="" width={1600} height={900} loading="lazy" decoding="async" />
      ) : null}
      <div className="page-pad page-shell sf-cta-inner">
        <p className="sf-eyebrow">{brand || t('banner.eyebrow')}</p>
        <h2>{t('home.ctaTitle')}</h2>
        <p className="mt-4 max-w-md text-sm font-light leading-relaxed text-white/65">
          {t('home.ctaBody')}
        </p>
        <div className="sf-actions">
          <button
            type="button"
            className="sf-btn sf-btn-primary"
            onClick={() => {
              navigate(publicPath?.('/cars') || '/cars')
              window.scrollTo(0, 0)
            }}
          >
            {t('banner.cta')}
          </button>
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sf-btn sf-btn-ghost"
              data-analytics-source="home_cta"
            >
              {t('hero.whatsappCta')}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default HomeCta
