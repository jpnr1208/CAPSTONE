import { useState } from 'react'
import { KeyRound, Save, User } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import { Alert, Button, Card, Field, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../utils/constants'
import { PasswordChecklist, passwordRules } from './NewPassword'

export default function Account() {
  const { user, setUser } = useAuth()
  const [profile, setProfile] = useState({ first_name: user.first_name, last_name: user.last_name })
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm: '' })
  const [msg, setMsg] = useState(null)
  const [pmsg, setPmsg] = useState(null)
  const [busy, setBusy] = useState('')

  const saveProfile = async (e) => {
    e.preventDefault(); setBusy('p'); setMsg(null)
    try { const { data } = await api.patch('/auth/me/', profile); setUser(data); setMsg({ type: 'success', text: 'Datos actualizados.' }) }
    catch (err) { setMsg({ type: 'error', text: errorMessage(err) }) } finally { setBusy('') }
  }

  const changePwd = async (e) => {
    e.preventDefault(); setBusy('c'); setPmsg(null)
    try {
      await api.post('/auth/change-password/', { current_password: pwd.current_password, new_password: pwd.new_password })
      setPwd({ current_password: '', new_password: '', confirm: '' })
      setPmsg({ type: 'success', text: 'Contraseña actualizada correctamente.' })
    } catch (err) { setPmsg({ type: 'error', text: errorMessage(err) }) } finally { setBusy('') }
  }

  const validPwd = passwordRules(pwd.new_password).every((r) => r.ok) && pwd.new_password === pwd.confirm && pwd.current_password

  return (
    <>
      <PageHeader icon={User} title="Mi cuenta" subtitle="Perfil institucional y seguridad." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-duoc-blue text-2xl font-bold text-duoc-yellow">
              {user.first_name?.[0]}{user.last_name?.[0]}
            </div>
            <p className="mt-3 text-lg font-semibold text-duoc-blue">{user.full_name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
            <span className="mt-2 rounded-full bg-duoc-yellow px-3 py-0.5 text-xs font-bold text-duoc-blue">{user.role_label}</span>
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            {[['RUT', user.rut], ['Carrera / Área', user.career], ['Sede', user.campus], ['Estado', user.status],
              ['Miembro desde', fmtDate(user.created_at)], ['Último acceso', fmtDate(user.last_login, true)]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-2"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v || '—'}</dd></div>
            ))}
          </dl>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card title="Datos personales" subtitle="RUT, carrera y sede son administrados por Registro Académico.">
            <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
              {msg && <div className="sm:col-span-2"><Alert type={msg.type}>{msg.text}</Alert></div>}
              <Field label="Nombres"><input className="input" value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} /></Field>
              <Field label="Apellidos"><input className="input" value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} /></Field>
              <Field label="Correo institucional"><input className="input" value={user.email} disabled /></Field>
              <Field label="RUT"><input className="input" value={user.rut || ''} disabled /></Field>
              <div className="sm:col-span-2"><Button type="submit" loading={busy === 'p'}><Save size={16} /> Guardar cambios</Button></div>
            </form>
          </Card>
          <Card title="Cambiar contraseña">
            <form onSubmit={changePwd} className="grid gap-4 sm:grid-cols-2">
              {pmsg && <div className="sm:col-span-2"><Alert type={pmsg.type}>{pmsg.text}</Alert></div>}
              <div className="sm:col-span-2"><Field label="Contraseña actual"><input type="password" className="input" autoComplete="current-password" value={pwd.current_password} onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })} /></Field></div>
              <Field label="Nueva contraseña"><input type="password" className="input" autoComplete="new-password" value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} /><PasswordChecklist value={pwd.new_password} /></Field>
              <Field label="Confirmar" error={pwd.confirm && pwd.confirm !== pwd.new_password ? 'No coincide' : ''}><input type="password" className="input" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Button type="submit" loading={busy === 'c'} disabled={!validPwd}><KeyRound size={16} /> Actualizar contraseña</Button></div>
            </form>
          </Card>
        </div>
      </div>
    </>
  )
}
