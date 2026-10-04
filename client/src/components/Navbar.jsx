import React, { useEffect, useState } from 'react'
import { assets, menuLinks } from '../assets/assets'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { motion as Motion } from 'framer-motion'
import LanguageSwitcher from './LanguageSwitcher'
import { useI18n } from '../i18n/I18nContext'
import { PLATFORM_NAME } from '../constants/brand'

/** Thin monochrome Instagram glyph */
const InstagramGlyph = ({ className = 'h-[21px] w-[21px]' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect
      x="3.25"
      y="3.25"
      width="17.5"
      height="17.5"
      rx="5"
      stroke="currentColor"
      strokeWidth="1.35"
    />
    <circle cx="12" cy="12" r="4.15" stroke="currentColor" strokeWidth="1.35" />
    <circle cx="17.15" cy="6.85" r="0.95" fill="currentColor" />
  </svg>
)

const Navbar = () => {
  const { logout, isOwner, publicPath, storefrontProfile, storefrontSlug } = useAppContext()
  const { t } = useI18n()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()
  const isHome =
    location.pathname === '/' || /^\/s\/[a-z0-9-]+\/?$/i.test(location.pathname)
  const isTenant = Boolean(storefrontSlug || storefrontProfile?.agencyId)
  const brandLabel = storefrontProfile?.name || (isTenant ? '' : PLATFORM_NAME)
  const brandLogo = storefrontProfile?.logoUrl || (isTenant ? '' : assets.logo)
  const instagramUrl = storefrontProfile?.socials?.instagram || ''
  const homePath = publicPath?.('/') || '/'
  const carsPath = publicPath?.('/cars') || '/cars'

  const navLabels = {
    Home: t('nav.home'),
    Cars: t('nav.cars'),
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 640) setOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!open) return
    document.body.classList.add('nav-open')
    return () => document.body.classList.remove('nav-open')
  }, [open])

  const solid = !isHome || scrolled || open

  return (
    <Motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 inset-x-0 z-40 border-b transition-all duration-300 pt-[env(safe-area-inset-top)] ${
        solid
          ? 'bg-white/95 backdrop-blur-md border-borderColor text-ink'
          : 'bg-transparent border-transparent text-ink'
      }`}
    >
      {/* —— Mobile: [Menu][IG] · logo centered · [Search][FR] —— */}
      <div className="page-pad page-shell relative flex items-center justify-between sm:hidden min-h-14 py-1.5">
        <div className="relative z-10 flex items-center -ml-1.5">
          <button
            type="button"
            className="booking-tap flex h-11 w-11 shrink-0 items-center justify-center text-ink/80 transition-opacity active:opacity-55 cursor-pointer"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <img
              src={open ? assets.close_icon : assets.menu_icon}
              alt=""
              className="block h-5 w-5 object-contain"
            />
          </button>

          {instagramUrl ? (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="booking-tap flex h-11 w-11 shrink-0 items-center justify-center text-ink/70 transition-opacity hover:text-ink hover:opacity-100 active:opacity-55"
            aria-label={`${brandLabel || 'Agency'} Instagram`}
          >
            <InstagramGlyph />
          </a>
          ) : null}
        </div>

        <Link
          to={homePath}
          className="pointer-events-auto absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 flex items-center"
          aria-label={brandLabel || 'Home'}
        >
          {brandLogo ? (
            <img
              src={brandLogo}
              alt={brandLabel || 'Logo'}
              width={140}
              height={36}
              decoding="async"
              className="block h-8 w-auto max-h-8 object-contain"
            />
          ) : (
            <span className="text-sm font-semibold text-ink whitespace-nowrap">{brandLabel || 'Home'}</span>
          )}
        </Link>

        <div className="relative z-10 flex items-center -mr-1.5">
          <button
            type="button"
            onClick={() => navigate(carsPath)}
            className="booking-tap flex h-11 w-11 shrink-0 items-center justify-center text-ink/70 transition-opacity hover:text-ink active:opacity-55 cursor-pointer"
            aria-label={t('nav.cars')}
          >
            <img src={assets.search_icon} alt="" className="block h-[18px] w-[18px] object-contain opacity-80" />
          </button>
          <LanguageSwitcher variant="bare" className="shrink-0" />
        </div>
      </div>

      {/* —— Desktop: unchanged —— */}
      <div className="page-pad page-shell hidden sm:flex items-center justify-between gap-4 py-3.5 sm:py-4">
        <Link to={homePath} className="relative z-10 shrink-0 flex items-center">
          {brandLogo ? (
            <Motion.img
              whileHover={{ scale: 1.03 }}
              src={brandLogo}
              alt={brandLabel || 'Logo'}
              width={160}
              height={40}
              decoding="async"
              className="block h-8 sm:h-9 lg:h-10 w-auto max-h-9 lg:max-h-10 object-contain"
            />
          ) : (
            <span className="text-base font-semibold text-ink">{brandLabel || 'Home'}</span>
          )}
        </Link>

        <nav className="flex items-center gap-5 lg:gap-7 shrink-0">
          {menuLinks.map((link, index) => (
            <Link
              key={index}
              to={link.path === '/' ? homePath : carsPath}
              className="text-sm tracking-wide text-muted hover:text-ink transition-colors whitespace-nowrap"
            >
              {navLabels[link.name] || link.name}
            </Link>
          ))}
          <LanguageSwitcher />
          {isOwner ? (
            <>
              <button
                type="button"
                onClick={() => navigate('/owner')}
                className="cursor-pointer text-sm text-muted hover:text-ink whitespace-nowrap"
              >
                {t('nav.dashboard')}
              </button>
              <button
                type="button"
                onClick={logout}
                className="cursor-pointer px-5 py-2.5 bg-primary hover:bg-primary-dull transition-all text-white rounded-xl text-sm whitespace-nowrap"
              >
                {t('nav.logout')}
              </button>
            </>
          ) : null}
        </nav>
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu overlay"
            className="fixed inset-0 z-40 bg-ink/40 sm:hidden"
            onClick={() => setOpen(false)}
          />
          <nav className="fixed inset-x-0 top-[calc(3.75rem+env(safe-area-inset-top))] z-50 flex h-[calc(100svh-3.75rem-env(safe-area-inset-top))] flex-col gap-1 overflow-y-auto border-t border-borderColor bg-white p-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:hidden">
            {menuLinks.map((link, index) => (
              <Link
                key={index}
                to={link.path === '/' ? homePath : carsPath}
                onClick={() => setOpen(false)}
                className="booking-tap flex min-h-12 items-center border-b border-borderColor/60 py-3 text-sm tracking-wide text-muted transition-colors hover:text-ink"
              >
                {navLabels[link.name] || link.name}
              </Link>
            ))}
            <div className="flex flex-col gap-3 pt-4">
              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/owner')
                      setOpen(false)
                    }}
                    className="booking-tap cursor-pointer py-3 text-left text-sm text-muted hover:text-ink"
                  >
                    {t('nav.dashboard')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      logout()
                      setOpen(false)
                    }}
                    className="booking-tap cursor-pointer rounded-2xl bg-primary px-5 text-[15px] font-semibold text-white transition-all hover:bg-primary-dull"
                  >
                    {t('nav.logout')}
                  </button>
                </>
              ) : null}
            </div>
          </nav>
        </>
      )}
    </Motion.header>
  )
}

export default Navbar
