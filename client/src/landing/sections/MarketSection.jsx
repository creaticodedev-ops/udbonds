import { useI18n } from '../../i18n/I18nProvider'
import { getLocaleMeta } from '../../i18n/locales'
import { GoldElement } from '../visuals/GoldElement'

export const MarketSection = () => {
  const { t, tm, locale } = useI18n()
  const drivers = tm('markets.drivers') || []
  const mass = new Intl.NumberFormat(getLocaleMeta(locale).htmlLang, { minimumFractionDigits: 3 }).format(196.967)

  return (
    <section className="section markets" id="markets" aria-labelledby="markets-title">
      <div className="container markets-grid">
        <div className="markets-art" data-reveal>
          <GoldElement
            name={t('markets.element.name')}
            numberLabel={t('markets.element.number')}
            massLabel={t('markets.element.mass')}
            mass={mass}
            label={t('markets.element.label')}
          />
        </div>
        <div className="markets-copy">
          <header className="section-intro" data-reveal>
            <p className="kicker">{t('markets.kicker')}</p>
            <h2 className="h2" id="markets-title">
              {t('markets.title')}
            </h2>
            <p className="lead">{t('markets.lead')}</p>
          </header>
          <ul className="drivers">
            {drivers.map((item, index) => (
              <li key={index} data-reveal style={{ '--d': index }}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
          <p className="fine-print">{t('markets.note')}</p>
        </div>
      </div>
    </section>
  )
}

export default MarketSection
