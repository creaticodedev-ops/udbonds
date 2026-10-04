import useGaPageViews from './useGaPageViews'

/**
 * SPA page-view tracker + outbound tel/mailto/WhatsApp click capture.
 * Mount once inside BrowserRouter (e.g. App).
 */
const GaRouteTracker = () => {
  useGaPageViews()
  return null
}

export default GaRouteTracker
