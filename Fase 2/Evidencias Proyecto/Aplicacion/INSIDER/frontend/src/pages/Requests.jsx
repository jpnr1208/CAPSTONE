import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, Bot, FileText, GraduationCap, HeartPulse, Laptop, Lightbulb, Pencil, Send, ShieldAlert, Sparkles, Wallet, XCircle,
} from 'lucide-react'
import api, { errorMessage, toFormData, unwrap } from '../api/client'
import CaseInbox from '../components/CaseInbox'
import MyCasesList from '../components/MyCasesList'
import { Alert, Button, Card, Field, FileDrop, Modal, PageHeader, PriorityBadge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { STATUS } from '../utils/constants'
import useCatalog from '../utils/useCatalog'

const CAT_ICONS = { ACADEMICA: GraduationCap, FINANCIERA: Wallet, ADMINISTRATIVA: FileText, BIENESTAR: HeartPulse, TI: Laptop }
const SUG_ICONS = { redirect: ShieldAlert, document: BookOpen, rule: Bot, faq: Lightbulb, tip: Sparkles }
const REQUEST_STATUSES = ['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'RESUELTA', 'CERRADA', 'ANULADA']
const emptyForm = { category: '', service: '', request_type: 'Solicitud', description: '' }

export default function Requests() {
  const { hasPerm } = useAuth()
  const catalog = useCatalog()
  const staff = hasPerm('requests.manage', 'requests.view_all')

  if (staff) {
    return (
      <>
        <PageHeader icon={FileText} title="Gestión de solicitudes" subtitle="Bandeja con búsqueda avanzada, asistente IA y cierre con dictamen." />
        <CaseInbox
          resource="requests" title="Bandeja de solicitudes" showPriority manage={hasPerm('requests.manage')} ai={hasPerm('ai.suggest')}
          statuses={REQUEST_STATUSES.map((s) => ({ value: s, label: STATUS[s].label }))}
          statusOptions={['EN_REVISION', 'EN_PROCESO', 'RESUELTA'].map((s) => ({ value: s, label: STATUS[s].label }))}
          extraFilters={[
            { key: 'category', label: 'Todas las categorías', options: (catalog?.categories || []).map((c) => ({ value: c.code, label: c.label })) },
            { key: 'priority', label: 'Toda prioridad', options: [{ value: 'ALTA', label: 'Alta' }, { value: 'MEDIA', label: 'Media' }, { value: 'BAJA', label: 'Baja' }] },
          ]}
        />
      </>
    )
  }
  return <StudentRequests catalog={catalog} />
}

function StudentRequests({ catalog }) {
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState(null)
  const [editing, setEditing] = useState(null)
  const [ai, setAi] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [cancelling, setCancelling] = useState(null)
  const [reason, setReason] = useState('')
  const timer = useRef(null)
  const formRef = useRef(null)

  const loadList = useCallback(async () => {
    setLoadingList(true)
    try { setItems(unwrap((await api.get('/requests/', { params: { page_size: 50 } })).data)) } finally { setLoadingList(false) }
  }, [])
  useEffect(() => { loadList() }, [loadList])

  // Motor de sugerencias IA en vivo (debounce)
  useEffect(() => {
    clearTimeout(timer.current)
    if (form.description.trim().length < 15) { setAi(null); return }
    timer.current = setTimeout(async () => {
      setAiLoading(true)
      try {
        const { data } = await api.post('/ai/suggest/', { description: form.description, service: form.service })
        setAi(data)
      } catch { /* silencioso */ } finally { setAiLoading(false) }
    }, 650)
    return () => clearTimeout(timer.current)
  }, [form.description, form.service])

  const services = catalog?.categories.find((c) => c.code === form.category)?.services || []

  const applySuggestion = () => {
    const c = ai?.classification
    if (!c) return
    setForm((f) => ({ ...f, category: c.category, service: c.service || '' }))
  }

  const reset = () => { setForm(emptyForm); setFile(null); setEditing(null); setAi(null) }

  const submit = async (e) => {
    e.preventDefault()
    setSending(true); setError(''); setResult(null)
    try {
      const payload = toFormData({ ...form, attached_file: file })
      const { data } = editing
        ? await api.patch(`/requests/${editing.id}/`, payload)
        : await api.post('/requests/', payload)
      setResult({ ...data, edited: !!editing })
      reset()
      loadList()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const startEdit = (it) => {
    setEditing(it)
    setForm({ category: it.category, service: it.service, request_type: it.request_type, description: it.description })
    setResult(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const doCancel = async () => {
    try {
      await api.post(`/requests/${cancelling.id}/cancel/`, { reason })
      setCancelling(null); setReason(''); loadList()
    } catch (err) { alert(errorMessage(err)) }
  }

  return (
    <>
      <PageHeader icon={FileText} title="Solicitudes" subtitle="Registra tu trámite: nuestro asistente IA te guía mientras escribes." />

      {result && (
        <div className="mb-6">
          <Alert type="success" onClose={() => setResult(null)}>
            Solicitud <strong>{result.folio}</strong> {result.edited ? 'modificada' : 'registrada'} correctamente.
            {result.ai_analysis && <> Prioridad asignada: <strong>{result.priority}</strong>.</>}
            {result.ai_suggestion && <p className="mt-1">🤖 {result.ai_suggestion}</p>}
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5" ref={formRef}>
        <Card className="lg:col-span-3" title={editing ? `Modificar ${editing.folio}` : 'Nueva solicitud'}
              actions={editing && <button className="text-sm text-slate-500 hover:underline" onClick={reset}>Cancelar edición</button>}>
          <form onSubmit={submit} className="space-y-5">
            {error && <Alert type="error">{error}</Alert>}
            <div>
              <p className="label">1. Selecciona el área <span className="text-red-500">*</span></p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(catalog?.categories || []).map((c) => {
                  const Icon = CAT_ICONS[c.code] || FileText
                  const active = form.category === c.code
                  return (
                    <button type="button" key={c.code} onClick={() => setForm({ ...form, category: c.code, service: '' })}
                            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold transition ${active ? 'border-duoc-blue bg-duoc-blue text-white' : 'border-slate-200 hover:border-duoc-blue'}`}>
                      <Icon size={20} className={active ? 'text-duoc-yellow' : 'text-duoc-blue'} /> {c.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="2. Servicio" required>
                <select className="input" required value={form.service} disabled={!form.category}
                        onChange={(e) => setForm({ ...form, service: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {services.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Tipo" required>
                <select className="input" value={form.request_type} onChange={(e) => setForm({ ...form, request_type: e.target.value })}>
                  {(catalog?.request_types || ['Solicitud']).map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="3. Describe tu solicitud" required hint={`${form.description.length}/5000 · mínimo 20 caracteres`}>
              <textarea className="input min-h-[140px]" maxLength={5000} required value={form.description}
                        placeholder="Ej: Necesito justificar mi inasistencia a la prueba del 12 de septiembre de Programación Web por licencia médica…"
                        onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="4. Adjuntos (opcional)"><FileDrop file={file} onChange={setFile} /></Field>
            <Button type="submit" loading={sending} className="w-full sm:w-auto" disabled={!form.category || !form.service || form.description.trim().length < 20}>
              <Send size={16} /> {editing ? 'Guardar cambios' : 'Enviar solicitud'}
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2" title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-duoc-yellow" /> Asistente INSIDER IA</span>}
              subtitle="Clasificación y sugerencias en tiempo real">
          {!ai && !aiLoading && <p className="text-sm text-slate-500">Comienza a describir tu solicitud y te sugeriremos el servicio adecuado, documentos necesarios y respuestas frecuentes.</p>}
          {aiLoading && <p className="animate-pulse text-sm text-duoc-blue">Analizando tu solicitud…</p>}
          {ai && (
            <div className="space-y-3">
              <div className="rounded-xl bg-duoc-blue p-4 text-white">
                <p className="text-xs uppercase tracking-wide text-duoc-yellow">Clasificación sugerida</p>
                <p className="mt-1 font-semibold">{ai.classification.category_label}{ai.classification.service && ` · ${ai.classification.service}`}</p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <PriorityBadge priority={ai.classification.priority} />
                  <span>Confianza {Math.round(ai.classification.confidence * 100)}%</span>
                </div>
                {(ai.classification.category !== form.category || (ai.classification.service && ai.classification.service !== form.service)) && (
                  <button type="button" onClick={applySuggestion} className="btn-accent mt-3 px-3 py-1.5 text-xs">Aplicar sugerencia</button>
                )}
              </div>
              {ai.suggestions.map((s, i) => {
                const Icon = SUG_ICONS[s.type] || Lightbulb
                return (
                  <div key={i} className={`rounded-xl border p-3 text-sm ${s.type === 'redirect' ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                    <p className="flex items-center gap-2 font-semibold text-duoc-blue"><Icon size={16} /> {s.title}</p>
                    <p className="mt-1 text-slate-600">{s.text}</p>
                    {s.link && <Link to={s.link} className="mt-2 inline-block text-xs font-semibold text-red-700 underline">Ir al canal de denuncias</Link>}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6" title="Mis solicitudes" subtitle="Seguimiento, edición (pendientes) y anulación">
        <MyCasesList resource="requests" items={items} loading={loadingList}
          renderTitle={(it) => `${it.service} · ${it.request_type}`}
          actions={(it) => (
            <>
              {it.status === 'PENDIENTE' && (
                <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => startEdit(it)}><Pencil size={14} /> Editar</button>
              )}
              {['PENDIENTE', 'EN_REVISION'].includes(it.status) && (
                <button className="btn-outline px-3 py-1.5 text-xs text-red-600" onClick={() => setCancelling(it)}><XCircle size={14} /> Anular</button>
              )}
            </>
          )} />
      </Card>

      <Modal open={!!cancelling} onClose={() => setCancelling(null)} title={`Anular ${cancelling?.folio}`} size="md"
             footer={<>
               <button className="btn-outline" onClick={() => setCancelling(null)}>Volver</button>
               <Button variant="danger" disabled={reason.trim().length < 10} onClick={doCancel}>Confirmar anulación</Button>
             </>}>
        <p className="mb-3 text-sm text-slate-600">Esta acción es definitiva. Indica el motivo de la anulación.</p>
        <textarea className="input min-h-[100px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (mínimo 10 caracteres)" />
      </Modal>
    </>
  )
}
