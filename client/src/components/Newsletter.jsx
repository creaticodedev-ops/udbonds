import React from 'react'
import { motion as Motion } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext'
import toast from 'react-hot-toast'

const Newsletter = () => {
  const { t } = useI18n()

  const handleSubmit = (e) => {
    e.preventDefault()
    toast.success(t('newsletter.thanks'))
    e.target.reset()
  }

  return (
    <section className="page-pad page-shell pb-20 sm:pb-28 md:pb-36">
      <Motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl mx-auto text-center"
      >
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-medium mb-3">
          {t('newsletter.eyebrow')}
        </p>
        <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-medium text-ink">
          {t('newsletter.title')}
        </h2>
        <p className="mt-3 text-muted text-sm md:text-base font-light leading-relaxed">
          {t('newsletter.subtitle')}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 flex flex-col sm:flex-row gap-2 sm:gap-0 sm:rounded-xl sm:overflow-hidden sm:border sm:border-borderColor sm:bg-white"
        >
          <input
            className="h-12 sm:h-14 flex-1 min-w-0 px-4 outline-none text-ink text-sm rounded-xl sm:rounded-none border border-borderColor sm:border-0 focus:border-primary sm:focus:ring-0 transition"
            type="email"
            placeholder={t('newsletter.placeholder')}
            required
          />
          <button
            type="submit"
            className="h-12 sm:h-14 px-8 bg-primary hover:bg-primary-dull transition-colors text-white text-sm font-medium rounded-xl sm:rounded-none cursor-pointer shrink-0"
          >
            {t('newsletter.subscribe')}
          </button>
        </form>
      </Motion.div>
    </section>
  )
}

export default Newsletter
