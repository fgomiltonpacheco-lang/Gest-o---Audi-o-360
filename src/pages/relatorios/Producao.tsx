import React, { useMemo, useState } from 'react'
import {
  BarChart3,
  ClipboardList,
  Stethoscope,
  ShoppingCart,
  Building2,
  Ear,
  Percent,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { formatCurrency } from '@/lib/formatters'
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

export default function RelatorioProducao() {
  const { appointments, audiometries, tympanometries, beras, sales, vendasB2B, currentUser } =
    useApp()

  const isAdmin = currentUser?.role === 'admin'
  const [period, setPeriod] = useState<Period>(() => thisMonthRange())
  const [profFilter, setProfFilter] = useState<string>(isAdmin ? 'all' : currentUser?.name || 'all')

  const profs = useMemo(
    () => professionalOptions(appointments, vendasB2B),
    [appointments, vendasB2B],
  )

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

  // Mapa appointmentId -> professionalName (para atribuir vendas diretas)
  const apptProf = useMemo(() => {
    const m: Record<string, string> = {}
    appointments.forEach((a) => (m[a.id] = a.professionalName))
    return m
  }, [appointments])

  const profNameForSale = (s: { appointmentId?: string }): string => {
    if (s.appointmentId && apptProf[s.appointmentId]) return apptProf[s.appointmentId]
    return 'Não vinculado'
  }

  type ProfRow = {
    profissional: string
    atendimentos: number
    exames: number
    vendasDiretas: number
    vendasB2B: number
    testes: number
    conversao: number
  }

  const rows: ProfRow[] = useMemo(() => {
    const map: Record<string, ProfRow> = {}

    const ensure = (name: string) => {
      if (!map[name]) {
        map[name] = {
          profissional: name,
          atendimentos: 0,
          exames: 0,
          vendasDiretas: 0,
          vendasB2B: 0,
          testes: 0,
          conversao: 0,
        }
      }
      return map[name]
    }

    // Atendimentos realizados
    appointments
      .filter((a) => a.status === 'Realizado' && inDateRange(a.date, period.from, period.to))
      .forEach((a) => {
        const r = ensure(a.professionalName || '—')
        r.atendimentos += 1
        if (/teste|aparelho/i.test(a.type || '')) r.testes += 1
      })

    // Exames realizizados
    const countExam = (prof: string, date: string) => {
      if (!inDateRange(date, period.from, period.to)) return
      ensure(prof || '—').exames += 1
    }
    audiometries.forEach((e) => countExam(e.professionalName, e.date))
    tympanometries.forEach((e) => countExam(e.professionalName, e.date))
    beras.forEach((e) => countExam(e.professionalName, e.date))

    // Vendas diretas (PDV/atendimento)
    sales
      .filter(
        (s) =>
          s.status !== 'Cancelado' &&
          s.status !== 'Estornado' &&
          inDateRange(s.date, period.from, period.to),
      )
      .forEach((s) => {
        ensure(profNameForSale(s)).vendasDiretas += 1
      })

    // Vendas B2B
    vendasB2B
      .filter((v) => v.status !== 'cancelada' && inDateRange(v.data_venda, period.from, period.to))
      .forEach((v) => {
        ensure(v.especialista_nome || '—').vendasB2B += 1
      })

    // Conversão
    Object.values(map).forEach((r) => {
      r.conversao = r.testes > 0 ? ((r.vendasDiretas + r.vendasB2B) / r.testes) * 100 : 0
    })

    let arr = Object.values(map)
    if (!isAdmin) {
      arr = arr.filter((r) => r.profissional === (currentUser?.name || ''))
    } else if (profFilter !== 'all') {
      arr = arr.filter((r) => r.profissional === profFilter)
    }
    return arr.sort((a, b) => b.atendimentos - a.atendimentos)
  }, [
    appointments,
    audiometries,
    tympanometries,
    beras,
    sales,
    vendasB2B,
    period,
    profFilter,
    isAdmin,
    currentUser,
    apptProf,
  ])

  // Cards totais
  const totais = useMemo(
    () => ({
      atendimentos: rows.reduce((a, r) => a + r.atendimentos, 0),
      exames: rows.reduce((a, r) => a + r.exames, 0),
      vendasDiretas: rows.reduce((a, r) => a + r.vendasDiretas, 0),
      vendasB2B: rows.reduce((a, r) => a + r.vendasB2B, 0),
      testes: rows.reduce((a, r) => a + r.testes, 0),
    }),
    [rows],
  )

  const hasFilters = profFilter !== 'all'
  const clearFilters = () => setProfFilter('all')

  const handleExport = () => {
    if (!rows.length) return
    downloadCSV(
      'relatorio-producao-profissional',
      rows.map((r) => ({
        Profissional: r.profissional,
        Atendimentos: r.atendimentos,
        Exames: r.exames,
        'Vendas Diretas': r.vendasDiretas,
        'Vendas B2B': r.vendasB2B,
        Testes: r.testes,
        'Conversão %': r.conversao.toFixed(1).replace('.', ','),
      })),
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      <ReportHeader
        title="Produção por Profissional"
        description="Atendimentos, exames, vendas e testes realizados por profissional"
        icon={BarChart3}
        onExport={handleExport}
        exportDisabled={!rows.length}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard
          label="Atendimentos"
          value={String(totais.atendimentos)}
          icon={ClipboardList}
          tone="blue"
        />
        <SummaryCard
          label="Exames"
          value={String(totais.exames)}
          icon={Stethoscope}
          tone="purple"
        />
        <SummaryCard
          label="Vendas (PDV)"
          value={String(totais.vendasDiretas)}
          icon={ShoppingCart}
          tone="green"
        />
        <SummaryCard
          label="Vendas B2B"
          value={String(totais.vendasB2B)}
          icon={Building2}
          tone="amber"
        />
        <SummaryCard
          label="Testes c/ Aparelho"
          value={String(totais.testes)}
          icon={Ear}
          tone="slate"
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
        extra={
          isAdmin ? (
            <ProfessionalSelect value={profFilter} onChange={setProfFilter} options={profs} />
          ) : undefined
        }
      />

      <ChartCard title="Comparativo entre profissionais" subtitle="Atendimentos × Exames × Vendas">
        {rows.length === 0 ? (
          <EmptyState message="Sem dados no período." icon={BarChart3} />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={rows} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="profissional" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={40} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="atendimentos"
                name="Atendimentos"
                fill="#0F2B5C"
                radius={[4, 4, 0, 0]}
              />
              <Bar dataKey="exames" name="Exames" fill="#00A6A6" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="vendasDiretas"
                name="Vendas Diretas"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
              <Bar dataKey="vendasB2B" name="Vendas B2B" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase">Profissional</TableHead>
                <TableHead className="text-xs uppercase text-right">Atendimentos</TableHead>
                <TableHead className="text-xs uppercase text-right">Exames</TableHead>
                <TableHead className="text-xs uppercase text-right">Vendas Diretas</TableHead>
                <TableHead className="text-xs uppercase text-right">Vendas B2B</TableHead>
                <TableHead className="text-xs uppercase text-right">Testes</TableHead>
                <TableHead className="text-xs uppercase text-right">Conversão %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      message="Nenhum profissional com produção no período."
                      icon={Percent}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.profissional} className="hover:bg-slate-50/60">
                    <TableCell className="font-semibold text-slate-800">{r.profissional}</TableCell>
                    <TableCell className="text-right">{r.atendimentos}</TableCell>
                    <TableCell className="text-right">{r.exames}</TableCell>
                    <TableCell className="text-right">{r.vendasDiretas}</TableCell>
                    <TableCell className="text-right">{r.vendasB2B}</TableCell>
                    <TableCell className="text-right">{r.testes}</TableCell>
                    <TableCell className="text-right font-semibold text-blue-700">
                      {r.conversao.toFixed(1).replace('.', ',')}%
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
