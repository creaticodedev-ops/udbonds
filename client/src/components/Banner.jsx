import React from 'react'
import { assets } from '../assets/assets'
import { motion as Motion } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'

const Banner = () => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { publicPath } = useAppContext()

  return (
    <section className="page-pad page-shell py-8 md:py-12">
      <Motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-2xl bg-ink min-h-[280px] md:min-h-[320px] flex flex-col md:flex-row items-stretch"
      >
        <div className="absolute inset-0">
          <img
            src={assets.banner_car_image}
            alt=""
            width={1600}
            height={900}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-center opacity-40 md:opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/40" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgba(165, 22, 36,0.35),transparent_55%)]" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-6 py-12 sm:px-8 md:px-14 md:py-16 max-w-xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/50 mb-3 font-medium">
            {t('banner.eyebrow')}
          </p>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-white font-medium leading-tight">
            {t('banner.title')}
          </h2>
          <p className="mt-4 text-white/65 text-sm md:text-base leading-relaxed font-light max-w-md">
            {t('banner.line1')}
          </p>
          <Motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => navigate(publicPath?.('/cars') || '/cars')}
            className="booking-tap mt-7 inline-flex h-12 items-center self-start rounded-2xl bg-primary px-6 text-[15px] font-semibold tracking-wide text-white transition-colors hover:bg-primary-dull cursor-pointer"
          >
            {t('banner.cta')}
          </Motion.button>
        </div>
      </Motion.div>
    </section>
  )
}

export default Banner
