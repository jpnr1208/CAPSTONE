import { useCallback, useEffect, useState } from 'react'
import { Filter, Inbox, RotateCcw, Search } from 'lucide-react'
import api, { errorMessage } from '../api/client'
import { fmtDate } from '../utils/constants'
import CaseDetailModal from './CaseDetailModal'
import { Alert, Card, EmptyState, Pagination, PriorityBadge, Spinner, StatusBadge } from './ui'

/**
 * CU011 - Bandeja de gestión con búsqueda avanzada y filtros múltiples.
 */
export default function CaseInbox({
  resource, title, subtitle, statuses, statusOptions, extraFilters = [], manage, ai, legal, showPriority, showUser = true,
}) {
  const empty = { search: '', status: '', date_from: '', date_to: '', ordering: '-created_at', ...Object.fromEntries(extraFilters.map((f) => [f.key, ''])) }
  const [filters, setFilters] = useState(empty)
  const [applied, setApplied] = useState(empty)
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = Object.fromEntries(Object.entries({ ...applied, page }).filter(([, v]) => v !== ''))
      const res = await api.get(`/${resource}/`, { params })
      setData(res.data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [resource, applied, page])

  useEffect(() => { load() }, [load])

  const apply = (e) => { e?.preventDefault(); setPage(1); setApplied(filters) }
  const reset = () => { setFilters(empty); setApplied(empty); setPage(1) }
  const onUpdated = (obj) => {
    setSelected(obj)
    setData((d) => ({ ...d, results: d.results.map((r) => (r.id === obj.id ? obj : r)) }))
  }

  return (
    <Card title={title} subtitle={subtitle} bodyClass="p-0">
      <form onSubmit={apply} className="grid gap-3 border-b bg-slate-50/60 p-4 md:grid-cols-6">
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input className="input pl-9" placeholder="Folio, descripción, RUT, correo…" value={filters.search}
                 onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
        <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Todos los estados</option>
          {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {extraFilters.map((f) => (
          <select key={f.key} className="input" value={filters[f.key]} onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}>
            <option value="">{f.label}</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        <input type="date" className="input" title="Desde" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
        <input type="date" className="input" title="Hasta" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
        <select className="input" value={filters.ordering} onChange={(e) => setFilters({ ...filters, ordering: e.target.value })}>
          <option value="-created_at">Más recientes</option>
          <option value="created_at">Más antiguos</option>
          {showPriority && <option value="priority">Prioridad</option>}
          <option value="status">Estado</option>
        </select>
        <div className="flex gap-2 md:col-span-2">
          <button className="btn-primary flex-1" type="submit"><Filter size={16} /> Filtrar</button>
          <button className="btn-outline" type="button" onClick={reset} title="Limpiar"><RotateCcw size={16} /></button>
        </div>
      </form>

      {error && <div className="p-4"><Alert type="error">{error}</Alert></div>}
      {loading ? <Spinner /> : !data.results.length ? (
        <EmptyState icon={Inbox} title="Sin resultados" text="No hay casos que coincidan con los filtros aplicados." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">Folio</th>
                {showUser && <th className="table-th">{legal ? 'Denunciante' : 'Solicitante'}</th>}
                <th className="table-th">{legal ? 'Denunciado/a' : 'Categoría / servicio'}</th>
                {showPriority && <th className="table-th">Prioridad</th>}
                <th className="table-th">Estado</th>
                <th className="table-th">Fecha</th>
                <th className="table-th">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.results.map((r) => (
                <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-duoc-blue-50/50">
                  <td className="table-td font-semibold text-duoc-blue">{r.folio}</td>
                  {showUser && <td className="table-td">{r.user_name || r.complainant_name}</td>}
                  <td className="table-td">
                    {legal ? r.target_name : <>
                      <span className="block">{r.category_label || r.category}</span>
                      {r.service && <span className="text-xs text-slate-500">{r.service}</span>}
                    </>}
                  </td>
                  {showPriority && <td className="table-td"><PriorityBadge priority={r.priority} /></td>}
                  <td className="table-td"><StatusBadge status={r.status} /></td>
                  <td className="table-td whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="table-td">
                    {r.sla_breached
                      ? <span className="text-xs font-semibold text-red-600">{r.hours_open} h ⚠</span>
                      : <span className="text-xs text-emerald-600">{r.hours_open} h</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} count={data.count} onChange={setPage} />

      <CaseDetailModal resource={resource} item={selected} open={!!selected} onClose={() => { setSelected(null); load() }}
                       onUpdated={onUpdated} manage={manage} ai={ai} legal={legal} statusOptions={statusOptions} />
    </Card>
  )
}
