import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, HelpCircle, Mail, Phone, Search, Sparkles } from 'lucide-react'
import api from '../api/client'
import { Card, PageHeader, Spinner } from '../components/ui'

export default function Help() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [openIdx, setOpenIdx] = useState(0)
  const t = useRef(null)

  useEffect(() => {
    clearTimeout(t.current)
    t.current = setTimeout(() => {
      api.get('/help/faq/', { params: q.trim() ? { q } : {} }).then(({ data }) => { setResults(data.results); setOpenIdx(0) }).catch(() => setResults([]))
    }, q ? 350 : 0)
    return () => clearTimeout(t.current)
  }, [q])

  return (
    <>
      <PageHeader icon={HelpCircle} title="Centro de ayuda" subtitle="Encuentra respuestas al instante con el buscador inteligente." />
      <div className="relative mb-6">
        <Search className="absolute left-4 top-4 text-slate-400" size={20} />
        <input className="input h-14 rounded-2xl pl-12 text-base shadow-card" placeholder="Ej: ¿cómo anulo una solicitud?" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <span className="absolute right-4 top-4 flex items-center gap-1 text-xs font-semibold text-duoc-blue"><Sparkles size={14} className="text-duoc-yellow" /> Búsqueda inteligente</span>}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={q ? 'Resultados' : 'Preguntas frecuentes'} bodyClass="p-2">
          {!results ? <Spinner /> : !results.length ? (
            <p className="p-4 text-sm text-slate-500">No encontramos coincidencias. Intenta con otras palabras o <Link to="/solicitudes" className="text-duoc-blue underline">crea una solicitud</Link>.</p>
          ) : (
            <ul>
              {results.map((f, i) => (
                <li key={f.question} className="border-b border-slate-100 last:border-0">
                  <button className="flex w-full items-center justify-between gap-3 px-3 py-4 text-left" onClick={() => setOpenIdx(openIdx === i ? -1 : i)} aria-expanded={openIdx === i}>
                    <span className="font-medium text-duoc-blue">{f.question}</span>
                    <ChevronDown size={18} className={`shrink-0 text-slate-400 transition ${openIdx === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openIdx === i && <p className="px-3 pb-4 text-sm text-slate-600">{f.answer}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="¿Necesitas más ayuda?">
          <ul className="space-y-4 text-sm">
            <li className="flex gap-3"><Mail className="text-duoc-blue" size={18} /> <span>Escríbenos a <strong>insider@duocuc.cl</strong></span></li>
            <li className="flex gap-3"><Phone className="text-duoc-blue" size={18} /> <span>Acércate a la <strong>mesa de ayuda de tu sede</strong>.</span></li>
          </ul>
          <Link to="/solicitudes" className="btn-accent mt-6 w-full">Crear una solicitud</Link>
        </Card>
      </div>
    </>
  )
}
