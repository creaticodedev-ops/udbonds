import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getInitialSaTheme, SA_THEME_KEY, saThemeStyles } from './saTheme'

const SaThemeContext = createContext(null)

export const SaThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getInitialSaTheme)

  const setTheme = useCallback((next) => {
    const value = next === 'light' ? 'light' : 'dark'
    setThemeState(value)
    try {
      localStorage.setItem(SA_THEME_KEY, value)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  useEffect(() => {
    const id = 'sa-theme-styles'
    if (!document.getElementById(id)) {
      const style = document.createElement('style')
      style.id = id
      style.textContent = saThemeStyles
      document.head.appendChild(style)
    }
    const fontId = 'sa-theme-font'
    if (!document.getElementById(fontId)) {
      const link = document.createElement('link')
      link.id = fontId
      link.rel = 'stylesheet'
      link.href =
        'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap'
      document.head.appendChild(link)
    }
  }, [])

  const value = useMemo(() => ({ theme, setTheme, toggleTheme, isDark: theme === 'dark' }), [
    theme,
    setTheme,
    toggleTheme,
  ])

  return (
    <SaThemeContext.Provider value={value}>
      <div className="sa-app" data-theme={theme}>
        {children}
      </div>
    </SaThemeContext.Provider>
  )
}

export const useSaTheme = () => {
  const ctx = useContext(SaThemeContext)
  if (!ctx) throw new Error('useSaTheme must be used within SaThemeProvider')
  return ctx
}
