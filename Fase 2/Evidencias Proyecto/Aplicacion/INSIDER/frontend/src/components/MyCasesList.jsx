import { useState } from 'react'
import { Clock, Download, Eye } from 'lucide-react'
import api, { downloadFile } from '../api/client'
import { fmtDate } from '../utils/constants'
import Timeline from './Timeline'
import { EmptyState, Modal, Spinner, StatusBadge } from './ui'

/** Lista del estudiante con acceso al timeline (CU007) y acciones opcionales. */
export default function MyCasesList({ resource, items, loading, renderTitle, actions }) {
  const [tl, setTl] = useState(null)
  const [events, setEvents] = useState(null)

  const openTimeline = async (item) => {
    setTl(item)
    setEvents(null)
    const { data } = await api.get(`/${resource}/${item.id}/timeline/`)
    setEvents(data.events)
  }

  if (loading) return <Spinner />
  if (!items.length) return <EmptyState icon={Clock} title="Aún no tienes registros" text="Cuando envíes uno, podrás seguir su estado aquí." />

  return (
    <>
      <ul className="divide-y divide-slate-100">
        {items.map((it) => (
          <li key={it.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-duoc-blue">
                {it.folio} <StatusBadge status={it.status} />
              </p>
              <p className="truncate text-sm text-slate-600">{renderTitle(it)}</p>
              <p className="text-xs text-slate-400">{fmtDate(it.created_at, true)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => openTimeline(it)}><Eye size={14} /> Seguimiento</button>
              {it.attachment_url && (
                <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => downloadFile(it.attachment_url)}><Download size={14} /></button>
              )}
              {actions?.(it)}
            </div>
          </li>
        ))}
      </ul>
      <Modal open={!!tl} onClose={() => setTl(null)} title={`Seguimiento ${tl?.folio || ''}`}>
        {tl?.resolution && (
          <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm"><strong>Resolución:</strong> {tl.resolution}</div>
        )}
        {events ? <Timeline events={events} /> : <Spinner />}
      </Modal>
    </>
  )
}
