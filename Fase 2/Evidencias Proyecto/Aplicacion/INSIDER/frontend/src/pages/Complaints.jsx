import { useCallback, useEffect, useState } from 'react'
import { Copy, EyeOff, Lock, Search, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'
import api, { errorMessage, toFormData, unwrap } from '../api/client'
import CaseInbox from '../components/CaseInbox'
import MyCasesList from '../components/MyCasesList'
import Timeline from '../components/Timeline'
import { Alert, Button, Card, Field, FileDrop, Modal, PageHeader, StatusBadge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { STATUS } from '../utils/constants'

const C_STATUSES = ['RECIBIDA', 'EN_INVESTIGACION', 'EN_DICTAMEN', 'CERRADA', 'ANULADA']

export default function Complaints() {
  const { hasPerm } = useAuth()
  if (hasPerm('complaints.manage')) {
    return (
      <>
        <PageHeader icon={ShieldAlert} title="Denuncias confidenciales" subtitle="Gestión exclusiva del Área Legal: investigación, reuniones y dictamen." />
        <CaseInbox resource="complaints" title="Bandeja legal" legal manage
          statuses={C_STATUSES.map((s) => ({ value: s, label: STATUS[s].label }))}
          statusOptions={['EN_INVESTIGACION', 'EN_DICTAMEN'].map((s) => ({ value: s, label: STATUS[s].label }))}
          extraFilters={[{ key: 'is_anonymous', label: 'Anónimas y confidenciales', options: [{ value: 'true', label: 'Solo anónimas' }, { value: 'false', label: 'Solo identificadas' }] }]} />
      </>
    )
  }
  return <StudentComplaints />
}

function StudentComplaints() {
  const [form, setForm] = useState({ target_name: '', description: '', is_anonymous: false })
  const [file, setFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(null)
  const [reason, setReason] = useState('')
  const [track, setTrack] = useState({ folio: '', tracking_code: '' })
  const [tracked, setTracked] = useState(null)
  const [trackErr, setTrackErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(unwrap((await api.get('/complaints/')).data)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async (e) => {
    e.preventDefault()
    setSending(true); setError('')
    try {
      const { data } = await api.post('/complaints/', toFormData({ ...form, evidence_file: file }))
      setCreated(data)
      setForm({ target_name: '', description: '', is_anonymous: false }); setFile(null)
      load()
    } catch (err) { setError(errorMessage(err)) } finally { setSending(false) }
  }

  const doTrack = async (e) => {
    e.preventDefault(); setTrackErr(''); setTracked(null)
    try { setTracked((await api.post('/complaints/track/', track)).data) } catch (err) { setTrackErr(errorMessage(err)) }
  }

  const doCancel = async () => {
    try {
      if (cancelling.anonymous) {
        await api.post('/complaints/track/cancel/', { ...track, reason })
        setTracked(null)
      } else {
        await api.post(`/complaints/${cancelling.id}/cancel/`, { reason })
        load()
      }
      setCancelling(null); setReason('')
    } catch (err) { alert(errorMessage(err)) }
  }

  return (
    <>
      <PageHeader icon={ShieldAlert} title="Canal de denuncias" subtitle="Informa conductas graves de forma confidencial o completamente anónima." />
      <div className="mb-6"><Alert type="info">
        Tu denuncia es recibida exclusivamente por el <strong>Área Legal</strong>. En modo <strong>anónimo</strong> no se almacena tu identidad ni tu dirección IP.
      </Alert></div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Registrar denuncia">
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert type="error">{error}</Alert>}
            <div className="grid gap-2 sm:grid-cols-2">
              {[[false, ShieldCheck, 'Confidencial', 'Tu identidad solo la conoce el Área Legal. Podrás hacer seguimiento desde tu cuenta.'],
                [true, EyeOff, 'Anónima', 'No guardamos tu identidad. Recibirás un folio y código de seguimiento.']].map(([val, Icon, t, d]) => (
                <button type="button" key={t} onClick={() => setForm({ ...form, is_anonymous: val })}
                        className={`rounded-xl border p-4 text-left transition ${form.is_anonymous === val ? 'border-duoc-blue bg-duoc-blue-50 ring-2 ring-duoc-blue/20' : 'border-slate-200'}`}>
                  <p className="flex items-center gap-2 font-semibold text-duoc-blue"><Icon size={18} /> {t}</p>
                  <p className="mt-1 text-xs text-slate-500">{d}</p>
                </button>
              ))}
            </div>
            <Field label="Persona o área denunciada" required>
              <input className="input" required maxLength={200} value={form.target_name} onChange={(e) => setForm({ ...form, target_name: e.target.value })} />
            </Field>
            <Field label="Relato de los hechos" required hint="Indica fechas, lugares y testigos si los hay (mín. 30 caracteres).">
              <textarea className="input min-h-[160px]" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Evidencias (opcional)"><FileDrop file={file} onChange={setFile} label="Adjuntar evidencia" /></Field>
            <Button type="submit" loading={sending} disabled={form.description.trim().length < 30 || !form.target_name.trim()}>
              <Lock size={16} /> Enviar denuncia
            </Button>
          </form>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Seguir denuncia anónima">
            <form onSubmit={doTrack} className="space-y-3">
              <input className="input" placeholder="Folio (DEN-…)" value={track.folio} onChange={(e) => setTrack({ ...track, folio: e.target.value })} />
              <input className="input" placeholder="Código de seguimiento" value={track.tracking_code} onChange={(e) => setTrack({ ...track, tracking_code: e.target.value })} />
              <Button variant="outline" type="submit" className="w-full"><Search size={16} /> Consultar</Button>
              {trackErr && <Alert type="error">{trackErr}</Alert>}
            </form>
            {tracked && (
              <div className="mt-4 space-y-3">
                <p className="flex items-center gap-2 font-semibold text-duoc-blue">{tracked.complaint.folio} <StatusBadge status={tracked.complaint.status} /></p>
                <Timeline events={tracked.events} />
                {!['CERRADA', 'ANULADA'].includes(tracked.complaint.status) && (
                  <button className="btn-outline w-full text-red-600" onClick={() => setCancelling({ ...tracked.complaint, anonymous: true })}>
                    <XCircle size={16} /> Anular denuncia
                  </button>
                )}
              </div>
            )}
          </Card>
          <Card title="Mis denuncias confidenciales">
            <MyCasesList resource="complaints" items={items} loading={loading} renderTitle={(it) => `Respecto a: ${it.target_name}`}
              actions={(it) => !['CERRADA', 'ANULADA'].includes(it.status) && (
                <button className="btn-outline px-3 py-1.5 text-xs text-red-600" onClick={() => setCancelling(it)}><XCircle size={14} /> Anular</button>
              )} />
          </Card>
        </div>
      </div>

      <Modal open={!!created} onClose={() => setCreated(null)} title="Denuncia recibida" size="md"
             footer={<button className="btn-primary" onClick={() => setCreated(null)}>Entendido</button>}>
        <p className="text-sm">Tu denuncia fue registrada con folio <strong>{created?.folio}</strong> y notificada al Área Legal.</p>
        {created?.tracking_code && (
          <div className="mt-4 rounded-xl border-2 border-duoc-yellow bg-amber-50 p-4">
            <p className="text-sm font-semibold text-duoc-blue">Código de seguimiento</p>
            <p className="my-2 font-mono text-2xl font-bold tracking-widest">{created.tracking_code}</p>
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => navigator.clipboard?.writeText(`${created.folio} / ${created.tracking_code}`)}>
              <Copy size={14} /> Copiar folio y código
            </button>
            <p className="mt-2 text-xs text-amber-800">{created.notice}</p>
          </div>
        )}
      </Modal>

      <Modal open={!!cancelling} onClose={() => setCancelling(null)} title={`Anular denuncia ${cancelling?.folio || ''}`} size="md"
             footer={<>
               <button className="btn-outline" onClick={() => setCancelling(null)}>Volver</button>
               <Button variant="danger" disabled={reason.trim().length < 10} onClick={doCancel}>Anular</Button>
             </>}>
        <p className="mb-3 text-sm text-slate-600">La anulación debe ser fundamentada y quedará registrada en el expediente.</p>
        <textarea className="input min-h-[100px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Fundamento (mín. 10 caracteres)" />
      </Modal>
    </>
  )
}
