import { useI18n } from '../../i18n/I18nProvider'
import { SectionIntro } from '../ui'
import { ServiceGlyph } from '../visuals/ServiceGlyph'

const GLYPHS = ['gold', 'invest', 'education', 'analysis']

export const Services = () => {
  const { t, tm } = useI18n()
  const items = tm('services.items') || []

  return (
    <section className="section services" id="services" aria-labelledby="services-title">
      <div className="container">
        <SectionIntro
          kicker={t('services.kicker')}
          title={t('services.title')}
          lead={t('services.lead')}
          titleId="services-title"
        />
        <ol className="services-list">
          {items.map((item, index) => (
            <li key={index} className="service" data-reveal style={{ '--d': index }}>
              <span className="service-index">{String(index + 1).padStart(2, '0')}</span>
              <ServiceGlyph name={GLYPHS[index]} />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default Services
