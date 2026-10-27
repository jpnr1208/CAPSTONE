import { CheckCircle2, Circle, XCircle } from 'lucide-react'
import { fmtDate, statusLabel } from '../utils/constants'

/** CU007 - Timeline interactivo de estados. */
export default function Timeline({ events = [] }) {
  if (!events.length) return <p className="text-sm text-slate-500">Sin movimientos registrados.</p>
  return (
    <ol className="relative ml-3 border-l-2 border-duoc-blue-50">
      {events.map((e, i) => {
        const last = i === events.length - 1
        const Icon = e.to_status === 'ANULADA' ? XCircle : last ? Circle : CheckCircle2
        const color = e.to_status === 'ANULADA' ? 'text-red-500' : last ? 'text-duoc-yellow' : 'text-duoc-blue'
        return (
          <li key={e.id} className="mb-5 ml-5">
            <span className={`absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full bg-white ${color}`}>
              <Icon size={20} fill={last ? 'currentColor' : 'none'} className={last ? 'animate-pulse' : ''} />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="font-semibold text-duoc-blue">
                {e.from_status && e.from_status !== e.to_status
                  ? `${statusLabel(e.from_status)} → ${statusLabel(e.to_status)}`
                  : statusLabel(e.to_status)}
              </p>
              <time className="text-xs text-slate-400">{fmtDate(e.created_at, true)}</time>
            </div>
            <p className="text-xs text-slate-500">{e.changed_by_name}</p>
            {e.comment && <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-2 text-sm text-slate-700">{e.comment}</p>}
          </li>
        )
      })}
    </ol>
  )
}
