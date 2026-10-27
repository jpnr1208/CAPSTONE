import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Power, Save, Search, Trash2 } from 'lucide-react'
import api, { errorMessage, unwrap } from '../../api/client'
import { Alert, Button, Card, Field, Modal, Pagination, Spinner, StatusBadge } from '../../components/ui'
import { fmtDate } from '../../utils/constants'

/** Administrador TI: usuarios, roles, reglas de automatización y bitácora. */
export default function AdminPanels() {
  const [tab, setTab] = useState('users')
  const tabs = [['users', 'Usuarios'], ['roles', 'Roles y permisos'], ['rules', 'Reglas IA'], ['logs', 'Auditoría']]
  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === k ? 'bg-duoc-blue text-white' : 'bg-white text-duoc-blue shadow-card'}`}>{l}</button>
        ))}
      </div>
      {tab === 'users' && <Users />}
      {tab === 'roles' && <Roles />}
      {tab === 'rules' && <Rules />}
      {tab === 'logs' && <Logs />}
    </div>
  )
}

function Users() {
  const [rows, setRows] = useState([])
  const [roles, setRoles] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await api.get('/admin/users/', { params: { page, ...(search && { search }) } })
    setRows(data.results); setCount(data.count); setLoading(false)
  }, [page, search])
  useEffect(() => { load() }, [load])
  useEffect(() => { api.get('/admin/roles/').then(({ data }) => setRoles(data)) }, [])

  const save = async () => {
    setErr('')
    try {
      const payload = { ...edit }
      if (!payload.password) delete payload.password
      if (edit.id) await api.patch(`/admin/users/${edit.id}/`, payload)
      else await api.post('/admin/users/', payload)
      setEdit(null); load()
    } catch (e) { setErr(errorMessage(e)) }
  }

  return (
    <Card title="Usuarios" bodyClass="p-0" actions={
      <div className="flex gap-2">
        <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input className="input w-52 pl-9" placeholder="Buscar" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} /></div>
        <button className="btn-primary" onClick={() => setEdit({ email: '', first_name: '', last_name: '', rut: '', career: '', campus: '', role: 'ESTUDIANTE', status: 'ACTIVO', is_active: true, password: '' })}><Plus size={16} /> Nuevo</button>
      </div>}>
      {loading ? <Spinner /> : (
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>{['Usuario', 'Rol', 'Sede', 'Estado', 'Último acceso', ''].map((h) => <th key={h} className="table-th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((u) => (
            <tr key={u.id}>
              <td className="table-td"><span className="block font-medium">{u.first_name} {u.last_name}</span><span className="text-xs text-slate-500">{u.email}</span></td>
              <td className="table-td">{roles.find((r) => r.name === u.role)?.label || u.role}</td>
              <td className="table-td">{u.campus}</td>
              <td className="table-td"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.is_active && u.status === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{u.status}</span></td>
              <td className="table-td text-xs">{fmtDate(u.last_login, true)}</td>
              <td className="table-td text-right"><button className="btn-ghost px-2 py-1" onClick={() => setEdit({ ...u, password: '' })}><Pencil size={16} /></button></td>
            </tr>))}
          </tbody></table></div>
      )}
      <Pagination page={page} count={count} onChange={setPage} />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar usuario' : 'Nuevo usuario'}
             footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancelar</button><Button onClick={save}><Save size={16} /> Guardar</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            {err && <div className="sm:col-span-2"><Alert type="error">{err}</Alert></div>}
            {[['email', 'Correo'], ['first_name', 'Nombres'], ['last_name', 'Apellidos'], ['rut', 'RUT'], ['career', 'Carrera / Área'], ['campus', 'Sede']].map(([k, l]) => (
              <Field key={k} label={l}><input className="input" value={edit[k] || ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></Field>
            ))}
            <Field label="Rol"><select className="input" value={edit.role || ''} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{roles.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}</select></Field>
            <Field label="Estado"><select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value, is_active: e.target.value !== 'INACTIVO' })}>
              <option value="ACTIVO">Activo</option><option value="SUSPENDIDO">Suspendido</option><option value="INACTIVO">Inactivo</option></select></Field>
            <div className="sm:col-span-2"><Field label={edit.id ? 'Nueva contraseña (opcional)' : 'Contraseña'} hint="Mínimo 8 caracteres">
              <input type="password" className="input" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field></div>
          </div>
        )}
      </Modal>
    </Card>
  )
}

const ALL_PERMS = ['requests.create', 'requests.view_own', 'requests.manage', 'requests.view_all', 'complaints.create', 'complaints.manage',
  'complaints.view_stats', 'meetings.manage', 'claims.create', 'claims.manage', 'claims.view_all', 'compliments.create', 'compliments.view',
  'financing.view_own', 'financing.manage', 'ai.suggest', 'dashboard.view', 'dashboard.executive', 'users.manage', 'roles.manage', 'rules.manage', 'audit.view']

function Roles() {
  const [roles, setRoles] = useState(null)
  const [msg, setMsg] = useState(null)
  useEffect(() => { api.get('/admin/roles/').then(({ data }) => setRoles(data)) }, [])
  const toggle = (role, perm) => setRoles((rs) => rs.map((r) => r.id !== role.id ? r : {
    ...r, permissions_json: r.permissions_json.includes(perm) ? r.permissions_json.filter((p) => p !== perm) : [...r.permissions_json, perm],
  }))
  const save = async (role) => {
    try { await api.patch(`/admin/roles/${role.id}/`, { permissions_json: role.permissions_json }); setMsg({ type: 'success', text: `Rol ${role.label} actualizado.` }) }
    catch (e) { setMsg({ type: 'error', text: errorMessage(e) }) }
  }
  if (!roles) return <Spinner />
  return (
    <Card title="Matriz RBAC" subtitle="Activa o desactiva permisos por rol" bodyClass="p-0">
      {msg && <div className="p-4"><Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert></div>}
      <div className="overflow-x-auto"><table className="min-w-full text-xs">
        <thead className="bg-slate-50"><tr><th className="table-th">Permiso</th>{roles.map((r) => <th key={r.id} className="table-th text-center">{r.label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {ALL_PERMS.map((p) => (
            <tr key={p}><td className="px-4 py-2 font-mono">{p}</td>
              {roles.map((r) => <td key={r.id} className="text-center"><input type="checkbox" checked={r.permissions_json.includes(p)} onChange={() => toggle(r, p)} /></td>)}
            </tr>
          ))}
          <tr><td />{roles.map((r) => <td key={r.id} className="py-3 text-center"><button className="btn-outline px-2 py-1 text-xs" onClick={() => save(r)}>Guardar</button></td>)}</tr>
        </tbody>
      </table></div>
    </Card>
  )
}

function Rules() {
  const [rules, setRules] = useState(null)
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')
  const load = () => api.get('/ai/rules/', { params: { page_size: 100 } }).then(({ data }) => setRules(unwrap(data)))
  useEffect(() => { load() }, [])
  const save = async () => {
    setErr('')
    try { edit.id ? await api.patch(`/ai/rules/${edit.id}/`, edit) : await api.post('/ai/rules/', edit); setEdit(null); load() }
    catch (e) { setErr(errorMessage(e)) }
  }
  const toggle = async (r) => { await api.patch(`/ai/rules/${r.id}/`, { is_active: !r.is_active }); load() }
  const remove = async (r) => { if (confirm(`¿Eliminar la regla "${r.trigger_keyword}"?`)) { await api.delete(`/ai/rules/${r.id}/`); load() } }
  return (
    <Card title="Reglas de automatización" subtitle="Palabras gatillo → plantilla de respuesta. Variables: {nombre}, {folio}, {servicio}"
          actions={<button className="btn-primary" onClick={() => setEdit({ trigger_keyword: '', service_type: '', auto_response_template: '', is_active: true })}><Plus size={16} /> Nueva regla</button>}>
      {!rules ? <Spinner /> : (
        <ul className="space-y-3">{rules.map((r) => (
          <li key={r.id} className={`rounded-xl border p-4 ${r.is_active ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-60'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-duoc-blue"><code className="rounded bg-duoc-blue-50 px-2 py-0.5">{r.trigger_keyword}</code> <span className="text-sm font-normal text-slate-500">→ {r.service_type || 'cualquier servicio'}</span></p>
              <div className="flex gap-1">
                <button className="btn-ghost px-2 py-1" title="Activar/desactivar" onClick={() => toggle(r)}><Power size={16} className={r.is_active ? 'text-emerald-600' : 'text-slate-400'} /></button>
                <button className="btn-ghost px-2 py-1" onClick={() => setEdit(r)}><Pencil size={16} /></button>
                <button className="btn-ghost px-2 py-1 text-red-600" onClick={() => remove(r)}><Trash2 size={16} /></button>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">{r.auto_response_template}</p>
          </li>))}
        </ul>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar regla' : 'Nueva regla'}
             footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancelar</button><Button onClick={save}>Guardar</Button></>}>
        {edit && (
          <div className="space-y-3">
            {err && <Alert type="error">{err}</Alert>}
            <Field label="Palabra gatillo" required><input className="input" value={edit.trigger_keyword} onChange={(e) => setEdit({ ...edit, trigger_keyword: e.target.value })} /></Field>
            <Field label="Tipo de servicio (opcional)"><input className="input" value={edit.service_type} onChange={(e) => setEdit({ ...edit, service_type: e.target.value })} /></Field>
            <Field label="Plantilla de respuesta" required><textarea className="input min-h-[140px]" value={edit.auto_response_template} onChange={(e) => setEdit({ ...edit, auto_response_template: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> Activa</label>
          </div>
        )}
      </Modal>
    </Card>
  )
}

function Logs() {
  const [rows, setRows] = useState(null)
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [f, setF] = useState({ action: '', date_from: '', date_to: '' })
  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries({ ...f, page }).filter(([, v]) => v))
    api.get('/audit-logs/', { params }).then(({ data }) => { setRows(data.results); setCount(data.count) })
  }, [f, page])
  useEffect(() => { load() }, [load])
  return (
    <Card title="Bitácora de auditoría" bodyClass="p-0" actions={
      <div className="flex flex-wrap gap-2">
        <input className="input w-40" placeholder="Acción" value={f.action} onChange={(e) => { setPage(1); setF({ ...f, action: e.target.value }) }} />
        <input type="date" className="input w-40" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} />
        <input type="date" className="input w-40" value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} />
      </div>}>
      {!rows ? <Spinner /> : (
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>{['Fecha', 'Usuario', 'Acción', 'IP', 'Detalle'].map((h) => <th key={h} className="table-th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((l) => (
            <tr key={l.id}>
              <td className="table-td whitespace-nowrap text-xs">{fmtDate(l.timestamp, true)}</td>
              <td className="table-td text-xs">{l.user_email || <em className="text-slate-400">anónimo / sistema</em>}</td>
              <td className="table-td"><StatusBadge status={l.action} label={l.action} /></td>
              <td className="table-td font-mono text-xs">{l.ip_address || '—'}</td>
              <td className="table-td max-w-xs truncate font-mono text-xs text-slate-500">{JSON.stringify(l.details)}</td>
            </tr>))}
          </tbody></table></div>
      )}
      <Pagination page={page} count={count} onChange={setPage} />
    </Card>
  )
}
