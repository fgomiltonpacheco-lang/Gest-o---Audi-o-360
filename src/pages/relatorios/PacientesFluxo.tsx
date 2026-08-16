import React, { useMemo, useState } from 'react'
import { UserPlus, RotateCw, CalendarDays, Percent, PieChart as PieIcon } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { formatDate } from '@/lib/formatters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import {
  ReportHeader,
  SummaryCard,
  ChartCard,
  PeriodFilterBar,
  EmptyState,
  type Period,
  thisMonthRange,
  last30Range,
  inDateRange,
  downloadCSV,
} from './shared'

const MONTH_ABBR = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

export default function RelatorioPacientesFluxo() {
  const { appointments, patients } = useApp()
  const [period, setPeriod] = useState<Period>(() => last30Range())

  const setShortcut = (s: 'this_month' | 'last_30d' | 'last_month' | 'this_year') => {
    if (s === 'this_month') setPeriod(thisMonthRange())
    else if (s === 'last_30d') setPeriod(last30Range())
    else if (s === 'last_month') {
      const t = new Date()
      setPeriod({
        from: new Date(t.getFullYear(), t.getMonth() - 1, 1).toISOString().split('T')[0],
        to: new Date(t.getFullYear(), t.getMonth(), 0).toISOString().split('T')[0],
      })
    } else {
      const y = new Date().getFullYear()
      setPeriod({ from: `${y}-01-01`, to: `${y}-12-31` })
    }
  }

  // Data do primeiro atendimento de cada paciente = paciente "novo" naquele mês
  const primeiroAtendimento = useMemo(() => {
    const m: Record<string, string> = {}
    appointments.forEach((a) => {
      if (!a.patientId) return
      if (!m[a.patientId] || a.date < m[a.patientId]) m[a.patientId] = a.date
    })
    return m
  }, [appointments])

  // Atendimentos realizados no período
  const atendimentos = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.status === 'Realizado' && inDateRange(a.date, period.from, period.to) && a.patientId,
      ),
    [appointments, period],
  )

  // Classificação novo x retorno
  const novos = atendimentos.filter((a) => primeiroAtendimento[a.patientId] === a.date).length
  const retornos = atendimentos.length - novos
  const pctNovos = atendimentos.length > 0 ? (novos / atendimentos.length) * 100 : 0

  // Por mês (do início do período até hoje, em meses cobertos)
  const meses = useMemo(() => {
    const from = new Date(period.from + 'T00:00:00')
    const to = new Date(period.to + 'T00:00:00')
    const arr: { key: string; label: string }[] = []
    const d = new Date(from.getFullYear(), from.getMonth(), 1)
    while (d <= to) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      arr.push({ key, label: `${MONTH_ABBR[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` })
      d.setMonth(d.getMonth() + 1)
    }
    return arr
  }, [period])

  const porMes = useMemo(() => {
    const map: Record<string, { novos: number; retornos: number }> = {}
    meses.forEach((m) => (map[m.key] = { novos: 0, retornos: 0 }))
    atendimentos.forEach((a) => {
      const ym = a.date.slice(0, 7)
      if (!map[ym]) return
      if (primeiroAtendimento[a.patientId] === a.date) map[ym].novos += 1
      else map[ym].retornos += 1
    })
    return meses.map((m) => ({
      mes: m.label,
      novos: map[m.key].novos,
      retornos: map[m.key].retornos,
      total: map[m.key].novos + map[m.key].retornos,
    }))
  }, [meses, atendimentos, primeiroAtendimento])

  const pieData = [
    { name: 'Novos', value: novos, fill: '#00A6A6' },
    { name: 'Retornos', value: retornos, fill: '#0F2B5C' },
  ]

  const hasFilters = false

  const handleExport = () => {
    if (!porMes.length) return
    downloadCSV(
      'relatorio-pacientes-fluxo',
      porMes.map((r) => ({
        Mês: r.mes,
        Novos: r.novos,
        Retornos: r.retornos,
        Total: r.total,
      })),
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      <ReportHeader
        title="Pacientes Novos vs. Retornos"
        description="Distribuição de atendimentos entre pacientes novos e retornos"
        icon={UserPlus}
        onExport={handleExport}
        exportDisabled={!porMes.length}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Pacientes Novos" value={String(novos)} icon={UserPlus} tone="blue" />
        <SummaryCard label="Retornos" value={String(retornos)} icon={RotateCw} tone="purple" />
        <SummaryCard
          label="Total Atendimentos"
          value={String(atendimentos.length)}
          icon={CalendarDays}
          tone="green"
        />
        <SummaryCard
          label="% Novos"
          value={`${pctNovos.toFixed(1).replace('.', ',')}%`}
          icon={Percent}
          tone="amber"
        />
      </div>

      <PeriodFilterBar
        from={period.from}
        to={period.to}
        onFrom={(v) => setPeriod((p) => ({ ...p, from: v }))}
        onTo={(v) => setPeriod((p) => ({ ...p, to: v }))}
        onShortcut={setShortcut}
        hasFilters={hasFilters}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Novos vs. Retornos por mês" subtitle="Barras empilhadas">
          {porMes.every((m) => m.total === 0) ? (
            <EmptyState message="Sem atendimentos no período." icon={UserPlus} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porMes} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={30} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="novos"
                  name="Novos"
                  stackId="a"
                  fill="#00A6A6"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="retornos"
                  name="Retornos"
                  stackId="a"
                  fill="#0F2B5C"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Distribuição Novos vs. Retornos" subtitle="Pizza">
          {novos + retornos === 0 ? (
            <EmptyState message="Sem atendimentos no período." icon={PieIcon} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase">Mês</TableHead>
                <TableHead className="text-xs uppercase text-right">Novos</TableHead>
                <TableHead className="text-xs uppercase text-right">Retornos</TableHead>
                <TableHead className="text-xs uppercase text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porMes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyState message="Sem dados no período." icon={UserPlus} />
                  </TableCell>
                </TableRow>
              ) : (
                porMes.map((m) => (
                  <TableRow key={m.mes} className="hover:bg-slate-50/60">
                    <TableCell className="font-semibold text-slate-800">{m.mes}</TableCell>
                    <TableCell className="text-right text-teal-700 font-semibold">
                      {m.novos}
                    </TableCell>
                    <TableCell className="text-right text-navy-700 font-semibold">
                      {m.retornos}
                    </TableCell>
                    <TableCell className="text-right font-bold">{m.total}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
