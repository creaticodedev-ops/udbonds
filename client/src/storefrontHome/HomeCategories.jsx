import React from 'react'
import { useI18n } from '../i18n/I18nContext'
import { useAppContext } from '../context/AppContext'

const HomeCategories = ({
  categories,
  activeIndex,
  onSelectCategory,
}) => {
  const { t } = useI18n()
  const { currency } = useAppContext()
  if (!categories.length) return null

  return (
    <section className="sf-section sf-cats" aria-labelledby="sf-cats-title">
      <div className="page-pad page-shell">
        <div className="sf-cats-head">
          <div>
            <p className="sf-eyebrow">{t('home.categoriesEyebrow')}</p>
            <h2 id="sf-cats-title">{t('home.categoriesTitle')}</h2>
          </div>
        </div>

        <div className="sf-cat-rail" role="tablist" aria-label={t('home.categoriesTitle')}>
          {categories.map((item, index) => (
            <button
              key={item.category}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-current={index === activeIndex ? 'true' : undefined}
              className="sf-cat booking-tap"
              onClick={() => onSelectCategory(index)}
            >
              <img
                src={item.image}
                alt=""
                width={320}
                height={180}
                loading="lazy"
                decoding="async"
              />
              <div className="sf-cat-body">
                <p className="sf-cat-name">{item.category}</p>
                <p className="sf-cat-meta">
                  {t('hero.fromPerDay', { price: `${currency}${item.from}` })}
                  {item.count > 1 ? ` · ${item.count}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>

        <div className="sf-progress" aria-hidden="true">
          {categories.map((item, index) => (
            <span key={item.category} data-on={index === activeIndex ? 'true' : 'false'} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default HomeCategories
