import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Award, BarChart3, ChevronDown, CreditCard, FileText, HelpCircle, Home, LogOut, Menu, MessageSquareWarning,
  ShieldAlert, User, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'
import AccessibilityControls from './AccessibilityControls'

export const NAV = [
  { to: '/inicio', label: 'Inicio', icon: Home },
  { to: '/solicitudes', label: 'Solicitudes', icon: FileText, perms: ['requests.create', 'requests.manage', 'requests.view_all'] },
  { to: '/financiamiento', label: 'Financiamiento', icon: CreditCard, perms: ['financing.view_own', 'financing.manage'] },
  { to: '/denuncias', label: 'Denuncias', icon: ShieldAlert, perms: ['complaints.create', 'complaints.manage'] },
  { to: '/reclamos', label: 'Reclamos', icon: MessageSquareWarning, perms: ['claims.create', 'claims.manage', 'claims.view_all'] },
  { to: '/felicitaciones', label: 'Felicitaciones', icon: Award, perms: ['compliments.create', 'compliments.view'] },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/ayuda', label: 'Ayuda', icon: HelpCircle, hideFor: ['DIRECCION', 'FINANZAS', 'ABOGADO', 'COORDINADOR'] },
  { to: '/cuenta', label: 'Mi cuenta', icon: User },
]

export default function Layout() {
  const { user, logout, hasPerm } = useAuth()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const navigate = useNavigate()
  const items = NAV.filter((n) => (!n.perms || hasPerm(...n.perms)) && !n.hideFor?.includes(user?.role))
  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}` || 'U'

  const doLogout = async () => { await logout(); navigate('/login') }

  const Nav = (
    <nav className="flex flex-col gap-1">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive ? 'bg-duoc-yellow text-duoc-blue shadow' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>
          <Icon size={18} /> {label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-duoc-blue p-4 lg:flex">
        <div className="mb-8 px-2 pt-2"><Logo light /></div>
        {Nav}
        <div className="mt-auto rounded-xl bg-white/5 p-3 text-xs text-white/60">
          <p className="font-semibold text-duoc-yellow">{user?.role_label}</p>
          <p className="truncate">{user?.campus || 'Duoc UC'}</p>
        </div>
      </aside>

      {/* Sidebar móvil */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-duoc-blue p-4">
            <div className="mb-6 flex items-center justify-between">
              <Logo light />
              <button className="text-white" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X /></button>
            </div>
            {Nav}
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 dark-mode:border-slate-700 bg-white/90 dark-mode:bg-slate-800/90 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <button className="rounded-lg p-2 text-duoc-blue dark-mode:text-white lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu /></button>
          <div className="lg:hidden"><Logo compact /></div>
          <span className="hidden rounded-full bg-duoc-blue-50 px-3 py-1 text-xs font-semibold text-duoc-blue sm:inline">
            {user?.role_label}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* AQUÍ VAN LOS CONTROLES DE MODO OSCURO Y TAMAÑO DE TEXTO */}
          <AccessibilityControls />

          {/* Menú de Usuario */}
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-100 dark-mode:hover:bg-slate-700">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-duoc-blue text-sm font-bold text-duoc-yellow">{initials}</span>
              <span className="hidden text-left text-sm sm:block">
                <span className="block font-semibold text-duoc-blue dark-mode:text-white">{user?.full_name}</span>
                <span className="block text-xs text-slate-500 dark-mode:text-slate-400">{user?.email}</span>
              </span>
              <ChevronDown size={16} className="text-slate-400" />
            </button>
            {menu && (
              <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border bg-white dark-mode:bg-slate-800 dark-mode:border-slate-700 shadow-lg" onMouseLeave={() => setMenu(false)}>
                <button className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50 dark-mode:hover:bg-slate-700" onClick={() => { setMenu(false); navigate('/cuenta') }}>
                  <User size={16} /> Mi cuenta
                </button>
                <button className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark-mode:hover:bg-slate-700" onClick={doLogout}>
                  <LogOut size={16} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
    </div>
  )
}