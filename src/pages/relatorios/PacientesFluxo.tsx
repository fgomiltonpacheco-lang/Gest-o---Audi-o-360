import React, { useMemo, useState } from 'react'
import { UserPlus, RotateCw, CalendarDays, Percent, PieChart as PieIcon } from 'lucide-react'
import { useApp } from '@/context/AppContext'
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
  SummaryCardSkeleton,
  ChartCard,
  ChartSkeleton,
  DateRangeFilter,
  EmptyState,
  ReportTable,
  type Period,
  thisMonthRange,
  inDateRange,
  exportToCSVGeneric,
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

type Row = {
  mes: string
  novos: number
  retornos: number
  total: number
  pctNovos: number
}

export default function RelatorioPacientesFluxo() {
  const { appointments, dataLoading } = useApp()
  const [period, setPeriod] = useState<Period>(() => thisMonthRange())

  // Data do primeiro atendimento de cada paciente (data mais antiga).
  const primeiroAtendimento = useMemo(() => {
    const m: Record<string, string> = {}
    appointments.forEach((a) => {
      if (!a.patientId) return
      if (!m[a.patientId] || a.date < m[a.patientId]) m[a.patientId] = a.date
    })
    return m
  }, [appointments])

  // Atendimentos realizados no período (status Realizado) com paciente.
  const atendimentos = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.status === 'Realizado' && inDateRange(a.date, period.from, period.to) && a.patientId,
      ),
    [appointments, period],
  )

  // Paciente é "Novo" quando o primeiro atendimento dele cai dentro do período.
  // É "Retorno" quando já existia atendimento anterior ao período.
  const isNovo = (a: { patientId: string; date: string }) => {
    const first = primeiroAtendimento[a.patientId]
    if (!first) return false
    return first >= period.from && first <= period.to && first === a.date
  }

  const novos = atendimentos.filter(isNovo).length
  const retornos = atendimentos.length - novos
  const pctNovos = atendimentos.length > 0 ? (novos / atendimentos.length) * 100 : 0

  // Meses cobertos pelo período (do primeiro mês do período até o último).
  const meses = useMemo(() => {
    const from = new Date(period.from + 'T00:00:00')
    const to = new Date(period.to + 'T00:00:00')
    const arr: { key: string; label: string }[] = []
    const d = new Date(from.getFullYear(), from.getMonth(), 1)
    while (d <= to) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      arr.push({
        key,
        label: `${MONTH_ABBR[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      })
      d.setMonth(d.getMonth() + 1)
    }
    return arr
  }, [period])

  const rows: Row[] = useMemo(() => {
    const map: Record<string, { novos: number; retornos: number }> = {}
    meses.forEach((m) => (map[m.key] = { novos: 0, retornos: 0 }))
    atendimentos.forEach((a) => {
      const ym = a.date.slice(0, 7)
      if (!map[ym]) return
      if (isNovo(a)) map[ym].novos += 1
      else map[ym].retornos += 1
    })
    return meses.map((m) => {
      const total = map[m.key].novos + map[m.key].retornos
      const pct = total > 0 ? (map[m.key].novos / total) * 100 : 0
      return {
        mes: m.label,
        novos: map[m.key].novos,
        retornos: map[m.key].retornos,
        total,
        pctNovos: Number(pct.toFixed(1)),
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meses, atendimentos, primeiroAtendimento, period])

  const pieData = [
    { name: 'Novos', value: novos, fill: '#00A6A6' },
    { name: 'Retornos', value: retornos, fill: '#0F2B5C' },
  ]

  const handleExport = () => {
    if (!rows.length) return
    exportToCSVGeneric(
      'relatorio-pacientes-fluxo',
      [
        { header: 'Mês', accessor: (r) => r.mes },
        { header: 'Novos', accessor: (r) => r.novos },
        { header: 'Retornos', accessor: (r) => r.retornos },
        { header: 'Total', accessor: (r) => r.total },
        { header: '% Novos', accessor: (r) => r.pctNovos.toFixed(1).replace('.', ',') },
      ],
      rows,
    )
  }

  const loading = dataLoading

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      <ReportHeader
        title="Pacientes Novos vs. Retornos"
        description="Distribuição de atendimentos entre pacientes novos e retornos"
        icon={UserPlus}
        onExport={handleExport}
        exportDisabled={!rows.length}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SummaryCardSkeleton key={i} />)
        ) : (
          <>
            <SummaryCard
              label="Pacientes Novos"
              value={String(novos)}
              icon={UserPlus}
              tone="blue"
            />
            <SummaryCard label="Retornos" value={String(retornos)} icon={RotateCw} tone="purple" />
            <SummaryCard
              label="Total de Atendimentos"
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
          </>
        )}
      </div>

      <DateRangeFilter period={period} onChange={setPeriod} />

      {loading ? (
        <>
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
        </>
      ) : atendimentos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <EmptyState message="Nenhum dado encontrado no período selecionado." icon={UserPlus} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Novos vs. Retornos por mês" subtitle="Barras empilhadas">
              {rows.every((m) => m.total === 0) ? (
                <EmptyState message="Sem atendimentos no período." icon={UserPlus} />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={rows} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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

            <ChartCard title="Distribuição Novos vs. Retornos" subtitle="Pizza do período total">
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

          <ReportTable
            emptyIcon={UserPlus}
            emptyMessage="Nenhum dado encontrado no período selecionado."
            rows={rows}
            columns={[
              {
                header: 'Mês',
                render: (r) => <span className="font-semibold text-slate-800">{r.mes}</span>,
                csv: (r) => r.mes,
                total: () => 'Total',
                className: 'text-slate-800',
              },
              {
                header: 'Novos',
                className: 'text-right',
                render: (r) => <span className="block text-right text-teal-700">{r.novos}</span>,
                csv: (r) => r.novos,
                total: (rs) => (
                  <span className="block text-right">{rs.reduce((a, x) => a + x.novos, 0)}</span>
                ),
              },
              {
                header: 'Retornos',
                className: 'text-right',
                render: (r) => <span className="block text-right text-blue-700">{r.retornos}</span>,
                csv: (r) => r.retornos,
                total: (rs) => (
                  <span className="block text-right">{rs.reduce((a, x) => a + x.retornos, 0)}</span>
                ),
              },
              {
                header: 'Total',
                className: 'text-right',
                render: (r) => <span className="block text-right font-bold">{r.total}</span>,
                csv: (r) => r.total,
                total: (rs) => (
                  <span className="block text-right">{rs.reduce((a, x) => a + x.total, 0)}</span>
                ),
              },
              {
                header: '% Novos',
                className: 'text-right',
                render: (r) => (
                  <span className="block text-right font-semibold text-amber-700">
                    {r.pctNovos.toFixed(1).replace('.', ',')}%
                  </span>
                ),
                csv: (r) => r.pctNovos.toFixed(1).replace('.', ','),
                total: () => (
                  <span className="block text-right">{pctNovos.toFixed(1).replace('.', ',')}%</span>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  )
}
