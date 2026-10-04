import React, { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { assets, ownerNavGroups } from '../../assets/assets'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../utils/apiError'

const STORAGE_KEY = 'hdn.owner.sidebar.groups'
const MOBILE_MQ = '(max-width: 767px)'

const isLinkActive = (pathname, path) => {
  if (path === '/owner') return pathname === '/owner'
  return pathname === path || pathname.startsWith(`${path}/`)
}

const readStoredGroups = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const Chevron = ({ open }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={`shrink-0 text-muted/80 transition-transform duration-200 ease-out ${open ? 'rotate-0' : '-rotate-90'}`}
  >
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/**
 * Admin sidebar — grouped, collapsible, permission-aware navigation.
 * Desktop: sticky rail. Mobile: drawer controlled by parent.
 */
const Sidebar = ({ mobileOpen = false, onMobileClose }) => {
  const { user, axios, fetchUser, hasPermission } = useAppContext()
  const { t } = useI18n()
  const location = useLocation()
  const [image, setImage] = useState('')
  const baseId = useId()
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const visibleGroups = useMemo(
    () =>
      ownerNavGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((link) => hasPermission(link.permission)),
        }))
        .filter((group) => group.items.length > 0),
    [hasPermission],
  )

  const activeGroupId = useMemo(() => {
    for (const group of visibleGroups) {
      if (group.items.some((link) => isLinkActive(location.pathname, link.path))) {
        return group.id
      }
    }
    return null
  }, [visibleGroups, location.pathname])

  const [openGroups, setOpenGroups] = useState(() => {
    const defaults = Object.fromEntries(ownerNavGroups.map((g) => [g.id, true]))
    const stored = readStoredGroups()
    return stored ? { ...defaults, ...stored } : defaults
  })

  // Keep active route's group expanded; preserve other user toggles
  useEffect(() => {
    if (!activeGroupId) return
    setOpenGroups((prev) => {
      if (prev[activeGroupId]) return prev
      const next = { ...prev, [activeGroupId]: true }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore quota */
      }
      return next
    })
  }, [activeGroupId])

  // Body scroll lock while mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return undefined
    document.body.classList.add('nav-open')
    return () => document.body.classList.remove('nav-open')
  }, [mobileOpen])

  // Escape closes mobile drawer
  useEffect(() => {
    if (!mobileOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onMobileClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen, onMobileClose])

  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : ''), [image])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const persistOpenGroups = useCallback((next) => {
    setOpenGroups(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }, [])

  const toggleGroup = useCallback(
    (id) => {
      persistOpenGroups({ ...openGroups, [id]: !openGroups[id] })
    },
    [openGroups, persistOpenGroups],
  )

  const updateImage = async () => {
    try {
      const formData = new FormData()
      formData.append('image', image)
      const { data } = await axios.post('/api/owner/update-image', formData)
      if (data.success) {
        fetchUser()
        toast.success(data.message)
        setImage('')
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const handleNavClick = () => {
    onMobileClose?.()
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-x-0 bottom-0 top-[57px] z-30 bg-ink/35 backdrop-blur-[2px] transition-opacity duration-200 md:hidden ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileOpen}
        onClick={onMobileClose}
      />

      <aside
        id="owner-sidebar"
        aria-label={t('admin.shell.navigation')}
        aria-hidden={isMobile && !mobileOpen ? true : undefined}
        className={[
          'flex flex-col bg-white border-r border-borderColor text-[13px]',
          'fixed md:sticky top-[57px] md:top-0 left-0 z-40 md:z-auto',
          'h-[calc(100svh-57px)] w-[min(18.5rem,88vw)] md:w-56 xl:w-[15.5rem] shrink-0',
          'transition-transform duration-200 ease-out md:translate-x-0',
          mobileOpen ? 'translate-x-0 shadow-[8px_0_32px_-12px_rgba(22,18,16,0.28)]' : '-translate-x-full md:translate-x-0',
          isMobile && !mobileOpen ? 'pointer-events-none' : '',
        ].join(' ')}
      >
        {/* Profile */}
        <div className="relative shrink-0 px-4 pt-5 pb-4 border-b border-borderColor/80">
          <div className="flex items-center gap-3">
            <div className="group relative shrink-0">
              <label htmlFor={`${baseId}-avatar`} className="block cursor-pointer">
                <img
                  src={previewUrl || user?.image || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=300'}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-borderColor"
                />
                <input
                  type="file"
                  id={`${baseId}-avatar`}
                  accept="image/*"
                  hidden
                  onChange={(e) => setImage(e.target.files?.[0] || '')}
                />
                <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-ink/25 group-hover:flex">
                  <img src={assets.edit_icon} alt="" className="h-3.5 w-3.5 brightness-0 invert" />
                </span>
              </label>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink leading-tight">{user?.name || 'Admin'}</p>
            </div>
            <button
              type="button"
              className="md:hidden -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-sand hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              onClick={onMobileClose}
              aria-label={t('admin.shell.closeMenu')}
            >
              <img src={assets.close_icon} alt="" className="h-3.5 w-3.5 opacity-70" />
            </button>
          </div>
          {image && (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              onClick={updateImage}
            >
              {t('admin.shell.save')} <img src={assets.check_icon} width={12} alt="" />
            </button>
          )}
        </div>

        {/* Scrollable nav */}
        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-2.5 py-3" aria-label={t('admin.shell.navigation')}>
          <ul className="space-y-1">
            {visibleGroups.map((group, groupIndex) => {
              const open = openGroups[group.id] !== false
              const panelId = `${baseId}-panel-${group.id}`
              const headerId = `${baseId}-header-${group.id}`
              const groupHasActive = group.items.some((link) => isLinkActive(location.pathname, link.path))

              return (
                <li key={group.id} className={groupIndex > 0 ? 'pt-1' : ''}>
                  {groupIndex > 0 && (
                    <div className="mx-2 mb-2 border-t border-borderColor/70" aria-hidden="true" />
                  )}

                  <button
                    type="button"
                    id={headerId}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => toggleGroup(group.id)}
                    className={[
                      'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5',
                      'text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
                      'hover:bg-sand/80 transition-colors',
                      groupHasActive ? 'text-ink' : 'text-muted',
                    ].join(' ')}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
                      {t(group.labelKey)}
                    </span>
                    <Chevron open={open} />
                  </button>

                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={headerId}
                    hidden={!open}
                    className={open ? 'mt-0.5' : ''}
                  >
                    <ul className="space-y-0.5">
                      {group.items.map((link) => {
                        const active = isLinkActive(location.pathname, link.path)
                        return (
                          <li key={link.path}>
                            <NavLink
                              to={link.path}
                              end={link.path === '/owner'}
                              title={t(link.nameKey)}
                              onClick={handleNavClick}
                              aria-current={active ? 'page' : undefined}
                              className={[
                                'group relative flex items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-2',
                                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1',
                                active
                                  ? 'bg-primary/[0.09] text-primary font-medium'
                                  : 'text-[#4a4540] hover:bg-sand/90 hover:text-ink',
                              ].join(' ')}
                            >
                              <span
                                className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity ${
                                  active ? 'bg-primary opacity-100' : 'opacity-0'
                                }`}
                                aria-hidden="true"
                              />
                              <img
                                src={active ? link.coloredIcon : link.icon}
                                alt=""
                                className="h-[17px] w-[17px] shrink-0 opacity-90"
                              />
                              <span className="min-w-0 truncate leading-snug">{t(link.nameKey)}</span>
                            </NavLink>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}

export default Sidebar
