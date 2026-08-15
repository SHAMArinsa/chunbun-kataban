import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import apiClient, { setAccessToken, setUnauthorizedHandler } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()
  // Refresh tokens are single-use/rotated on every call. React StrictMode double-invokes
  // effects in dev, which would otherwise fire this mount-time refresh twice — the second
  // call fails because the first already rotated the token, incorrectly logging a valid
  // session out. This ref makes the actual refresh run at most once per mount.
  const didInitialRefresh = useRef(false)

  const clearAuth = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    // Prevents a just-logged-in user from briefly seeing the previous session's
    // cached React Query data (e.g. enrollments) before their own data loads.
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(clearAuth)
  }, [clearAuth])

  const loadMe = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/auth/me')
      setUser(data)
    } catch {
      clearAuth()
    }
  }, [clearAuth])

  useEffect(() => {
    if (didInitialRefresh.current) return
    didInitialRefresh.current = true
    // Attempt silent refresh on load (httpOnly cookie may still be valid)
    ;(async () => {
      try {
        const { data } = await apiClient.post('/auth/refresh')
        setAccessToken(data.access_token)
        await loadMe()
      } catch {
        clearAuth()
      } finally {
        setLoading(false)
      }
    })()
  }, [loadMe, clearAuth])

  const login = async (email, password) => {
    queryClient.clear()
    const { data } = await apiClient.post('/auth/login', { email, password })
    setAccessToken(data.access_token)
    await loadMe()
    return data
  }

  const register = async (payload) => {
    queryClient.clear()
    const { data } = await apiClient.post('/auth/register', payload)
    setAccessToken(data.access_token)
    await loadMe()
    return data
  }

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      clearAuth()
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
