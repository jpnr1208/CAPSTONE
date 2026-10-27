import { useEffect, useState } from 'react'
import {
  Activity, AlertTriangle, Award, BarChart3, CalendarClock, CheckCircle2, Clock, CreditCard, FileText, ShieldAlert,
  ShieldCheck, Timer, Users, Wallet,
} from 'lucide-react'
import api, { errorMessage } from '../api/client'
import { Alert, Card, PageHeader, Spinner, StatCard } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { clp, fmtDate } from '../utils/constants'
import AdminPanels from './dashboard/AdminPanels'
import { BarBlock, LineBlock, PieBlock } from './dashboard/charts'

const pct = (v) => (v == null ? '—' : `${v}%`)
const hrs = (v) => (v == null ? '—' : `${v} h`)

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { api.get('/dashboard/').then(({ data }) => setData(data)).catch((e) => setError(errorMessage(e))) }, [])

  return (
    <>
      <PageHeader icon={BarChart3} title="Dashboard" subtitle={`Indicadores para ${user?.role_label}`}
                  actions={data && <span className="text-xs text-slate-400">Actualizado {fmtDate(data.generated_at, true)}</span>} />
      {error && <Alert type="error">{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && VIEWS[data.role] ? VIEWS[data.role](data) : null}
      {data?.role === 'ADMIN_TI' && <AdminPanels />}
    </>
  )
}

function Grid({ children, cols = 'lg:grid-cols-4' }) {
  return <div className={`mb-6 grid gap-4 sm:grid-cols-2 ${cols}`}>{children}</div>
}

function SLAStrip({ sla }) {
  return (
    <Grid>
      <StatCard label="SLA objetivo" value={`${sla.sla_hours} h`} icon={Timer} />
      <StatCard label="Cumplimiento SLA" value={pct(sla.compliance_pct)} icon={CheckCircle2} tone="green" hint={`${sla.closed} casos cerrados`} />
      <StatCard label="Tiempo prom. resolución" value={hrs(sla.avg_resolution_hours)} icon={Clock} tone="yellow" />
      <StatCard label="Abiertos fuera de SLA" value={sla.open_breached} icon={AlertTriangle} tone="red" />
    </Grid>
  )
}

const VIEWS = {
  ESTUDIANTE: (d) => (
    <>
      <Grid>
        <StatCard label="Solicitudes en proceso" value={d.requests.open} icon={FileText} />
        <StatCard label="Solicitudes totales" value={d.requests.total} icon={Activity} tone="green" />
        <StatCard label="Saldo pendiente" value={clp(d.financing.pending)} icon={Wallet} tone="yellow" />
        <StatCard label="Cuotas vencidas" value={d.financing.overdue} icon={CreditCard} tone="red" />
      </Grid>
      <div className="grid gap-6 lg:grid-cols-2">
        <PieBlock title="Mis solicitudes por estado" data={d.requests.by_status} />
        <BarBlock title="Mis solicitudes por área" data={d.requests.by_category} />
      </div>
      <Grid cols="lg:grid-cols-3">
        <StatCard label="Reclamos" value={d.claims} icon={ShieldAlert} />
        <StatCard label="Denuncias confidenciales" value={d.complaints} icon={ShieldCheck} />
        <StatCard label="Felicitaciones enviadas" value={d.compliments} icon={Award} tone="yellow" />
      </Grid>
    </>
  ),
  COORDINADOR: (d) => (
    <>
      <Grid>
        <StatCard label="Solicitudes abiertas" value={d.requests.open} icon={FileText} />
        <StatCard label="Asignadas a mí" value={d.assigned_to_me} icon={Users} tone="yellow" />
        <StatCard label="Reclamos abiertos" value={d.claims.open} icon={ShieldAlert} tone="red" />
        <StatCard label="Total solicitudes" value={d.requests.total} icon={Activity} tone="green" />
      </Grid>
      <SLAStrip sla={d.requests.sla} />
      <div className="grid gap-6 lg:grid-cols-2">
        <LineBlock title="Tendencia mensual" series={[{ name: 'Solicitudes', data: d.requests.monthly }, { name: 'Reclamos', data: d.claims.monthly }]} />
        <PieBlock title="Solicitudes por estado" data={d.requests.by_status} />
        <BarBlock title="Servicios más solicitados" data={d.by_service} horizontal />
        <PieBlock title="Pendientes por prioridad" data={d.by_priority} />
      </div>
    </>
  ),
  ABOGADO: (d) => (
    <>
      <Grid>
        <StatCard label="Denuncias totales" value={d.complaints.total} icon={ShieldAlert} />
        <StatCard label="En curso" value={d.complaints.open} icon={Activity} tone="yellow" />
        <StatCard label="% anónimas" value={pct(d.anonymous_pct)} icon={ShieldCheck} tone="green" />
        <StatCard label="Fuera de SLA" value={d.complaints.sla.open_breached} icon={AlertTriangle} tone="red" />
      </Grid>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><LineBlock title="Denuncias por mes" series={[{ name: 'Denuncias', data: d.complaints.monthly }]} /></div>
        <Card title={<span className="flex items-center gap-2"><CalendarClock size={18} /> Próximas reuniones</span>}>
          {!d.upcoming_meetings.length ? <p className="text-sm text-slate-500">Sin reuniones agendadas.</p> : (
            <ul className="space-y-2 text-sm">{d.upcoming_meetings.map((m, i) => (
              <li key={i} className="rounded-lg bg-slate-50 p-2"><strong className="text-duoc-blue">{m.folio}</strong><br />
                {fmtDate(m.meetings__scheduled_at, true)} · {m.meetings__location || 'Por definir'}</li>))}
            </ul>
          )}
        </Card>
        <PieBlock title="Denuncias por estado" data={d.complaints.by_status} />
      </div>
    </>
  ),
  DIRECCION: (d) => (
    <>
      <Grid>
        <StatCard label="Solicitudes" value={d.requests.total} icon={FileText} hint={`${d.requests.open} abiertas`} />
        <StatCard label="Reclamos" value={d.claims.total} icon={ShieldAlert} tone="yellow" hint={`${d.claims.open} abiertos`} />
        <StatCard label="Denuncias" value={d.complaints.total} icon={ShieldCheck} tone="red" />
        <StatCard label="Felicitaciones" value={d.compliments.total} icon={Award} tone="green" />
      </Grid>
      <h3 className="mb-3 font-semibold">Métricas SLA · Solicitudes</h3>
      <SLAStrip sla={d.requests.sla} />
      <div className="grid gap-6 lg:grid-cols-2">
        <LineBlock title="Volumen mensual institucional" series={[
          { name: 'Solicitudes', data: d.requests.monthly }, { name: 'Reclamos', data: d.claims.monthly }, { name: 'Denuncias', data: d.complaints.monthly }]} />
        <BarBlock title="Solicitudes por sede" data={d.by_campus} />
        <PieBlock title="Solicitudes por área" data={d.requests.by_category} />
        <BarBlock title="Funcionarios más reconocidos" data={d.compliments.top_staff} horizontal color="#FFC72C" />
      </div>
      <p className="mt-4 text-xs text-slate-400">Las denuncias se muestran solo en forma agregada para resguardar la confidencialidad.</p>
    </>
  ),
  ADMIN_TI: (d) => (
    <>
      <Grid>
        <StatCard label="Inicios de sesión (7d)" value={d.logins_7d} icon={Activity} tone="green" />
        <StatCard label="Accesos fallidos (7d)" value={d.failed_logins_7d} icon={AlertTriangle} tone="red" />
        <StatCard label="Usuarios" value={d.users_by_role.reduce((a, b) => a + b.total, 0)} icon={Users} />
        <StatCard label="Eventos auditados (7d)" value={d.actions_7d.reduce((a, b) => a + b.total, 0)} icon={ShieldCheck} tone="yellow" />
      </Grid>
      <div className="grid gap-6 lg:grid-cols-2">
        <PieBlock title="Usuarios por rol" data={d.users_by_role} />
        <BarBlock title="Acciones más frecuentes (7 días)" data={d.actions_7d} horizontal />
      </div>
    </>
  ),
  FINANZAS: (d) => {
    const s = Object.fromEntries(d.financing.by_status.map((r) => [r.key, r]))
    return (
      <>
        <Grid>
          <StatCard label="Cartera total" value={clp(d.financing.total)} icon={Wallet} />
          <StatCard label="Recaudado" value={clp(s.PAGADO?.amount)} icon={CheckCircle2} tone="green" hint={`${s.PAGADO?.total || 0} cuotas`} />
          <StatCard label="Por cobrar" value={clp(s.PENDIENTE?.amount)} icon={CreditCard} tone="yellow" />
          <StatCard label="Vencido" value={clp(s.VENCIDO?.amount)} icon={AlertTriangle} tone="red" hint={`${d.financing.debtors} estudiante(s)`} />
        </Grid>
        <div className="grid gap-6 lg:grid-cols-2">
          <BarBlock title="Monto por periodo" data={d.financing.by_period} dataKey="amount" fmt={(v) => clp(v)} />
          <PieBlock title="Cuotas por estado" data={d.financing.by_status} />
        </div>
      </>
    )
  },
}
