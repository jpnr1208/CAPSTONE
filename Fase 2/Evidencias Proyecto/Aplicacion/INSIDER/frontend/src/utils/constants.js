export const STATUS = {
  PENDIENTE: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800' },
  EN_REVISION: { label: 'En revisión', cls: 'bg-sky-100 text-sky-800' },
  EN_PROCESO: { label: 'En proceso', cls: 'bg-indigo-100 text-indigo-800' },
  RESUELTA: { label: 'Resuelta', cls: 'bg-emerald-100 text-emerald-800' },
  CERRADA: { label: 'Cerrada', cls: 'bg-slate-200 text-slate-700' },
  ANULADA: { label: 'Anulada', cls: 'bg-red-100 text-red-700' },
  RECIBIDA: { label: 'Recibida', cls: 'bg-amber-100 text-amber-800' },
  EN_INVESTIGACION: { label: 'En investigación', cls: 'bg-sky-100 text-sky-800' },
  EN_DICTAMEN: { label: 'En dictamen', cls: 'bg-indigo-100 text-indigo-800' },
  PAGADO: { label: 'Pagado', cls: 'bg-emerald-100 text-emerald-800' },
  VENCIDO: { label: 'Vencido', cls: 'bg-red-100 text-red-700' },
}

export const PRIORITY = {
  ALTA: { label: 'Alta', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  MEDIA: { label: 'Media', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  BAJA: { label: 'Baja', cls: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200' },
}

export const FINAL = ['CERRADA', 'ANULADA']
export const OPEN = ['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'RECIBIDA', 'EN_INVESTIGACION', 'EN_DICTAMEN']

export const CHART_COLORS = ['#002855', '#FFC72C', '#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ef4444', '#64748b']

export const clp = (n) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n || 0))

const toDate = (d) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00` : d)

export const fmtDate = (d, withTime = false) =>
  d
    ? toDate(d).toLocaleString('es-CL', withTime
        ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

export const statusLabel = (s) => STATUS[s]?.label || s
