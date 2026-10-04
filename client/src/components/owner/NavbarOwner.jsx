import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { PLATFORM_NAME } from '../../constants/brand'
import { useI18n } from '../../i18n/I18nContext'
import LanguageSwitcher from '../LanguageSwitcher'
import NotificationBell from './NotificationBell'
import GlobalSearch from './GlobalSearch'
import { assets } from '../../assets/assets'

const NavbarOwner = ({ mobileNavOpen = false, onToggleMobileNav }) => {
  const { user, logout, license, licenseLocked, axios } = useAppContext()
  const { t } = useI18n()
  const [agency, setAgency] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await axios.get('/api/owner/agency')
        if (!cancelled && data.success) setAgency(data.agency)
      } catch {
        /* ignore — keep neutral */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [axios])

  const showTrialBadge =
    !licenseLocked &&
    license?.licenseStatus === 'trial' &&
    typeof license?.daysRemaining === 'number'

  const brandLabel = agency?.name || user?.agencyName || PLATFORM_NAME
  const brandLogo = agency?.logoUrl || ''
  const homeLink = agency?.storefrontPath || agency?.storefrontUrl || '/owner'

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 md:px-8 lg:px-10 py-3 text-gray-500 border-b border-borderColor bg-white min-h-[57px]">
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {!licenseLocked && onToggleMobileNav && (
          <button
            type="button"
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-borderColor/90 text-ink hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            onClick={onToggleMobileNav}
            aria-label={mobileNavOpen ? t('admin.shell.closeMenu') : t('admin.shell.openMenu')}
            aria-expanded={mobileNavOpen}
            aria-controls="owner-sidebar"
          >
            <img
              src={mobileNavOpen ? assets.close_icon : assets.menu_icon}
              alt=""
              className="h-4 w-4 opacity-80"
            />
          </button>
        )}
        <Link to={homeLink} className="shrink-0 flex items-center gap-2">
          {brandLogo ? (
            <img
              src={brandLogo}
              alt={brandLabel}
              className="block h-8 sm:h-9 w-auto max-h-9 object-contain"
            />
          ) : (
            <span className="text-sm font-semibold text-ink whitespace-nowrap">{brandLabel}</span>
          )}
        </Link>
      </div>

      {!licenseLocked && (
        <div className="hidden md:flex min-w-0 flex-1 justify-center px-2 lg:px-6">
          <GlobalSearch />
        </div>
      )}

      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
        {showTrialBadge && (
          <span className="hidden sm:inline-flex text-[11px] px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-100 whitespace-nowrap">
            {license.daysRemaining === 1
              ? t('admin.trial.daysLeft', { count: 1 })
              : t('admin.trial.daysLeft_plural', { count: license.daysRemaining })}
          </span>
        )}
        {!licenseLocked && <NotificationBell />}
        <LanguageSwitcher />
        <p className="hidden xl:block text-sm truncate max-w-[12rem]">
          {t('admin.shell.welcome', { name: user?.name || 'Admin' })}
        </p>
        <button
          type="button"
          onClick={logout}
          className="px-3 sm:px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dull cursor-pointer whitespace-nowrap"
        >
          {t('admin.shell.logout')}
        </button>
      </div>
    </div>
  )
}

export default NavbarOwner
