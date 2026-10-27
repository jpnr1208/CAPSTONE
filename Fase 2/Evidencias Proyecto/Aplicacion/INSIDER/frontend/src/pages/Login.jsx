import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Mail, Lock } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import { Alert, Button, Field } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../api/client'

const DEMO = ['estudiante', 'coordinador', 'abogado', 'direccion', 'admin', 'finanzas']

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email.trim().toLowerCase(), form.password)
      navigate(location.state?.from?.pathname || '/inicio', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'No fue posible iniciar sesión.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Acceso institucional" subtitle="Ingresa con tu correo @duocuc.cl">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        <Field label="Correo institucional" required>
          <div className="relative">
            <Mail size={18} className="absolute left-3 top-3 text-slate-400" />
            <input className="input pl-10" type="email" autoComplete="username" required placeholder="nombre@duocuc.cl"
                   value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </Field>
        <Field label="Contraseña" required>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-3 text-slate-400" />
            <input className="input px-10" type={show ? 'text' : 'password'} autoComplete="current-password" required
                   value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" className="absolute right-3 top-2.5 text-slate-400" onClick={() => setShow(!show)}
                    aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>
        <div className="flex justify-end">
          <Link to="/recuperar-password" className="text-sm font-medium text-duoc-blue hover:underline">¿Olvidaste tu contraseña?</Link>
        </div>
        <Button type="submit" loading={loading} className="w-full py-3"><LogIn size={18} /> Ingresar</Button>
      </form>

      {import.meta.env.DEV && (
        <details className="mt-8 rounded-xl border border-dashed border-slate-300 p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-duoc-blue">Credenciales de prueba (desarrollo)</summary>
          <p className="mt-2 text-xs text-slate-500">Contraseña: <code>insiderduoc2026</code></p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DEMO.map((u) => (
              <button key={u} type="button" className="btn-outline px-2 py-1.5 text-xs"
                      onClick={() => setForm({ email: `${u}@duocuc.cl`, password: 'insiderduoc2026' })}>
                {u}
              </button>
            ))}
          </div>
        </details>
      )}
    </AuthShell>
  )
}
