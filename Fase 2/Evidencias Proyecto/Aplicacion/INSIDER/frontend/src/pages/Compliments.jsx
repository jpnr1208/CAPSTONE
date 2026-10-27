import { useCallback, useEffect, useState } from 'react'
import { Award, Heart, Send, Trophy } from 'lucide-react'
import api, { errorMessage, unwrap } from '../api/client'
import { Alert, Button, Card, EmptyState, Field, PageHeader, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../utils/constants'

const ROLES = ['Docente', 'Coordinador/a', 'Administrativo/a', 'Biblioteca', 'Bienestar Estudiantil', 'Soporte TI', 'Otro']

export default function Compliments() {
  const { hasPerm } = useAuth()
  const canCreate = hasPerm('compliments.create')
  const canView = hasPerm('compliments.view')
  const [form, setForm] = useState({ staff_name: '', staff_role: 'Docente', message: '' })
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState(null)
  const [items, setItems] = useState([])
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(unwrap((await api.get('/compliments/')).data))
      if (canView) setRanking((await api.get('/compliments/ranking/')).data)
    } finally { setLoading(false) }
  }, [canView])
  useEffect(() => { load() }, [load])

  const submit = async (e) => {
    e.preventDefault(); setSending(true); setMsg(null)
    try {
      await api.post('/compliments/', form)
      setMsg({ type: 'success', text: `¡Gracias! Tu reconocimiento a ${form.staff_name} fue registrado.` })
      setForm({ staff_name: '', staff_role: 'Docente', message: '' })
      load()
    } catch (err) { setMsg({ type: 'error', text: errorMessage(err) }) } finally { setSending(false) }
  }

  return (
    <>
      <PageHeader icon={Award} title="Felicitaciones" subtitle="Reconoce formalmente el trabajo de docentes y funcionarios." />
      <div className="grid gap-6 lg:grid-cols-5">
        {canCreate && (
          <Card className="lg:col-span-2" title="Enviar reconocimiento">
            <form onSubmit={submit} className="space-y-4">
              {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}
              <Field label="Nombre del funcionario/a o docente" required>
                <input className="input" required value={form.staff_name} onChange={(e) => setForm({ ...form, staff_name: e.target.value })} />
              </Field>
              <Field label="Cargo / área">
                <select className="input" value={form.staff_role} onChange={(e) => setForm({ ...form, staff_role: e.target.value })}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Mensaje" required hint="Cuéntanos qué hizo destacar a esta persona.">
                <textarea className="input min-h-[130px]" required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </Field>
              <Button type="submit" variant="accent" loading={sending} disabled={!form.staff_name || form.message.trim().length < 10}>
                <Send size={16} /> Enviar felicitación
              </Button>
            </form>
          </Card>
        )}
        <div className={`space-y-6 ${canCreate ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
          {canView && ranking.length > 0 && (
            <Card title={<span className="flex items-center gap-2"><Trophy size={18} className="text-duoc-yellow" /> Más reconocidos</span>}>
              <ol className="grid gap-2 sm:grid-cols-2">
                {ranking.map((r, i) => (
                  <li key={r.staff_name} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span><strong className="mr-2 text-duoc-blue">#{i + 1}</strong>{r.staff_name}</span>
                    <span className="rounded-full bg-duoc-yellow px-2 text-xs font-bold text-duoc-blue">{r.total}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          <Card title={canView ? 'Reconocimientos recibidos' : 'Mis felicitaciones enviadas'}>
            {loading ? <Spinner /> : !items.length ? <EmptyState icon={Heart} title="Sin felicitaciones aún" /> : (
              <ul className="space-y-3">
                {items.map((c) => (
                  <li key={c.id} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-duoc-blue">{c.staff_name} <span className="text-xs font-normal text-slate-500">· {c.staff_role}</span></p>
                      <time className="text-xs text-slate-400">{fmtDate(c.created_at)}</time>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">“{c.message}”</p>
                    {canView && <p className="mt-1 text-xs text-slate-400">Enviado por {c.sender_name}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
