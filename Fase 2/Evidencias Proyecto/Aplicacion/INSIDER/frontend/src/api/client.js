import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'
const ACCESS = 'insider.access'
const REFRESH = 'insider.refresh'

export const tokens = {
  get access() { return localStorage.getItem(ACCESS) },
  get refresh() { return localStorage.getItem(REFRESH) },
  set({ access, refresh }) {
    if (access) localStorage.setItem(ACCESS, access)
    if (refresh) localStorage.setItem(REFRESH, refresh)
  },
  clear() { localStorage.removeItem(ACCESS); localStorage.removeItem(REFRESH) },
}

const api = axios.create({ baseURL: BASE_URL, timeout: 30000 })

api.interceptors.request.use((config) => {
  if (tokens.access) config.headers.Authorization = `Bearer ${tokens.access}`
  return config
})

// Refresco automático del access token (una sola petición concurrente).
let refreshing = null
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    const isAuthCall = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh')
    if (error.response?.status === 401 && !original._retry && tokens.refresh && !isAuthCall) {
      original._retry = true
      try {
        refreshing = refreshing || axios.post(`${BASE_URL}/auth/refresh/`, { refresh: tokens.refresh })
        const { data } = await refreshing
        tokens.set(data)
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch (e) {
        tokens.clear()
        window.dispatchEvent(new Event('insider:logout'))
        return Promise.reject(error)
      } finally {
        refreshing = null
      }
    }
    return Promise.reject(error)
  },
)

/** Convierte errores DRF en un mensaje legible. */
export function errorMessage(err, fallback = 'Ocurrió un error inesperado. Intenta nuevamente.') {
  const data = err?.response?.data
  if (!data) return err?.message === 'Network Error' ? 'No hay conexión con el servidor.' : fallback
  if (typeof data === 'string') return fallback
  if (data.detail) return Array.isArray(data.detail) ? data.detail.join(' ') : data.detail
  const first = Object.entries(data)[0]
  if (first) {
    const [field, msgs] = first
    const msg = Array.isArray(msgs) ? msgs.join(' ') : String(msgs)
    return field === 'non_field_errors' ? msg : `${field}: ${msg}`
  }
  return fallback
}

/** Construye FormData omitiendo valores vacíos (para adjuntos). */
export function toFormData(obj) {
  const fd = new FormData()
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    fd.append(k, typeof v === 'boolean' ? String(v) : v)
  })
  return fd
}

/** Descarga protegida con JWT (los adjuntos no son públicos). */
export async function downloadFile(url, fallbackName = 'adjunto') {
  const path = url.replace(/^\/api\/v1/, '')
  const res = await api.get(path, { responseType: 'blob' })
  const cd = res.headers['content-disposition'] || ''
  const name = decodeURIComponent((cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i) || [])[1] || fallbackName)
  const href = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.click()
  URL.revokeObjectURL(href)
}

export const unwrap = (data) => (Array.isArray(data) ? data : data?.results ?? [])

export default api
