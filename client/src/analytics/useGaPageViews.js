import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { bindOutboundContactTracking, initGa4, trackPageView } from './ga4'

/**
 * SPA page views + outbound tel/mailto/WhatsApp click capture.
 * Mount once inside BrowserRouter (via GaRouteTracker or a layout).
 */
export default function useGaPageViews() {
  const location = useLocation()

  useEffect(() => {
    initGa4()
    return bindOutboundContactTracking()
  }, [])

  useEffect(() => {
    trackPageView(location.pathname, location.search)
  }, [location.pathname, location.search])
}
