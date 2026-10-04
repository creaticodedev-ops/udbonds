import React, { useEffect } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import NoIndexHead from '../seo/NoIndexHead'
import Loader from './Loader'

/**
 * Nested public routes under /s/:agencySlug.
 * AppContext reads the slug from the URL and scopes all public API calls.
 */
const StorefrontShell = () => {
  const { agencySlug } = useParams()
  const { storefrontSlug, storefrontProfile, storefrontError, storefrontReady } = useAppContext()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [agencySlug])

  if (!agencySlug) {
    return <Navigate to="/" replace />
  }

  if (!storefrontReady && storefrontSlug === agencySlug) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <NoIndexHead />
        <Loader />
      </div>
    )
  }

  if (storefrontError && storefrontSlug === agencySlug) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <NoIndexHead />
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold text-ink">Storefront not found</h1>
          <p className="text-sm text-muted">
            {storefrontError}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <NoIndexHead />
      {storefrontProfile?.name ? (
        <span className="sr-only">{storefrontProfile.name} storefront</span>
      ) : null}
      <Outlet />
    </>
  )
}

export default StorefrontShell
