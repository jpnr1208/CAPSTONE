import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { tokens } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    if (!tokens.access) { setLoading(false); return }
    try {
      const { data } = await api.get('/auth/me/')
      setUser(data)
    } catch {
      tokens.clear()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProfile() }, [loadProfile])

  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('insider:logout', onLogout)
    return () => window.removeEventListener('insider:logout', onLogout)
  }, [])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login/', { email, password })
    tokens.set(data)
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try { await api.post('/auth/logout/', { refresh: tokens.refresh }) } catch { /* sin conexión */ }
    tokens.clear()
    setUser(null)
  }

  const hasPerm = useCallback(
    (...perms) => {
      if (!user) return false
      const granted = user.permissions || []
      return granted.includes('*') || perms.some((p) => granted.includes(p))
    },
    [user],
  )

  const value = useMemo(
    () => ({ user, setUser, loading, login, logout, hasPerm, reload: loadProfile }),
    [user, loading, hasPerm, loadProfile],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
