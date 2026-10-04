import React, { lazy, Suspense, useEffect } from 'react'
import Navbar from './components/Navbar'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import MarketingHome from './marketing/MarketingHome'
import { isMarketingSurface } from './utils/marketingSurface'
import ErrorBoundary from './components/ErrorBoundary'
import RequirePermission from './components/owner/RequirePermission'
import { Toaster } from 'react-hot-toast'
import { useAppContext } from './context/AppContext'
import Loader from './components/Loader'
import GaRouteTracker from './analytics/GaRouteTracker'

const Cars = lazy(() => import('./pages/Cars'))
const CarDetails = lazy(() => import('./pages/CarDetails'))
const BookingConfirmation = lazy(() => import('./pages/BookingConfirmation'))
const CompleteBooking = lazy(() => import('./pages/CompleteBooking'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Footer = lazy(() => import('./components/Footer'))
const Login = lazy(() => import('./components/Login'))

const Layout = lazy(() => import('./pages/owner/Layout'))
const Dashboard = lazy(() => import('./pages/owner/Dashboard'))
const Analytics = lazy(() => import('./pages/owner/Analytics'))
const AddCar = lazy(() => import('./pages/owner/AddCar'))
const EditCar = lazy(() => import('./pages/owner/EditCar'))
const ManageCars = lazy(() => import('./pages/owner/ManageCars'))
const CatalogOrder = lazy(() => import('./pages/owner/CatalogOrder'))
const VehicleStatsPage = lazy(() => import('./pages/owner/VehicleStatsPage'))
const VehicleStatsListPage = lazy(() => import('./pages/owner/VehicleStatsListPage'))
const ManageBookings = lazy(() => import('./pages/owner/ManageBookings'))
const WalkInBooking = lazy(() => import('./pages/owner/WalkInBooking'))
const Customers = lazy(() => import('./pages/owner/Customers'))
const BookingCalendar = lazy(() => import('./pages/owner/BookingCalendar'))
const ManageLocations = lazy(() => import('./pages/owner/ManageLocations'))
const Maintenance = lazy(() => import('./pages/owner/Maintenance'))
const Reports = lazy(() => import('./pages/owner/Reports'))
const AuditLogs = lazy(() => import('./pages/owner/AuditLogs'))
const Contracts = lazy(() => import('./pages/owner/Contracts'))
const Invoices = lazy(() => import('./pages/owner/Invoices'))
const ExportTemplates = lazy(() => import('./pages/owner/ExportTemplates'))
const Settings = lazy(() => import('./pages/owner/Settings'))

const SuperAdminLogin = lazy(() => import('./pages/superadmin/Login'))
const SuperAdminLayout = lazy(() => import('./pages/superadmin/Layout'))
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/Dashboard'))
const SuperAdminAdmins = lazy(() => import('./pages/superadmin/Admins'))
const SuperAdminAdminDetail = lazy(() => import('./pages/superadmin/AdminDetail'))
const SuperAdminAgencyRequests = lazy(() => import('./pages/superadmin/AgencyRequests'))
const SuperAdminAgencies = lazy(() => import('./pages/superadmin/Agencies'))
const SuperAdminBilling = lazy(() => import('./pages/superadmin/Billing'))
const SuperAdminAgencyDetail = lazy(() => import('./pages/superadmin/AgencyDetail'))
const SuperAdminPermissions = lazy(() => import('./pages/superadmin/Permissions'))
const SuperAdminActivity = lazy(() => import('./pages/superadmin/Activity'))
const SuperAdminNotifications = lazy(() => import('./pages/superadmin/Notifications'))
const SuperAdminHealth = lazy(() => import('./pages/superadmin/Health'))
const SuperAdminSettings = lazy(() => import('./pages/superadmin/Settings'))
const ActivateAccount = lazy(() => import('./pages/ActivateAccount'))
const ActivateStaff = lazy(() => import('./pages/ActivateStaff'))
const AgencySetup = lazy(() => import('./pages/AgencySetup'))
const StorefrontShell = lazy(() => import('./components/StorefrontShell'))
const ContactPage = lazy(() => import('./pages/marketing/ContactPage'))
const SignupPage = lazy(() => import('./pages/marketing/SignupPage'))
const AboutPage = lazy(() => import('./pages/marketing/AboutPage'))
const PrivacyPage = lazy(() => import('./pages/marketing/LegalPages'))
const TermsPage = lazy(() => import('./pages/marketing/LegalPages').then((m) => ({ default: m.TermsPage })))

const MoroccoPillarPage = lazy(() => import('./pages/seo/MoroccoPillarPage'))
const CityPage = lazy(() => import('./pages/seo/CityPage'))
const AirportPage = lazy(() => import('./pages/seo/AirportPage'))
const CarsSlugPage = lazy(() => import('./pages/seo/CarsSlugPage'))
const GuideHubPage = lazy(() => import('./pages/seo/GuideHubPage'))
const GuideArticlePage = lazy(() => import('./pages/seo/GuideArticlePage'))

const withPerm = (permission, Component) => (
  <RequirePermission permission={permission}>{React.createElement(Component)}</RequirePermission>
)

const PublicHome = () => {
  const { hostTenant } = useAppContext()
  if (hostTenant.atRoot) return <Home />
  return <MarketingHome />
}

const RouteFallback = () => <Loader />

const App = () => {
  const { showLogin, hostTenant } = useAppContext()
  const { pathname } = useLocation()
  const isOwnerPath = pathname.startsWith('/owner')
  const isSuperAdminPath = pathname.startsWith('/superadmin')
  const isOnboardingPath =
    pathname.startsWith('/activate-account') ||
    pathname.startsWith('/activate-staff') ||
    pathname.startsWith('/agency-setup')
  const hidePublicChrome = isOwnerPath || isSuperAdminPath || isOnboardingPath
  const marketing = isMarketingSurface(pathname, hostTenant)
  const isStorefrontHome =
    !marketing && (pathname === '/' || /^\/s\/[a-z0-9-]+\/?$/i.test(pathname))
  const needsNavOffset = !hidePublicChrome && !marketing && !isStorefrontHome

  // Remove build-time SEO body after hydration (crawlers still see it in raw HTML).
  useEffect(() => {
    document.getElementById('seo-prerender')?.remove()
  }, [])

  return (
    <ErrorBoundary>
      <GaRouteTracker />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <Toaster
        position="top-center"
        containerStyle={{
          top: 'max(4.5rem, calc(env(safe-area-inset-top) + 3.75rem))',
          left: 16,
          right: 16,
        }}
        toastOptions={{
          className: 'text-sm max-w-[min(100%,24rem)]',
          style: { wordBreak: 'break-word' },
        }}
      />
      {showLogin && !isSuperAdminPath && !isOnboardingPath && (
        <Suspense fallback={null}>
          <Login />
        </Suspense>
      )}

      {!hidePublicChrome && !marketing && <Navbar />}

      <div
        id="main-content"
        tabIndex={-1}
        className={needsNavOffset ? 'pt-[calc(4.05rem+env(safe-area-inset-top))] sm:pt-[calc(4.55rem+env(safe-area-inset-top))]' : ''}
      >
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<PublicHome />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/location-voiture-maroc" element={<MoroccoPillarPage />} />
            <Route path="/location-voiture/:city" element={<CityPage />} />
            <Route path="/location-voiture-aeroport/:airport" element={<AirportPage />} />
            <Route path="/guide" element={<GuideHubPage />} />
            <Route path="/guide/:slug" element={<GuideArticlePage />} />
            <Route path="/car-details/:id" element={<CarDetails />} />
            <Route path="/cars" element={<Cars />} />
            <Route path="/cars/:slug" element={<CarsSlugPage />} />
            <Route path="/booking-confirmation" element={<BookingConfirmation />} />
            <Route path="/complete-booking/:token" element={<CompleteBooking />} />
            <Route path="/activate-account/:token" element={<ActivateAccount />} />
            <Route path="/activate-staff/:token" element={<ActivateStaff />} />
            <Route path="/agency-setup" element={<AgencySetup />} />
            {/* Per-agency public storefront (slug resolver — no custom domains) */}
            <Route path="/s/:agencySlug" element={<StorefrontShell />}>
              <Route index element={<Home />} />
              <Route path="cars" element={<Cars />} />
              <Route path="cars/:slug" element={<CarsSlugPage />} />
              <Route path="car-details/:id" element={<CarDetails />} />
              <Route path="booking-confirmation" element={<BookingConfirmation />} />
            </Route>
            <Route path="/admin" element={<Navigate to="/owner" replace />} />
            <Route path="/owner" element={<Layout />}>
              <Route index element={withPerm('dashboard', Dashboard)} />
              <Route path="analytics" element={withPerm('analytics', Analytics)} />
              <Route path="add-car" element={withPerm('fleet', AddCar)} />
              <Route path="edit-car/:id" element={withPerm('fleet', EditCar)} />
              <Route path="manage-cars" element={withPerm('fleet', ManageCars)} />
              <Route path="catalog-order" element={withPerm('fleet', CatalogOrder)} />
              <Route path="vehicle-stats" element={withPerm('fleet', VehicleStatsListPage)} />
              <Route path="vehicle-stats/:id" element={withPerm('fleet', VehicleStatsPage)} />
              <Route path="manage-bookings" element={withPerm('bookings', ManageBookings)} />
              <Route path="walk-in" element={withPerm('bookings', WalkInBooking)} />
              <Route path="customers" element={withPerm('customers', Customers)} />
              <Route path="locations" element={withPerm('locations', ManageLocations)} />
              <Route path="calendar" element={withPerm('calendar', BookingCalendar)} />
              <Route path="maintenance" element={withPerm('maintenance', Maintenance)} />
              <Route path="reports" element={withPerm('reports', Reports)} />
              <Route path="contracts" element={withPerm('contracts', Contracts)} />
              <Route path="invoices" element={withPerm('contracts', Invoices)} />
              <Route path="templates" element={withPerm('templates', ExportTemplates)} />
              <Route path="audit" element={withPerm('audit', AuditLogs)} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="/superadmin/login" element={<SuperAdminLogin />} />
            <Route path="/superadmin" element={<SuperAdminLayout />}>
              <Route index element={<SuperAdminDashboard />} />
              <Route path="requests" element={<SuperAdminAgencyRequests />} />
              <Route path="agencies" element={<SuperAdminAgencies />} />
              <Route path="agencies/:id" element={<SuperAdminAgencyDetail />} />
              <Route path="billing" element={<SuperAdminBilling />} />
              <Route path="admins" element={<SuperAdminAdmins />} />
              <Route path="admins/:id" element={<SuperAdminAdminDetail />} />
              <Route path="notifications" element={<SuperAdminNotifications />} />
              <Route path="permissions" element={<SuperAdminPermissions />} />
              <Route path="activity" element={<SuperAdminActivity />} />
              <Route path="audit" element={<SuperAdminActivity />} />
              <Route path="health" element={<SuperAdminHealth />} />
              <Route path="settings" element={<SuperAdminSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>

      {!hidePublicChrome && !marketing && (
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      )}
    </ErrorBoundary>
  )
}

export default App
