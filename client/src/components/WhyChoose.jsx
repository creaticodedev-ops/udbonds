import React from 'react'
import { motion as Motion } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext'
import { useAppContext } from '../context/AppContext'
import { buildWaMeUrl } from '../utils/whatsapp'

const iconClass = 'h-5 w-5'

const FleetIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 15.5h17M5 15.5l1.2-5.2A2 2 0 018.15 8.5h7.7a2 2 0 011.95 1.8l1.2 5.2" />
    <circle cx="7.5" cy="16.75" r="1.35" />
    <circle cx="16.5" cy="16.75" r="1.35" />
    <path strokeLinecap="round" d="M8.5 8.5l1-2.5h5l1 2.5" />
  </svg>
)

const BoltIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 3L5.5 13.5H12l-1 7.5L19.5 10H13L13 3z" />
  </svg>
)

const PinIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0012 4.3a6.5 6.5 0 00-6.5 6.5C5.5 15.8 12 21 12 21z" />
    <circle cx="12" cy="10.8" r="2.1" />
  </svg>
)

const ChatIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 18.5l-1.2 3.2 3.5-1.1A8.8 8.8 0 0020.5 12 8.5 8.5 0 0012 3.5 8.5 8.5 0 003.5 12c0 2.4.95 4.55 2.5 6.15" />
  </svg>
)

const ICONS = [FleetIcon, BoltIcon, PinIcon, ChatIcon]

const WhyChoose = () => {
  const { t, getArray } = useI18n()
  const { storefrontProfile } = useAppContext()
  const benefits = getArray('whyChoose.benefits')
  const brand = storefrontProfile?.name || ''
  const dial = String(storefrontProfile?.whatsapp || storefrontProfile?.phone || '').replace(/\D/g, '')
  const whatsappUrl = dial
    ? buildWaMeUrl(
        t('whyChoose.whatsappMessage', { brand: brand || 'car rental' }),
        dial,
      )
    : ''

  return (
    <section className="page-pad page-shell bg-sand/30 py-16 sm:py-20 md:py-24 pb-20 sm:pb-28 md:pb-32">
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="mx-auto max-w-3xl text-center"
      >
        <h2 className="font-display text-3xl sm:text-4xl md:text-[2.75rem] font-medium leading-tight text-ink">
          {t('whyChoose.title')}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm md:text-base font-light leading-relaxed text-muted">
          {t('whyChoose.subtitle')}
        </p>
      </Motion.div>

      <div className="mx-auto mt-12 md:mt-14 grid max-w-5xl grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map((item, index) => {
          const Icon = ICONS[index % ICONS.length]
          return (
            <Motion.div
              key={item.title || index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: index * 0.07, ease: 'easeOut' }}
              className="text-center sm:text-left"
            >
              <div className="mx-auto sm:mx-0 mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-borderColor/80 bg-white text-primary shadow-[0_1px_2px_rgba(22,18,16,0.04)]">
                <Icon />
              </div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink leading-snug">
                {item.title}
              </h3>
              {item.description ? (
                <p className="mt-1.5 text-sm font-light leading-relaxed text-muted">
                  {item.description}
                </p>
              ) : null}
            </Motion.div>
          )
        })}
      </div>

      {whatsappUrl ? (
      <Motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-12 md:mt-14 flex justify-center"
      >
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-analytics-source="why_choose"
          className="group inline-flex items-center gap-2 text-[15px] font-medium text-ink transition-colors hover:text-primary"
        >
          <span>{t('whyChoose.cta')}</span>
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
          >
            →
          </span>
        </a>
      </Motion.div>
      ) : null}
    </section>
  )
}

export default WhyChoose
