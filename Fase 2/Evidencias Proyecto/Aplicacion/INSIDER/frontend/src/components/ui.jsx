import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, Loader2, Paperclip, UploadCloud, X } from 'lucide-react'
import { PRIORITY, STATUS } from '../utils/constants'

export function PageHeader({ title, subtitle, icon: Icon, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="rounded-xl bg-duoc-blue p-2.5 text-duoc-yellow"><Icon size={22} /></div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, subtitle, actions, children, className = '', bodyClass = 'p-5' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

export function StatCard({ label, value, icon: Icon, tone = 'blue', hint }) {
  const tones = {
    blue: 'bg-duoc-blue-50 text-duoc-blue',
    yellow: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
  }
  return (
    <div className="card flex items-center gap-4 p-5">
      {Icon && <div className={`rounded-xl p-3 ${tones[tone]}`}><Icon size={22} /></div>}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-duoc-blue">{value ?? '—'}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  )
}

export function Field({ label, error, hint, children, required }) {
  return (
    <div>
      {label && (
        <label className="label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function Button({ loading, children, variant = 'primary', className = '', ...props }) {
  return (
    <button className={`btn-${variant} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

export function Alert({ type = 'info', children, onClose }) {
  const map = {
    info: ['bg-duoc-blue-50 text-duoc-blue border-duoc-blue/20', Info],
    success: ['bg-emerald-50 text-emerald-800 border-emerald-200', CheckCircle2],
    error: ['bg-red-50 text-red-700 border-red-200', AlertCircle],
    warning: ['bg-amber-50 text-amber-800 border-amber-200', AlertCircle],
  }
  const [cls, Icon] = map[type]
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${cls}`} role="alert">
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1">{children}</div>
      {onClose && <button onClick={onClose} aria-label="Cerrar"><X size={16} /></button>}
    </div>
  )
}

export function StatusBadge({ status, label }) {
  const s = STATUS[status] || { label: label || status, cls: 'bg-slate-100 text-slate-600' }
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{label || s.label}</span>
}

export function PriorityBadge({ priority }) {
  if (!priority) return null
  const p = PRIORITY[priority]
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${p.cls}`}>{p.label}</span>
}

export function Spinner({ label = 'Cargando…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
      <Loader2 className="animate-spin" size={20} /> <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({ icon: Icon = Info, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 rounded-full bg-duoc-blue-50 p-4 text-duoc-blue"><Icon size={26} /></div>
      <p className="font-semibold text-duoc-blue">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, size = 'lg' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-duoc-blue/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
         onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} role="dialog" aria-modal="true"
           className={`flex max-h-[92vh] w-full ${widths[size]} flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl`}>
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold text-duoc-blue">{title}</h3>
          <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

export function FileDrop({ file, onChange, accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.mp3,.mp4,.txt', label = 'Adjuntar archivo' }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)
  const pick = (f) => {
    if (f && f.size > 10 * 1024 * 1024) { alert('El archivo supera 10 MB.'); return }
    onChange(f || null)
  }
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]) }}
      className={`rounded-xl border-2 border-dashed p-4 text-center transition ${drag ? 'border-duoc-yellow bg-amber-50' : 'border-slate-300 bg-slate-50'}`}
    >
      {file ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-duoc-blue">
            <Paperclip size={16} /> <span className="truncate">{file.name}</span>
            <span className="text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
          </span>
          <button type="button" className="text-red-600 hover:underline" onClick={() => pick(null)}>Quitar</button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center gap-1 text-sm text-slate-500">
          <UploadCloud className="text-duoc-blue" />
          <span><strong className="text-duoc-blue">{label}</strong> o arrastra aquí</span>
          <span className="text-xs">PDF, imágenes, Office, audio/video · máx. 10 MB</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}

export function Pagination({ page, count, pageSize = 20, onChange }) {
  const pages = Math.max(1, Math.ceil((count || 0) / pageSize))
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
      <span className="text-slate-500">{count} resultados · página {page} de {pages}</span>
      <div className="flex gap-2">
        <button className="btn-outline px-3 py-1.5" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button>
        <button className="btn-outline px-3 py-1.5" disabled={page >= pages} onClick={() => onChange(page + 1)}>Siguiente</button>
      </div>
    </div>
  )
}
