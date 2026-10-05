import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from './i18n/I18nProvider'
import { LandingPage } from './landing/LandingPage'

// Single-page site: every unknown path resolves to the landing page.
if (window.location.pathname !== '/') {
  window.history.replaceState(null, '', `/${window.location.hash}`)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <LandingPage />
    </I18nProvider>
  </StrictMode>,
)
