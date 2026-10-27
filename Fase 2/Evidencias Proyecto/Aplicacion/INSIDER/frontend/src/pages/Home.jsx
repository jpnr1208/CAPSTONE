import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Award, BarChart3, CreditCard, FileText, HelpCircle, MessageSquareWarning, ShieldAlert } from 'lucide-react'
import api from '../api/client'
import { Card, EmptyState, PriorityBadge, Spinner, StatusBadge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../utils/constants'

const SHORTCUTS = [
  { to: '/solicitudes', label: 'Nueva solicitud', desc: 'Trámites académicos y administrativos', icon: FileText, perms: ['requests.create'] },
  { to: '/solicitudes', label: 'Bandeja de solicitudes', desc: 'Gestiona y resuelve con IA', icon: FileText, perms: ['requests.manage', 'requests.view_all'] },
  { to: '/financiamiento', label: 'Financiamiento', desc: 'Mensualidades y pagos', icon: CreditCard, perms: ['financing.view_own', 'financing.manage'] },
  { to: '/denuncias', label: 'Denuncias', desc: 'Canal confidencial', icon: ShieldAlert, perms: ['complaints.create', 'complaints.manage'] },
  { to: '/reclamos', label: 'Reclamos', desc: 'Disconformidad formal', icon: MessageSquareWarning, perms: ['claims.create', 'claims.manage'] },
  { to: '/felicitaciones', label: 'Felicitaciones', desc: 'Reconoce a tu equipo', icon: Award, perms: ['compliments.create', 'compliments.view'] },
  { to: '/dashboard', label: 'Dashboard', desc: 'Métricas e indicadores', icon: BarChart3 },
  { to: '/ayuda', label: 'Ayuda', desc: 'Preguntas frecuentes', icon: HelpCircle },
]

export default function Home() {
  const { user, hasPerm } = useAuth()
  const [data, setData] = useState(null)

  useEffect(() => { api.get('/dashboard/home/').then(({ data }) => setData(data)).catch(() => setData({ recent: [], in_process: 0 })) }, [])

  const staff = hasPerm('requests.manage', 'requests.view_all')
  const shortcuts = SHORTCUTS.filter((s) => !s.perms || hasPerm(...s.perms))

  return (
    <>
      <section className="relative mb-8 overflow-hidden rounded-3xl bg-duoc-blue p-6 text-white sm:p-10">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-duoc-yellow/20" />
        <div className="absolute bottom-0 right-24 h-24 w-24 rounded-full bg-white/5" />
        <p className="text-sm text-duoc-yellow">{new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="mt-1 text-3xl font-extrabold text-white sm:text-4xl">Hola {user?.first_name || 'Usuario'},</h1>
        <p className="mt-2 text-lg text-white/85">
          {data ? <>tienes <strong className="text-duoc-yellow">{data.in_process}</strong> solicitud{data.in_process === 1 ? '' : 'es'} en proceso{staff ? ' en la bandeja' : ''}.</> : 'cargando tu resumen…'}
        </p>
        {data?.pending_payments > 0 && (
          <Link to="/financiamiento" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20">
            <CreditCard size={16} /> {data.pending_payments} cuota(s) por pagar <ArrowRight size={14} />
          </Link>
        )}
      </section>

      <h2 className="mb-3 text-lg font-semibold">Accesos directos</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {shortcuts.map(({ to, label, desc, icon: Icon }) => (
          <Link key={label} to={to} className="card group p-4 transition hover:-translate-y-0.5 hover:border-duoc-yellow">
            <div className="mb-3 inline-flex rounded-xl bg-duoc-blue-50 p-2.5 text-duoc-blue group-hover:bg-duoc-yellow"><Icon size={20} /></div>
            <p className="font-semibold text-duoc-blue">{label}</p>
            <p className="text-xs text-slate-500">{desc}</p>
          </Link>
        ))}
      </div>

      <Card title={staff ? 'Solicitudes recientes (institucional)' : 'Mis solicitudes recientes'}
            actions={<Link to="/solicitudes" className="text-sm font-semibold text-duoc-blue hover:underline">Ver todas</Link>} bodyClass="p-0">
        {!data ? <Spinner /> : !data.recent.length ? (
          <EmptyState icon={FileText} title="Sin solicitudes recientes" action={hasPerm('requests.create') && <Link to="/solicitudes" className="btn-primary">Crear solicitud</Link>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.recent.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-duoc-blue">{r.folio} <span className="font-normal text-slate-500">· {r.service}</span></p>
                  <p className="text-xs text-slate-400">{fmtDate(r.created_at, true)}{staff && ` · ${r.user_name}`}</p>
                </div>
                <div className="flex items-center gap-2"><PriorityBadge priority={r.priority} /><StatusBadge status={r.status} /></div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
