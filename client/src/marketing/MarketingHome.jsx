import SeoHead from '../seo/SeoHead'
import { SITE_ORIGIN } from '../seo/constants'
import { organizationJsonLd, websiteJsonLd } from '../seo/jsonLd'
import { BRAND } from './config'
import MarketingLayout from './MarketingLayout'
import { SaasHero } from './home/SaasHero'
import { SaasTrust } from './home/SaasTrust'
import { SaasProblem } from './home/SaasProblem'
import { SaasFeatures } from './home/SaasFeatures'
import { SaasShowcase } from './home/SaasShowcase'
import { SaasOutcomes } from './home/SaasOutcomes'
import { SaasSteps } from './home/SaasSteps'
import { SaasPricing } from './home/SaasPricing'
import { SaasFaq } from './home/SaasFaq'
import { SaasFinalCta } from './home/SaasFinalCta'
import { useMktI18n } from './i18n/MarketingI18n'
import './saasHome.css'

export const MarketingHome = () => (
  <MarketingLayout>
    <HomeInner />
  </MarketingLayout>
)

const HomeInner = () => {
  const { t, htmlLang, ogLocale, dir } = useMktI18n()
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: BRAND,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: t('seo.homeDescription'),
    url: SITE_ORIGIN,
    inLanguage: htmlLang,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'MAD',
      lowPrice: '0',
      highPrice: '599',
      offerCount: 3,
    },
  }

  return (
    <>
      <SeoHead
        title={t('seo.homeTitle')}
        description={t('seo.homeDescription')}
        path="/"
        lang={htmlLang}
        dir={dir}
        locale={ogLocale}
        siteName={BRAND}
        jsonLd={[organizationJsonLd(null), { ...websiteJsonLd(null), inLanguage: htmlLang }, softwareJsonLd]}
      />
      <SaasHero />
      <SaasTrust />
      <SaasProblem />
      <SaasFeatures />
      <SaasShowcase />
      <SaasOutcomes />
      <SaasSteps />
      <SaasPricing />
      <SaasFaq />
      <SaasFinalCta />
    </>
  )
}

export default MarketingHome
