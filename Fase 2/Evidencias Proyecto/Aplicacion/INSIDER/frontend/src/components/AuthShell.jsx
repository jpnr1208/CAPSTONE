import { ShieldCheck, Sparkles, Workflow } from 'lucide-react'
import Logo from './Logo'

/** Contenedor visual de las pantallas de acceso y recuperación. */
export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-duoc-blue p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-duoc-yellow/10" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" />
        <Logo light />
        <div className="relative space-y-6">
          <h2 className="text-4xl font-extrabold leading-tight text-white">
            Una sola plataforma para <span className="text-duoc-yellow">todas tus soluciones</span>.
          </h2>
          <ul className="space-y-3 text-sm text-white/80">
            <li className="flex gap-3"><Workflow className="text-duoc-yellow" size={20} /> Solicitudes, reclamos, denuncias y financiamiento unificados.</li>
            <li className="flex gap-3"><Sparkles className="text-duoc-yellow" size={20} /> Asistente IA que sugiere respuestas y acelera tus trámites.</li>
            <li className="flex gap-3"><ShieldCheck className="text-duoc-yellow" size={20} /> Canal confidencial y trazabilidad completa.</li>
          </ul>
        </div>
        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Duoc UC · Sistema de Soluciones INSIDER</p>
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  )
}
