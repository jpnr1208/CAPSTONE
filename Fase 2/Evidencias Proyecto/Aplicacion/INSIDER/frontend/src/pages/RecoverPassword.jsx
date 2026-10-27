import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import { Alert, Button, Field } from '../components/ui'
import api, { errorMessage } from '../api/client'

export default function RecoverPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/password-reset/request/', { email: email.trim().toLowerCase() })
      sessionStorage.setItem('insider.reset.email', email.trim().toLowerCase())
      if (data.debug_code) sessionStorage.setItem('insider.reset.debug', data.debug_code)
      navigate('/codigo-verificacion')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Recuperar contraseña" subtitle="Te enviaremos un código de verificación de 6 dígitos a tu correo institucional.">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        <Field label="Correo institucional" required>
          <input className="input" type="email" required placeholder="nombre@duocuc.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" loading={loading} className="w-full py-3"><Send size={18} /> Enviar código</Button>
        <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-duoc-blue hover:underline">
          <ArrowLeft size={16} /> Volver al inicio de sesión
        </Link>
      </form>
    </AuthShell>
  )
}
