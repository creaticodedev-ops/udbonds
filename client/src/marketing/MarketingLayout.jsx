import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { MarketingNav } from './MarketingNav'
import { MarketingFooter } from './MarketingFooter'
import { MarketingI18nProvider, useMktI18n } from './i18n/MarketingI18n'
import './marketing.css'
import './experience.css'

const Shell = ({ children, footer, nav }) => {
  const { hash, pathname } = useLocation()
  const { dir } = useMktI18n()

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }
    const id = hash.replace('#', '')
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, pathname])

  return (
    <div className={`mkt${nav ? '' : ' is-onboard'}`} dir={dir}>
      {nav ? <MarketingNav /> : null}
      {children}
      {footer ? <MarketingFooter /> : null}
    </div>
  )
}

export const MarketingLayout = ({ children, footer = true, nav = true }) => (
  <MarketingI18nProvider>
    <Shell footer={footer} nav={nav}>
      {children}
    </Shell>
  </MarketingI18nProvider>
)

export default MarketingLayout
