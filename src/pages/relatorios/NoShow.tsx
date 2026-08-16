import React, { useMemo, useState } from 'react'
import { CalendarX, Calendar, UserCheck, UserX, Percent, TrendingDown } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { formatDate } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
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
  ProfessionalSelect,
  EmptyState,
  ReportTable,
  type Period,
  thisMonthRange,
  inDateRange,
  professionalOptions,
  exportToCSVGeneric,
} from './shared'

// Dias da semana começando na segunda (ordem Seg-Dom).
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
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

/** Monday-first index (0=Seg ... 6=Dom) a partir de um Date. */
function mondayIndex(d: Date): number {
  const js = d.getDay() // 0=Dom ... 6=Sáb
  return (js + 6) % 7
}

type Row = {
  data: string
  paciente: string
  horario: string
  procedimento: string
  profissional: string
  status: string
}

export default function RelatorioNoShow() {
  const { appointments, dataLoading } = useApp()
  const [period, setPeriod] = useState<Period>(() => thisMonthRange())
  const [profFilter, setProfFilter] = useState<string>('all')

  const profs = useMemo(() => professionalOptions(appointments), [appointments])

  // Agendamentos no período (exclui cancelados — não contam para a taxa).
  const appts = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.status !== 'Cancelado' &&
          inDateRange(a.date, period.from, period.to) &&
          (profFilter === 'all' || a.professionalName === profFilter),
      ),
    [appointments, period, profFilter],
  )

  const compareceram = appts.filter(
    (a) =>
      a.status === 'Realizado' ||
      a.status === 'Confirmado' ||
      a.reception === 'presente' ||
      a.reception === 'atendendo',
  ).length
  const noShow = appts.filter((a) => a.status === 'Faltou').length
  const taxa = appts.length > 0 ? (noShow / appts.length) * 100 : 0

  // No-show por dia da semana (compareceram x faltaram)
  const porDiaSemana = useMemo(() => {
    const comp = [0, 0, 0, 0, 0, 0, 0]
    const falta = [0, 0, 0, 0, 0, 0, 0]
    appts.forEach((a) => {
      const d = new Date(a.date + 'T00:00:00')
      const idx = mondayIndex(d)
      if (a.status === 'Faltou') falta[idx] += 1
      else if (
        a.status === 'Realizado' ||
        a.status === 'Confirmado' ||
        a.reception === 'presente' ||
        a.reception === 'atendendo'
      )
        comp[idx] += 1
    })
    return WEEKDAYS.map((dia, i) => ({ dia, compareceram: comp[i], faltaram: falta[i] }))
  }, [appts])

  // Evolução da taxa de no-show ao longo do tempo (por mês)
  const porMes = useMemo(() => {
    const map: Record<string, { total: number; faltas: number }> = {}
    appts.forEach((a) => {
      const ym = a.date.slice(0, 7)
      if (!map[ym]) map[ym] = { total: 0, faltas: 0 }
      map[ym].total += 1
      if (a.status === 'Faltou') map[ym].faltas += 1
    })
    return Object.keys(map)
      .sort()
      .map((ym) => {
        const m = Number(ym.slice(5, 7)) - 1
        const label = `${MONTH_ABBR[m]}/${ym.slice(2)}`
        const taxaMes = map[ym].total > 0 ? (map[ym].faltas / map[ym].total) * 100 : 0
        return { mes: label, taxa: Number(taxaMes.toFixed(1)) }
      })
  }, [appts])

  const rows: Row[] = useMemo(
    () =>
      appts
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.time < b.time ? 1 : -1))
        .map((a) => ({
          data: a.date,
          paciente: a.patientName,
          horario: a.time,
          procedimento: a.type,
          profissional: a.professionalName,
          status: a.status,
        })),
    [appts],
  )

  const hasFilters = profFilter !== 'all'
  const clearFilters = () => setProfFilter('all')

  const handleExport = () => {
    if (!rows.length) return
    exportToCSVGeneric(
      'relatorio-no-show',
      [
        { header: 'Data', accessor: (r) => r.data },
        { header: 'Paciente', accessor: (r) => r.paciente },
        { header: 'Horário', accessor: (r) => r.horario },
        { header: 'Procedimento', accessor: (r) => r.procedimento },
        { header: 'Profissional', accessor: (r) => r.profissional },
        { header: 'Status', accessor: (r) => r.status },
      ],
      rows,
    )
  }

  const loading = dataLoading

  const statusBadge = (s: string) => {
    const cls =
      s === 'Faltou'
        ? 'bg-red-50 text-red-700 border-red-200'
        : s === 'Realizado'
          ? 'bg-green-50 text-green-700 border-green-200'
          : s === 'Confirmado'
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : s === 'Cancelado'
              ? 'bg-slate-100 text-slate-600 border-slate-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
    return (
      <Badge variant="outline" className={cls}>
        {s}
      </Badge>
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      <ReportHeader
        title="No-Show / Faltas"
        description="Acompanhamento de faltas e taxa de não comparecimento"
        icon={CalendarX}
        onExport={handleExport}
        exportDisabled={!rows.length}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SummaryCardSkeleton key={i} />)
        ) : (
          <>
            <SummaryCard
              label="Total de Agendamentos"
              value={String(appts.length)}
              icon={Calendar}
              tone="blue"
            />
            <SummaryCard
              label="Compareceram"
              value={String(compareceram)}
              icon={UserCheck}
              tone="green"
            />
            <SummaryCard label="Não Compareceram" value={String(noShow)} icon={UserX} tone="red" />
            <SummaryCard
              label="Taxa de No-Show"
              value={`${taxa.toFixed(1).replace('.', ',')}%`}
              icon={Percent}
              tone="amber"
            />
          </>
        )}
      </div>

      <DateRangeFilter
        period={period}
        onChange={setPeriod}
        hasFilters={hasFilters}
        onClear={clearFilters}
        extra={<ProfessionalSelect value={profFilter} onChange={setProfFilter} options={profs} />}
      />

      {loading ? (
        <>
          <ChartSkeleton height={260} />
          <ChartSkeleton height={240} />
        </>
      ) : appts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <EmptyState message="Nenhum dado encontrado no período selecionado." icon={CalendarX} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard
              title="Comparecimento por dia da semana"
              subtitle="Verde = compareceram · Vermelho = faltaram"
            >
              {porDiaSemana.every((d) => d.compareceram === 0 && d.faltaram === 0) ? (
                <EmptyState message="Sem agendamentos no período." icon={CalendarX} />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={porDiaSemana} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} width={30} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="compareceram"
                      name="Compareceram"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar dataKey="faltaram" name="Faltaram" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Evolução da taxa de No-Show"
              subtitle="Percentual de faltas ao longo do tempo (mensal)"
            >
              {porMes.length === 0 ? (
                <EmptyState message="Sem dados no período." icon={TrendingDown} />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={porMes} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={40} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Line
                      type="monotone"
                      dataKey="taxa"
                      name="Taxa de No-Show"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <ReportTable
            emptyIcon={CalendarX}
            emptyMessage="Nenhum dado encontrado no período selecionado."
            rows={rows}
            columns={[
              {
                header: 'Data',
                render: (r) => (
                  <span className="text-slate-600 whitespace-nowrap">{formatDate(r.data)}</span>
                ),
                csv: (r) => r.data,
                total: () => 'Total',
                className: 'text-slate-800',
              },
              {
                header: 'Paciente',
                render: (r) => <span className="text-slate-700">{r.paciente}</span>,
                csv: (r) => r.paciente,
              },
              {
                header: 'Horário',
                render: (r) => <span className="text-slate-600">{r.horario}</span>,
                csv: (r) => r.horario,
              },
              {
                header: 'Procedimento',
                render: (r) => <span className="text-slate-600">{r.procedimento}</span>,
                csv: (r) => r.procedimento,
              },
              {
                header: 'Profissional',
                render: (r) => <span className="text-slate-600">{r.profissional}</span>,
                csv: (r) => r.profissional,
              },
              {
                header: 'Status',
                render: (r) => statusBadge(r.status),
                csv: (r) => r.status,
              },
            ]}
          />
        </>
      )}
    </div>
  )
}
