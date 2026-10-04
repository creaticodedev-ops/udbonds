import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import SeoHead from '../seo/SeoHead'
import { localBusinessJsonLd, organizationJsonLd, websiteJsonLd } from '../seo/jsonLd'
import { useAppContext } from '../context/AppContext'
import { SITE_ORIGIN } from '../seo/constants'
import Hero from '../components/Hero'
import { buildCategoryShowcase, featuredVehicles } from '../storefrontHome/fleetShowcase'
import { usePrefersReducedMotion } from '../storefrontHome/usePrefersReducedMotion'
import '../storefrontHome/storefrontHome.css'

const HomeCategories = lazy(() => import('../storefrontHome/HomeCategories'))
const HomeFleet = lazy(() => import('../storefrontHome/HomeFleet'))
const HomeWhy = lazy(() => import('../storefrontHome/HomeWhy'))
const HomeLocations = lazy(() => import('../storefrontHome/HomeLocations'))
const HomeCta = lazy(() => import('../storefrontHome/HomeCta'))

const SectionFallback = () => (
  <div className="min-h-[10rem] w-full" aria-hidden />
)

const Home = () => {
  const { storefrontProfile, storefrontSlug, publicPath, cars } = useAppContext()
  const reduceMotion = usePrefersReducedMotion()
  const categories = useMemo(() => buildCategoryShowcase(cars), [cars])
  const vehicles = useMemo(() => featuredVehicles(cars), [cars])
  const [activeIndex, setActiveIndex] = useState(0)
  const [cyclePaused, setCyclePaused] = useState(false)

  useEffect(() => {
    if (activeIndex >= categories.length) setActiveIndex(0)
  }, [categories.length, activeIndex])

  useEffect(() => {
    if (reduceMotion || cyclePaused || categories.length < 2) return undefined
    let id = 0
    const tick = () => setActiveIndex((current) => (current + 1) % categories.length)
    const start = () => {
      window.clearInterval(id)
      id = window.setInterval(tick, 5800)
    }
    const stop = () => window.clearInterval(id)
    const onVis = () => {
      if (document.hidden) stop()
      else start()
    }
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [categories.length, reduceMotion, cyclePaused])

  useEffect(() => {
    if (!cyclePaused) return undefined
    const id = window.setTimeout(() => setCyclePaused(false), 12000)
    return () => window.clearTimeout(id)
  }, [cyclePaused, activeIndex])

  const selectCategory = (index) => {
    setActiveIndex(index)
    setCyclePaused(true)
  }

  const isTenant = Boolean(storefrontSlug || storefrontProfile?.agencyId)
  const brandName = storefrontProfile?.name || ''
  const title = storefrontProfile?.seo?.title ||
    (brandName ? `${brandName} — Car rental` : 'Car rental')
  const description = storefrontProfile?.seo?.description ||
    (brandName ? `Book a car with ${brandName}.` : 'Book a car online.')
  const path = publicPath?.('/') || (storefrontSlug ? `/s/${storefrontSlug}` : '/')
  const origin = storefrontProfile?.storefrontUrl
    ? storefrontProfile.storefrontUrl.replace(/\/s\/[^/]+\/?$/, '') || SITE_ORIGIN
    : (typeof window !== 'undefined' ? window.location.origin : SITE_ORIGIN)
  const ogImage = storefrontProfile?.seo?.ogImageUrl || storefrontProfile?.logoUrl || undefined
  const ctaImage = categories[0]?.image || vehicles[0]?.image || vehicles[0]?.images?.[0] || ''

  return (
    <div className="sf-home">
      <SeoHead
        title={title}
        description={description}
        path={path}
        image={ogImage}
        siteName={brandName || undefined}
        origin={origin}
        faviconUrl={storefrontProfile?.faviconUrl || storefrontProfile?.logoUrl || ''}
        jsonLd={
          isTenant || storefrontProfile
            ? [
                organizationJsonLd(storefrontProfile),
                websiteJsonLd(storefrontProfile),
                localBusinessJsonLd(storefrontProfile),
              ]
            : [
                organizationJsonLd(null),
                websiteJsonLd(null),
                localBusinessJsonLd(null),
              ]
        }
      />
      <Hero />
      <Suspense fallback={<SectionFallback />}>
        <HomeCategories
          categories={categories}
          activeIndex={activeIndex}
          onSelectCategory={selectCategory}
        />
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <HomeFleet vehicles={vehicles} />
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <HomeWhy />
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <HomeLocations />
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <HomeCta image={ctaImage} />
      </Suspense>
    </div>
  )
}

export default Home
