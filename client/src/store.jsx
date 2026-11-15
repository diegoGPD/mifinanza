import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from './api.js'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const EMPTY = { settings: null, cards: [], transactions: [], msi_plans: [], recurring: [], goals: [] }

export function StoreProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = cargando, null = sin sesión
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(false)

  const loadState = useCallback(async () => {
    setLoading(true)
    try {
      const s = await api.get('/api/state')
      setData(s)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    api.get('/api/auth/me')
      .then((u) => { setUser(u); return loadState() })
      .catch(() => setUser(null))
  }, [loadState])

  // Tema
  const theme = data.settings?.theme || 'dark'
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#0d0d0d' : '#f9f9f7')
  }, [theme])

  const login = async (email, password) => {
    const u = await api.post('/api/auth/login', { email, password })
    setUser(u)
    await loadState()
  }
  const register = async (email, password) => {
    const u = await api.post('/api/auth/register', { email, password })
    setUser(u)
    await loadState()
  }
  const logout = async () => {
    await api.post('/api/auth/logout')
    setUser(null)
    setData(EMPTY)
  }

  // CRUD genérico con actualización optimista del estado local
  const create = async (table, body) => {
    const row = await api.post(`/api/${table}`, body)
    setData((d) => ({ ...d, [table]: [...d[table], row] }))
    return row
  }
  const update = async (table, id, body) => {
    const row = await api.put(`/api/${table}/${id}`, body)
    setData((d) => ({ ...d, [table]: d[table].map((r) => (r.id === id ? row : r)) }))
    return row
  }
  const remove = async (table, id) => {
    await api.del(`/api/${table}/${id}`)
    setData((d) => ({ ...d, [table]: d[table].filter((r) => r.id !== id) }))
  }
  const saveSettings = async (body) => {
    const s = await api.put('/api/settings', body)
    setData((d) => ({ ...d, settings: s }))
    return s
  }

  const value = { user, data, loading, login, register, logout, create, update, remove, saveSettings, reload: loadState, theme }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
