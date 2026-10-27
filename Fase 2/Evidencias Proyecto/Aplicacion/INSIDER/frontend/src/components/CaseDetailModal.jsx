import { useEffect, useState } from 'react'
import { CalendarPlus, Download, Gavel, Lock, Sparkles, Wand2 } from 'lucide-react'
import api, { downloadFile, errorMessage } from '../api/client'
import { FINAL, fmtDate } from '../utils/constants'
import Timeline from './Timeline'
import { Alert, Button, Field, Modal, PriorityBadge, Spinner, StatusBadge } from './ui'

/**
 * Detalle de caso para gestión (coordinación / área legal).
 * Incluye timeline (CU007), cambio de estado, borrador IA y cierre con dictamen (CU012).
 */
export default function CaseDetailModal({ resource, item, open, onClose, onUpdated, manage, ai, legal, statusOptions }) {
  const [timeline, setTimeline] = useState(null)
  const [tab, setTab] = useState('detalle')
  const [status, setStatus] = useState('')
  const [comment, setComment] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [resolution, setResolution] = useState('')
  const [notes, setNotes] = useState('')
  const [draft, setDraft] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [meeting, setMeeting] = useState({ scheduled_at: '', location: '', participants: '', notes: '' })
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)

  const base = `/${resource}/${item?.id}`
  const final = item && FINAL.includes(item.status)

  useEffect(() => {
    if (!open || !item) return
    setTab('detalle'); setMsg(null); setDraft(null); setResolution(''); setComment('')
    setNotes(item.legal_notes || '')
    setStatus(statusOptions?.[0]?.value || '')
    api.get(`${base}/timeline/`).then(({ data }) => setTimeline(data.events)).catch(() => setTimeline([]))
    if (legal) api.get(`${base}/meetings/`).then(({ data }) => setMeetings(data)).catch(() => setMeetings([]))
  }, [open, item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key, fn, okText) => {
    setBusy(key); setMsg(null)
    try {
      const res = await fn()
      if (okText) setMsg({ type: 'success', text: okText })
      if (res?.data?.id) onUpdated?.(res.data)
      const { data } = await api.get(`${base}/timeline/`)
      setTimeline(data.events)
      return res
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) })
    } finally {
      setBusy('')
    }
  }

  const loadDraft = () => run('ai', async () => {
    const res = await api.get(`${base}/ai-suggestion/`)
    setDraft(res.data)
    setResolution(res.data.draft)
    setTab('gestion')
    return null
  })

  if (!item) return null
  const tabs = [['detalle', 'Detalle'], ['timeline', 'Seguimiento']]
  if (manage && !final) tabs.push(['gestion', 'Gestionar'])
  if (legal) tabs.push(['legal', 'Área legal'])

  return (
    <Modal open={open} onClose={onClose} size="xl" title={<span className="flex items-center gap-3">{item.folio} <StatusBadge status={item.status} /></span>}>
      <div className="mb-4 flex gap-1 border-b">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-duoc-yellow text-duoc-blue' : 'border-transparent text-slate-500 hover:text-duoc-blue'}`}>
            {l}
          </button>
        ))}
      </div>
      {msg && <div className="mb-4"><Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert></div>}

      {tab === 'detalle' && (
        <div className="space-y-4">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            {item.user_name && <Info label="Solicitante" value={item.user_name} />}
            {item.complainant_name && <Info label="Denunciante" value={item.complainant_name} />}
            {item.target_name && <Info label="Denunciado/a" value={item.target_name} />}
            {item.category_label || item.category ? <Info label="Categoría" value={item.category_label || item.category} /> : null}
            {item.service && <Info label="Servicio" value={item.service} />}
            {item.priority && <Info label="Prioridad" value={<PriorityBadge priority={item.priority} />} />}
            <Info label="Creado" value={fmtDate(item.created_at, true)} />
            {item.hours_open != null && (
              <Info label="Tiempo abierto" value={<span className={item.sla_breached ? 'font-semibold text-red-600' : ''}>{item.hours_open} h {item.sla_breached && '(fuera de SLA)'}</span>} />
            )}
          </dl>
          <div>
            <p className="label">Descripción</p>
            <p className="whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm">{item.description}</p>
          </div>
          {(item.attachment_url || item.evidence_url) && (
            <Button variant="outline" onClick={() => downloadFile(item.attachment_url || item.evidence_url)}>
              <Download size={16} /> Descargar adjunto
            </Button>
          )}
          {item.ai_suggestion && (
            <Alert type="info"><strong>Respuesta automática aplicada:</strong> {item.ai_suggestion}</Alert>
          )}
          {item.resolution && (
            <div><p className="label">Dictamen / resolución</p><p className="whitespace-pre-line rounded-xl bg-emerald-50 p-4 text-sm">{item.resolution}</p></div>
          )}
          {item.cancel_reason && <Alert type="warning"><strong>Motivo de anulación:</strong> {item.cancel_reason}</Alert>}
          {ai && manage && !final && (
            <Button variant="accent" loading={busy === 'ai'} onClick={loadDraft}><Sparkles size={16} /> Generar respuesta con IA</Button>
          )}
        </div>
      )}

      {tab === 'timeline' && (timeline ? <Timeline events={timeline} /> : <Spinner />)}

      {tab === 'gestion' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h4 className="font-semibold text-duoc-blue">Cambiar estado</h4>
            <Field label="Nuevo estado">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Comentario">
              <textarea className="input min-h-[90px]" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentario visible en el seguimiento" />
            </Field>
            {legal && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!isPublic} onChange={(e) => setIsPublic(!e.target.checked)} />
                <Lock size={14} /> Nota interna (no visible para el denunciante)
              </label>
            )}
            <Button loading={busy === 'status'} onClick={() => run('status', () =>
              api.post(`${base}/change-status/`, { status, comment, ...(legal ? { is_public: isPublic } : {}) }), 'Estado actualizado.')}>
              Actualizar estado
            </Button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-duoc-blue">Cerrar con dictamen</h4>
              {ai && (
                <button className="flex items-center gap-1 text-xs font-semibold text-duoc-blue hover:underline" onClick={loadDraft}>
                  <Wand2 size={14} /> Sugerir con IA
                </button>
              )}
            </div>
            {draft && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                Fuente: {draft.source} · confianza {Math.round(draft.classification.confidence * 100)}% · estado recomendado: {draft.recommended_status}
              </p>
            )}
            <textarea className="input min-h-[160px]" value={resolution} onChange={(e) => setResolution(e.target.value)}
                      placeholder="Fundamento y resolución formal del caso (mín. 15 caracteres)" />
            <Button variant="accent" loading={busy === 'close'} disabled={resolution.trim().length < 15}
                    onClick={() => run('close', () => api.post(`${base}/close/`, { resolution }), 'Caso cerrado con dictamen.').then(() => setTab('timeline'))}>
              <Gavel size={16} /> Cerrar caso
            </Button>
          </div>
        </div>
      )}

      {tab === 'legal' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 font-semibold text-duoc-blue"><Lock size={16} /> Notas legales (confidencial)</h4>
            <textarea className="input min-h-[180px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button loading={busy === 'notes'} onClick={() => run('notes', () => api.patch(base + '/', { legal_notes: notes }), 'Notas guardadas.')}>Guardar notas</Button>
          </div>
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 font-semibold text-duoc-blue"><CalendarPlus size={16} /> Agenda de reuniones</h4>
            <ul className="space-y-2">
              {meetings.map((m) => (
                <li key={m.id} className="rounded-lg border p-2 text-sm">
                  <strong>{fmtDate(m.scheduled_at, true)}</strong> · {m.location || 'Sin lugar'}
                  {m.participants && <p className="text-xs text-slate-500">{m.participants}</p>}
                </li>
              ))}
              {!meetings.length && <li className="text-sm text-slate-500">Sin reuniones agendadas.</li>}
            </ul>
            {!final && (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                <input type="datetime-local" className="input" value={meeting.scheduled_at} onChange={(e) => setMeeting({ ...meeting, scheduled_at: e.target.value })} />
                <input className="input" placeholder="Lugar / enlace Teams" value={meeting.location} onChange={(e) => setMeeting({ ...meeting, location: e.target.value })} />
                <input className="input" placeholder="Participantes" value={meeting.participants} onChange={(e) => setMeeting({ ...meeting, participants: e.target.value })} />
                <Button variant="outline" loading={busy === 'meet'} disabled={!meeting.scheduled_at}
                        onClick={() => run('meet', async () => {
                          const res = await api.post(`${base}/meetings/`, { ...meeting, scheduled_at: new Date(meeting.scheduled_at).toISOString() })
                          setMeetings((ms) => [...ms, res.data])
                          setMeeting({ scheduled_at: '', location: '', participants: '', notes: '' })
                          return null
                        }, 'Reunión agendada.')}>
                  Agendar reunión
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
    </div>
  )
}
