import SeoHead from '../../seo/SeoHead'
import MarketingLayout from '../../marketing/MarketingLayout'
import { PageHero } from '../../marketing/PageHero'
import { BRAND, CLIENTS } from '../../marketing/config'
import { DemoCta, PrimaryCta } from '../../marketing/Ctas'
import { useMktI18n } from '../../marketing/i18n/MarketingI18n'

export const AboutPage = () => (
  <MarketingLayout>
    <AboutInner />
  </MarketingLayout>
)

const AboutInner = () => {
  const { t, htmlLang, ogLocale, dir } = useMktI18n()
  const clients = CLIENTS.map((client) => client.name).join(t('proof.and'))

  return (
    <>
      <SeoHead
        title={t('seo.aboutTitle')}
        description={t('seo.aboutDescription')}
        path="/about"
        lang={htmlLang}
        dir={dir}
        locale={ogLocale}
        siteName={BRAND}
      />
      <PageHero kicker={t('about.kicker')} title={t('about.title')} />
      <section className="mkt-page-body">
        <div className="mkt-wrap mkt-page-prose">
          <p className="mkt-lead">{t('about.p1')}</p>
          <p className="mkt-lead">{t('about.p2', { clients })}</p>
          <div className="mkt-actions">
            <PrimaryCta>{t('cta.trial')}</PrimaryCta>
            <DemoCta />
          </div>
        </div>
      </section>
    </>
  )
}

export default AboutPage
