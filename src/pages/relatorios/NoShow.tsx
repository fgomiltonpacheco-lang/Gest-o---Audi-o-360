import React, { useMemo, useState } from 'react'
import { CalendarX, Users, UserCheck, Percent, Calendar } from 'lucide-react'
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
  ChartCard,
  PeriodFilterBar,
  EmptyState,
  type Period,
  thisMonthRange,
  last30Range,
  inDateRange,
  professionalOptions,
  downloadCSV,
  ProfessionalSelect,
} from './shared'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function RelatorioNoShow() {
  const { appointments } = useApp()
  const [period, setPeriod] = useState<Period>(() => thisMonthRange())
  const [profFilter, setProfFilter] = useState<string>('all')

  const profs = useMemo(() => professionalOptions(appointments), [appointments])

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

  // Agendamentos no período (exceto cancelados pelo paciente — contam apenas os que marcaram)
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

  // No-show por dia da semana
  const porDiaSemana = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    appts.forEach((a) => {
      if (a.status === 'Faltou') {
        const d = new Date(a.date + 'T00:00:00')
        counts[d.getDay()] += 1
      }
    })
    return WEEKDAYS.map((nome, i) => ({ dia: nome, faltas: counts[i] }))
  }, [appts])

  // No-show ao longo do tempo (por dia)
  const porDia = useMemo(() => {
    const m: Record<string, number> = {}
    appts.forEach((a) => {
      if (a.status === 'Faltou') m[a.date] = (m[a.date] || 0) + 1
    })
    return Object.keys(m)
      .sort()
      .map((d) => ({ data: formatDate(d), faltas: m[d] }))
  }, [appts])

  const rows = useMemo(
    () =>
      appts
        .filter((a) => a.status === 'Faltou')
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((a) => ({
          data: a.date,
          paciente: a.patientName,
          horario: a.time,
          procedimento: a.type,
          status: 'Faltou',
        })),
    [appts],
  )

  const hasFilters = profFilter !== 'all'
  const clearFilters = () => setProfFilter('all')

  const handleExport = () => {
    if (!rows.length) return
    downloadCSV(
      'relatorio-no-show',
      rows.map((r) => ({
        Data: r.data,
        Paciente: r.paciente,
        Horário: r.horario,
        Procedimento: r.procedimento,
        Status: r.status,
      })),
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
        <SummaryCard label="Não Compareceram" value={String(noShow)} icon={CalendarX} tone="red" />
        <SummaryCard
          label="Taxa de No-Show"
          value={`${taxa.toFixed(1).replace('.', ',')}%`}
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
        onClear={clearFilters}
        extra={<ProfessionalSelect value={profFilter} onChange={setProfFilter} options={profs} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="No-show por dia da semana" subtitle="Distribuição das faltas">
          {porDiaSemana.every((d) => d.faltas === 0) ? (
            <EmptyState message="Sem faltas no período." icon={CalendarX} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porDiaSemana} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} width={30} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="faltas" name="Faltas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="No-show ao longo do tempo" subtitle="Faltas por dia">
          {porDia.length === 0 ? (
            <EmptyState message="Sem faltas no período." icon={CalendarX} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={porDia} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={30} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="faltas"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Faltas"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase">Data</TableHead>
                <TableHead className="text-xs uppercase">Paciente</TableHead>
                <TableHead className="text-xs uppercase">Horário</TableHead>
                <TableHead className="text-xs uppercase">Procedimento</TableHead>
                <TableHead className="text-xs uppercase">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState message="Nenhuma falta registrada no período." icon={Users} />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={i} className="hover:bg-slate-50/60">
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {formatDate(r.data)}
                    </TableCell>
                    <TableCell className="text-slate-700">{r.paciente}</TableCell>
                    <TableCell className="text-slate-600">{r.horario}</TableCell>
                    <TableCell className="text-slate-600">{r.procedimento}</TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                        {r.status}
                      </span>
                    </TableCell>
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
