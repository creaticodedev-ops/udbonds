import React, { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSuperAdmin, saError } from '../../context/SuperAdminContext'
import { BRAND_NAME } from '../../constants/brand'
import { SaThemeProvider, useSaTheme } from './SaThemeContext'
import { sa } from './saUi'

const ThemeToggle = () => {
  const { theme, toggleTheme } = useSaTheme()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={sa.btnGhost}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? '☀ Light' : '☾ Dark'}
    </button>
  )
}

const LoginForm = () => {
  const { login, isSuperAdmin, authReady } = useSuperAdmin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (authReady && isSuperAdmin) {
    return <Navigate to="/superadmin" replace />
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email.trim(), password)
      toast.success('Welcome, Super Admin')
    } catch (error) {
      toast.error(saError(error, 'Invalid credentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh flex flex-col bg-[var(--sa-bg)] text-[var(--sa-text)]">
      <header className="page-pad py-6 flex items-center justify-between border-b border-[var(--sa-border)]">
        <Link to="/" className={`${sa.btnGhost} -ml-2`}>
          ← Public site
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--sa-text-muted)]">Restricted</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center page-pad py-12">
        <div className="w-full max-w-md">
          <p className="text-2xl font-semibold tracking-tight text-[var(--sa-text)]">{BRAND_NAME}</p>
          <h1 className="mt-1 text-lg text-[var(--sa-text-secondary)] font-medium">Super Admin</h1>
          <p className="text-sm text-[var(--sa-text-muted)] mb-8 max-w-sm mt-2 leading-relaxed">
            Platform control for agencies, billing, and system activity. Agency admins cannot access this area.
          </p>

          <form onSubmit={onSubmit} className={`${sa.card} ${sa.cardPad} space-y-4`}>
            <div>
              <label htmlFor="sa-email" className={sa.label}>
                Email
              </label>
              <input
                id="sa-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={sa.input}
              />
            </div>
            <div>
              <label htmlFor="sa-password" className={sa.label}>
                Password
              </label>
              <input
                id="sa-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={sa.input}
              />
            </div>
            <button type="submit" disabled={loading || !authReady} className={`${sa.btnPrimary} w-full mt-2`}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

const SuperAdminLogin = () => (
  <SaThemeProvider>
    <LoginForm />
  </SaThemeProvider>
)

export default SuperAdminLogin
