import { useCallback, useEffect, useState } from 'react'
import { MessageSquareWarning, Send, XCircle } from 'lucide-react'
import api, { errorMessage, toFormData, unwrap } from '../api/client'
import CaseInbox from '../components/CaseInbox'
import MyCasesList from '../components/MyCasesList'
import { Alert, Button, Card, Field, FileDrop, Modal, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { STATUS } from '../utils/constants'
import useCatalog from '../utils/useCatalog'

const STATUSES = ['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'RESUELTA', 'CERRADA', 'ANULADA']

export default function Claims() {
  const { hasPerm } = useAuth()
  const catalog = useCatalog()
  if (hasPerm('claims.manage', 'claims.view_all')) {
    return (
      <>
        <PageHeader icon={MessageSquareWarning} title="Gestión de reclamos" subtitle="Revisa, responde y cierra reclamos formales." />
        <CaseInbox resource="claims" title="Bandeja de reclamos" manage={hasPerm('claims.manage')} ai={hasPerm('ai.suggest')}
          statuses={STATUSES.map((s) => ({ value: s, label: STATUS[s].label }))}
          statusOptions={['EN_REVISION', 'EN_PROCESO', 'RESUELTA'].map((s) => ({ value: s, label: STATUS[s].label }))}
          extraFilters={[{ key: 'category', label: 'Todas las categorías', options: (catalog?.claim_categories || []).map((c) => ({ value: c, label: c })) }]} />
      </>
    )
  }
  return <StudentClaims catalog={catalog} />
}

function StudentClaims({ catalog }) {
  const [form, setForm] = useState({ category: '', description: '', is_anonymous: false })
  const [file, setFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(unwrap((await api.get('/claims/')).data)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async (e) => {
    e.preventDefault()
    setSending(true); setMsg(null)
    try {
      const { data } = await api.post('/claims/', toFormData({ ...form, attached_file: file }))
      setMsg({ type: 'success', text: `Reclamo ${data.folio} registrado. Te notificaremos cada cambio de estado.` })
      setForm({ category: '', description: '', is_anonymous: false }); setFile(null)
      load()
    } catch (err) { setMsg({ type: 'error', text: errorMessage(err) }) } finally { setSending(false) }
  }

  const doCancel = async () => {
    try { await api.post(`/claims/${cancelling.id}/cancel/`, { reason }); setCancelling(null); setReason(''); load() }
    catch (err) { alert(errorMessage(err)) }
  }

  return (
    <>
      <PageHeader icon={MessageSquareWarning} title="Reclamos" subtitle="Expresa formalmente tu disconformidad con un servicio o proceso." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Nuevo reclamo">
          <form onSubmit={submit} className="space-y-4">
            {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}
            <Field label="Categoría" required>
              <select className="input" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Selecciona…</option>
                {(catalog?.claim_categories || []).map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Detalle del reclamo" required hint="¿Qué ocurrió, cuándo y qué solución esperas? (mín. 20 caracteres)">
              <textarea className="input min-h-[150px]" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Respaldo (opcional)"><FileDrop file={file} onChange={setFile} /></Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={form.is_anonymous} onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })} />
              <span>Reservar mi identidad <span className="block text-xs text-slate-500">Quien gestione el reclamo no verá tu nombre; tú podrás seguir su estado.</span></span>
            </label>
            <Button type="submit" loading={sending} disabled={!form.category || form.description.trim().length < 20}><Send size={16} /> Enviar reclamo</Button>
          </form>
        </Card>
        <Card title="Mis reclamos">
          <MyCasesList resource="claims" items={items} loading={loading} renderTitle={(it) => it.category}
            actions={(it) => ['PENDIENTE', 'EN_REVISION'].includes(it.status) && (
              <button className="btn-outline px-3 py-1.5 text-xs text-red-600" onClick={() => setCancelling(it)}><XCircle size={14} /> Anular</button>
            )} />
        </Card>
      </div>
      <Modal open={!!cancelling} onClose={() => setCancelling(null)} title={`Anular ${cancelling?.folio || ''}`} size="md"
             footer={<><button className="btn-outline" onClick={() => setCancelling(null)}>Volver</button>
               <Button variant="danger" disabled={reason.trim().length < 10} onClick={doCancel}>Anular</Button></>}>
        <textarea className="input min-h-[100px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (mín. 10 caracteres)" />
      </Modal>
    </>
  )
}
