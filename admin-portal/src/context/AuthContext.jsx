import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import apiClient, { setAccessToken, setUnauthorizedHandler } from '../api/client'

const AuthContext = createContext(null)
const STAFF_ROLES = ['admin', 'instructor']

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
    // Prevents a just-logged-in admin from briefly seeing the previous session's cached data.
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(clearAuth)
  }, [clearAuth])

  const loadMe = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/auth/me')
      if (!STAFF_ROLES.includes(data.role)) {
        clearAuth()
        return
      }
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
    if (!STAFF_ROLES.includes(data.role)) {
      await apiClient.post('/auth/logout')
      throw new Error('This portal is for Admin and Instructor accounts only.')
    }
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
    <AuthContext.Provider value={{
      user, loading, login, logout, isAdmin: user?.role === 'admin', isInstructor: user?.role === 'instructor',
      isSuperAdmin: user?.role === 'admin' && !!user?.is_super_admin,
      // can(area): super admins and instructors (role-restricted elsewhere) pass; regular admins need the area granted.
      can: (area) => {
        if (!user) return false
        if (user.role !== 'admin') return area !== '__super__'
        if (user.is_super_admin) return true
        if (area === '__super__') return false
        return user.permissions == null || user.permissions.includes(area)
      },
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
