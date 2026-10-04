import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { useSuperAdmin } from '../../context/SuperAdminContext'
import { BRAND_NAME } from '../../constants/brand'
import { SaThemeProvider, useSaTheme } from './SaThemeContext'
import { sa } from './saUi'
import { SaGlobalSearch } from './SaGlobalSearch'
import { SaNotificationCenter } from './SaNotificationCenter'

const Icon = ({ d, className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

const ICONS = {
  overview: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4',
  agencies: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1',
  requests: 'M3 7a2 2 0 012-2h10a2 2 0 012 2v9a2 2 0 01-2 2H8l-3 3v-3H5a2 2 0 01-2-2V7z',
  users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  billing: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  activity: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  health: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  settings: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  sun: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  moon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  collapse: 'M11 19l-7-7 7-7m8 14l-7-7 7-7',
  plus: 'M12 4v16m8-8H4',
  search: 'M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
}

const NAV = [
  { to: '/superadmin', end: true, label: 'Overview', icon: ICONS.overview },
  { to: '/superadmin/agencies', label: 'Agencies', icon: ICONS.agencies },
  { to: '/superadmin/requests', label: 'Agency Requests', icon: ICONS.requests, badge: 'pending' },
  { to: '/superadmin/admins', label: 'Users', icon: ICONS.users },
  { to: '/superadmin/billing', label: 'Subscriptions', icon: ICONS.billing },
  { to: '/superadmin/notifications', label: 'Notifications', icon: ICONS.bell, badge: 'unread' },
  { to: '/superadmin/activity', label: 'Activity Log', icon: ICONS.activity },
  { to: '/superadmin/health', label: 'System Health', icon: ICONS.health, badge: 'health' },
  { to: '/superadmin/settings', label: 'Settings', icon: ICONS.settings },
]

const PAGE_META = [
  { match: /^\/superadmin\/requests/, title: 'Agency Requests', crumbs: ['Control Center', 'Agency Requests'] },
  { match: /^\/superadmin\/agencies\/[^/]+$/, title: 'Agency', crumbs: ['Control Center', 'Agencies', 'Detail'] },
  { match: /^\/superadmin\/agencies/, title: 'Agencies', crumbs: ['Control Center', 'Agencies'] },
  { match: /^\/superadmin\/admins\/[^/]+$/, title: 'User', crumbs: ['Control Center', 'Users', 'Profile'] },
  { match: /^\/superadmin\/admins/, title: 'Users', crumbs: ['Control Center', 'Users'] },
  { match: /^\/superadmin\/billing/, title: 'Subscriptions', crumbs: ['Control Center', 'Subscriptions'] },
  { match: /^\/superadmin\/notifications/, title: 'Notifications', crumbs: ['Control Center', 'Notifications'] },
  { match: /^\/superadmin\/permissions/, title: 'Access', crumbs: ['Control Center', 'Settings', 'Access'] },
  { match: /^\/superadmin\/activity/, title: 'Activity Log', crumbs: ['Control Center', 'Activity'] },
  { match: /^\/superadmin\/audit/, title: 'Audit', crumbs: ['Control Center', 'Activity'] },
  { match: /^\/superadmin\/health/, title: 'System Health', crumbs: ['Control Center', 'Health'] },
  { match: /^\/superadmin\/settings/, title: 'Settings', crumbs: ['Control Center', 'Settings'] },
  { match: /^\/superadmin\/?$/, title: 'Overview', crumbs: ['Control Center', 'Overview'] },
]

const Badge = ({ value }) => {
  if (!value) return null
  const n = Number(value)
  if (!n) return null
  return (
    <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-md bg-[var(--sa-warn-soft)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--sa-warn)]">
      {n > 99 ? '99+' : n}
    </span>
  )
}

const Shell = () => {
  const { authReady, isSuperAdmin, user, logout, navigate, axios } = useSuperAdmin()
  const { theme, toggleTheme } = useSaTheme()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sa_sidebar') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [summary, setSummary] = useState({ pendingAgencies: 0, unreadInbox: 0, failedInbox: 0, healthAlerts: 0 })
  const [inbox, setInbox] = useState([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const menuRef = useRef(null)
  const quickRef = useRef(null)
  const inboxWrapRef = useRef(null)

  const page = useMemo(() => PAGE_META.find(({ match }) => match.test(location.pathname)) || PAGE_META.at(-1), [location.pathname])

  const loadSummary = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/super-admin/summary')
      if (data.success) {
        setSummary({
          pendingAgencies: data.pendingAgencies || 0,
          unreadInbox: data.unreadInbox || 0,
          failedInbox: data.failedInbox || 0,
          healthAlerts: data.healthAlerts || 0,
        })
      }
    } catch {
      /* shell badges are non-blocking */
    }
  }, [axios])

  const loadInbox = useCallback(async () => {
    setInboxLoading(true)
    try {
      const { data } = await axios.get('/api/super-admin/inbox', { params: { limit: 12 } })
      if (data.success) {
        setInbox(data.items || [])
        setSummary((prev) => ({ ...prev, unreadInbox: data.unread || 0 }))
      }
    } catch {
      /* ignore */
    } finally {
      setInboxLoading(false)
    }
  }, [axios])

  useEffect(() => {
    if (authReady && !isSuperAdmin) navigate('/superadmin/login', { replace: true })
  }, [authReady, isSuperAdmin, navigate])

  useEffect(() => {
    setMobileOpen(false)
    setMenuOpen(false)
    setQuickOpen(false)
    setInboxOpen(false)
  }, [location.pathname])

  useEffect(() => {
    try {
      localStorage.setItem('sa_sidebar', collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  useEffect(() => {
    if (!authReady || !isSuperAdmin) return undefined
    loadSummary()
    const id = setInterval(loadSummary, 60_000)
    return () => clearInterval(id)
  }, [authReady, isSuperAdmin, loadSummary])

  useEffect(() => {
    if (!inboxOpen) return undefined
    loadInbox()
    return undefined
  }, [inboxOpen, loadInbox])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!menuOpen && !quickOpen && !inboxOpen) return undefined
    const onPointer = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
      if (quickRef.current && !quickRef.current.contains(e.target)) setQuickOpen(false)
      if (inboxWrapRef.current && !inboxWrapRef.current.contains(e.target)) setInboxOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setQuickOpen(false)
        setInboxOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, quickOpen, inboxOpen])

  const badgeFor = (link) => {
    if (link.badge === 'pending') return summary.pendingAgencies
    if (link.badge === 'unread') return summary.unreadInbox
    if (link.badge === 'health') return summary.healthAlerts
    return 0
  }

  const markRead = async (id) => {
    try {
      await axios.patch(`/api/super-admin/inbox/${id}/read`)
      setInbox((prev) => prev.map((item) => (item._id === id ? { ...item, readAt: new Date().toISOString() } : item)))
      setSummary((prev) => ({ ...prev, unreadInbox: Math.max(0, prev.unreadInbox - 1) }))
    } catch {
      /* ignore */
    }
  }

  const markAll = async () => {
    try {
      await axios.patch('/api/super-admin/inbox/read-all')
      setInbox((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })))
      setSummary((prev) => ({ ...prev, unreadInbox: 0 }))
    } catch {
      /* ignore */
    }
  }

  if (!authReady) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-[var(--sa-text-muted)]">
        Loading Super Admin…
      </div>
    )
  }

  if (!isSuperAdmin) return <Navigate to="/superadmin/login" replace />

  const NavItems = ({ compact }) =>
    NAV.map((link) => (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end}
        title={link.label}
        aria-label={link.label}
        className={({ isActive }) =>
          `group relative flex items-center gap-3 rounded-[var(--sa-radius-sm)] px-2.5 py-2 text-sm font-medium transition ${
            isActive
              ? 'bg-[var(--sa-accent-soft)] text-[var(--sa-accent)]'
              : 'text-[var(--sa-text-secondary)] hover:bg-[var(--sa-surface-2)] hover:text-[var(--sa-text)]'
          } ${compact ? 'justify-center px-2' : ''}`
        }
      >
        {({ isActive }) => (
          <>
            {isActive ? (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--sa-accent)]" aria-hidden />
            ) : null}
            <Icon d={link.icon} className="h-[18px] w-[18px] shrink-0" />
            {!compact ? <span className="truncate">{link.label}</span> : null}
            {!compact ? <Badge value={badgeFor(link)} /> : badgeFor(link) ? (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--sa-warn)]" />
            ) : null}
          </>
        )}
      </NavLink>
    ))

  return (
    <div className="flex min-h-svh bg-[var(--sa-bg)] text-[var(--sa-text)]">
      <aside
        className={`sticky top-0 hidden h-svh flex-col border-r border-[var(--sa-border)] bg-[var(--sa-sidebar)] transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-[4.25rem]' : 'w-60'
        }`}
      >
        <div className={`flex items-center gap-2 border-b border-[var(--sa-border)] px-3 py-4 ${collapsed ? 'justify-center' : ''}`}>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold tracking-tight">{BRAND_NAME}</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--sa-accent)]">Control Center</p>
            </div>
          ) : (
            <span className="text-sm font-bold text-[var(--sa-accent)]" title={`${BRAND_NAME} Super Admin`}>
              KR
            </span>
          )}
        </div>
        <nav className="sa-scrollbar flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Super Admin">
          <NavItems compact={collapsed} />
        </nav>
        <div className="border-t border-[var(--sa-border)] p-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={`${sa.btnGhost} w-full ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon d={ICONS.collapse} className="h-4 w-4" />
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-[var(--sa-overlay)]" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-r border-[var(--sa-border)] bg-[var(--sa-sidebar)] shadow-[var(--sa-shadow)]">
            <div className="border-b border-[var(--sa-border)] px-4 py-4">
              <p className="font-semibold">{BRAND_NAME}</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--sa-accent)]">Control Center</p>
            </div>
            <nav className="sa-scrollbar flex-1 space-y-0.5 overflow-y-auto p-2">
              <NavItems compact={false} />
            </nav>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--sa-border)] bg-[var(--sa-bg-elevated)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--sa-bg-elevated)]/85">
          <div className="flex items-center gap-2 px-3 py-3 sm:px-5">
            <button type="button" className={`${sa.btnGhost} lg:hidden`} onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Icon d={ICONS.menu} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{page.title}</p>
              <p className="hidden truncate text-[11px] text-[var(--sa-text-muted)] sm:block">{page.crumbs?.join(' / ')}</p>
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className={`${sa.btnSecondary} !min-h-9 hidden max-w-xs flex-1 items-center justify-start gap-2 !px-3 text-[var(--sa-text-muted)] md:inline-flex`}
              aria-label="Search anything"
            >
              <Icon d={ICONS.search} className="h-4 w-4" />
              <span className="text-xs">Search anything…</span>
              <kbd className="ml-auto rounded border border-[var(--sa-border)] px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </button>
            <button type="button" className={`${sa.btnGhost} md:hidden`} onClick={() => setSearchOpen(true)} aria-label="Search">
              <Icon d={ICONS.search} className="h-4 w-4" />
            </button>
            <div className="relative" ref={quickRef}>
              <button
                type="button"
                className={sa.btnGhost}
                aria-haspopup="menu"
                aria-expanded={quickOpen}
                aria-label="Quick actions"
                onClick={() => setQuickOpen((v) => !v)}
              >
                <Icon d={ICONS.plus} className="h-4 w-4" />
              </button>
              {quickOpen ? (
                <div role="menu" className="absolute right-0 mt-1.5 w-56 rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface)] py-1 shadow-[var(--sa-shadow)]">
                  <button type="button" role="menuitem" className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--sa-surface-2)]" onClick={() => { setQuickOpen(false); navigate('/superadmin/requests') }}>
                    Review agency requests
                  </button>
                  <button type="button" role="menuitem" className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--sa-surface-2)]" onClick={() => { setQuickOpen(false); navigate('/superadmin/agencies?create=1') }}>
                    Create agency
                  </button>
                  <button type="button" role="menuitem" className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--sa-surface-2)]" onClick={() => { setQuickOpen(false); setSearchOpen(true) }}>
                    Search agency
                  </button>
                  <button type="button" role="menuitem" className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--sa-surface-2)]" onClick={() => { setQuickOpen(false); navigate('/superadmin/notifications') }}>
                    View notifications
                  </button>
                </div>
              ) : null}
            </div>
            <div className="relative" ref={inboxWrapRef}>
              <button
                type="button"
                className={`${sa.btnGhost} relative`}
                aria-label={summary.unreadInbox ? `${summary.unreadInbox} unread notifications` : 'Notifications'}
                onClick={() => setInboxOpen((v) => !v)}
              >
                <Icon d={ICONS.bell} className="h-4 w-4" />
                {summary.unreadInbox ? (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-[var(--sa-danger)] px-1 text-[9px] font-bold text-white">
                    {summary.unreadInbox > 9 ? '9+' : summary.unreadInbox}
                  </span>
                ) : null}
              </button>
              <SaNotificationCenter
                open={inboxOpen}
                onClose={() => setInboxOpen(false)}
                items={inbox}
                unread={summary.unreadInbox}
                loading={inboxLoading}
                onMarkRead={markRead}
                onMarkAll={markAll}
              />
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={sa.btnGhost}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              <Icon d={theme === 'dark' ? ICONS.sun : ICONS.moon} className="h-4 w-4" />
            </button>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className={`${sa.btnSecondary} !min-h-9 !px-2.5`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Super Admin account"
              >
                <span className="max-w-[9rem] truncate text-xs sm:text-sm">{user?.name || 'Super Admin'}</span>
              </button>
              {menuOpen ? (
                <div role="menu" className="absolute right-0 z-50 mt-1.5 w-52 rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface)] py-1 shadow-[var(--sa-shadow)]">
                  <p className="truncate border-b border-[var(--sa-border)] px-3 py-2 text-[11px] text-[var(--sa-text-muted)]">
                    {user?.email}
                  </p>
                  <button type="button" role="menuitem" className="w-full px-3 py-2.5 text-left text-sm text-[var(--sa-danger)] hover:bg-[var(--sa-danger-soft)]" onClick={logout}>
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-5 sm:px-5 sm:py-7 lg:px-8">
          <Outlet />
        </main>
      </div>

      <SaGlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

const SuperAdminLayout = () => (
  <SaThemeProvider>
    <Shell />
  </SaThemeProvider>
)

export default SuperAdminLayout
