import React, { useMemo, useState } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Receipt, ShoppingBag, Building2 } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { formatCurrency, formatDate } from '@/lib/formatters'
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
  LineChart,
  Line,
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
  prevPeriod,
  inDateRange,
  professionalOptions,
  normalizePaymentMethod,
  PAYMENT_GROUPS,
  growthPct,
  fmtPct,
  downloadCSV,
  ProfessionalSelect,
} from './shared'
import { BarChart3 } from 'lucide-react'

export default function RelatorioFaturamento() {
  const { sales, vendasB2B, appointments, currentUser } = useApp()

  const [period, setPeriod] = useState<Period>(() => thisMonthRange())
  const [pmFilter, setPmFilter] = useState<string>('all')
  const [profFilter, setProfFilter] = useState<string>('all')

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

  // Vendas diretas (PDV/atendimento) ativas no período
  const directSales = useMemo(
    () =>
      sales.filter(
        (s) =>
          s.status !== 'Cancelado' &&
          s.status !== 'Estornado' &&
          inDateRange(s.date, period.from, period.to),
      ),
    [sales, period],
  )

  // Vendas B2B ativas no período
  const b2bSales = useMemo(
    () =>
      vendasB2B.filter(
        (v) => v.status !== 'cancelada' && inDateRange(v.data_venda, period.from, period.to),
      ),
    [vendasB2B, period],
  )

  // Linhas unificadas para tabela/CSV
  type Row = {
    data: string
    venda: string
    cliente: string
    itens: string
    valor: number
    forma: string
    profissional: string
    origem: 'Direta' | 'B2B'
  }
  const rows: Row[] = useMemo(() => {
    const direct: Row[] = directSales.map((s) => ({
      data: s.date,
      venda: `#${s.number} (PDV)`,
      cliente: s.patientName || '—',
      itens: s.itemsDescription || s.items?.map((i) => i.name).join(', ') || '',
      valor: s.totalValue || 0,
      forma: normalizePaymentMethod(s.paymentMethod),
      profissional: currentUser?.name || '—',
      origem: 'Direta',
    }))
    const b2b: Row[] = b2bSales.map((v) => ({
      data: v.data_venda,
      venda: v.numero_venda || 'B2B',
      cliente: v.cliente_empresa_nome || '—',
      itens: v.itens?.map((i) => `${i.produto_nome} x${i.quantidade}`).join(', ') || '',
      valor: v.valor_total || 0,
      forma: 'Boleto',
      profissional: v.especialista_nome || '—',
      origem: 'B2B',
    }))
    return [...direct, ...b2b]
      .filter((r) => (pmFilter === 'all' ? true : r.forma === pmFilter))
      .filter((r) => (profFilter === 'all' ? true : r.profissional === profFilter))
      .sort((a, b) => (a.data < b.data ? 1 : -1))
  }, [directSales, b2bSales, pmFilter, profFilter, currentUser])

  // Cards de resumo
  const receitaTotal = rows.reduce((acc, r) => acc + r.valor, 0)
  const ticketMedio = rows.length ? receitaTotal / rows.length : 0
  const receitaB2B = rows.filter((r) => r.origem === 'B2B').reduce((a, r) => a + r.valor, 0)
  const receitaDireta = receitaTotal - receitaB2B
  const porForma = PAYMENT_GROUPS.map((g) => ({
    forma: g,
    valor: rows.filter((r) => r.forma === g).reduce((a, r) => a + r.valor, 0),
  }))

  // Faturamento diário
  const dailyMap: Record<string, number> = {}
  rows.forEach((r) => {
    dailyMap[r.data] = (dailyMap[r.data] || 0) + r.valor
  })
  const dailyData = Object.keys(dailyMap)
    .sort()
    .map((d) => ({ data: formatDate(d), valor: dailyMap[d] }))

  // Comparativo com período anterior
  const prev = prevPeriod(period)
  const prevRows = useMemo(() => {
    const ds = sales.filter(
      (s) =>
        s.status !== 'Cancelado' &&
        s.status !== 'Estornado' &&
        inDateRange(s.date, prev.from, prev.to),
    )
    const bs = vendasB2B.filter(
      (v) => v.status !== 'cancelada' && inDateRange(v.data_venda, prev.from, prev.to),
    )
    let total = 0
    ds.forEach((s) => (total += s.totalValue || 0))
    bs.forEach((v) => (total += v.valor_total || 0))
    return total
  }, [sales, vendasB2B, prev])
  const g = growthPct(receitaTotal, prevRows)

  const hasFilters = pmFilter !== 'all' || profFilter !== 'all'
  const clearFilters = () => {
    setPmFilter('all')
    setProfFilter('all')
  }

  const handleExport = () => {
    if (!rows.length) return
    downloadCSV(
      'relatorio-faturamento',
      rows.map((r) => ({
        Data: r.data,
        Venda: r.venda,
        Cliente: r.cliente,
        Itens: r.itens,
        'Valor Total': r.valor.toFixed(2),
        'Forma de Pagamento': r.forma,
        Profissional: r.profissional,
        Origem: r.origem,
      })),
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      <ReportHeader
        title="Relatório de Faturamento"
        description="Receita total, por forma de pagamento e comparação com período anterior"
        icon={DollarSign}
        onExport={handleExport}
        exportDisabled={!rows.length}
      />

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Receita Total"
          value={formatCurrency(receitaTotal)}
          hint={`Período: ${formatDate(period.from)} a ${formatDate(period.to)}`}
          icon={DollarSign}
          tone="blue"
        />
        <SummaryCard
          label="Ticket Médio"
          value={formatCurrency(ticketMedio)}
          hint={`${rows.length} venda(s)`}
          icon={Receipt}
          tone="purple"
        />
        <SummaryCard
          label="Receita Direta"
          value={formatCurrency(receitaDireta)}
          hint="PDV / Atendimento"
          icon={ShoppingBag}
          tone="green"
        />
        <SummaryCard
          label="Receita B2B"
          value={formatCurrency(receitaB2B)}
          hint="Empresas parceiras"
          icon={Building2}
          tone="amber"
        />
      </div>

      {/* Comparativo período anterior */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        {g === null ? (
          <TrendingUp className="w-5 h-5 text-slate-400" />
        ) : g >= 0 ? (
          <TrendingUp className="w-5 h-5 text-emerald-600" />
        ) : (
          <TrendingDown className="w-5 h-5 text-red-600" />
        )}
        <div className="text-sm">
          <span className="font-semibold text-slate-700">Comparativo período anterior:</span>{' '}
          <span className="text-slate-500">
            {formatCurrency(prevRows)} (anterior) → {formatCurrency(receitaTotal)} (atual)
          </span>{' '}
          <span
            className={`font-bold ${g === null ? 'text-slate-400' : g >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {g === null ? '—' : fmtPct(g)}
          </span>
        </div>
      </div>

      {/* Receita por forma de pagamento */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {porForma.map((p) => (
          <div key={p.forma} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 uppercase">{p.forma}</p>
            <p className="text-base font-bold text-slate-900 mt-1">{formatCurrency(p.valor)}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <PeriodFilterBar
        from={period.from}
        to={period.to}
        onFrom={(v) => setPeriod((p) => ({ ...p, from: v }))}
        onTo={(v) => setPeriod((p) => ({ ...p, to: v }))}
        onShortcut={setShortcut}
        hasFilters={hasFilters}
        onClear={clearFilters}
        extra={
          <>
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Forma de Pagamento</label>
              <select
                value={pmFilter}
                onChange={(e) => setPmFilter(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 text-sm px-2 bg-white"
              >
                <option value="all">Todas</option>
                {PAYMENT_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <ProfessionalSelect value={profFilter} onChange={setProfFilter} options={profs} />
          </>
        }
      />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Faturamento diário" subtitle="Receita por dia no período">
          {dailyData.length === 0 ? (
            <EmptyState message="Sem dados no período." icon={BarChart3} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="#0F2B5C"
                  strokeWidth={2}
                  name="Receita"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Faturamento por forma de pagamento" subtitle="Barras por categoria">
          {porForma.every((p) => p.valor === 0) ? (
            <EmptyState message="Sem dados no período." icon={BarChart3} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porForma} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="forma" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="valor" name="Receita" fill="#00A6A6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs uppercase">Data</TableHead>
                <TableHead className="text-xs uppercase">Venda</TableHead>
                <TableHead className="text-xs uppercase">Cliente</TableHead>
                <TableHead className="text-xs uppercase">Itens</TableHead>
                <TableHead className="text-xs uppercase text-right">Valor Total</TableHead>
                <TableHead className="text-xs uppercase">Forma de Pagamento</TableHead>
                <TableHead className="text-xs uppercase">Profissional</TableHead>
                <TableHead className="text-xs uppercase">Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState message="Nenhuma venda no período selecionado." icon={BarChart3} />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={i} className="hover:bg-slate-50/60">
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {formatDate(r.data)}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-800">{r.venda}</TableCell>
                    <TableCell className="text-slate-700 max-w-[200px] truncate">
                      {r.cliente}
                    </TableCell>
                    <TableCell className="text-slate-600 max-w-[260px] truncate">
                      {r.itens || '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      {formatCurrency(r.valor)}
                    </TableCell>
                    <TableCell className="text-slate-600">{r.forma}</TableCell>
                    <TableCell className="text-slate-600">{r.profissional}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.origem === 'B2B'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {r.origem}
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
