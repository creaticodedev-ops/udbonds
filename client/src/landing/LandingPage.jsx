import { useI18n } from '../i18n/I18nProvider'
import { useReveal } from './hooks'
import { Footer } from './layout/Footer'
import { Navbar } from './layout/Navbar'
import { Approach } from './sections/Approach'
import { CapitalSection } from './sections/CapitalSection'
import { FinalCTA } from './sections/FinalCTA'
import { Hero } from './sections/Hero'
import { HowItWorks } from './sections/HowItWorks'
import { InsightsPreview } from './sections/InsightsPreview'
import { Intro } from './sections/Intro'
import { MarketSection } from './sections/MarketSection'
import { OffersPreview } from './sections/OffersPreview'
import { Services } from './sections/Services'
import { WhyUDBonds } from './sections/WhyUDBonds'
import './landing.css'

export const LandingPage = () => {
  const { locale } = useI18n()
  useReveal(locale)

  return (
    <>
      <Navbar />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Intro />
        <Services />
        <OffersPreview />
        <CapitalSection />
        <MarketSection />
        <WhyUDBonds />
        <InsightsPreview />
        <HowItWorks />
        <Approach />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}

export default LandingPage
