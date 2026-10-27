import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card, EmptyState } from '../../components/ui'
import { CHART_COLORS, statusLabel } from '../../utils/constants'

const label = (k) => statusLabel(k)

export function BarBlock({ title, data = [], dataKey = 'total', horizontal, height = 260, color = '#002855', fmt }) {
  const rows = data.map((d) => ({ ...d, name: label(d.key ?? d.month) }))
  return (
    <Card title={title}>
      {!rows.length ? <EmptyState title="Sin datos" /> : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={rows} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ left: horizontal ? 40 : 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            {horizontal ? <><XAxis type="number" allowDecimals={false} tickFormatter={fmt} /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} /></>
              : <><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tickFormatter={fmt} /></>}
            <Tooltip formatter={fmt ? (v) => fmt(v) : undefined} />
            <Bar dataKey={dataKey} fill={color} radius={[6, 6, 6, 6]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export function PieBlock({ title, data = [], height = 260 }) {
  const rows = data.map((d) => ({ name: label(d.key), value: d.total }))
  return (
    <Card title={title}>
      {!rows.length ? <EmptyState title="Sin datos" /> : (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
              {rows.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export function LineBlock({ title, series = [], height = 260 }) {
  // series: [{ name, data: [{month,total}] }]
  const months = [...new Set(series.flatMap((s) => s.data.map((d) => d.month)))].sort()
  const rows = months.map((m) => Object.fromEntries([['month', m], ...series.map((s) => [s.name, s.data.find((d) => d.month === m)?.total || 0])]))
  return (
    <Card title={title}>
      {!rows.length ? <EmptyState title="Sin datos" /> : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} />
            <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s, i) => <Line key={s.name} type="monotone" dataKey={s.name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={3} dot={{ r: 4 }} />)}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
