import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, KeyRound, X } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import { Alert, Button, Field } from '../components/ui'
import api, { errorMessage } from '../api/client'

export const passwordRules = (p) => [
  { ok: p.length >= 8, label: 'Mínimo 8 caracteres' },
  { ok: /[A-Z]/.test(p), label: 'Una mayúscula' },
  { ok: /\d/.test(p), label: 'Un número' },
  { ok: /[^A-Za-z0-9]/.test(p), label: 'Un símbolo' },
]

export function PasswordChecklist({ value }) {
  return (
    <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
      {passwordRules(value).map((r) => (
        <li key={r.label} className={`flex items-center gap-1 ${r.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
          {r.ok ? <Check size={14} /> : <X size={14} />} {r.label}
        </li>
      ))}
    </ul>
  )
}

export default function NewPassword() {
  const navigate = useNavigate()
  const token = sessionStorage.getItem('insider.reset.token')
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => { if (!token) navigate('/recuperar-password') }, [token, navigate])

  const valid = passwordRules(pwd).every((r) => r.ok) && pwd === confirm

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/password-reset/confirm/', { reset_token: token, new_password: pwd })
      ;['token', 'email'].forEach((k) => sessionStorage.removeItem(`insider.reset.${k}`))
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Nueva contraseña" subtitle="Define una contraseña segura para tu cuenta institucional.">
      {done ? (
        <Alert type="success">Contraseña restablecida. Redirigiendo al inicio de sesión…</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          <Field label="Nueva contraseña" required>
            <input className="input" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
            <PasswordChecklist value={pwd} />
          </Field>
          <Field label="Confirmar contraseña" required error={confirm && pwd !== confirm ? 'Las contraseñas no coinciden.' : ''}>
            <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" loading={loading} disabled={!valid} className="w-full py-3"><KeyRound size={18} /> Restablecer contraseña</Button>
        </form>
      )}
    </AuthShell>
  )
}
