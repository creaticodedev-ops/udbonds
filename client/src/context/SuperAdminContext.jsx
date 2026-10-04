import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../utils/apiError'

import { resolveApiBaseUrl } from '../utils/apiBase'

const SA_TOKEN_KEY = 'sa_token'
const API_BASE_URL = resolveApiBaseUrl()

const SuperAdminContext = createContext(null)

const saAxios = axios.create({ baseURL: API_BASE_URL })

export const SuperAdminProvider = ({ children }) => {
  const navigate = useNavigate()
  const [token, setToken] = useState(() => localStorage.getItem(SA_TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  const applyToken = useCallback((next) => {
    if (next) {
      localStorage.setItem(SA_TOKEN_KEY, next)
      saAxios.defaults.headers.common.Authorization = `Bearer ${next}`
      setToken(next)
    } else {
      localStorage.removeItem(SA_TOKEN_KEY)
      delete saAxios.defaults.headers.common.Authorization
      setToken(null)
      setUser(null)
    }
  }, [])

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await saAxios.get('/api/super-admin/me')
      if (data.success && data.user?.role === 'superadmin') {
        setUser(data.user)
      } else {
        applyToken(null)
      }
    } catch {
      applyToken(null)
    } finally {
      setAuthReady(true)
    }
  }, [applyToken])

  useEffect(() => {
    if (token) {
      saAxios.defaults.headers.common.Authorization = `Bearer ${token}`
      fetchMe()
    } else {
      setAuthReady(true)
    }
  }, [token, fetchMe])

  useEffect(() => {
    const id = saAxios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status
        const code = error.response?.data?.code
        if (status === 401 || code === 'TOKEN_REVOKED' || code === 'SUPERADMIN_REQUIRED') {
          applyToken(null)
          if (window.location.pathname.startsWith('/superadmin') && !window.location.pathname.includes('/login')) {
            toast.error('Session expired. Please sign in again.')
            navigate('/superadmin/login', { replace: true })
          }
        }
        return Promise.reject(error)
      }
    )
    return () => saAxios.interceptors.response.eject(id)
  }, [applyToken, navigate])

  const login = useCallback(async (email, password) => {
    const { data } = await saAxios.post('/api/super-admin/login', { email, password })
    if (!data.success) throw new Error(data.message || 'Login failed')
    applyToken(data.token)
    setUser(data.user)
    setAuthReady(true)
    return data.user
  }, [applyToken])

  const logout = useCallback(() => {
    applyToken(null)
    toast.success('Signed out of Super Admin')
    navigate('/superadmin/login')
  }, [applyToken, navigate])

  const value = useMemo(
    () => ({
      axios: saAxios,
      token,
      user,
      authReady,
      isSuperAdmin: user?.role === 'superadmin',
      login,
      logout,
      fetchMe,
      navigate,
    }),
    [token, user, authReady, login, logout, fetchMe, navigate]
  )

  return <SuperAdminContext.Provider value={value}>{children}</SuperAdminContext.Provider>
}

export const useSuperAdmin = () => {
  const ctx = useContext(SuperAdminContext)
  if (!ctx) throw new Error('useSuperAdmin must be used within SuperAdminProvider')
  return ctx
}

export const saError = (error, fallback = 'Request failed') => getErrorMessage(error, fallback)
