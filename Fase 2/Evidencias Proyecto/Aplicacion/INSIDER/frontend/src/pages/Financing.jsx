import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, CreditCard, Loader2, Search, Wallet } from 'lucide-react'
import api, { errorMessage, unwrap } from '../api/client'
import { Alert, Button, Card, EmptyState, Modal, PageHeader, Pagination, Spinner, StatCard, StatusBadge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { clp, fmtDate } from '../utils/constants'

export default function Financing() {
  const { hasPerm } = useAuth()
  const finance = hasPerm('financing.manage')
  const [summary, setSummary] = useState(null)
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(null)
  const [step, setStep] = useState('confirm')
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, ...(filters.search && { search: filters.search }), ...(filters.status && { status: filters.status }) }
      const [s, list] = await Promise.all([api.get('/financing/summary/', { params }), api.get('/financing/', { params })])
      setSummary(s.data); setRows(unwrap(list.data)); setCount(list.data.count ?? 0)
    } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) }
  }, [page, filters])
  useEffect(() => { load() }, [load])

  const pay = async () => {
    setStep('processing')
    await new Promise((r) => setTimeout(r, 1500)) // simulación de pasarela
    try {
      const { data } = await api.post(`/financing/${paying.id}/pay/`)
      setReceipt(data); setStep('done'); load()
    } catch (err) { setError(errorMessage(err)); setPaying(null) }
  }
  const closePay = () => { setPaying(null); setStep('confirm'); setReceipt(null) }

  return (
    <>
      <PageHeader icon={CreditCard} title={finance ? 'Gestión de financiamiento' : 'Financiamiento'}
                  subtitle={finance ? 'Mensualidades y estados de pago de estudiantes.' : 'Tus mensualidades, cuotas y pagos.'} />
      {error && <div className="mb-4"><Alert type="error" onClose={() => setError('')}>{error}</Alert></div>}

      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total arancel" value={clp(summary.total)} icon={Wallet} />
          <StatCard label="Pagado" value={clp(summary.paid.amount)} hint={`${summary.paid.count} cuotas`} icon={CheckCircle2} tone="green" />
          <StatCard label="Pendiente" value={clp(summary.pending.amount)} hint={`${summary.pending.count} cuotas`} icon={CreditCard} tone="yellow" />
          <StatCard label="Vencido" value={clp(summary.overdue.amount)} hint={`${summary.overdue.count} cuotas`} icon={CreditCard} tone="red" />
        </div>
      )}

      {!finance && summary?.next_due && (
        <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl bg-duoc-blue p-5 text-white sm:flex-row sm:items-center">
          <div>
            <p className="text-xs uppercase tracking-wide text-duoc-yellow">Próximo vencimiento</p>
            <p className="text-xl font-bold">{clp(summary.next_due.amount)} · {summary.next_due.concept} {summary.next_due.payment_period}</p>
            <p className="text-sm text-white/70">Vence el {fmtDate(summary.next_due.due_date)}</p>
          </div>
          <button className="btn-accent" onClick={() => setPaying(summary.next_due)}>Pagar ahora</button>
        </div>
      )}

      <Card title={finance ? 'Cartera de mensualidades' : 'Cuadro de mensualidades'} bodyClass="p-0"
            actions={finance && (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); load() }}>
                <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input className="input w-56 pl-9" placeholder="RUT, correo o nombre" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
                </div>
                <select className="input w-36" value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }) }}>
                  <option value="">Todos</option><option value="PENDIENTE">Pendiente</option><option value="VENCIDO">Vencido</option><option value="PAGADO">Pagado</option>
                </select>
              </form>
            )}>
        {loading ? <Spinner /> : !rows.length ? <EmptyState icon={Wallet} title="Sin registros de financiamiento" /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50"><tr>
                {finance && <th className="table-th">Estudiante</th>}
                <th className="table-th">Cuota</th><th className="table-th">Periodo</th><th className="table-th">Concepto</th>
                <th className="table-th">Vencimiento</th><th className="table-th text-right">Monto</th><th className="table-th">Estado</th><th className="table-th" />
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    {finance && <td className="table-td"><span className="block font-medium">{r.student_name}</span><span className="text-xs text-slate-500">{r.student_email}</span></td>}
                    <td className="table-td">#{r.installment}</td>
                    <td className="table-td">{r.payment_period}</td>
                    <td className="table-td">{r.concept}</td>
                    <td className="table-td">{fmtDate(r.due_date)}</td>
                    <td className="table-td text-right font-semibold">{clp(r.amount)}</td>
                    <td className="table-td"><StatusBadge status={r.status} /></td>
                    <td className="table-td text-right">
                      {r.status !== 'PAGADO'
                        ? <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => setPaying(r)}>{finance ? 'Registrar pago' : 'Pagar'}</button>
                        : <span className="text-xs text-slate-400">{r.transaction_id}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} count={count} onChange={setPage} />
      </Card>

      <Modal open={!!paying} onClose={step === 'processing' ? undefined : closePay} title="Pago de cuota (simulación)" size="md"
             footer={step === 'confirm' ? (<><button className="btn-outline" onClick={closePay}>Cancelar</button><Button onClick={pay}>Confirmar pago {paying && clp(paying.amount)}</Button></>)
               : step === 'done' ? <button className="btn-primary" onClick={closePay}>Listo</button> : null}>
        {step === 'confirm' && paying && (
          <div className="space-y-3 text-sm">
            <p>Estás por pagar la cuota <strong>#{paying.installment}</strong> del periodo <strong>{paying.payment_period}</strong>.</p>
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="text-xs uppercase text-slate-500">Monto a pagar</p>
              <p className="text-3xl font-bold text-duoc-blue">{clp(paying.amount)}</p>
            </div>
            <Alert type="warning">Entorno de prueba: no se realizará ningún cargo real.</Alert>
          </div>
        )}
        {step === 'processing' && (
          <div className="flex flex-col items-center gap-3 py-8 text-duoc-blue"><Loader2 className="animate-spin" size={36} /> Procesando con la pasarela…</div>
        )}
        {step === 'done' && receipt && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="text-emerald-500" size={48} />
            <p className="text-lg font-semibold text-duoc-blue">¡Pago aprobado!</p>
            <p className="text-sm text-slate-600">Comprobante: <strong>{receipt.transaction_id}</strong></p>
            <p className="text-xs text-slate-400">{fmtDate(receipt.paid_at, true)}</p>
          </div>
        )}
      </Modal>
    </>
  )
}
