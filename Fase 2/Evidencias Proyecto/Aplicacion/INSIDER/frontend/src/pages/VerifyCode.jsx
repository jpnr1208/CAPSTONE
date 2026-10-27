import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import { Alert, Button } from '../components/ui'
import api, { errorMessage } from '../api/client'

export default function VerifyCode() {
  const navigate = useNavigate()
  const email = sessionStorage.getItem('insider.reset.email')
  const debug = sessionStorage.getItem('insider.reset.debug')
  const [digits, setDigits] = useState(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const refs = useRef([])

  useEffect(() => { if (!email) navigate('/recuperar-password') }, [email, navigate])

  const setDigit = (i, v) => {
    const clean = v.replace(/\D/g, '')
    if (clean.length > 1) { // pegado completo
      const arr = clean.slice(0, 6).split('')
      setDigits([...arr, ...Array(6 - arr.length).fill('')])
      refs.current[Math.min(arr.length, 5)]?.focus()
      return
    }
    const next = [...digits]
    next[i] = clean
    setDigits(next)
    if (clean && i < 5) refs.current[i + 1]?.focus()
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/password-reset/verify/', { email, code: digits.join('') })
      sessionStorage.setItem('insider.reset.token', data.reset_token)
      sessionStorage.removeItem('insider.reset.debug')
      navigate('/nueva-password')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    const { data } = await api.post('/auth/password-reset/request/', { email })
    if (data.debug_code) sessionStorage.setItem('insider.reset.debug', data.debug_code)
    setInfo('Enviamos un nuevo código a tu correo.')
  }

  return (
    <AuthShell title="Código de verificación" subtitle={`Ingresa el código enviado a ${email || 'tu correo'}. Expira en 15 minutos.`}>
      <form onSubmit={submit} className="space-y-5">
        {error && <Alert type="error">{error}</Alert>}
        {info && <Alert type="success">{info}</Alert>}
        {import.meta.env.DEV && debug && <Alert type="warning">Modo desarrollo · código: <strong>{debug}</strong></Alert>}
        <div className="flex justify-between gap-2">
          {digits.map((d, i) => (
            <input key={i} ref={(el) => (refs.current[i] = el)} value={d} inputMode="numeric" maxLength={6}
                   aria-label={`Dígito ${i + 1}`}
                   onChange={(e) => setDigit(i, e.target.value)}
                   onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && refs.current[i - 1]?.focus()}
                   className="input h-14 w-12 text-center text-xl font-bold sm:w-14" />
          ))}
        </div>
        <Button type="submit" loading={loading} disabled={digits.join('').length !== 6} className="w-full py-3">
          <ShieldCheck size={18} /> Validar código
        </Button>
        <div className="flex justify-between text-sm">
          <button type="button" onClick={resend} className="font-medium text-duoc-blue hover:underline">Reenviar código</button>
          <Link to="/login" className="text-slate-500 hover:underline">Cancelar</Link>
        </div>
      </form>
    </AuthShell>
  )
}
