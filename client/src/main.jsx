import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {BrowserRouter} from 'react-router-dom'
import {AppProvider} from './context/AppContext.jsx'
import { SuperAdminProvider } from './context/SuperAdminContext.jsx'
import {MotionConfig} from 'motion/react'
import { I18nProvider } from './i18n/I18nContext.jsx'
import { HelmetProvider } from 'react-helmet-async'

createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <BrowserRouter>
      <I18nProvider>
        <AppProvider>
          <SuperAdminProvider>
            <MotionConfig viewport={{once: true}}>
              <App />
            </MotionConfig>
          </SuperAdminProvider>
        </AppProvider>
      </I18nProvider>
    </BrowserRouter>
  </HelmetProvider>,
)
